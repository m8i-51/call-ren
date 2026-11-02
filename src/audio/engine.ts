import { DEFAULT_FLAVOR, redlineFor } from "@/audio/types";
import type { CylinderCount, EngineFlavor } from "@/audio/types";

export type EngineSnapshot = {
  rpm: number;
  throttle: number;
  redline: number;
  limiting: boolean;
  cylinders: CylinderCount;
};

const spectrumScratch: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(128));

export function spectrumBins(): Uint8Array<ArrayBuffer> {
  return spectrumScratch;
}

export class EngineSynth {
  private ctx: AudioContext | null = null;
  private worklet: AudioWorkletNode | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private clickGain: GainNode | null = null;
  private flavor: EngineFlavor = { ...DEFAULT_FLAVOR };
  private volume = 0.8;
  private throttle = 0;
  private rpm = 1000;
  private limiting = false;
  private limiterPhase = 0;
  private cutUntil = 0;
  private lastTime = performance.now();

  setThrottle(value: number): void {
    this.throttle = clamp01(value);
    if (this.ctx?.state === "suspended") {
      void this.ctx.resume();
    }
  }

  setFlavor(flavor: EngineFlavor): void {
    this.flavor = {
      cylinders: flavor.cylinders,
      pipe: flavor.pipe,
      aggression: clamp01(flavor.aggression),
    };
  }

  setVolume(value: number): void {
    this.volume = clamp01(value);
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(this.heardGain(), this.ctx.currentTime, 0.03);
  }

  async start(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state !== "running") await this.ctx.resume();
      return;
    }

    const ctx = new AudioContext();
    void ctx.resume();
    try {
      const moduleUrl = new URL("./engine.worklet.js", import.meta.url);
      await ctx.audioWorklet.addModule(moduleUrl.href);
      const node = new AudioWorkletNode(ctx, "engine-call", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      const master = ctx.createGain();
      master.gain.value = 0;
      const clickGain = ctx.createGain();
      clickGain.gain.value = 1;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -4;
      compressor.knee.value = 2;
      compressor.ratio.value = 1.35;
      compressor.attack.value = 0.001;
      compressor.release.value = 0.06;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.42;

      node.connect(master);
      clickGain.connect(master);
      master.connect(compressor);
      compressor.connect(analyser);
      analyser.connect(ctx.destination);

      this.ctx = ctx;
      this.worklet = node;
      this.master = master;
      this.clickGain = clickGain;
      this.analyser = analyser;
      this.lastTime = performance.now();
      master.gain.setTargetAtTime(this.heardGain(), ctx.currentTime, 0.05);
      this.postParams();
    } catch (error) {
      await ctx.close();
      throw error;
    }
  }

  tick(): void {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.advance(dt);
    this.postParams();
  }

  snapshot(): EngineSnapshot {
    return {
      rpm: this.rpm,
      throttle: this.throttle,
      redline: redlineFor(this.flavor.cylinders),
      limiting: this.limiting,
      cylinders: this.flavor.cylinders,
    };
  }

  currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  readSpectrum(target: Uint8Array<ArrayBuffer>): void {
    this.analyser?.getByteFrequencyData(target);
  }

  playClick(time: number, accent: boolean): void {
    if (!this.ctx || !this.clickGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(accent ? 1480 : 880, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.2 : 0.11, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(gain);
    gain.connect(this.clickGain);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  private heardGain(): number {
    return this.volume * 0.92;
  }

  private advance(dt: number): void {
    const redline = redlineFor(this.flavor.cylinders);
    const nowSec = performance.now() / 1000;
    const hunt =
      Math.sin(nowSec * 3.1) * (36 + this.flavor.aggression * 70) +
      Math.sin(nowSec * 8.4) * this.flavor.aggression * 28;
    const idle = 1180 + hunt;
    const ceiling = redline + 900;
    const target = idle + this.throttle * (ceiling - idle);
    const opening = target > this.rpm;
    const rate = opening ? 11 + this.flavor.aggression * 8 : 2.6;
    this.rpm += (target - this.rpm) * (1 - Math.exp(-rate * dt));
    if (this.rpm < 700) this.rpm = 700;

    const wantsLimit = this.throttle > 0.86 && this.rpm >= redline - 60;
    this.limiting = wantsLimit;
    if (!wantsLimit) {
      this.limiterPhase = 0;
      return;
    }

    this.limiterPhase += dt;
    const period = 0.052 - this.flavor.aggression * 0.018;
    if (this.limiterPhase < period) return;
    this.rpm = redline - (700 + this.flavor.aggression * 520);
    this.limiterPhase = 0;
    const audioNow = this.ctx?.currentTime ?? 0;
    this.cutUntil = audioNow + 0.04 + (1 - this.flavor.aggression) * 0.012;
  }

  private postParams(): void {
    this.worklet?.port.postMessage({
      type: "params",
      rpm: this.rpm,
      throttle: this.throttle,
      cylinders: this.flavor.cylinders,
      straight: this.flavor.pipe === "straight" ? 1 : 0,
      aggression: this.flavor.aggression,
      cutUntil: this.cutUntil,
    });
  }
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
