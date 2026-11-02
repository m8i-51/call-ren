import type { CylinderCount } from "@/audio/types";

export const GAUGE_MAX_RPM = 12000;
export const GAUGE_START = -120;
export const GAUGE_SWEEP = 240;

export function gaugeDegrees(rpm: number): number {
  const clamped = Math.min(GAUGE_MAX_RPM, Math.max(0, rpm));
  return GAUGE_START + (clamped / GAUGE_MAX_RPM) * GAUGE_SWEEP;
}

export function polar(cx: number, cy: number, radius: number, degrees: number): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
}

export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
): string {
  const [x0, y0] = polar(cx, cy, radius, startDeg);
  const [x1, y1] = polar(cx, cy, radius, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function fireFlash(rpm: number, cylinders: CylinderCount, nowMs: number): number {
  const hz = Math.max(1, (rpm / 60) * (cylinders / 2));
  const fraction = (nowMs / 1000) * hz;
  const phase = fraction - Math.floor(fraction);
  if (phase > 0.14) return 0;
  return 1 - phase / 0.14;
}
