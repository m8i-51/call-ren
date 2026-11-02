import { memo } from "react";
import { GAUGE_MAX_RPM, GAUGE_START, GAUGE_SWEEP, arcPath, gaugeDegrees, polar } from "@/lib/gauge";

type TachometerProps = {
  redline: number;
  subtitle: string;
  countLabel: string | null;
};

const ticks = Array.from({ length: 13 }, (_, index) => {
  const rpm = index * 1000;
  return { rpm, major: rpm % 2000 === 0 };
});

export function Tachometer({ redline, subtitle, countLabel }: TachometerProps) {
  return (
    <div data-tach className="relative mx-auto aspect-square w-[min(100%,22rem)]">
      <TachFace redline={redline} />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-[18%]">
        <RpmCluster />
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {countLabel ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="font-tach rounded-full bg-background/80 px-6 py-2 text-6xl text-primary">
            {countLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}

const TachFace = memo(function TachFace({ redline }: { redline: number }) {
  const redStart = gaugeDegrees(redline);
  const redEnd = gaugeDegrees(GAUGE_MAX_RPM);
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full text-muted-foreground" aria-hidden="true">
      <circle cx="100" cy="100" r="96" className="tach-rim" />
      <path
        d={arcPath(100, 100, 90, GAUGE_START, GAUGE_START + GAUGE_SWEEP)}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d={arcPath(100, 100, 90, redStart, redEnd)}
        fill="none"
        stroke="var(--destructive)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle data-glow cx="100" cy="100" r="70" fill="none" stroke="var(--primary)" strokeWidth="10" opacity="0" />
      {ticks.map((tick) => {
        const degrees = gaugeDegrees(tick.rpm);
        const [x0, y0] = polar(100, 100, tick.major ? 74 : 79, degrees);
        const [x1, y1] = polar(100, 100, 88, degrees);
        const [labelX, labelY] = polar(100, 100, 62, degrees);
        return (
          <g key={tick.rpm}>
            <line
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
              stroke="currentColor"
              strokeWidth={tick.major ? 2 : 1}
            />
            {tick.major ? (
              <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" className="tick-label">
                {tick.rpm / 1000}
              </text>
            ) : null}
          </g>
        );
      })}
      <g data-needle transform={`rotate(${gaugeDegrees(1000)} 100 100)`}>
        <polygon points="100,24 96.5,104 103.5,104" className="fill-primary" />
        <circle cx="100" cy="100" r="5" className="fill-foreground" />
      </g>
    </svg>
  );
});

const RpmCluster = memo(function RpmCluster() {
  return (
    <div className="flex flex-col items-center">
      <span data-limit-flag hidden className="font-tach text-xs tracking-[0.25em] text-destructive">
        リミット
      </span>
      <span data-rpm className="font-tach text-5xl leading-none">
        1000
      </span>
      <span className="text-xs tracking-[0.16em] text-muted-foreground">rpm</span>
    </div>
  );
}, () => true);
