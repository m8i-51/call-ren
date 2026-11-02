import { parseCylinders, parsePipe } from "@/audio/types";
import type { EngineFlavor } from "@/audio/types";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type GarageProps = {
  flavor: EngineFlavor;
  volume: number;
  onFlavor: (flavor: EngineFlavor) => void;
  onVolume: (volume: number) => void;
};

export function Garage({ flavor, volume, onFlavor, onVolume }: GarageProps) {
  return (
    <section className="flex flex-col gap-4 px-4" aria-label="排気の性格">
      <div className="flex flex-col gap-2">
        <span className="text-sm" id="cylinder-label">
          気筒
        </span>
        <ToggleGroup
          type="single"
          spacing={0}
          variant="outline"
          value={String(flavor.cylinders)}
          onValueChange={(value) => {
            const cylinders = parseCylinders(value);
            if (!cylinders) return;
            onFlavor({ ...flavor, cylinders });
          }}
          aria-labelledby="cylinder-label"
          className="grid w-full grid-cols-3"
        >
          <ToggleGroupItem value="1" className="h-11">
            単気筒
          </ToggleGroupItem>
          <ToggleGroupItem value="2" className="h-11">
            2気筒
          </ToggleGroupItem>
          <ToggleGroupItem value="4" className="h-11">
            4気筒
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm" id="pipe-label">
          排気管
        </span>
        <ToggleGroup
          type="single"
          spacing={0}
          variant="outline"
          value={flavor.pipe}
          onValueChange={(value) => {
            const pipe = parsePipe(value);
            if (!pipe) return;
            onFlavor({ ...flavor, pipe });
          }}
          aria-labelledby="pipe-label"
          className="grid w-full grid-cols-2"
        >
          <ToggleGroupItem value="straight" className="h-11">
            直管
          </ToggleGroupItem>
          <ToggleGroupItem value="muffler" className="h-11">
            マフラー
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <LabeledSlider
        id="aggression"
        label="荒さ"
        value={flavor.aggression}
        onChange={(aggression) => onFlavor({ ...flavor, aggression })}
      />
      <LabeledSlider id="volume" label="音量" value={volume} onChange={onVolume} />
    </section>
  );
}

function LabeledSlider({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const labelId = `${id}-label`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm" id={labelId}>
          {label}
        </span>
        <span className="font-tach text-sm text-muted-foreground">{Math.round(value * 100)}</span>
      </div>
      <Slider
        aria-labelledby={labelId}
        min={0}
        max={100}
        step={1}
        value={[Math.round(value * 100)]}
        onValueChange={(next) => {
          const head = next[0];
          if (head === undefined) return;
          onChange(head / 100);
        }}
      />
    </div>
  );
}
