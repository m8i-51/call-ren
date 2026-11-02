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
    this.aggression = 0.62;
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
    this.popLeft = 0;
    this.popWait = 0;
    this.popArmed = 0;
    this.prevTarget = 0;
    this.noiseLp = 0;
    this.dcIn = 0;
    this.dcOut = 0;
    this.low = new Biquad();
    this.high = new Biquad();
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
    const lowFreq = (straight ? 150 : 95) * cyl * open;
    const highFreq = (straight ? 1280 : 460) * open;
    const lowQ = straight ? 0.9 + this.aggression * 0.4 : 0.45;
    const highQ = straight ? 1.3 + this.aggression * 0.8 : 0.4;
    const lowpass = straight ? 5400 : 1500;
    this.low.setBandpass(lowFreq, lowQ, sampleRate);
    this.high.setBandpass(highFreq, highQ, sampleRate);
    this.tone.setLowpass(lowpass, 0.7, sampleRate);
  }

  scheduleEdge() {
    const rose = this.targetThrottle - this.prevTarget > 0.2;
    const fell = this.prevTarget - this.targetThrottle > 0.22;
    if (rose) this.tip = 1;
    if (fell && this.rpm > 2400 && this.popArmed === 0) {
      this.popLeft = this.straight > 0.5 ? 5 : 2;
      this.popArmed = 1;
      this.popWait = Math.floor(sampleRate * 0.025);
    }
    if (this.targetThrottle > 0.48) this.popArmed = 0;
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
    let decay = straight ? 0.02 : 0.055;
    if (this.cylinders === 1) decay *= 2.2;
    else if (this.cylinders === 2) decay *= 1.4;
    const decayCoef = Math.exp(-1 / (decay * sampleRate));
    const knockCoef = Math.exp(-1 / (0.04 * sampleRate));
    const tipCoef = Math.exp(-1 / (0.018 * sampleRate));

    for (let i = 0; i < out.length; i += 1) {
      this.rpm += (this.targetRpm - this.rpm) * 0.002;
      this.throttle += (this.targetThrottle - this.throttle) * 0.02;
      const freq = Math.max(5, (this.rpm / 60) * fires);
      this.untilFire -= 1;

      let impulse = 0;
      if (this.untilFire <= 0) {
        if (!cutting) {
          this.env = 0.75 + Math.random() * 0.35;
          this.knockA = this.cylinders === 1 ? 1 : 0.7;
          this.knockF = (this.cylinders === 1 ? 52 : this.cylinders === 2 ? 74 : 98) + this.throttle * 30;
          impulse = 0.9;
        }
        let period = sampleRate / freq;
        if (this.cylinders === 2) {
          this.lump = !this.lump;
          period *= this.lump ? 1.28 : 0.74;
        } else if (this.cylinders === 1) {
          period *= 1 + (Math.random() - 0.5) * 0.07 * (1 + this.aggression);
        } else {
          period *= 1 + (Math.random() - 0.5) * 0.018 * (1 + this.aggression);
        }
        if (period < 8) period = 8;
        this.lastPeriod = period;
        this.untilFire += period;
      }

      if (this.popLeft > 0) {
        this.popWait -= 1;
        if (this.popWait <= 0) {
          impulse = Math.max(impulse, 0.75);
          this.env = Math.max(this.env, 0.72);
          this.popLeft -= 1;
          this.popWait = Math.floor(sampleRate * (0.03 + Math.random() * 0.045));
        }
      }

      this.env *= decayCoef;
      const white = Math.random() * 2 - 1;
      const noiseFollow = straight ? 0.42 : 0.14;
      this.noiseLp += (white - this.noiseLp) * noiseFollow;

      let excite = impulse * 0.85 + this.noiseLp * this.env * (straight ? 0.7 : 0.4);
      if (this.tip > 0.001) {
        excite += white * this.tip * (straight ? 0.55 : 0.2);
        this.tip *= tipCoef;
      }

      const cycle = 1 - this.untilFire / Math.max(8, this.lastPeriod);
      const half = Math.sin(Math.min(1, Math.max(0, cycle)) * Math.PI) * this.env;
      const low = this.low.process(excite);
      const high = this.high.process(excite);
      this.knockP += (2 * Math.PI * this.knockF) / sampleRate;
      if (this.knockP > Math.PI * 2) this.knockP -= Math.PI * 2;
      this.knockA *= knockCoef;
      this.knockF *= 0.9995;
      const knock = Math.sin(this.knockP) * this.knockA;
      this.subP += (Math.PI * freq) / sampleRate;
      if (this.subP > Math.PI * 2) this.subP -= Math.PI * 2;
      const sub = Math.sin(this.subP) * this.env;

      const rasp = (straight ? 0.9 : 0.16) * (0.4 + this.aggression * 0.75);
      const body = straight ? 0.5 : 0.95;
      const subAmt = this.cylinders === 1 ? 0.85 : this.cylinders === 2 ? 0.5 : 0.28;
      let sample = low * body * 2.4 + high * rasp * 2.6 + knock * subAmt + half * (this.cylinders === 4 ? 0.28 : 0.5) + sub * subAmt;
      const drive = 1.5 + this.aggression * 2.6 + (straight ? 1.25 : 0);
      sample = Math.tanh(sample * drive);
      sample = this.tone.process(sample);
      const vca = (0.38 + this.throttle * 0.7) * (0.9 / Math.sqrt(fires));
      if (cutting) sample *= 0.18;
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
