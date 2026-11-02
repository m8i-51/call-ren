export const JUST_SEC = 0.1;
export const EDGE_SEC = 0.17;
const ONSET = 0.42;
const PEAK_WINDOW = 0.18;

export const JUDGEMENT_ORDER = ["just", "early", "late", "weak", "miss"] as const;

export type JudgementName = (typeof JUDGEMENT_ORDER)[number];

export type CallKind = "blip" | "hold";

export type CallEvent = {
  id: string;
  start: number;
  duration: number;
  minThrottle: number;
  kind: CallKind;
};

export type ThrottleSample = {
  t: number;
  throttle: number;
};

export type EventJudgement = {
  id: string;
  judgement: JudgementName;
  delta: number | null;
};

export type ScoreResult = {
  score: number;
  passed: boolean;
  title: string;
  detail: string;
  counts: Record<JudgementName, number>;
};

const WEIGHT: Record<JudgementName, number> = {
  just: 100,
  early: 55,
  late: 55,
  weak: 25,
  miss: 0,
};

export function detectOnsets(samples: readonly ThrottleSample[], threshold = ONSET): { t: number; peak: number }[] {
  const onsets: { t: number; peak: number }[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const cur = samples[i];
    if (!prev || !cur) continue;
    if (prev.throttle >= threshold || cur.throttle < threshold) continue;
    let peak = cur.throttle;
    const limit = cur.t + PEAK_WINDOW;
    for (let j = i; j < samples.length; j += 1) {
      const sample = samples[j];
      if (!sample || sample.t > limit) break;
      if (sample.throttle > peak) peak = sample.throttle;
    }
    onsets.push({ t: cur.t, peak });
  }
  return onsets;
}

export function judgeEvents(events: readonly CallEvent[], samples: readonly ThrottleSample[]): EventJudgement[] {
  const onsets = detectOnsets(samples);
  const used = new Set<number>();
  return events.map((event) => {
    let best = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < onsets.length; i += 1) {
      if (used.has(i)) continue;
      const onset = onsets[i];
      if (!onset) continue;
      const delta = onset.t - event.start;
      if (delta < -EDGE_SEC || delta > EDGE_SEC) continue;
      const distance = Math.abs(delta);
      if (distance < bestDist) {
        bestDist = distance;
        best = i;
      }
    }
    if (best < 0) return { id: event.id, judgement: "miss", delta: null };
    used.add(best);
    const onset = onsets[best];
    if (!onset) return { id: event.id, judgement: "miss", delta: null };
    const delta = onset.t - event.start;
    if (onset.peak < event.minThrottle * 0.75) {
      return { id: event.id, judgement: "weak", delta };
    }
    if (event.kind === "hold" && holdRatio(samples, event) < 0.5) {
      return { id: event.id, judgement: "weak", delta };
    }
    if (delta < -JUST_SEC) return { id: event.id, judgement: "early", delta };
    if (delta > JUST_SEC) return { id: event.id, judgement: "late", delta };
    return { id: event.id, judgement: "just", delta };
  });
}

export function scoreJudgements(items: readonly EventJudgement[]): ScoreResult {
  const counts: Record<JudgementName, number> = {
    just: 0,
    early: 0,
    late: 0,
    weak: 0,
    miss: 0,
  };
  let sum = 0;
  for (const item of items) {
    counts[item.judgement] += 1;
    sum += WEIGHT[item.judgement];
  }
  const score = items.length === 0 ? 0 : Math.round(sum / items.length);
  return {
    score,
    passed: score >= 70,
    title: titleFor(score),
    detail: detailFor(score),
    counts,
  };
}

export function judgementLabel(name: JudgementName): string {
  switch (name) {
    case "just":
      return "ジャスト";
    case "early":
      return "早い";
    case "late":
      return "遅い";
    case "weak":
      return "浅い";
    case "miss":
      return "ミス";
    default: {
      const neverName: never = name;
      return neverName;
    }
  }
}

export function judgementBadgeVariant(
  name: JudgementName,
): "default" | "secondary" | "outline" | "destructive" {
  switch (name) {
    case "just":
      return "default";
    case "early":
    case "late":
      return "secondary";
    case "weak":
      return "outline";
    case "miss":
      return "destructive";
    default: {
      const neverName: never = name;
      return neverName;
    }
  }
}

function holdRatio(samples: readonly ThrottleSample[], event: CallEvent): number {
  let total = 0;
  let hot = 0;
  const end = event.start + event.duration;
  const gate = event.minThrottle * 0.72;
  for (const sample of samples) {
    if (sample.t < event.start || sample.t > end) continue;
    total += 1;
    if (sample.throttle >= gate) hot += 1;
  }
  if (total === 0) return 0;
  return hot / total;
}

function titleFor(score: number): string {
  if (score >= 92) return "完璧な間";
  if (score >= 70) return "キレがある";
  if (score >= 45) return "もう一声";
  return "型を聞き直そう";
}

function detailFor(score: number): string {
  if (score >= 70) return "合格。開ける位置が型に乗っている。";
  if (score >= 45) return "音は出ている。ジャストの位置をもう一度。";
  return "お手本を聞いて、開けるタイミングだけ合わせよう。";
}
