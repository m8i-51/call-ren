import type { EngineSynth } from "@/audio/engine";
import { findPattern, throttleEnvelope } from "@/practice/patterns";
import type { Pattern } from "@/practice/patterns";
import { EDGE_SEC, judgeEvents, scoreJudgements } from "@/practice/score";
import type { JudgementName, ScoreResult, ThrottleSample } from "@/practice/score";

export type PracticePhase = "idle" | "countin" | "running" | "done";
export type PracticeRunMode = "play" | "demo";

export type PracticeView = {
  rev: number;
  phase: PracticePhase;
  mode: PracticeRunMode;
  patternId: string;
  countLabel: string | null;
  judgements: Record<string, JudgementName>;
  result: ScoreResult | null;
  notice: string | null;
};

const BEAT = 0.5;
const COUNT_IN = 2;

export class PracticeSession {
  private rev = 0;
  private phase: PracticePhase = "idle";
  private mode: PracticeRunMode = "play";
  private patternId = "tanpatsu";
  private countLabel: string | null = null;
  private judgements: Record<string, JudgementName> = {};
  private result: ScoreResult | null = null;
  private notice: string | null = null;
  private t0 = 0;
  private patternZero = 0;
  private samples: ThrottleSample[] = [];
  private decided = new Set<string>();

  view(): PracticeView {
    return {
      rev: this.rev,
      phase: this.phase,
      mode: this.mode,
      patternId: this.patternId,
      countLabel: this.countLabel,
      judgements: { ...this.judgements },
      result: this.result,
      notice: this.notice,
    };
  }

  blocksInput(): boolean {
    return this.mode === "demo" && (this.phase === "countin" || this.phase === "running");
  }

  select(id: string, engine: EngineSynth): void {
    const running = this.phase === "countin" || this.phase === "running";
    if (!running && id === this.patternId) return;
    if (running) this.halt(engine);
    this.patternId = id;
    this.result = null;
    this.judgements = {};
    this.notice = null;
    this.bump();
  }

  start(engine: EngineSynth, mode: PracticeRunMode): void {
    if (this.phase === "countin" || this.phase === "running") return;
    const now = engine.currentTime();
    this.mode = mode;
    this.phase = "countin";
    this.countLabel = "1";
    this.notice = null;
    this.result = null;
    this.judgements = {};
    this.samples = [];
    this.decided.clear();
    this.t0 = now + 0.08;
    this.patternZero = this.t0 + COUNT_IN;
    for (let beat = 0; beat < 4; beat += 1) {
      engine.playClick(this.t0 + beat * BEAT, beat === 3);
    }
    this.bump();
  }

  stop(engine: EngineSynth): void {
    if (this.phase !== "countin" && this.phase !== "running") return;
    this.halt(engine);
    this.bump();
  }

  tick(engine: EngineSynth): void {
    if (this.phase !== "countin" && this.phase !== "running") return;
    const pattern = findPattern(this.patternId);
    const now = engine.currentTime();
    const time = now - this.patternZero;
    let changed = false;

    if (this.mode === "demo") {
      engine.setThrottle(time >= 0 ? throttleEnvelope(pattern, time) : 0);
    } else {
      const throttle = engine.snapshot().throttle;
      this.samples.push({ t: time, throttle });
      if (this.samples.length > 2400) this.samples.shift();
      if (this.judgeDue(pattern, time)) changed = true;
    }

    if (this.phase === "countin" && now >= this.patternZero) {
      this.phase = "running";
      this.countLabel = null;
      changed = true;
    } else if (this.phase === "countin") {
      const label = countLabelFor(now - this.t0);
      if (label !== this.countLabel) {
        this.countLabel = label;
        changed = true;
      }
    }

    if (time >= pattern.duration + 0.25) {
      this.finish(engine, pattern);
      return;
    }
    if (changed) this.bump();
  }

  playheadRatio(now: number): number {
    const pattern = findPattern(this.patternId);
    if (this.phase === "done") return 1;
    if (this.phase !== "countin" && this.phase !== "running") return 0;
    const time = now - this.patternZero;
    if (time <= 0) return 0;
    return Math.min(1, time / pattern.duration);
  }

  private judgeDue(pattern: Pattern, time: number): boolean {
    const ready = pattern.events.some((event) => {
      if (this.decided.has(event.id)) return false;
      return time >= event.start + Math.max(event.duration, EDGE_SEC) + 0.22;
    });
    if (!ready) return false;
    const judged = judgeEvents(pattern.events, this.samples);
    let changed = false;
    for (const item of judged) {
      const event = pattern.events.find((candidate) => candidate.id === item.id);
      if (!event || this.decided.has(event.id)) continue;
      const decideAt = event.start + Math.max(event.duration, EDGE_SEC) + 0.22;
      if (time < decideAt) continue;
      this.judgements[item.id] = item.judgement;
      this.decided.add(item.id);
      changed = true;
    }
    return changed;
  }

  private finish(engine: EngineSynth, pattern: Pattern): void {
    engine.setThrottle(0);
    this.countLabel = null;
    if (this.mode === "demo") {
      this.phase = "idle";
      this.mode = "play";
      this.notice = "お手本はここまで。同じ間で開けてみよう。";
      this.bump();
      return;
    }
    const judged = judgeEvents(pattern.events, this.samples);
    const judgements: Record<string, JudgementName> = {};
    for (const item of judged) judgements[item.id] = item.judgement;
    this.judgements = judgements;
    this.result = scoreJudgements(judged);
    this.phase = "done";
    this.bump();
  }

  private halt(engine: EngineSynth): void {
    this.phase = "idle";
    this.mode = "play";
    this.countLabel = null;
    this.samples = [];
    this.decided.clear();
    engine.setThrottle(0);
  }

  private bump(): void {
    this.rev += 1;
  }
}

function countLabelFor(elapsed: number): string | null {
  if (elapsed < 0.5) return "1";
  if (elapsed < 1) return "2";
  if (elapsed < 1.5) return "3";
  if (elapsed < 2) return "ハイ";
  return null;
}
