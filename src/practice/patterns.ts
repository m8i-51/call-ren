import type { CallEvent } from "@/practice/score";

export type Pattern = {
  id: string;
  name: string;
  reading: string;
  description: string;
  duration: number;
  events: CallEvent[];
};

export const PATTERNS: readonly Pattern[] = [
  {
    id: "tanpatsu",
    name: "単発",
    reading: "たんぱつ",
    description: "一回だけ鋭く開けて、すぐ戻す。",
    duration: 2.2,
    events: [{ id: "a", start: 0.7, duration: 0.18, minThrottle: 0.78, kind: "blip" }],
  },
  {
    id: "niren",
    name: "二連",
    reading: "にれん",
    description: "同じ大きさでふたつ。間隔を揃える。",
    duration: 2.5,
    events: [
      { id: "a", start: 0.55, duration: 0.16, minThrottle: 0.74, kind: "blip" },
      { id: "b", start: 1.15, duration: 0.16, minThrottle: 0.74, kind: "blip" },
    ],
  },
  {
    id: "sanren",
    name: "三連打",
    reading: "さんれんだ",
    description: "短く三回。どんどん急がない。",
    duration: 2.7,
    events: [
      { id: "a", start: 0.48, duration: 0.14, minThrottle: 0.7, kind: "blip" },
      { id: "b", start: 0.98, duration: 0.14, minThrottle: 0.7, kind: "blip" },
      { id: "c", start: 1.48, duration: 0.14, minThrottle: 0.7, kind: "blip" },
    ],
  },
  {
    id: "tatarn",
    name: "タターン",
    reading: "たたーん",
    description: "短、短、それから長く粘る。",
    duration: 3.3,
    events: [
      { id: "a", start: 0.46, duration: 0.13, minThrottle: 0.72, kind: "blip" },
      { id: "b", start: 0.92, duration: 0.13, minThrottle: 0.72, kind: "blip" },
      { id: "c", start: 1.4, duration: 0.85, minThrottle: 0.8, kind: "hold" },
    ],
  },
  {
    id: "long",
    name: "ロング",
    reading: "ろんぐ",
    description: "一気に開けて、高い回転で保つ。",
    duration: 3.1,
    events: [{ id: "a", start: 0.42, duration: 1.55, minThrottle: 0.88, kind: "hold" }],
  },
  {
    id: "gun",
    name: "マシンガン",
    reading: "ましんがん",
    description: "小さく細かく、六連。指先だけで刻む。",
    duration: 3.2,
    events: [0, 1, 2, 3, 4, 5].map((index) => ({
      id: `g${index}`,
      start: 0.4 + index * 0.36,
      duration: 0.12,
      minThrottle: 0.64,
      kind: "blip" as const,
    })),
  },
];

export function findPattern(id: string): Pattern {
  for (const pattern of PATTERNS) {
    if (pattern.id === id) return pattern;
  }
  const first = PATTERNS[0];
  if (!first) throw new Error("パターンがありません");
  return first;
}

export function nextPatternId(id: string): string | null {
  const index = PATTERNS.findIndex((pattern) => pattern.id === id);
  const next = PATTERNS[index + 1];
  return next ? next.id : null;
}

export function throttleEnvelope(pattern: Pattern, time: number): number {
  let level = 0;
  for (const event of pattern.events) {
    const attack = event.kind === "hold" ? 0.06 : 0.035;
    const release = event.kind === "hold" ? 0.09 : 0.05;
    const end = event.start + event.duration;
    if (time < event.start || time >= end + release) continue;
    let value = event.minThrottle;
    if (time < event.start + attack) {
      value = event.minThrottle * ((time - event.start) / attack);
    } else if (time > end) {
      value = event.minThrottle * (1 - (time - end) / release);
    }
    if (value > level) level = value;
  }
  return level;
}
