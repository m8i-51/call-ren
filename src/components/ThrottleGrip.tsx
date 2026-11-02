import type { PointerEvent } from "react";
import { cn } from "@/lib/utils";

type ThrottleGripProps = {
  axis: "x" | "y";
  disabled: boolean;
  onChange: (value: number) => void;
};

const THROTTLE_KEYS = new Set(["Space", "ArrowUp", "ArrowRight", "KeyW"]);

export function ThrottleGrip({ axis, disabled, onChange }: ThrottleGripProps) {
  const valueFromEvent = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (axis === "y") {
      if (rect.height <= 0) return 0;
      return clamp01(1 - (event.clientY - rect.top) / rect.height);
    }
    if (rect.width <= 0) return 0;
    return clamp01((event.clientX - rect.left) / rect.width);
  };

  return (
    <div
      data-throttle
      data-axis={axis}
      role="slider"
      aria-label="スロットル"
      aria-orientation={axis === "y" ? "vertical" : "horizontal"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        "grip relative h-full w-full outline-none focus-visible:ring-3 focus-visible:ring-ring",
        disabled && "opacity-60",
      )}
      onPointerDown={(event) => {
        if (disabled) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onChange(valueFromEvent(event));
      }}
      onPointerMove={(event) => {
        if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        onChange(valueFromEvent(event));
      }}
      onPointerUp={() => onChange(0)}
      onPointerCancel={() => onChange(0)}
      onKeyDown={(event) => {
        if (disabled || !THROTTLE_KEYS.has(event.code)) return;
        event.preventDefault();
        if (!event.repeat) onChange(1);
      }}
      onKeyUp={(event) => {
        if (!THROTTLE_KEYS.has(event.code)) return;
        onChange(0);
      }}
    >
      <div data-throttle-fill className="grip-fill absolute bottom-0 left-0" />
      <div data-throttle-puck className="grip-puck" />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex p-3 text-xs font-medium text-foreground/80",
          axis === "y" ? "flex-col justify-between" : "items-end justify-between",
        )}
      >
        {axis === "y" ? (
          <>
            <span>全開</span>
            <span>閉</span>
          </>
        ) : (
          <>
            <span>閉</span>
            <span>全開</span>
          </>
        )}
      </div>
    </div>
  );
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
