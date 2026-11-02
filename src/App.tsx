import { useCallback, useEffect, useRef, useState } from "react";
import { EngineSynth } from "@/audio/engine";
import { DEFAULT_FLAVOR, flavorSubtitle, parseMode, redlineFor } from "@/audio/types";
import type { AppMode, EngineFlavor } from "@/audio/types";
import { BootGate } from "@/components/BootGate";
import { Garage } from "@/components/Garage";
import { PracticePanel } from "@/components/PracticePanel";
import { Spectrum } from "@/components/Spectrum";
import { Tachometer } from "@/components/Tachometer";
import { ThrottleGrip } from "@/components/ThrottleGrip";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMediaQuery } from "@/hooks/use-media-query";
import { findPattern, nextPatternId } from "@/practice/patterns";
import { PracticeSession } from "@/practice/session";
import type { PracticeView } from "@/practice/session";
import { cn } from "@/lib/utils";
import { paintFrame } from "@/visual/paint";

const THROTTLE_KEYS = new Set(["Space", "ArrowUp", "KeyW"]);

export default function App() {
  const [engine] = useState(() => new EngineSynth());
  const [session] = useState(() => new PracticeSession());

  const [booted, setBooted] = useState(false);
  const [pending, setPending] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [mode, setMode] = useState<AppMode>("free");
  const [flavor, setFlavor] = useState<EngineFlavor>(DEFAULT_FLAVOR);
  const [volume, setVolume] = useState(0.8);
  const [practice, setPractice] = useState<PracticeView>(() => session.view());
  const wide = useMediaQuery("(min-width: 768px)");

  const pointerRef = useRef(0);
  const keyRef = useRef(false);
  const viewRev = useRef(practice.rev);
  const bootedRef = useRef(false);
  const pendingRef = useRef(false);

  const applyInput = useCallback(() => {
    if (session.blocksInput()) return;
    engine.setThrottle(Math.max(pointerRef.current, keyRef.current ? 1 : 0));
  }, [engine, session]);

  const syncPractice = useCallback(() => {
    const view = session.view();
    viewRev.current = view.rev;
    setPractice(view);
  }, [session]);

  useEffect(() => {
    if (!showTip) return;
    const id = window.setTimeout(() => setShowTip(false), 7000);
    return () => window.clearTimeout(id);
  }, [showTip]);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      if (bootedRef.current) {
        if (!session.blocksInput()) {
          engine.setThrottle(Math.max(pointerRef.current, keyRef.current ? 1 : 0));
        }
        session.tick(engine);
        engine.tick();
        paintFrame(engine, session);
        const view = session.view();
        if (view.rev !== viewRev.current) {
          viewRev.current = view.rev;
          setPractice(view);
        }
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [engine, session]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!bootedRef.current || event.repeat || !THROTTLE_KEYS.has(event.code)) return;
      if (shouldIgnoreKey(event)) return;
      event.preventDefault();
      keyRef.current = true;
      applyInput();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!THROTTLE_KEYS.has(event.code)) return;
      keyRef.current = false;
      applyInput();
    };
    const onBlur = () => {
      keyRef.current = false;
      pointerRef.current = 0;
      applyInput();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [applyInput]);

  const boot = () => {
    if (pendingRef.current || bootedRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setBootError(null);
    engine.setFlavor(flavor);
    engine.setVolume(volume);
    void engine.start().then(
      () => {
        bootedRef.current = true;
        setBooted(true);
        setShowTip(true);
        setPending(false);
      },
      () => {
        pendingRef.current = false;
        setPending(false);
        setBootError("このブラウザでは音を出せません。別のブラウザで開き直してください。");
      },
    );
  };

  const changeMode = (value: string) => {
    const next = parseMode(value);
    if (!next || next === mode) return;
    if (next === "free") session.stop(engine);
    setMode(next);
    syncPractice();
  };

  const updateFlavor = (next: EngineFlavor) => {
    engine.setFlavor(next);
    setFlavor(next);
  };

  const inputBlocked =
    practice.mode === "demo" && (practice.phase === "countin" || practice.phase === "running");
  const pattern = findPattern(practice.patternId);

  return (
    <div className="mx-auto flex h-dvh max-w-5xl flex-col overflow-hidden">
      {!booted ? <BootGate pending={pending} error={bootError} onBoot={boot} /> : null}
      <header className="flex items-end justify-between gap-3 px-4 pt-4 pb-3">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground">スタンド練習</p>
          <h1 className="text-2xl font-black tracking-tight">コール練</h1>
        </div>
        <p className="pb-1 text-xs text-muted-foreground">ニュートラル</p>
      </header>
      <Separator />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto py-3">
          {showTip ? (
            <div className="mx-4 flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
              <p className="text-sm leading-relaxed">
                グリップを押し込んで離す。練習タブで、型のタイミングに合わせる。
              </p>
              <Button type="button" variant="ghost" className="min-h-11 shrink-0" onClick={() => setShowTip(false)}>
                閉じる
              </Button>
            </div>
          ) : null}
          <Tabs value={mode} onValueChange={changeMode} className="gap-3">
            <div className="px-4">
              <TabsList className="grid h-11 w-full grid-cols-2">
                <TabsTrigger value="free">フリー</TabsTrigger>
                <TabsTrigger value="practice">練習</TabsTrigger>
              </TabsList>
            </div>
            <Tachometer
              redline={redlineFor(flavor.cylinders)}
              subtitle={flavorSubtitle(flavor)}
              countLabel={mode === "practice" ? practice.countLabel : null}
            />
            <Spectrum />
            <TabsContent value="free" className="flex flex-col gap-3">
              <p className="px-4 text-center text-sm text-muted-foreground">
                ニュートラルで空ぶかし。回転の形だけを遊ぶ。
              </p>
              <Garage
                flavor={flavor}
                volume={volume}
                onFlavor={updateFlavor}
                onVolume={(next) => {
                  engine.setVolume(next);
                  setVolume(next);
                }}
              />
            </TabsContent>
            <TabsContent value="practice">
              <PracticePanel
                pattern={pattern}
                view={practice}
                onSelect={(id) => {
                  session.select(id, engine);
                  syncPractice();
                }}
                onStart={() => {
                  session.start(engine, "play");
                  syncPractice();
                }}
                onDemo={() => {
                  session.start(engine, "demo");
                  syncPractice();
                }}
                onStop={() => {
                  session.stop(engine);
                  syncPractice();
                }}
                onNext={() => {
                  const next = nextPatternId(pattern.id);
                  if (!next) return;
                  session.select(next, engine);
                  session.start(engine, "play");
                  syncPractice();
                }}
              />
            </TabsContent>
          </Tabs>
          <p className="px-4 pb-2 text-center text-xs leading-relaxed text-muted-foreground">
            公道での空吹かし・暴走行為は禁止です。音の練習用の玩具です。
          </p>
        </main>
        <aside
          className={cn(
            "z-20 shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:flex md:w-80 md:flex-col md:border-t-0 md:border-l",
          )}
        >
          <p className="px-4 pt-2 text-center text-xs text-muted-foreground">
            {wide ? "上へ押し込んで離す。スペースキーでも全開。" : "押し込んで離すと、スプリングで戻る。"}
          </p>
          <div className={wide ? "min-h-0 flex-1 p-3" : "h-40 p-3 pt-2"}>
            <ThrottleGrip
              axis={wide ? "y" : "x"}
              disabled={inputBlocked}
              onChange={(value) => {
                pointerRef.current = value;
                applyInput();
              }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function shouldIgnoreKey(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(target.closest("button, a, [role='tab'], [data-slot='slider']"));
}
