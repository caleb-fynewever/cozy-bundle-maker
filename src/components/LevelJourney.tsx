import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Avatar } from "@/components/ui-kit";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LEVELS, levelFor } from "@/data/people";
import { DURATION, EASE_OUT, SPRING, reducedMotion } from "@/lib/motion";
import { levelsReachedAt } from "@/lib/progress";
import type { XpEvent } from "@/lib/store";
import { cn } from "@/lib/utils";

/*
 * Your quest journey: every level as a stop on one trail that climbs the sheet, Wanderer at the
 * bottom and wego Legend at the top, like a trophy road. Reached stops are clover discs, yours is
 * ink, the ones ahead are pencilled. Your avatar stands on the trail between your level and the
 * next, as far along as your XP is. Opening it brings you into view, the clover trail draws up to
 * you and your marker settles onto it; reduced motion shows it finished. On phones it rises as a
 * bottom sheet, on laptops it is a sheet of paper in the middle.
 */

const SHEET = cn(
  "flex max-h-[min(86dvh,52rem)] max-w-[30rem] flex-col gap-0 overflow-hidden border-border-strong bg-card p-0 sm:rounded-lg",
  "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[88dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-xl max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0",
  "max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=closed]:slide-out-to-bottom",
  // The dialog's own X stays above the sticky title as the trail scrolls under it.
  "[&>button:last-child]:z-20",
);

/** A line in the margin for each level, so the tiers read as a journey rather than a table. */
const NOTES: Record<number, string> = {
  1: "everyone starts here",
  2: "you've got a few stories",
  3: "friends ask you where to go",
  4: "you say yes to the weird plan",
  5: "the city's your map",
};

const COUNT = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

const dayStart = (at: number) => {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

function reachedLabel(at: number | undefined, now: number) {
  if (at === undefined) return "reached";
  const days = Math.round((dayStart(now) - dayStart(at)) / 86_400_000);
  if (days <= 0) return "reached today";
  if (days === 1) return "reached yesterday";
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  return `reached ${new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) })}`;
}

/** How far down `el` sits inside `ancestor`, by layout (so the sheet's opening zoom doesn't skew it). */
function offsetIn(el: HTMLElement, ancestor: HTMLElement) {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

export function LevelJourney({
  open,
  onOpenChange,
  returnFocus,
  xp,
  log,
  name,
  avatarUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What had focus before (the level label, or its "?"); focus goes back there on close. */
  returnFocus?: RefObject<HTMLElement | null>;
  xp: number;
  log: XpEvent[];
  name: string;
  avatarUrl?: string | null;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={SHEET}
        // Open on the title (inside the scroller, so arrow keys scroll the trail); keep the scroll we set.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          title.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          const opener = returnFocus?.current;
          if (!opener?.isConnected) return;
          event.preventDefault();
          opener.focus();
        }}
      >
        <Journey titleRef={title} xp={xp} log={log} name={name} avatarUrl={avatarUrl ?? null} />
      </DialogContent>
    </Dialog>
  );
}

