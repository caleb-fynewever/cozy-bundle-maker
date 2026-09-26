import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowUpRight, Heart, RotateCcw, X } from "lucide-react";
import type { ScoredQuest } from "@/lib/engine";
import { actions } from "@/lib/store";
import { questImage } from "@/lib/imagery";
import { metaLine, reasonLine } from "@/components/QuestCard";
import { Button } from "@/components/ui-kit";

type Choice = "pass" | "save";
type Phase = "idle" | "stamping" | "leaving";
type Gesture = { id: number; x: number; y: number; at: number; axis: "pending" | "horizontal" | "vertical" };

export function SwipeDeck({ items }: { items: ScoredQuest[] }) {
  const [dragX, setDragX] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [lastChoice, setLastChoice] = useState<{ id: string; choice: Choice } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const locked = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const current = items[0];
  const next = items[1];

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function choose(selected: Choice) {
    if (!current || locked.current) return;
    locked.current = true;
    gesture.current = null;
    setChoice(selected);
    if (selected === "save") setDragX(0);
    const id = current.quest.id;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stampDelay = selected === "save" && !reducedMotion ? 440 : 0;
    const flightDelay = reducedMotion ? 0 : 320;
    if (stampDelay) setPhase("stamping");
    timers.current.push(setTimeout(() => {
      setPhase("leaving");
      setDragX(selected === "save" ? 800 : -800);
      timers.current.push(setTimeout(() => {
        if (selected === "pass") actions.pass(id);
        else actions.toggleSave(id);
        setLastChoice({ id, choice: selected });
        setDragX(0);
        setPhase("idle");
        setChoice(null);
        locked.current = false;
      }, flightDelay));
    }, stampDelay));
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (!current || locked.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    if ((event.target as HTMLElement).closest("a, button")) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), axis: "pending" };
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const move = gesture.current;
    if (!move || move.id !== event.pointerId || locked.current) return;
    const dx = event.clientX - move.x;
    const dy = event.clientY - move.y;
    if (move.axis === "pending" && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
      move.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "horizontal" : "vertical";
      if (move.axis === "horizontal") event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (move.axis === "horizontal") setDragX(dx);
  }

  function finish(event: PointerEvent<HTMLElement>, cancelled = false) {
    const move = gesture.current;
    if (!move || move.id !== event.pointerId) return;
    gesture.current = null;
    if (move.axis !== "horizontal" || cancelled) { setDragX(0); return; }
    const dx = event.clientX - move.x;
    const elapsed = Math.max(performance.now() - move.at, 1);
    if (Math.abs(dx) > 95 || (Math.abs(dx) > 45 && Math.abs(dx) / elapsed > 0.65)) choose(dx > 0 ? "save" : "pass");
    else setDragX(0);
  }

  function undo() {
    if (!lastChoice || locked.current) return;
    actions.undoChoice(lastChoice.id, lastChoice.choice);
    setLastChoice(null);
  }

  return (
    <section aria-label="Quest postcards" className="mt-3 md:mt-6">
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:mb-3">
        <div className="min-w-0">
          <p className="font-hand text-lg">one thing at a time</p>
          <h2 className="text-xl font-semibold sm:text-2xl">Your next quest</h2>
        </div>
        {lastChoice ? <Button variant="ghost" onClick={undo} ariaLabel="Undo last choice"><RotateCcw aria-hidden className="h-5 w-5" /> <span className="hidden sm:inline">Undo</span></Button> : null}
      </div>
      {current ? (
        <>
          <div className="relative mb-4 overflow-x-clip pb-2 pr-2" aria-live="off">
            {next ? <div aria-hidden className="absolute inset-x-2 top-2 bottom-0 rotate-1 overflow-hidden border border-border bg-secondary"><img src={questImage(next.quest)} alt="" draggable={false} className="h-full w-full object-cover opacity-40" /></div> : null}
            <article
              key={current.quest.id}
              className={`relative overflow-hidden border border-border-strong bg-card shadow-sm ${phase === "leaving" ? "transition-transform duration-300 ease-in" : dragX === 0 ? "transition-transform duration-200 ease-out" : ""}`}
              style={{ transform: `translateX(${dragX}px) rotate(${Math.max(-12, Math.min(12, dragX / 30))}deg)`, touchAction: "pan-y" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={(event) => finish(event)}
              onPointerCancel={(event) => finish(event, true)}
              onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); choose(event.key === "ArrowRight" ? "save" : "pass"); } }}
              tabIndex={0}
              aria-label={`${current.quest.title}. Press left arrow to pass or right arrow to save.`}
            >
              <div className="relative bg-secondary p-2 sm:p-3">
                <img src={questImage(current.quest)} alt={`${current.quest.location.name}, ${current.quest.location.area}`} draggable={false} className="h-[min(24dvh,230px)] w-full select-none object-cover sm:h-[min(42dvh,430px)]" />
                <span aria-hidden className={`pointer-events-none absolute left-6 top-6 -rotate-12 border-2 border-destructive bg-card px-3 py-1 font-hand text-2xl text-destructive transition-opacity ${dragX < -35 ? "opacity-100" : "opacity-0"}`}>pass</span>
                {phase === "stamping" || (choice === "save" && phase === "leaving") ? <span aria-hidden className="save-stamp pointer-events-none absolute left-1/2 top-1/2 border-4 border-ring bg-card/90 px-7 py-2 font-hand text-4xl text-ring shadow-sm">SAVED!</span> : <span aria-hidden className={`pointer-events-none absolute right-6 top-6 rotate-12 border-2 border-ring bg-card px-3 py-1 font-hand text-2xl text-ring transition-opacity ${dragX > 35 ? "opacity-100" : "opacity-0"}`}>save</span>}
              </div>
              <div className="px-4 py-3 sm:p-6">
                <p className="font-hand text-base text-muted-foreground sm:text-lg">{reasonLine(current)}</p>
                <h3 className="mt-0.5 text-xl font-semibold leading-tight sm:text-3xl">{current.quest.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{current.quest.location.area} · {metaLine(current.distance, current.quest.durationMin, current.quest.costPerPerson)}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-snug sm:mt-4 sm:text-base">{current.quest.hook}</p>
                <Link to="/quest/$questId" params={{ questId: current.quest.id }} className="mt-1 inline-flex min-h-10 items-center gap-1 text-sm font-semibold underline decoration-primary underline-offset-4 sm:mt-3">See the quest <ArrowUpRight aria-hidden className="h-4 w-4" /></Link>
              </div>
            </article>
          </div>
          <div className="flex items-center justify-center gap-5">
            <Button variant="outline" onClick={() => choose("pass")} disabled={phase !== "idle"} ariaLabel={`Pass ${current.quest.title}`}><X aria-hidden className="h-6 w-6" /> Pass</Button>
            <Button onClick={() => choose("save")} disabled={phase !== "idle"} ariaLabel={`Save ${current.quest.title}`}><Heart aria-hidden className="h-6 w-6" /> Save</Button>
          </div>
          <p className="mt-1 text-center font-hand text-sm text-muted-foreground sm:mt-2 sm:text-base">swipe left to pass · right to save</p>
          <span className="sr-only" role="status" aria-live="polite">{phase === "stamping" ? `${current.quest.title} saved` : ""}</span>
        </>
      ) : (
        <div className="border-y border-border py-12 text-center" aria-live="polite">
          <p className="font-hand text-2xl">all caught up for now</p>
          <p className="mt-2 text-muted-foreground">Change the plan for a fresh set, or revisit your saved quests in Profile.</p>
          {lastChoice ? <div className="mt-5"><Button variant="outline" onClick={undo}><RotateCcw aria-hidden className="h-4 w-4" /> Undo</Button></div> : null}
        </div>
      )}
    </section>
  );
}
