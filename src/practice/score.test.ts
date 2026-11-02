import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { judgeEvents, scoreJudgements } from "./score.ts";
import type { CallEvent, ThrottleSample } from "./score.ts";

function frames(at: (time: number) => number, from = -0.4, to = 2.4): ThrottleSample[] {
  const samples: ThrottleSample[] = [];
  for (let step = Math.round(from * 60); step <= Math.round(to * 60); step += 1) {
    const time = step / 60;
    samples.push({ t: time, throttle: at(time) });
  }
  return samples;
}

const blip: CallEvent = {
  id: "a",
  start: 0.5,
  duration: 0.16,
  minThrottle: 0.8,
  kind: "blip",
};

describe("judgeEvents", () => {
  it("marks an on-time open as just", () => {
    const samples = frames((time) => (time >= 0.5 && time < 0.66 ? 0.92 : 0));
    const [result] = judgeEvents([blip], samples);
    assert.equal(result?.judgement, "just");
  });

  it("marks an early open", () => {
    const samples = frames((time) => (time >= 0.36 && time < 0.52 ? 0.92 : 0));
    const [result] = judgeEvents([blip], samples);
    assert.equal(result?.judgement, "early");
  });

  it("marks a late open", () => {
    const samples = frames((time) => (time >= 0.64 && time < 0.8 ? 0.92 : 0));
    const [result] = judgeEvents([blip], samples);
    assert.equal(result?.judgement, "late");
  });

  it("marks silence as a miss", () => {
    const [result] = judgeEvents([blip], frames(() => 0));
    assert.equal(result?.judgement, "miss");
  });

  it("marks a timid blip as weak", () => {
    const samples = frames((time) => (time >= 0.5 && time < 0.66 ? 0.5 : 0));
    const [result] = judgeEvents([blip], samples);
    assert.equal(result?.judgement, "weak");
  });

  it("requires a hold to stay open", () => {
    const hold: CallEvent = {
      id: "h",
      start: 0.5,
      duration: 0.8,
      minThrottle: 0.8,
      kind: "hold",
    };
    const held = frames((time) => (time >= 0.5 && time < 1.3 ? 0.9 : 0), -0.2, 1.6);
    const clipped = frames((time) => (time >= 0.5 && time < 0.65 ? 0.9 : 0), -0.2, 1.6);
    assert.equal(judgeEvents([hold], held)[0]?.judgement, "just");
    assert.equal(judgeEvents([hold], clipped)[0]?.judgement, "weak");
  });

  it("scores a clean pattern as a pass", () => {
    const judged = judgeEvents([blip], frames((time) => (time >= 0.5 && time < 0.66 ? 0.92 : 0)));
    const score = scoreJudgements(judged);
    assert.equal(score.score, 100);
    assert.equal(score.passed, true);
    assert.equal(score.counts.just, 1);
  });

  it("does not pass a miss", () => {
    const score = scoreJudgements(judgeEvents([blip], frames(() => 0)));
    assert.equal(score.passed, false);
    assert.equal(score.counts.miss, 1);
  });
});
