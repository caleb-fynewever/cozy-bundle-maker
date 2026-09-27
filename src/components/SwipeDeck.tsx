import { Link, useNavigate } from "@tanstack/react-router";
import { Doodle } from "@/components/Doodle";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Bookmark, X } from "lucide-react";
import type { ScoredQuest } from "@/lib/engine";
import { actions, useUserState, type CompleteSnapshot } from "@/lib/store";
import { questImage } from "@/lib/imagery";
import { VIBE_DOODLE } from "@/lib/vibes";
import { QuestMeta, reasonLine } from "@/components/QuestCard";
import { PhotoPrint, buttonClass } from "@/components/ui-kit";
import { Stamp } from "@/components/Stamp";
import { HelpDot } from "@/components/HelpDot";
import { QuestPreviewDialog } from "@/components/QuestPreviewDialog";
import { DURATION, EASE_IN, EASE_OUT, SPRING, burst, flyToNav, reducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/*
 * The Quests deck: one postcard at a time, three waiting underneath, and one two-way decision:
 * Pass (left) or Save (right). A decision is written to the store the moment it's made (so nothing
 * is lost if you navigate away mid-animation); the card you decided on leaves as a copy ("ghost")
 * drawn over the page, while the real deck already shows the next card. Each decision leaves the
 * way it means:
 *   pass  - thrown off to the left, washed red
 *   save  - "filed away", washed clover: it folds into the Lists tab
 *   done  - "postmark" (the preview sheet's "Already did this one?"): once the sheet is out of the
 *           way an ink stamp slams onto the card, sparks and +XP rise off the stamp, then the card
 *           lifts away. Finishing a quest through Let's go stamps it the same way.
 */

type Choice = "pass" | "save" | "done";
type Gesture = { id: number; x: number; y: number; at: number; pointerType: string; axis: "pending" | "horizontal" | "vertical" };
type Box = { left: number; top: number; width: number; height: number };
/** Runs `run` once the preview sheet has finished closing; returns a cancel. */
type AfterSheet = (run: () => void) => () => void;
type Ghost = {
  key: number;
  item: ScoredQuest;
  choice: Choice;
  box: Box;
  /** The card's transform at the moment of the decision (where a drag left it). */
  from: string;
  /** How inked the drag stamp already was (0..1). */
  intent: number;
  /** How strong the drag's colour wash already was (0..1). */
  wash: number;
  /** Extra wait while the preview sheet closes (pass and save). */
  delay: number;
  /**
   * The postmark waits until the preview sheet is gone: on phones the sheet covers the whole deck,
   * so a stamp that lands while it slides away is never seen.
   */
  afterSheet: AfterSheet | null;
  earned: number;
  date: string;
};
type Last = { key: number; id: string; title: string; choice: Choice; earned: number; before?: CompleteSnapshot };
/** How the next top card arrives. `id` null: whichever card ends up on top (the ranking can reshuffle). */
type Enter = { id: string | null; from: string; fade: boolean; delay: number };
type Deal = "pending" | "run" | "done";

/** The deck deals itself in once per page load, not on every tab switch or return visit. */
let dealt = false;

/**
 * Where each waiting card sits under the top one: lower, a touch smaller, a little askew. The tilt
 * is scaled down on wider cards (quests.css --rot-k) so the edges fan out instead of crossing.
 */
const UNDER = [
  { n: 1, rot: 0.8, deal: 2 },
  { n: 2, rot: -1.3, deal: -3 },
  { n: 3, rot: 0.5, deal: 3 },
] as const;

/*
 * The photo is sized to the screen so the card, the buttons and the hint all fit above the fold
 * (390x844 phones, 820x1180 tablets, 1366x768 laptops), instead of a fixed cap. On phones the card
 * itself is sized to the screen (quests.css .deck-face) and the photo fills what the copy leaves,
 * so a long title shortens the photo rather than pushing Pass/Save under the floating tab bar.
 * On the landscape card (lg) the photo fills its half of the card, never shorter than
 * PHOTO_MIN_LG, so a long title on the copy side never leaves a white strip under it.
 */
const PHOTO_H = "max-sm:absolute max-sm:inset-0 max-sm:h-full sm:h-[clamp(150px,calc(100svh_-_650px),380px)] md:h-[clamp(260px,calc(100svh_-_600px),440px)] lg:absolute lg:inset-0 lg:h-full";
const PHOTO_MIN_LG = "lg:min-h-[clamp(260px,calc(100svh_-_424px),420px)]";

/** From the stamp starting its slam to the card lifting away: it lands at ~460ms, then stays to be read. */
const HOLD_DONE = 1000;
/** About how long the preview sheet takes to close (the dialog's 150ms exit, then its unmount). */
const SHEET_EXIT = 180;
/** If the sheet never reports that it closed, the postmark goes ahead after this long. */
const SHEET_FALLBACK = 450;

function underTransform(n: number, rot: number, settle = 1, rotK = 1) {
  return `translateY(${n * 8 * settle}px) scale(${1 - n * 0.035 * settle}) rotate(${rot * rotK * settle}deg)`;
}

/** The deck's tilt factor at this width (--rot-k in quests.css), so JS starts where the CSS rests. */
function readRotK(deck: HTMLElement | null) {
  if (!deck) return 1;
  const k = Number.parseFloat(getComputedStyle(deck).getPropertyValue("--rot-k"));
  return Number.isFinite(k) ? k : 1;
}

/** How far a drag must travel before letting go counts (the same rule the release uses). */
function commitDistance(pointerType: string, width: number) {
  return pointerType === "touch" ? Math.max(115, width * 0.3) : 95;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function stampDate() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase();
}

/** Runs after React has committed the update this event scheduled (the next card is in the DOM). */
function afterCommit(run: () => void) {
  window.setTimeout(run, 0);
}

function buzz(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(ms);
}

export function SwipeDeck({ items: ranked }: { items: ScoredQuest[] }) {
  const navigate = useNavigate();
  const state = useUserState();
  const [previewOpen, setPreviewOpen] = useState(false);
  // The quest the sheet shows. Held apart from the deck, so the sheet keeps its own card while it
  // slides away after a decision (instead of flashing the next quest), and can finish closing even
  // when that decision emptied the deck.
  const [preview, setPreview] = useState<ScoredQuest | null>(null);
  // While the sheet is open the deck under it holds still: a re-rank in the meantime (your location
  // arriving, the time of day turning over) waits until it closes. So the quest the sheet shows is
  // always the one its Pass, Save, "Already did this one?" and Let's go act on.
  const [held, setHeld] = useState<ScoredQuest[] | null>(null);
  const items = previewOpen && held ? held : ranked;
  const [last, setLast] = useState<Last | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [deal, setDeal] = useState<Deal>(() => (dealt ? "done" : "pending"));
  const deckRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const emptyRef = useRef<HTMLDivElement>(null);
  const passRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const sheetWaiters = useRef(new Set<() => void>());
  const gesture = useRef<Gesture | null>(null);
  // The drag lives outside React: pointer moves write the card's transform once per frame.
  const drag = useRef({ x: 0, raf: 0, live: false, limit: 95, armed: null as Choice | null });
  const ignoreCardClick = useRef(false);
  const enter = useRef<Enter | null>(null);
  const keys = useRef(0);
  const current = items[0];
  const stack = items.slice(1, 4);
  const currentId = current?.quest.id;

  // The top card the server painted stays put: it is the page's main image, so it shows before any
  // script runs. Only the waiting cards are dealt in under it, plus the top card if this device's
  // saved state turns out to put a different quest on top (that one is "fresh" and is dealt too).
  const firstTopId = useRef(currentId);
  const fresh = deal !== "done" && currentId !== firstTopId.current;

  /** Keyboard focus stays on the deck: the new top card, or the empty slot once the deck runs out. */
  const focusDeck = useCallback(() => (cardRef.current ?? emptyRef.current)?.focus({ preventScroll: true }), []);

  // The deal: wait for the saved state to load (so the right cards are dealt), then deal once.
  // Keyed to this deck's own first render, so StrictMode's mount/unmount/mount re-runs it cleanly.
  const dealsIn = useRef(deal === "pending");
  useEffect(() => {
    if (!dealsIn.current) return;
    dealt = true;
    if (reducedMotion()) {
      setDeal("done");
      return;
    }
    // Runs after the store has loaded this device's saved state (AppShell hydrates it in the same
    // effects pass), so the cards dealt are the right ones.
    setDeal("run");
    const end = window.setTimeout(() => setDeal("done"), DURATION.slow + 70 * 3 + 160);
    return () => window.clearTimeout(end);
  }, []);

  useEffect(() => {
    const d = drag.current;
    return () => cancelAnimationFrame(d.raf);
  }, []);

  // Warm the photos waiting in the stack so the next card never shows an empty frame.
  const upcoming = stack.map(({ quest }) => questImage(quest)).join("\n");
  useEffect(() => {
    for (const src of upcoming.split("\n")) {
      if (!src) continue;
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }
  }, [upcoming]);

  // A new top card rises out of the stack (or, after an undo, comes back from where it went).
  useLayoutEffect(() => {
    const next = enter.current;
    enter.current = null;
    const el = cardRef.current;
    if (!next || !el || (next.id !== null && next.id !== currentId) || reducedMotion()) return;
    const frames = next.fade ? [{ transform: next.from, opacity: 0 }, { transform: "none", opacity: 1 }] : [{ transform: next.from }, { transform: "none" }];
    const animation = el.animate(frames, { duration: DURATION.slow, easing: SPRING, delay: next.delay, fill: "backwards" });
    return () => animation.cancel();
  }, [currentId]);

  const dropGhost = useCallback((key: number) => setGhosts((list) => list.filter((ghost) => ghost.key !== key)), []);

  // "Already did this one?" closes the sheet and stamps the card; the stamp waits for the sheet to
  // be gone (QuestPreviewDialog reports it once its exit is over), with a timer as a backstop.
  const afterSheet = useCallback<AfterSheet>((run) => {
    const waiters = sheetWaiters.current;
    let timer = 0;
    const fire = () => {
      waiters.delete(fire);
      window.clearTimeout(timer);
      run();
    };
    timer = window.setTimeout(fire, SHEET_FALLBACK);
    waiters.add(fire);
    return () => {
      waiters.delete(fire);
      window.clearTimeout(timer);
    };
  }, []);
  const sheetClosed = useCallback(() => {
    for (const fire of [...sheetWaiters.current]) fire();
  }, []);

  function openPreview() {
    if (!current) return;
    setHeld(items);
    setPreview(current);
    setPreviewOpen(true);
  }

  function paint() {
    const d = drag.current;
    d.raf = 0;
    const card = cardRef.current;
    const deck = deckRef.current;
    if (!card || !deck) return;
    const x = d.x;
    card.style.transform = x ? `translate(${x}px, 0px) rotate(${clamp(x / 50, -5, 5)}deg) scale(1.015)` : "";
    // The stamp inks in once the card is clearly moving; the colour follows from the first pixel.
    // Both are full at the distance where letting go counts.
    const ink = clamp((Math.abs(x) - 24) / (d.limit - 24), 0, 1);
    const wash = clamp(Math.abs(x) / d.limit, 0, 1);
    // Each value goes on the one element that reads it (they are registered as non-inheriting in
    // quests.css), so a drag frame restyles two stamps, two washes and three edges, not the deck.
    const put = (selector: string, name: string, value: number) => card.querySelector<HTMLElement>(selector)?.style.setProperty(name, value.toFixed(3));
    put('.deck-intent[data-kind="pass"]', "--pass", x < 0 ? ink : 0);
    put('.deck-intent[data-kind="save"]', "--save", x > 0 ? ink : 0);
    put('.deck-wash[data-kind="pass"]', "--wash", x < 0 ? wash : 0);
    put('.deck-wash[data-kind="save"]', "--wash", x > 0 ? wash : 0);
    const lift = Math.min(Math.abs(x) / 240, 1).toFixed(3);
    for (const under of deck.querySelectorAll<HTMLElement>(".deck-under")) under.style.setProperty("--lift", lift);
    const armed: Choice | null = ink >= 1 ? (x < 0 ? "pass" : "save") : null;
    if (armed === d.armed) return;
    d.armed = armed;
    passRef.current?.toggleAttribute("data-armed", armed === "pass");
    saveRef.current?.toggleAttribute("data-armed", armed === "save");
    if (!armed) return;
    // Crossing the line: the stamp thunks and the phone ticks, so you feel that letting go counts.
    if (!reducedMotion()) {
      card.querySelector(`.deck-intent[data-kind="${armed}"]`)?.animate([{ scale: 1 }, { scale: 1.12, offset: 0.4 }, { scale: 1 }], { duration: 180, easing: EASE_OUT });
    }
    buzz(8);
  }

  function setDragging(on: boolean) {
    deckRef.current?.toggleAttribute("data-dragging", on);
    cardRef.current?.toggleAttribute("data-dragging", on);
  }

  /** Let go without deciding: the card springs home (CSS transition) and the stamps fade. */
  function resetDrag() {
    const d = drag.current;
    cancelAnimationFrame(d.raf);
    d.raf = 0;
    d.x = 0;
    d.live = false;
    setDragging(false);
    paint();
  }

  function choose(choice: Choice, { fromPreview = false } = {}) {
    const item = items[0];
    if (!item) return;
    const card = cardRef.current;
    const deck = deckRef.current;
    const hadFocus = !!card && document.activeElement === card;
    const reduce = reducedMotion();
    const d = drag.current;
    if (d.raf) {
      cancelAnimationFrame(d.raf);
      paint();
    }
    const settle = 1 - 0.45 * Math.min(Math.abs(d.x) / 240, 1);
    const { id, title } = item.quest;
    const before: CompleteSnapshot = {
      streak: state.streak,
      lastQuestDay: state.lastQuestDay,
      saved: state.saved,
      passed: state.passed,
      inProgress: state.inProgress,
      scheduledQuests: state.scheduledQuests,
    };
    // Snapshot the card before the store moves on. Under reduced motion only "did it" keeps a
    // (still) copy, so the stamp can be read before it fades.
    let ghost: Omit<Ghost, "earned"> | null = null;
    if (card && deck && (!reduce || choice === "done")) {
      const box = deck.getBoundingClientRect();
      ghost = {
        key: ++keys.current,
        item,
        choice,
        box: { left: box.left, top: box.top, width: box.width, height: box.height },
        from: card.style.transform || "translate(0px, 0px)",
        intent: choice === "done" ? 0 : clamp((Math.abs(d.x) - 24) / (d.limit - 24), 0, 1),
        wash: choice === "done" ? 0 : clamp(Math.abs(d.x) / d.limit, 0, 1),
        delay: fromPreview && choice !== "done" ? 140 : 0,
        afterSheet: fromPreview && choice === "done" ? afterSheet : null,
        date: stampDate(),
      };
    }

    // Write first. The animation is decoration on top; it never holds the decision hostage.
    let earned = 0;
    if (choice === "pass") actions.pass(id);
    else if (choice === "save") actions.toggleSave(id);
    else earned = actions.complete(id, title);

    enter.current = {
      id: null,
      from: underTransform(1, UNDER[0].rot, settle, readRotK(deck)),
      fade: false,
      // After "did it" the next card waits under the stamped one until it lifts away.
      delay: choice === "done" && !reduce ? HOLD_DONE + (fromPreview ? SHEET_EXIT : 0) : 0,
    };
    resetDrag();
    setLast({ key: ++keys.current, id, title, choice, earned, ...(choice === "done" ? { before } : {}) });
    if (ghost) {
      const leaving: Ghost = { ...ghost, earned };
      setGhosts((list) => [...list.slice(-1), leaving]);
    }
    // Keyboard deciders keep their place: focus moves to the next card once it has rendered (or to
    // the empty slot, when that was the last card).
    if (hadFocus) afterCommit(focusDeck);
  }

  function undo() {
    if (!last) return;
    if (last.choice === "done") {
      if (last.before) actions.undoComplete(last.id, last.before);
    } else actions.undoChoice(last.id, last.choice);
    // It comes back from where it went: from the left after a pass, from above after save/did it.
    enter.current = {
      id: last.id,
      from: last.choice === "pass" ? "translate(-64px, 8px) rotate(-6deg)" : "translateY(-16px) scale(0.94)",
      fade: true,
      delay: 0,
    };
    // If it's still on its way out, call the copy back too: the card can't be in two places.
    const id = last.id;
    setGhosts((list) => list.filter((ghost) => ghost.item.quest.id !== id));
    setLast(null);
    afterCommit(focusDeck);
  }

  function go() {
    const item = items[0];
    if (!item) return;
    void navigate({ to: "/go/$questId", params: { questId: item.quest.id }, viewTransition: !reducedMotion() });
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (!current || (event.pointerType === "mouse" && event.button !== 0)) return;
    if ((event.target as HTMLElement).closest("a, button")) return;
    ignoreCardClick.current = false;
    // A mouse can leave the card before the first move event. Capture it immediately;
    // touch still waits for a horizontal intent so vertical page scrolling works.
    if (event.pointerType === "mouse") {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    drag.current.limit = commitDistance(event.pointerType, event.currentTarget.clientWidth);
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), pointerType: event.pointerType, axis: event.pointerType === "mouse" ? "horizontal" : "pending" };
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const move = gesture.current;
    if (!move || move.id !== event.pointerId) return;
    const dx = event.clientX - move.x;
    const dy = event.clientY - move.y;
    if (move.axis === "pending" && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
      move.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "horizontal" : "vertical";
      ignoreCardClick.current = true;
      if (move.axis === "horizontal" && !event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (move.axis !== "horizontal") return;
    if (Math.abs(dx) > 8) ignoreCardClick.current = true;
    const d = drag.current;
    if (!d.live && Math.abs(dx) > 3) {
      // Picked up: a card still arriving stops where it is and follows the finger from there.
      d.live = true;
      for (const animation of event.currentTarget.getAnimations()) animation.cancel();
      setDragging(true);
    }
    if (!d.live) return;
    d.x = move.pointerType === "touch" ? dx * 0.9 : dx;
    if (!d.raf) d.raf = requestAnimationFrame(paint);
  }

  function finish(event: PointerEvent<HTMLElement>, cancelled = false) {
    const move = gesture.current;
    if (!move || move.id !== event.pointerId) return;
    gesture.current = null;
    const wasLive = drag.current.live;
    if (move.axis !== "horizontal" || cancelled || !wasLive) {
      if (wasLive) resetDrag();
      return;
    }
    const dx = event.clientX - move.x;
    const elapsed = Math.max(performance.now() - move.at, 1);
    const distance = Math.abs(dx);
    const speed = distance / elapsed;
    const isTouch = move.pointerType === "touch";
    const committed = isTouch
      ? distance >= Math.max(115, event.currentTarget.clientWidth * 0.3) || (distance >= 85 && speed > 1.05)
      : distance >= 95 || (distance >= 45 && speed > 0.65);
    if (committed) choose(dx > 0 ? "save" : "pass");
    else resetDrag();
  }

  const note = last ? (last.choice === "pass" ? "passed" : last.choice === "save" ? "saved to Lists" : last.earned ? `did it · +${last.earned} XP` : "did it") : null;
  const status = last
    ? last.choice === "pass"
      ? `Passed ${last.title}.`
      : last.choice === "save"
        ? `Saved ${last.title} to Lists.`
        : `Did ${last.title}.${last.earned ? ` Plus ${last.earned} XP.` : ""}`
    : "";

  return (
    <section aria-label="Quest postcards" className="deck-section mt-4 max-sm:[@media(max-height:45rem)]:mt-3 sm:mt-6" data-deal={deal}>
      {current ? (
        <div ref={deckRef} className="deck" aria-live="off">
          {/* Deepest first, so each card naturally sits under the one before it. */}
          {stack
            .map((item, index) => ({ item, level: index + 1 }))
            .reverse()
            .map(({ item, level }) => (
              <UnderCard key={item.quest.id} item={item} level={level} dealIndex={stack.length - level} deal={deal} />
            ))}
          <article
            ref={cardRef}
            key={current.quest.id}
            className="deck-card deck-top focus-visible:outline-offset-4"
            data-fresh={fresh ? "" : undefined}
            style={{ "--deal-i": stack.length, "--deal-rot": "-2.5deg" } as CSSProperties}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => finish(event)}
            onPointerCancel={(event) => finish(event, true)}
            onDragStart={(event) => event.preventDefault()}
            onClick={(event) => {
              if (ignoreCardClick.current) {
                ignoreCardClick.current = false;
                return;
              }
              if ((event.target as HTMLElement).closest("a, button")) return;
              openPreview();
            }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                choose(event.key === "ArrowRight" ? "save" : "pass");
              } else if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openPreview();
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`${current.quest.title}. Open quest. Press left arrow to pass, right arrow to save.`}
          >
            <PostcardFace item={current} priority heading>
              <span aria-hidden className="deck-intent" data-kind="save">
                save
              </span>
              <span aria-hidden className="deck-intent" data-kind="pass">
                pass
              </span>
            </PostcardFace>
            {/* The colour of where the card is heading, rising from that side as you drag. */}
            <span aria-hidden className="deck-wash" data-kind="pass" />
            <span aria-hidden className="deck-wash" data-kind="save" />
          </article>
        </div>
      ) : (
        <EmptyDeck deal={deal} focusRef={emptyRef} />
      )}

      <div className="deck-after">
        {current ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:mx-auto sm:mt-8 sm:max-w-[26rem] sm:gap-4">
            {/* The deck's one decision, as two equal halves: Pass (paper, quieter ink) on the side
                a pass throws the card, Save (the one clover action) on the side it files it. Each
                lights up in its colour while a drag is past the point where letting go counts. */}
            <button
              ref={passRef}
              type="button"
              data-kind="pass"
              onClick={() => choose("pass")}
              aria-label={`Pass: ${current.quest.title}`}
              className={cn(
                buttonClass({ variant: "outline" }),
                "deck-action text-muted-foreground hover:text-foreground data-armed:border-destructive data-armed:bg-[color-mix(in_srgb,var(--destructive)_9%,var(--card))] data-armed:text-destructive",
              )}
            >
              <X aria-hidden className="size-[18px]" strokeWidth={1.75} /> Pass
            </button>
            <button
              ref={saveRef}
              type="button"
              data-kind="save"
              onClick={() => choose("save")}
              aria-label={`Save ${current.quest.title}`}
              className={cn(buttonClass({ variant: "primary" }), "deck-action data-armed:bg-[color-mix(in_srgb,var(--primary)_68%,var(--ring))]")}
            >
              <Bookmark aria-hidden className="size-[18px]" strokeWidth={1.75} /> Save
            </button>
          </div>
        ) : null}
        {/* One reserved line for the hint, then for what just happened and its undo: nothing shifts.
            The question mark stays at the end of it either way, for whenever the deck is confusing. */}
        <div className="mt-2 flex min-h-10 items-center justify-center gap-4 text-center font-hand text-base leading-tight text-muted-foreground max-sm:[@media(max-height:45rem)]:mt-1 max-sm:[@media(max-height:45rem)]:min-h-8 sm:mt-3 sm:text-[17px]">
          <p className="flex flex-wrap items-center justify-center">
            {last && note ? (
              <span key={last.key} className="morph-in inline-flex items-center">
                {note}
                <span aria-hidden className="mx-2">
                  ·
                </span>
                <button type="button" onClick={undo} aria-label="Undo last choice" className="deck-undo">
                  undo
                </button>
              </span>
            ) : current ? (
              <>
                <span className="pointer-fine:hidden">swipe left to pass · right to save</span>
                <span className="hidden items-center gap-1.5 pointer-fine:inline-flex">
                  <kbd className="deck-kbd">←</kbd>
                  pass
                  <span aria-hidden className="mx-1">
                    ·
                  </span>
                  <kbd className="deck-kbd">→</kbd>
                  save
                </span>
              </>
            ) : null}
          </p>
          {current ? <DeckHelp /> : null}
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          {status}
        </span>
      </div>

      {preview ? (
        <QuestPreviewDialog
          item={preview}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          onPass={() => {
            setPreviewOpen(false);
            choose("pass", { fromPreview: true });
          }}
          onSave={() => {
            setPreviewOpen(false);
            choose("save", { fromPreview: true });
          }}
          onAlreadyDone={() => {
            setPreviewOpen(false);
            choose("done", { fromPreview: true });
          }}
          onGo={go}
          onReturnFocus={focusDeck}
          onClosed={sheetClosed}
        />
      ) : null}

      {ghosts.length ? createPortal(ghosts.map((ghost) => <LeavingCard key={ghost.key} ghost={ghost} onDone={dropGhost} />), document.body) : null}
    </section>
  );
}

