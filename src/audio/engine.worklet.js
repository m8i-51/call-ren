// Procedural 4-stroke exhaust. One impulse per firing event excites fixed pipe
// resonances; RPM changes the gap between impulses, not a synth pitch sweep.

class Biquad {
  constructor() {
    this.b0 = 1;
    this.b1 = 0;
    this.b2 = 0;
    this.a1 = 0;
    this.a2 = 0;
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }

  setBandpass(freq, q, sampleRate) {
    const w0 = (2 * Math.PI * Math.min(freq, sampleRate * 0.45)) / sampleRate;
    const cos = Math.cos(w0);
    const sin = Math.sin(w0);
    const alpha = sin / (2 * Math.max(0.15, q));
    const b0 = alpha;
    const b2 = -alpha;
    const a0 = 1 + alpha;
    this.b0 = b0 / a0;
    this.b1 = 0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  setLowpass(freq, q, sampleRate) {
    const w0 = (2 * Math.PI * Math.min(freq, sampleRate * 0.45)) / sampleRate;
    const cos = Math.cos(w0);
    const sin = Math.sin(w0);
    const alpha = sin / (2 * Math.max(0.15, q));
    const b1 = 1 - cos;
    const b0 = b1 / 2;
    const a0 = 1 + alpha;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b0 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    if (!Number.isFinite(y)) {
      this.x1 = 0;
      this.x2 = 0;
      this.y1 = 0;
      this.y2 = 0;
      return 0;
    }
    return y;
  }
}

class EngineCallProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRpm = 1000;
    this.rpm = 1000;
    this.targetThrottle = 0;
    this.throttle = 0;
    this.cylinders = 4;
    this.straight = 1;
    this.aggression = 0.86;
    this.cutUntil = 0;
    this.untilFire = 24;
    this.lastPeriod = 800;
    this.lump = false;
    this.env = 0;
    this.knockA = 0;
    this.knockF = 80;
    this.knockP = 0;
    this.subP = 0;
    this.tip = 0;
    this.bark = 0;
    this.barkF = 2200;
    this.barkP = 0;
    this.crackle = 0;
    this.popLeft = 0;
    this.popWait = 0;
    this.popArmed = 0;
    this.prevTarget = 0;
    this.noiseLp = 0;
    this.dcIn = 0;
    this.dcOut = 0;
    this.comb = new Float32Array(1024);
    this.combPos = 0;
    this.combLp = 0;
    this.low = new Biquad();
    this.high = new Biquad();
    this.rasp = new Biquad();
    this.tone = new Biquad();
    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data || data.type !== "params") return;
      this.targetRpm = data.rpm;
      this.targetThrottle = data.throttle;
      this.cylinders = data.cylinders;
      this.straight = data.straight;
      this.aggression = data.aggression;
      this.cutUntil = data.cutUntil;
    };
  }

  updateFilters() {
    const cyl = this.cylinders === 1 ? 0.72 : this.cylinders === 2 ? 0.9 : 1.12;
    const open = 1 + this.throttle * 0.18;
    const straight = this.straight > 0.5;
    const lowFreq = (straight ? 180 : 100) * cyl * open;
    const highFreq = (straight ? 2400 : 520) * open;
    const raspFreq = (straight ? 4300 : 980) * open;
    const lowQ = straight ? 1.15 + this.aggression * 0.55 : 0.42;
    const highQ = straight ? 2.4 + this.aggression * 1.6 : 0.45;
    const raspQ = straight ? 3.2 + this.aggression * 2.2 : 0.5;
    const lowpass = straight ? 9800 : 1600;
    this.low.setBandpass(lowFreq, lowQ, sampleRate);
    this.high.setBandpass(highFreq, highQ, sampleRate);
    this.rasp.setBandpass(raspFreq, raspQ, sampleRate);
    this.tone.setLowpass(lowpass, 0.55, sampleRate);
  }

  scheduleEdge() {
    const rose = this.targetThrottle - this.prevTarget > 0.1;
    const fell = this.prevTarget - this.targetThrottle > 0.1;
    if (rose) {
      this.tip = 1;
      this.bark = 1;
      this.barkF = 1600 + Math.random() * 1400 + this.aggression * 400;
    }
    if (fell && this.rpm > 1800 && this.popArmed === 0) {
      this.popLeft = this.straight > 0.5 ? 9 : 3;
      this.popArmed = 1;
      this.popWait = Math.floor(sampleRate * 0.012);
      this.bark = Math.max(this.bark, 0.8);
    }
    if (this.targetThrottle > 0.55) this.popArmed = 0;
    this.prevTarget = this.targetThrottle;
  }

  process(_inputs, outputs) {
    const channels = outputs[0];
    const out = channels?.[0];
    if (!out) return true;

    this.updateFilters();
    this.scheduleEdge();
    const cutting = currentTime < this.cutUntil;
    const fires = Math.max(0.5, this.cylinders / 2);
    const straight = this.straight > 0.5;
    let decay = straight ? 0.011 : 0.042;
    if (this.cylinders === 1) decay *= 2.1;
    else if (this.cylinders === 2) decay *= 1.35;
    const decayCoef = Math.exp(-1 / (decay * sampleRate));
    const knockCoef = Math.exp(-1 / (0.028 * sampleRate));
    const tipCoef = Math.exp(-1 / (0.032 * sampleRate));
    const barkCoef = Math.exp(-1 / (0.016 * sampleRate));
    const crackCoef = Math.exp(-1 / (0.01 * sampleRate));
    const combDelay = straight ? Math.floor(sampleRate * 0.00215) : Math.floor(sampleRate * 0.0046);
    const combFb = straight ? 0.38 + this.aggression * 0.16 : 0.08;
    const combCut = straight ? 0.55 : 0.22;

    for (let i = 0; i < out.length; i += 1) {
      this.rpm += (this.targetRpm - this.rpm) * 0.002;
      this.throttle += (this.targetThrottle - this.throttle) * 0.02;
      const freq = Math.max(5, (this.rpm / 60) * fires);
      this.untilFire -= 1;

      let impulse = 0;
      if (this.untilFire <= 0) {
        if (!cutting) {
          this.env = 0.85 + Math.random() * 0.55;
          this.knockA = this.cylinders === 1 ? 1.15 : 0.85;
          this.knockF = (this.cylinders === 1 ? 48 : this.cylinders === 2 ? 70 : 120) + this.throttle * 70;
          impulse = 1.35;
          if (straight && this.throttle > 0.2 && Math.random() < 0.18 + this.aggression * 0.28) {
            this.crackle = 0.7 + Math.random() * 0.5;
          }
        }
        let period = sampleRate / freq;
        if (this.cylinders === 2) {
          this.lump = !this.lump;
          period *= this.lump ? 1.36 : 0.68;
        } else if (this.cylinders === 1) {
          period *= 1 + (Math.random() - 0.5) * 0.1 * (1 + this.aggression);
        } else {
          period *= 1 + (Math.random() - 0.5) * 0.045 * (1 + this.aggression);
        }
        if (period < 8) period = 8;
        this.lastPeriod = period;
        this.untilFire += period;
      }

      if (this.popLeft > 0) {
        this.popWait -= 1;
        if (this.popWait <= 0) {
          impulse = Math.max(impulse, 1.2);
          this.env = Math.max(this.env, 0.95);
          this.crackle = Math.max(this.crackle, 0.85);
          this.popLeft -= 1;
          this.popWait = Math.floor(sampleRate * (0.018 + Math.random() * 0.04));
        }
      }

      this.env *= decayCoef;
      const white = Math.random() * 2 - 1;
      const noiseFollow = straight ? 0.72 : 0.18;
      this.noiseLp += (white - this.noiseLp) * noiseFollow;

      let excite = impulse * (0.7 + Math.abs(white)) + this.noiseLp * this.env * (straight ? 1.25 : 0.45);
      if (this.tip > 0.001) {
        excite += white * this.tip * (straight ? 1.35 : 0.35);
        this.tip *= tipCoef;
      }
      if (this.crackle > 0.001) {
        excite += white * this.crackle * (straight ? 1.1 : 0.25);
        this.crackle *= crackCoef;
      }

      const cycle = 1 - this.untilFire / Math.max(8, this.lastPeriod);
      const half = Math.sin(Math.min(1, Math.max(0, cycle)) * Math.PI) * this.env;
      const low = this.low.process(excite);
      const high = this.high.process(excite);
      const hash = this.rasp.process(excite + impulse * white);
      const readAt = (this.combPos - combDelay + 1024) & 1023;
      this.combLp += ((this.comb[readAt] ?? 0) - this.combLp) * combCut;
      const combOut = Math.max(-2, Math.min(2, high * 0.85 + impulse * 0.9 + this.combLp * combFb));
      this.comb[this.combPos] = combOut;
      this.combPos = (this.combPos + 1) & 1023;

      this.knockP += (2 * Math.PI * this.knockF) / sampleRate;
      if (this.knockP > Math.PI * 2) this.knockP -= Math.PI * 2;
      this.knockA *= knockCoef;
      this.knockF *= 0.9992;
      const knock = Math.sin(this.knockP) * this.knockA;
      this.barkP += (2 * Math.PI * this.barkF) / sampleRate;
      if (this.barkP > Math.PI * 2) this.barkP -= Math.PI * 2;
      const bark = Math.sin(this.barkP) * this.bark * (straight ? 0.55 : 0.12);
      this.bark *= barkCoef;
      this.subP += (Math.PI * freq) / sampleRate;
      if (this.subP > Math.PI * 2) this.subP -= Math.PI * 2;
      const sub = Math.sin(this.subP) * this.env;

      const raspAmt = (straight ? 1.35 : 0.18) * (0.55 + this.aggression * 0.9);
      const hashAmt = (straight ? 0.85 : 0.05) * (0.4 + this.aggression);
      const body = straight ? 0.42 : 0.9;
      const subAmt = this.cylinders === 1 ? 0.9 : this.cylinders === 2 ? 0.48 : 0.22;
      let sample =
        low * body * 2.2 +
        high * raspAmt * 2.4 +
        hash * hashAmt * 2.8 +
        combOut * (straight ? 0.42 : 0.08) +
        knock * subAmt +
        bark +
        half * (this.cylinders === 4 ? 0.12 : 0.38) +
        sub * subAmt +
        impulse * (straight ? 0.35 : 0.08);
      const drive = 2.4 + this.aggression * 3.4 + (straight ? 1.8 : 0.2);
      const driven = sample * drive;
      const asym = driven + 0.22 * driven * Math.abs(driven);
      sample = Math.tanh(Math.max(-1.4, Math.min(1.15, asym)));
      sample = this.tone.process(sample);
      const vca = (0.48 + this.throttle * 0.9) * (1.15 / Math.sqrt(fires));
      if (cutting) sample *= 0.08;
      sample *= vca;

      const dc = sample - this.dcIn + 0.995 * this.dcOut;
      this.dcIn = sample;
      this.dcOut = dc;
      out[i] = Math.max(-1, Math.min(1, dc));
    }

    for (let c = 1; c < channels.length; c += 1) {
      channels[c]?.set(out);
    }
    return true;
  }
}

registerProcessor("engine-call", EngineCallProcessor);