function Journey({
  titleRef,
  xp,
  log,
  name,
  avatarUrl,
}: {
  titleRef: RefObject<HTMLHeadingElement | null>;
  xp: number;
  log: XpEvent[];
  name: string;
  avatarUrl: string | null;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const note = useRef<HTMLSpanElement>(null);

  const level = levelFor(xp);
  const reached = useMemo(() => levelsReachedAt(xp, log), [xp, log]);
  const first = LEVELS[0]!;
  const last = LEVELS[LEVELS.length - 1]!;
  const now = Date.now();

  useLayoutEffect(() => {
    const box = scroller.current;
    const you = marker.current;
    const trail = list.current;
    if (!box || !you || !trail) return;

    // You, a little below the middle of what's visible under the title: what's next sits above you.
    const title = head.current?.offsetHeight ?? 0;
    const y = offsetIn(you, box) + you.offsetHeight / 2;
    box.scrollTop = Math.max(0, y - title - (box.clientHeight - title) * 0.5);

    if (reducedMotion()) return;

    // The walked trail is drawn in pieces (one per stop and road below you), bottom up. Each piece
    // takes its share of one ease-out stroke, so the line reads as a single pen slowing into you.
    const pieces = Array.from(trail.querySelectorAll<HTMLElement>(".journey-walk")).reverse();
    const lengths = pieces.map((piece) => piece.offsetHeight);
    const total = lengths.reduce((sum, length) => sum + length, 0);
    const delay = DURATION.base;
    const draw = total ? Math.min(900, Math.max(420, total * 1.3)) : 0;
    const timeAt = (fraction: number) => 1 - Math.cbrt(1 - Math.min(1, fraction)); // inverse of an ease-out cubic
    const running: Animation[] = [];
    let covered = 0;
    if (total > 0) {
      pieces.forEach((piece, index) => {
        const from = timeAt(covered / total) * draw;
        covered += lengths[index]!;
        const to = timeAt(covered / total) * draw;
        running.push(piece.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], { duration: Math.max(1, to - from), delay: delay + from, easing: "linear", fill: "backwards" }));
      });
    }

    // Then you land on it: a small drop with the spring's overshoot, and the note writes in beside you.
    const landed = delay + draw;
    if (mark.current) {
      running.push(
        mark.current.animate([{ opacity: 0, transform: "translateY(-14px) scale(0.7)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], {
          duration: DURATION.slow + 140,
          delay: Math.max(0, landed - 80),
          easing: SPRING,
          fill: "backwards",
        }),
      );
    }
    if (note.current) {
      running.push(
        note.current.animate([{ opacity: 0, transform: "translateX(-6px)" }, { opacity: 1, transform: "translateX(0)" }], {
          duration: DURATION.base,
          delay: landed + 60,
          easing: EASE_OUT,
          fill: "backwards",
        }),
      );
    }
    return () => running.forEach((animation) => animation.cancel());
    // Plays once each time the sheet opens (it mounts with it).
  }, []);

  const you = (
    <div ref={marker} className="journey-you" aria-hidden>
      <span ref={mark} className="journey-you-mark">
        <Avatar name={name} you size={34} imageUrl={avatarUrl} />
      </span>
      <span ref={note} className="flex min-w-0 flex-col gap-0.5">
        <span className="font-hand text-[17px] leading-none">you're here</span>
        <span className="text-[13px] font-semibold leading-tight tabular-nums">
          {xp.toLocaleString()}
          {level.next ? ` / ${level.next.xp.toLocaleString()}` : ""} XP
        </span>
      </span>
    </div>
  );

  return (
    <div ref={scroller} className="relative min-h-0 overflow-y-auto overscroll-contain pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
      <div ref={head} className="sticky top-0 z-10 border-b border-border bg-card px-5 pb-4 pr-14 pt-5 sm:px-7 sm:pt-6">
        <DialogTitle ref={titleRef} tabIndex={-1} className="text-xl leading-tight tracking-[-0.01em] outline-none sm:text-[1.375rem]">
          Your quest journey
        </DialogTitle>
        <DialogDescription className="mt-1 text-pretty">
          {COUNT[LEVELS.length] ?? LEVELS.length} levels, from {first.name} to {last.name}.
        </DialogDescription>
      </div>

      <ol ref={list} reversed className="journey mx-5 mt-6 sm:mx-7" style={{ "--p": level.progress } as CSSProperties}>
        {[...LEVELS].reverse().map((stop) => {
          const state = stop.level < level.level ? "reached" : stop.level === level.level ? "current" : "future";
          const walked = state !== "future";
          const current = state === "current";
          // The road above this stop, toward the next one. Yours carries you; the top has none unless you're on it.
          let road: ReactNode = null;
          if (stop.level === last.level) {
            if (current) {
              road = (
                <div className="journey-road" data-you="" aria-hidden>
                  {you}
                  <div className="journey-gap" data-part="summit">
                    <span className="journey-walk" />
                  </div>
                </div>
              );
            }
          } else if (current) {
            road = (
              <div className="journey-road" data-you="" aria-hidden>
                <div className="journey-gap" data-part="ahead" />
                {you}
                <div className="journey-gap" data-part="behind">
                  <span className="journey-walk" />
                </div>
              </div>
            );
          } else {
            road = <div className="journey-road" aria-hidden>{walked ? <span className="journey-walk" /> : null}</div>;
          }

          return (
            <li key={stop.level} aria-current={current ? "step" : undefined}>
              {road}
              <div className="journey-row">
                {walked ? <span aria-hidden className="journey-walk" data-end={stop.level === first.level ? "" : undefined} /> : null}
                <span aria-hidden className="journey-disc" data-state={state}>
                  {stop.level}
                </span>
                <div className="journey-text">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className={cn("min-w-0 text-[17px] font-semibold leading-6", state === "future" && "text-muted-foreground")}>
                      <span className="sr-only">Level {stop.level}: </span>
                      {stop.name}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      <span className="sr-only">at </span>
                      {stop.xp.toLocaleString()} XP
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {state === "future" ? (
                      <>
                        <span className="font-medium tabular-nums text-foreground">{(stop.xp - xp).toLocaleString()} XP</span> to go
                      </>
                    ) : (
                      reachedLabel(reached.get(stop.level), now)
                    )}
                  </p>
                  {NOTES[stop.level] ? <p className="mt-0.5 font-hand text-[15px] leading-snug text-muted-foreground">{NOTES[stop.level]}</p> : null}
                  {current ? (
                    <span className="sr-only">
                      You're here: {xp.toLocaleString()}
                      {level.next ? ` of ${level.next.xp.toLocaleString()}` : ""} XP.
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
