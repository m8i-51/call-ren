import { Button } from "@/components/ui/button";

type BootGateProps = {
  pending: boolean;
  error: string | null;
  onBoot: () => void;
};

export function BootGate({ pending, error, onBoot }: BootGateProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background px-6"
      onClick={onBoot}
    >
      <div className="flex w-full max-w-md flex-col gap-5">
        <p className="text-xs tracking-[0.2em] text-muted-foreground">スタンドをかけたまま</p>
        <h1 className="text-4xl font-black tracking-tight">コール練</h1>
        <p className="text-base leading-relaxed">
          指でスロットルを刻むと、合成した排気音が回転に合わせて吠えます。型に合わせて、音の間を練習します。
        </p>
        <Button type="button" className="min-h-14 text-base" disabled={pending} onClick={onBoot}>
          {pending ? "エンジン始動…" : "タップしてエンジンをかける"}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <p className="text-xs leading-relaxed text-muted-foreground">
          タップすると音が出ます。公道での空吹かしや暴走行為は法律で禁じられています。これは音とリズムの練習用です。
        </p>
      </div>
    </div>
  );
}
