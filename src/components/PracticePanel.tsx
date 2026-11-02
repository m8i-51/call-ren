import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PATTERNS, nextPatternId } from "@/practice/patterns";
import type { Pattern } from "@/practice/patterns";
import { JUDGEMENT_ORDER, judgementBadgeVariant, judgementLabel } from "@/practice/score";
import type { PracticeView } from "@/practice/session";

type PracticePanelProps = {
  pattern: Pattern;
  view: PracticeView;
  onSelect: (id: string) => void;
  onStart: () => void;
  onDemo: () => void;
  onStop: () => void;
  onNext: () => void;
};

export function PracticePanel({
  pattern,
  view,
  onSelect,
  onStart,
  onDemo,
  onStop,
  onNext,
}: PracticePanelProps) {
  const running = view.phase === "countin" || view.phase === "running";
  const nextId = nextPatternId(pattern.id);

  return (
    <section className="flex flex-col gap-3 px-4" aria-label="コールの練習">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PATTERNS.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={item.id === pattern.id ? "default" : "outline"}
            className="min-h-11 shrink-0"
            onClick={() => onSelect(item.id)}
          >
            {item.name}
          </Button>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight">
          {pattern.name}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{pattern.reading}</span>
        </h2>
        <p className="text-sm text-muted-foreground">{pattern.description}</p>
      </div>
      <div className="lane" aria-hidden="true">
        <div data-playhead className="playhead" />
        {pattern.events.map((event) => (
          <div
            key={event.id}
            className="lane-block"
            data-judgement={view.judgements[event.id] ?? "pending"}
            style={{
              left: `${(event.start / pattern.duration) * 100}%`,
              width: `${Math.max((event.duration / pattern.duration) * 100, 1.8)}%`,
              height: `${event.minThrottle * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1" aria-live="polite">
        {pattern.events.map((event, index) => {
          const judgement = view.judgements[event.id];
          return (
            <Badge key={event.id} variant={judgement ? judgementBadgeVariant(judgement) : "outline"}>
              {index + 1}
              {judgement ? ` ${judgementLabel(judgement)}` : " …"}
            </Badge>
          );
        })}
      </div>
      {view.notice ? <p className="text-sm text-primary">{view.notice}</p> : null}
      {view.result ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.16em] text-muted-foreground">スコア</p>
              <p className={view.result.passed ? "font-tach text-5xl text-just" : "font-tach text-5xl"}>
                {view.result.score}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {view.result.passed ? <Badge>合格</Badge> : <Badge variant="outline">もう一度</Badge>}
              <p className="text-sm font-medium">{view.result.title}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{view.result.detail}</p>
          <div className="flex flex-wrap gap-1">
            {JUDGEMENT_ORDER.map((name) => (
              <Badge key={name} variant={judgementBadgeVariant(name)}>
                {judgementLabel(name)} {view.result?.counts[name] ?? 0}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {running ? (
          <Button type="button" variant="outline" className="min-h-12 flex-1" onClick={onStop}>
            やめる
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" className="min-h-12 flex-1" onClick={onDemo}>
              お手本
            </Button>
            <Button type="button" className="min-h-12 flex-1" onClick={onStart}>
              {view.phase === "done" ? "もう一度" : "スタート"}
            </Button>
            {view.phase === "done" && nextId ? (
              <Button type="button" variant="secondary" className="min-h-12 flex-1" onClick={onNext}>
                次の型
              </Button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
