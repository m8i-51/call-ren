import { memo } from "react";
import { SPECTRUM_BARS } from "@/visual/paint";

export const Spectrum = memo(function Spectrum() {
  return (
    <div data-spectrum className="flex h-12 items-end gap-1 px-4" aria-hidden="true">
      {Array.from({ length: SPECTRUM_BARS }, (_, index) => (
        <span key={index} data-bar className="spectrum-bar" />
      ))}
    </div>
  );
});
