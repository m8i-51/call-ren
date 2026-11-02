export type CylinderCount = 1 | 2 | 4;

export type PipeStyle = "straight" | "muffler";

export type EngineFlavor = {
  cylinders: CylinderCount;
  pipe: PipeStyle;
  aggression: number;
};

export const DEFAULT_FLAVOR: EngineFlavor = {
  cylinders: 4,
  pipe: "straight",
  aggression: 0.86,
};

export type AppMode = "free" | "practice";

export function redlineFor(cylinders: CylinderCount): number {
  switch (cylinders) {
    case 1:
      return 7200;
    case 2:
      return 9000;
    case 4:
      return 11000;
    default: {
      const neverCylinders: never = cylinders;
      return neverCylinders;
    }
  }
}

export function cylinderLabel(cylinders: CylinderCount): string {
  switch (cylinders) {
    case 1:
      return "単気筒";
    case 2:
      return "2気筒";
    case 4:
      return "4気筒";
    default: {
      const neverCylinders: never = cylinders;
      return neverCylinders;
    }
  }
}

export function pipeLabel(pipe: PipeStyle): string {
  switch (pipe) {
    case "straight":
      return "直管";
    case "muffler":
      return "マフラー";
    default: {
      const neverPipe: never = pipe;
      return neverPipe;
    }
  }
}

export function flavorSubtitle(flavor: EngineFlavor): string {
  return `${cylinderLabel(flavor.cylinders)} · ${pipeLabel(flavor.pipe)}`;
}

export function parseCylinders(value: string): CylinderCount | null {
  switch (value) {
    case "1":
      return 1;
    case "2":
      return 2;
    case "4":
      return 4;
    default:
      return null;
  }
}

export function parsePipe(value: string): PipeStyle | null {
  switch (value) {
    case "straight":
    case "muffler":
      return value;
    default:
      return null;
  }
}

export function parseMode(value: string): AppMode | null {
  switch (value) {
    case "free":
    case "practice":
      return value;
    default:
      return null;
  }
}
