import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Bookmark, Footprints, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import type { ScoredQuest } from "@/lib/engine";
import { actions } from "@/lib/store";
import { questImage } from "@/lib/imagery";
import { metaLine, reasonLine } from "@/components/QuestCard";
import { Button } from "@/components/ui-kit";
import { QuestPreviewDialog } from "@/components/QuestPreviewDialog";

type Choice = "pass" | "save" | "go";
type Phase = "idle" | "leaving";
type Gesture = { id: number; x: number; y: number; at: number; pointerType: string; axis: "pending" | "horizontal" | "vertical" };
const LEAVE_DURATION_MS = 600;

export function SwipeDeck({ items }: { items: ScoredQuest[] }) {
  const navigate = useNavigate();
  const [dragX, setDragX] = useState(0);
  const [dragRange, setDragRange] = useState(120);
  const [liftY, setLiftY] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [zoom, setZoom] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [lastChoice, setLastChoice] = useState<{ id: string; choice: Choice } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const ignoreCardClick = useRef(false);
  const locked = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const current = items[0];
  const stack = items.slice(1, 4);
  const turn = Math.max(-6, Math.min(6, dragX / 45));
  const tintChoice: Choice | null = phase === "leaving"
    ? (choice === "pass" || choice === "save" ? choice : null)
    : dragX < 0 ? "pass" : dragX > 0 ? "save" : null;
  const tintOpacity = phase === "leaving" && tintChoice
    ? 0.96
    : Math.min(Math.abs(dragX) / dragRange, 0.96);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function choose(selected: Choice) {
    if (!current || locked.current) return;
    locked.current = true;
    gesture.current = null;
    setChoice(selected);
    setPhase("leaving");
    const id = current.quest.id;
    if (selected === "pass") toast("Not now", { description: current.quest.title });
    if (selected === "save") toast.success("Saved for later", { description: current.quest.title });
    if (selected === "go") {
      // "Let's go" zooms the card in on the way out to the go flow.
      setZoom(true);
    } else {
      // Move completely out of the viewport, even on a wide desktop display.
      if (selected === "save") setLiftY(-Math.max(window.innerHeight, 900));
      else setDragX(-Math.max(window.innerWidth, 800));
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timers.current.push(setTimeout(() => {
      if (selected === "pass") actions.pass(id);
      else if (selected === "save") actions.toggleSave(id);
      if (selected !== "go") setLastChoice({ id, choice: selected });
      setDragX(0);
      setLiftY(0);
      setZoom(false);
      setPhase("idle");
      setChoice(null);
      locked.current = false;
      if (selected === "go") void navigate({ to: "/go/$questId", params: { questId: id } });
    }, reducedMotion ? 0 : LEAVE_DURATION_MS));
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (!current || locked.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    if ((event.target as HTMLElement).closest("a, button")) return;
    ignoreCardClick.current = false;
    setDragRange(event.pointerType === "touch"
      ? Math.max(115, event.currentTarget.clientWidth * 0.3)
      : 95);
    // A mouse can leave the card before the first move event. Capture it immediately;
    // touch still waits for a horizontal intent so vertical page scrolling works.
    if (event.pointerType === "mouse") {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), pointerType: event.pointerType, axis: event.pointerType === "mouse" ? "horizontal" : "pending" };
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const move = gesture.current;
    if (!move || move.id !== event.pointerId || locked.current) return;
    const dx = event.clientX - move.x;
    const dy = event.clientY - move.y;
    if (move.axis === "pending" && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
      move.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "horizontal" : "vertical";
      ignoreCardClick.current = true;
      if (move.axis === "horizontal" && !event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (move.axis === "horizontal") {
      if (Math.abs(dx) > 8) ignoreCardClick.current = true;
      setDragX(move.pointerType === "touch" ? dx * 0.9 : dx);
    }
  }

  function finish(event: PointerEvent<HTMLElement>, cancelled = false) {
    const move = gesture.current;
    if (!move || move.id !== event.pointerId) return;
    gesture.current = null;
    if (move.axis !== "horizontal" || cancelled) { setDragX(0); return; }
    const dx = event.clientX - move.x;
    const elapsed = Math.max(performance.now() - move.at, 1);
    const distance = Math.abs(dx);
    const speed = distance / elapsed;
    const isTouch = move.pointerType === "touch";
    const committed = isTouch
      ? distance >= Math.max(115, event.currentTarget.clientWidth * 0.3) || (distance >= 85 && speed > 1.05)
      : distance >= 95 || (distance >= 45 && speed > 0.65);
    if (committed) choose(dx > 0 ? "save" : "pass");
    else setDragX(0);
  }

  function undo() {
    if (!lastChoice || locked.current || lastChoice.choice === "go") return;
    actions.undoChoice(lastChoice.id, lastChoice.choice);
    setLastChoice(null);
  }

  return (
    <section aria-label="Quest postcards" className="mt-3 md:mt-6">
      {lastChoice ? <div className="mb-2 flex justify-end"><Button variant="ghost" onClick={undo} ariaLabel="Undo last choice"><RotateCcw aria-hidden className="h-5 w-5" /> Undo</Button></div> : null}
      {current ? (
        <>
          <div className="relative mb-4 pb-2 pr-2" aria-live="off">
            {stack.map((item, depth) => {
              // items[1] is next up: it sits on top of the deeper cards and is
              // rendered at full strength so it becomes the top card seamlessly.
              const level = depth + 1;
              const lift = Math.min(Math.abs(dragX) / 240, 1);
              const settle = 1 - lift * 0.5;
              return (
                <div
                  key={item.quest.id}
                  aria-hidden
                  className="absolute inset-0 overflow-hidden border border-border bg-card transition-transform duration-200 ease-out"
                  style={{
                    transform: `translate(${level * 2 * settle}px, ${level * 3 * settle}px) rotate(${level * 0.4 * (level % 2 === 0 ? -1 : 1) * settle}deg)`,
                    zIndex: stack.length - depth,
                  }}
                >
                  <div className="flex h-full flex-col">
                    <div className="bg-secondary p-2 sm:p-3">
                      <img src={questImage(item.quest)} alt="" draggable={false} className="h-[min(20dvh,190px)] w-full object-cover sm:h-[min(34dvh,350px)]" style={{ opacity: level === 1 ? 1 : 0.45 }} />
                    </div>
                    <div className="px-4 py-3 sm:p-6">
                      <p className="font-hand text-base text-muted-foreground sm:text-lg">{reasonLine(item)}</p>
                      <h3 className="mt-0.5 text-xl font-semibold leading-tight sm:text-3xl">{item.quest.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{item.quest.location.area} · {metaLine(item.distance, item.quest.durationMin, item.quest.costPerPerson)}</p>
                      <p className="mt-1 line-clamp-2 text-sm leading-snug sm:mt-4 sm:text-base">{item.quest.hook}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <article
              key={current.quest.id}
              className={`relative z-10 cursor-pointer select-none overflow-hidden border border-border-strong bg-card shadow-sm ${phase === "leaving" ? "transition-transform duration-[600ms] ease-out" : dragX === 0 ? "transition-transform duration-300 ease-[cubic-bezier(0.2,1.35,0.3,1)]" : ""}`}
              style={{ transform: `translate(${dragX}px, ${liftY}px) rotate(${turn}deg) scale(${zoom ? 1.07 : 1})`, touchAction: "pan-y" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={(event) => finish(event)}
              onPointerCancel={(event) => finish(event, true)}
              onClick={(event) => {
                if (ignoreCardClick.current) {
                  ignoreCardClick.current = false;
                  return;
                }
                if ((event.target as HTMLElement).closest("a, button") || phase !== "idle") return;
                setPreviewOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  choose(event.key === "ArrowRight" ? "save" : "pass");
                } else if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (phase === "idle") setPreviewOpen(true);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${current.quest.title}. Open quest. Press left arrow to pass for now or right arrow to save for later.`}
            >
              <div className="relative bg-secondary p-2 sm:p-3">
                <img src={questImage(current.quest)} alt={`${current.quest.location.name}, ${current.quest.location.area}`} draggable={false} className="h-[min(20dvh,190px)] w-full select-none object-cover sm:h-[min(34dvh,350px)]" />
              </div>
              <div className="px-4 py-3 sm:p-6">
                <p className="font-hand text-base text-muted-foreground sm:text-lg">{reasonLine(current)}</p>
                <h3 className="mt-0.5 text-xl font-semibold leading-tight sm:text-3xl">{current.quest.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{current.quest.location.area} · {metaLine(current.distance, current.quest.durationMin, current.quest.costPerPerson)}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-snug sm:mt-4 sm:text-base">{current.quest.hook}</p>
              </div>
              {tintChoice ? (
                <div
                  aria-hidden="true"
                  className={`swipe-card-tint ${tintChoice === "pass" ? "swipe-card-tint-pass" : "swipe-card-tint-save"}`}
                  style={{ opacity: tintOpacity }}
                />
              ) : null}
            </article>
          </div>
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <Button variant="outline" onClick={() => choose("pass")} disabled={phase !== "idle"} ariaLabel={`Not now: ${current.quest.title}`} className="gap-1 whitespace-nowrap px-3 text-sm sm:px-6 sm:text-[15px]"><X aria-hidden className="h-5 w-5 shrink-0" /> Not now</Button>
            <Button onClick={() => choose("go")} disabled={phase !== "idle"} ariaLabel={`Do ${current.quest.title} now`} className="whitespace-nowrap px-4 text-sm sm:px-6 sm:text-[15px]"><Footprints aria-hidden className="h-5 w-5 shrink-0" /> Let&apos;s go</Button>
            <Button variant="outline" onClick={() => choose("save")} disabled={phase !== "idle"} ariaLabel={`Save ${current.quest.title} for later`} className="gap-1 whitespace-nowrap px-3 text-sm sm:px-6 sm:text-[15px]"><Bookmark aria-hidden className="h-5 w-5 shrink-0" /> Save for later</Button>
          </div>
          <p className="mt-1 text-center font-hand text-sm text-muted-foreground sm:mt-2 sm:text-base">swipe left for not now · right to save for later</p>
          <span className="sr-only" role="status" aria-live="polite">
            {choice === "save" ? `${current.quest.title} saved for later` : choice === "pass" ? `${current.quest.title}, not now` : ""}
          </span>
          <QuestPreviewDialog
            item={current}
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            onPass={() => { setPreviewOpen(false); choose("pass"); }}
            onSave={() => { setPreviewOpen(false); choose("save"); }}
            onGo={() => { setPreviewOpen(false); choose("go"); }}
          />
        </>
      ) : (
        <div className="border-y border-border py-12 text-center" aria-live="polite">
          <p className="font-hand text-2xl">all caught up for now</p>
          <p className="mt-2 text-muted-foreground">Check back soon, or find saved quests in Your quests.</p>
          {lastChoice ? <div className="mt-5"><Button variant="outline" onClick={undo}><RotateCcw aria-hidden className="h-4 w-4" /> Undo</Button></div> : null}
        </div>
      )}
    </section>
  );
}
