import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowUpRight, Heart, RotateCcw, X } from "lucide-react";
import type { ScoredQuest } from "@/lib/engine";
import { actions } from "@/lib/store";
import { questImage } from "@/lib/imagery";
import { metaLine, reasonLine } from "@/components/QuestCard";
import { Button } from "@/components/ui-kit";

type Choice = "pass" | "save";

export function SwipeDeck({ items }: { items: ScoredQuest[] }) {
  const [dragX, setDragX] = useState(0);
  const [leaving, setLeaving] = useState<Choice | null>(null);
  const [lastChoice, setLastChoice] = useState<{ id: string; choice: Choice } | null>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = items[0];
  const next = items[1];

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function choose(choice: Choice) {
    if (!current || leaving) return;
    setLeaving(choice);
    setDragX(choice === "save" ? 520 : -520);
    const id = current.quest.id;
    timer.current = setTimeout(() => {
      if (choice === "pass") actions.pass(id);
      else actions.toggleSave(id);
      setLastChoice({ id, choice });
      setDragX(0);
      setLeaving(null);
      timer.current = null;
    }, 240);
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (!current || leaving || (event.pointerType === "mouse" && event.button !== 0)) return;
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!start.current || start.current.id !== event.pointerId || leaving) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    // Let vertical gestures continue scrolling the page.
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 20) return;
    setDragX(dx);
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (!start.current || start.current.id !== event.pointerId) return;
    const dx = event.clientX - start.current.x;
    start.current = null;
    if (Math.abs(dx) > 90) choose(dx > 0 ? "save" : "pass");
    else setDragX(0);
  }

  function undo() {
    if (!lastChoice || leaving) return;
    actions.undoChoice(lastChoice.id, lastChoice.choice);
    setLastChoice(null);
  }

  return (
    <section aria-label="Quest postcards" className="mt-10 border-t border-border pt-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="font-hand text-xl">one thing at a time</p>
          <h2 className="text-2xl font-semibold">Your next quest</h2>
        </div>
        {lastChoice ? <Button variant="ghost" onClick={undo} ariaLabel="Undo last choice"><RotateCcw aria-hidden className="h-5 w-5" /> <span className="hidden sm:inline">Undo</span></Button> : null}
      </div>
      {current ? (
        <>
          <div className="relative mb-5 overflow-hidden pb-3 pr-3" aria-live="polite">
            {next ? <div aria-hidden className="absolute inset-x-3 top-3 bottom-0 rotate-1 overflow-hidden border border-border bg-secondary"><img src={questImage(next.quest)} alt="" className="h-full w-full object-cover opacity-40" /></div> : null}
            <article
              key={current.quest.id}
              className={`relative overflow-hidden border border-border-strong bg-card shadow-sm ${leaving ? "transition-transform duration-200 ease-out" : dragX === 0 ? "transition-transform duration-200 ease-out" : ""}`}
              style={{ transform: `translateX(${dragX}px) rotate(${Math.max(-12, Math.min(12, dragX / 28))}deg)`, touchAction: "pan-y" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => { start.current = null; if (!leaving) setDragX(0); }}
              onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); choose("pass"); } if (event.key === "ArrowRight") { event.preventDefault(); choose("save"); } }}
              tabIndex={0}
              aria-label={`${current.quest.title}. Left to pass, right to save.`}
            >
              <div className="relative bg-secondary p-2.5 sm:p-4">
                <img src={questImage(current.quest)} alt={`${current.quest.location.name}, ${current.quest.location.area}`} draggable={false} className="aspect-[4/3] w-full select-none object-cover sm:aspect-[16/10]" />
                <span aria-hidden className={`pointer-events-none absolute left-6 top-6 -rotate-12 border-2 border-destructive bg-card px-4 py-1 font-hand text-2xl text-destructive transition-opacity ${dragX < -25 ? "opacity-100" : "opacity-0"}`}>pass</span>
                <span aria-hidden className={`pointer-events-none absolute right-6 top-6 rotate-12 border-2 border-ring bg-card px-4 py-1 font-hand text-2xl text-ring transition-opacity ${dragX > 25 ? "opacity-100" : "opacity-0"}`}>save</span>
              </div>
              <div className="p-5 sm:p-7">
                <p className="font-hand text-lg text-muted-foreground">{reasonLine(current)}</p>
                <h3 className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl">{current.quest.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{current.quest.location.area} · {metaLine(current.distance, current.quest.durationMin, current.quest.costPerPerson)}</p>
                <p className="mt-4 leading-relaxed">{current.quest.hook}</p>
                <Link to="/quest/$questId" params={{ questId: current.quest.id }} className="mt-3 inline-flex min-h-11 items-center gap-1 font-semibold underline decoration-primary underline-offset-4">See the quest <ArrowUpRight aria-hidden className="h-4 w-4" /></Link>
              </div>
            </article>
          </div>
          <div className="flex items-center justify-center gap-5">
            <Button variant="outline" onClick={() => choose("pass")} disabled={Boolean(leaving)} ariaLabel={`Pass ${current.quest.title}`}><X aria-hidden className="h-6 w-6" /> Pass</Button>
            <Button onClick={() => choose("save")} disabled={Boolean(leaving)} ariaLabel={`Save ${current.quest.title}`}><Heart aria-hidden className="h-6 w-6" /> Save</Button>
          </div>
          <p className="mt-3 text-center font-hand text-base text-muted-foreground">swipe left to pass · right to save</p>
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