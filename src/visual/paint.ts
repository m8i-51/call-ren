import type { EngineSynth } from "@/audio/engine";
import { spectrumBins } from "@/audio/engine";
import { fireFlash, gaugeDegrees } from "@/lib/gauge";
import type { PracticeSession } from "@/practice/session";

export const SPECTRUM_BARS = 24;

export function paintFrame(engine: EngineSynth, session: PracticeSession): void {
  const snap = engine.snapshot();
  const rpm = document.querySelector<HTMLElement>("[data-rpm]");
  if (rpm) {
    const text = String(Math.round(snap.rpm));
    if (rpm.textContent !== text) rpm.textContent = text;
  }

  const needle = document.querySelector<SVGElement>("[data-needle]");
  if (needle) {
    needle.setAttribute("transform", `rotate(${gaugeDegrees(snap.rpm).toFixed(2)} 100 100)`);
  }

  const glow = document.querySelector<SVGElement>("[data-glow]");
  if (glow) {
    glow.setAttribute("opacity", fireFlash(snap.rpm, snap.cylinders, performance.now()).toFixed(3));
  }

  const tach = document.querySelector<HTMLElement>("[data-tach]");
  if (tach) tach.dataset.limiting = snap.limiting ? "true" : "false";

  const flag = document.querySelector<HTMLElement>("[data-limit-flag]");
  if (flag) flag.hidden = !snap.limiting;

  const bins = spectrumBins();
  engine.readSpectrum(bins);
  const bars = document.querySelectorAll<HTMLElement>("[data-bar]");
  bars.forEach((bar, index) => {
    const start = 1 + Math.floor((index * 40) / SPECTRUM_BARS);
    const end = 1 + Math.floor(((index + 1) * 40) / SPECTRUM_BARS);
    let peak = 0;
    for (let bin = start; bin <= end && bin < bins.length; bin += 1) {
      const value = bins[bin] ?? 0;
      if (value > peak) peak = value;
    }
    const scale = 0.06 + (peak / 255) * 0.94;
    bar.style.transform = `scaleY(${scale.toFixed(3)})`;
  });

  const grip = document.querySelector<HTMLElement>("[data-throttle]");
  const fill = document.querySelector<HTMLElement>("[data-throttle-fill]");
  const puck = document.querySelector<HTMLElement>("[data-throttle-puck]");
  const percent = Math.round(snap.throttle * 1000) / 10;
  if (grip) {
    const opened = Math.round(snap.throttle * 100);
    grip.setAttribute("aria-valuenow", String(opened));
    grip.setAttribute("aria-valuetext", `スロットル ${opened}`);
  }
  if (fill && puck && grip) {
    const axis = grip.dataset.axis;
    if (axis === "y") {
      fill.style.width = "100%";
      fill.style.height = `${percent}%`;
      puck.style.width = "72%";
      puck.style.height = "22px";
      puck.style.left = "14%";
      puck.style.right = "auto";
      puck.style.top = "auto";
      puck.style.bottom = `clamp(8px, calc(${percent}% - 11px), calc(100% - 30px))`;
    } else {
      fill.style.height = "100%";
      fill.style.width = `${percent}%`;
      puck.style.height = "72%";
      puck.style.width = "22px";
      puck.style.top = "14%";
      puck.style.bottom = "auto";
      puck.style.left = `clamp(8px, calc(${percent}% - 11px), calc(100% - 30px))`;
    }
  }

  const playhead = document.querySelector<HTMLElement>("[data-playhead]");
  if (playhead) {
    const ratio = session.playheadRatio(engine.currentTime());
    playhead.style.left = `${ratio * 100}%`;
  }
}