/**
 * The face of a postcard: the printed photo on white paper, then the note, title, hook and address
 * line. On the landscape card (lg) the copy half is the back of the postcard: a postage stamp (the
 * quest's vibe doodle) in the corner and, where there's the height, the address written on ruled
 * lines at the bottom (quests.css .deck-meta-*).
 */
function PostcardFace({ item, priority = false, heading = false, children }: { item: ScoredQuest; priority?: boolean; heading?: boolean; children?: ReactNode }) {
  const { quest } = item;
  const Title = heading ? "h2" : "p";
  const vibe = quest.vibes[0];
  return (
    <div className="deck-face lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="deck-face-photo relative px-2.5 pt-2.5 sm:px-3 sm:pt-3 lg:flex lg:flex-col lg:pb-3">
        <PhotoPrint
          src={questImage(quest)}
          alt={`${quest.location.name}, ${quest.location.area}`}
          priority={priority}
          className={cn("rounded-[3px] border-0 bg-muted p-0 lg:flex-1", PHOTO_MIN_LG)}
          imgClassName={cn("select-none rounded-[3px]", PHOTO_H)}
        >
          <span aria-hidden className="deck-photo-edge" />
        </PhotoPrint>
        {children}
      </div>
      <div className="deck-copy flex min-w-0 flex-col px-4 pb-4 pt-3 max-sm:[@media(max-height:45rem)]:pb-3 max-sm:[@media(max-height:45rem)]:pt-2 sm:px-6 sm:pb-5 sm:pt-4 lg:px-8 lg:py-7">
        {/* flow-root keeps the postage stamp's float inside the note and title. */}
        <div className="flow-root">
          {vibe ? (
            <span aria-hidden className="deck-postage">
              <Doodle name={VIBE_DOODLE[vibe]} size={44} block />
            </span>
          ) : null}
          <p className="font-hand text-[17px] leading-snug text-foreground/75 sm:text-xl">{reasonLine(item)}</p>
          <Title className="mt-0.5 text-balance text-2xl font-semibold leading-[1.12] tracking-[-0.015em] sm:text-3xl lg:mt-1.5 lg:text-[2.25rem]">{quest.title}</Title>
        </div>
        <p className="mt-1.5 line-clamp-2 text-pretty text-[15px] leading-snug sm:mt-2.5 sm:text-base lg:line-clamp-4 lg:text-[17px]">{quest.hook}</p>
        <div className="deck-meta-inline">
          <QuestMeta item={item} className="border-t border-border pt-2.5 text-[13px] text-muted-foreground max-sm:[@media(max-height:45rem)]:pt-2 sm:pt-3 sm:text-sm" />
        </div>
        <div className="deck-meta-lines">
          <QuestMeta item={item} lines className="text-sm text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

/** A card waiting in the stack. Only the next one has a face; deeper ones show just their edge. */
function UnderCard({ item, level, dealIndex, deal }: { item: ScoredQuest; level: number; dealIndex: number; deal: Deal }) {
  // A card that joins the stack after the deal fades in; the dealt ones arrive with the deal.
  const [joined] = useState(deal === "done");
  const spot = UNDER[level - 1] ?? UNDER[2];
  return (
    <div
      aria-hidden
      data-n={spot.n}
      className={cn("deck-card deck-under", joined && "deck-under-in")}
      style={{ "--n": spot.n, "--rot": `${spot.rot}deg`, "--deal-i": dealIndex, "--deal-rot": `${spot.deal}deg`, zIndex: 4 - spot.n } as CSSProperties}
    >
      {spot.n === 1 ? <PostcardFace item={item} /> : null}
    </div>
  );
}

function EmptyDeck({ deal, focusRef }: { deal: Deal; focusRef: RefObject<HTMLDivElement | null> }) {
  const [arrived] = useState(deal === "done");
  return (
    <div
      ref={focusRef}
      // Focusable only by script: after the last decision, keyboard focus lands here instead of the page.
      tabIndex={-1}
      className={cn("deck-empty grid place-items-center px-6 py-16 text-center sm:py-24", arrived && "deck-empty-in")}
      aria-live="polite"
    >
      <div>
        <Doodle name="late-night" size={72} block className="mx-auto mb-4 -rotate-6" />
        <p className="font-hand text-2xl leading-tight sm:text-3xl">all caught up for now</p>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-muted-foreground">
          Check back soon, or find saved quests in{" "}
          <Link to="/" search={{ tab: "mine" }} className="font-medium text-foreground underline decoration-foreground/30 decoration-[1.5px] underline-offset-4 transition-colors hover:decoration-foreground">
            Lists
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/** The deck's "how does this work?": the whole loop in four lines, one tap from the hint. */
function DeckHelp() {
  const ui = "font-medium text-foreground";
  return (
    <HelpDot label="How Quests work" title="How Quests work" side="top" align="center" className="font-sans">
      <ul className="space-y-1.5">
        <li>
          Swipe right or tap <span className={ui}>Save</span> to keep it in Lists.
        </li>
        <li>
          Swipe left or tap <span className={ui}>Pass</span> to skip it for now.
        </li>
        <li>
          Tap a card for the details and <span className={ui}>Let&rsquo;s go</span>.
        </li>
        <li>
          Finish a quest with <span className={ui}>Let&rsquo;s go</span> and it gets stamped (+XP).
        </li>
      </ul>
    </HelpDot>
  );
}

/** "+120 XP" in handwriting on a slip of paper, rising off the stamp and fading. */
function riseNote(from: DOMRect, text: string) {
  if (reducedMotion()) return;
  const el = document.createElement("span");
  el.className = "deck-xp-note";
  el.setAttribute("aria-hidden", "true");
  el.textContent = text;
  el.style.left = `${from.left + from.width / 2}px`;
  el.style.top = `${from.top}px`;
  document.body.append(el);
  const animation = el.animate(
    [
      { transform: "translate(-50%, -20%) rotate(-4deg) scale(0.7)", opacity: 0 },
      { transform: "translate(-50%, -115%) rotate(-4deg) scale(1.06)", opacity: 1, offset: 0.2 },
      { transform: "translate(-50%, -140%) rotate(-4deg) scale(1)", opacity: 1, offset: 0.62 },
      { transform: "translate(-50%, -200%) rotate(-4deg) scale(1)", opacity: 0 },
    ],
    { duration: 1150, easing: EASE_OUT, fill: "both" },
  );
  animation.onfinish = () => el.remove();
  animation.oncancel = () => el.remove();
}

/**
 * The card you just decided on, drawn over the page where it was and sent where it belongs.
 * The deck underneath has already moved on, so none of this blocks the next decision.
 */
function LeavingCard({ ghost, onDone }: { ghost: Ghost; onDone: (key: number) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [stamped, setStamped] = useState(ghost.choice === "done" && !ghost.afterSheet);
  const finished = useRef(onDone);
  finished.current = onDone;

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const { choice, from, box, delay, intent, wash } = ghost;
    const reduce = reducedMotion();
    const timers: number[] = [];
    const later = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));
    const animations: Animation[] = [];
    let stopWaiting: (() => void) | null = null;
    /** The animation that ends this card's trip; the copy is dropped when it finishes. */
    const leave = (exit: Animation) => {
      animations.push(exit);
      exit.onfinish = () => finished.current(ghost.key);
    };

    if (choice === "pass" || choice === "save") {
      // The decision inks fully as it goes, stamp and colour (either may be part-way from the drag).
      const stamp = el.querySelector<HTMLElement>(".deck-intent");
      if (stamp) {
        animations.push(stamp.animate([{ opacity: intent, scale: intent > 0.9 ? 1.08 : 1.25 }, { opacity: 1, scale: 1 }], { duration: 150, delay, easing: EASE_OUT, fill: "backwards" }));
      }
      const tint = el.querySelector<HTMLElement>(".deck-wash");
      if (tint) animations.push(tint.animate([{ opacity: wash }, { opacity: 1 }], { duration: 150, delay, easing: EASE_OUT, fill: "backwards" }));
    }

    if (choice === "pass") {
      // Thrown off to the left, turning as it goes.
      const off = -(box.left + box.width + 80);
      leave(el.animate([{ transform: from }, { transform: `translate(${off}px, 56px) rotate(-18deg)` }], { duration: 340, delay: delay + 60, easing: EASE_IN, fill: "forwards" }));
    } else if (choice === "save") {
      // Filed away: it lifts, then folds down to nothing while a small print of it flies to Lists.
      leave(
        el.animate(
          [
            { transform: from, opacity: 1, easing: EASE_OUT },
            { transform: `${from} translateY(-10px) scale(1.02)`, opacity: 1, offset: 0.3, easing: EASE_IN },
            { transform: `${from} translateY(-22px) scale(0.55)`, opacity: 0 },
          ],
          { duration: 380, delay, fill: "forwards" },
        ),
      );
      later(delay + 110, () => flyToNav(el, "quests", questImage(ghost.item.quest)));
    } else {
      // Postmark: the stamp slams on (Stamp does the slam), the card gives under it, sparks and the
      // XP rise off the stamp itself, it's held long enough to read, then the card lifts away.
      const postmark = () => {
        if (reduce) {
          leave(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DURATION.quick, delay: 900, easing: EASE_IN, fill: "forwards" }));
          return;
        }
        animations.push(el.animate([{ transform: from }, { transform: `${from} translateY(1px) scale(0.988)`, offset: 0.35 }, { transform: from }], { duration: 240, delay: 260, easing: EASE_OUT }));
        later(260, () => {
          const stamp = el.querySelector(".deck-postmark .stamp");
          if (stamp) {
            const r = stamp.getBoundingClientRect();
            burst(r.left + r.width / 2, r.top + r.height / 2, { sparks: 9, stars: 3, spread: 46 });
            if (ghost.earned) riseNote(r, `+${ghost.earned} XP`);
          }
          buzz(12);
        });
        leave(el.animate([{ transform: from }, { transform: `${from} translateY(${-(box.top + box.height + 80)}px) rotate(3deg)` }], { duration: 380, delay: HOLD_DONE, easing: EASE_IN, fill: "forwards" }));
      };
      if (ghost.afterSheet) {
        // Wait for the preview sheet to be gone, then press the stamp on.
        stopWaiting = ghost.afterSheet(() => {
          setStamped(true);
          postmark();
        });
      } else postmark();
    }

    return () => {
      stopWaiting?.();
      for (const animation of animations) animation.cancel();
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [ghost]);

  const { box, choice } = ghost;
  return (
    <div
      ref={root}
      aria-hidden
      className="deck-card pointer-events-none fixed"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height, transform: ghost.from, zIndex: 45 }}
    >
      <PostcardFace item={ghost.item} priority>
        {choice === "done" ? (
          stamped ? (
            <span className="deck-postmark">
              {/* It lands half on the photo, so it gets its paper disc to read over any picture. */}
              <Stamp label="did it" sub={ghost.date} size={108} tilt={-12} slam backed />
            </span>
          ) : null
        ) : (
          <span className="deck-intent" data-kind={choice} style={{ "--pass": 1, "--save": 1 } as CSSProperties}>
            {choice}
          </span>
        )}
      </PostcardFace>
      {choice === "done" ? null : <span className="deck-wash" data-kind={choice} style={{ "--wash": 1 } as CSSProperties} />}
    </div>
  );
}
