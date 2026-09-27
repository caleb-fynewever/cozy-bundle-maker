import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { Doodle } from "@/components/Doodle";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Avatar, PageHeader, Tally, textButtonClass } from "@/components/ui-kit";
import { Stamp } from "@/components/Stamp";
import { Tabs } from "@/components/Tabs";
import { BOARDS, SCOPES, boardKeyOf, nextUp, passedLine, passedSince, rankBoard, rankOf, type BoardKey, type Entry, type Scope } from "@/lib/leaderboard";
import { EASE_OUT, SPRING, burst, flip, reducedMotion } from "@/lib/motion";
import { actions, useUserState } from "@/lib/store";
import { cn } from "@/lib/utils";

/*
 * Local Legends, the squad leaderboard (Squad page, #ranks). Switching boards reshuffles the rows
 * with FLIP. It also remembers the rank you last saw on each board (store.ranksSeen): if you have
 * moved up since, your row starts in its old slot, lifts, glides up past the people you passed, and
 * "passed Alex" is written in under your name. Once per change; a first visit or a drop settles
 * silently. Under reduced motion you get the final order and the note.
 */

type Row = { kind: "entry"; entry: Entry; rank: number } | { kind: "gap"; id: string };
type Note = { text: string; fresh: boolean };

/** Boards up to this long show everyone; longer ones show the top and your neighbourhood. */
const SHOW_ALL_UP_TO = 8;
const TOP = 5;
/** How far the board tabs' faded edges reach, in px (matches .legends-boards in squad.css). */
const EDGE = 40;

const SCOPE_LABEL: Record<Scope, string> = { friends: "Your Squads", everyone: "Global" };

/**
 * A quiet choice in a section heading's action slot ("within 3 mi", "Your squad"): the value in ink,
 * a chevron, a surface wash on hover. It hangs a little below the slot so its text sits on the
 * section title's baseline.
 */
export function QuietSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  className,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <span className={cn("relative -mb-2.5 inline-flex items-center", className)}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="press -mr-2 min-h-11 cursor-pointer appearance-none rounded-md bg-transparent py-2 pl-3 pr-8 text-sm font-medium text-foreground hover:bg-surface"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-0.5 h-4 w-4 text-muted-foreground" />
    </span>
  );
}

function visibleRows(entries: Entry[], expanded: boolean): Row[] {
  const all: Row[] = entries.map((entry, i) => ({ kind: "entry", entry, rank: i + 1 }));
  if (expanded || entries.length <= SHOW_ALL_UP_TO) return all;
  const me = entries.findIndex((e) => e.you);
  const keep = new Set<number>();
  for (let i = 0; i < Math.min(TOP, entries.length); i++) keep.add(i);
  for (const i of [me - 1, me, me + 1]) if (i >= 0 && i < entries.length) keep.add(i);
  const rows: Row[] = [];
  let last = -1;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (last >= 0 && i > last + 1) rows.push({ kind: "gap", id: `gap-${i}` });
    rows.push(all[i]!);
    last = i;
  }
  return rows;
}

/** The #1 mark arrives with a small pop; reaching it yourself adds a little burst of clover. */
function popCrown(row: HTMLElement | undefined, celebrate = false) {
  const crown = row?.querySelector<HTMLElement>("[data-crown]");
  if (!crown || reducedMotion()) return;
  crown.animate(
    [
      { transform: "scale(0.4)", opacity: 0 },
      { transform: "scale(1)", opacity: 1 },
    ],
    { duration: 460, easing: SPRING },
  );
  if (celebrate) {
    const r = crown.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, { sparks: 8, stars: 2, spread: 30 });
  }
}

export function LocalLegends({ className }: { className?: string }) {
  const state = useUserState();
  const [key, setKey] = useState<BoardKey>("week");
  const [scope, setScope] = useState<Scope>("friends");
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  /**
   * While an overtake plays: your old rank (null once it has rolled over) and the people you passed,
   * who keep their old ranks until yours rolls too. Your note slot stays empty until "passed Alex"
   * is written into it.
   */
  const [held, setHeld] = useState<{ boardKey: string; rank: number | null; passed: string[] } | null>(null);
  /** "passed Alex" per board, kept for the visit. */
  const [notes, setNotes] = useState<Record<string, Note>>({});

  const board = BOARDS.find((b) => b.key === key)!;
  const boardKey = boardKeyOf(key, scope);
  const entries = useMemo(() => rankBoard(state, key, scope), [state, key, scope]);
  const rows = useMemo(() => visibleRows(entries, expanded), [entries, expanded]);
  const collapsible = entries.length > SHOW_ALL_UP_TO && visibleRows(entries, false).filter((r) => r.kind === "entry").length < entries.length;
  const myRank = rankOf(entries);
  const seen = state.ranksSeen[boardKey];
  const sig = entries.map((e) => `${e.id}:${e.value}`).join("|");
  const squadSig = state.squadIds.join(",");
  const onlyYou = entries.length === 1;
  const hint = nextUp(entries, board);
  const note = notes[boardKey];
  const holding = held?.boardKey === boardKey;
  const rolling = holding ? held : null;

  const boardsRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef(new Map<string, HTMLLIElement>());
  const before = useRef<Map<string, number> | null>(null);
  const topId = useRef<string | null>(null);
  const booted = useRef(false);
  const lastSquad = useRef<string | null>(null);
  const latest = useRef({ state, entries, rows });
  latest.current = { state, entries, rows };

  // The store hydrates in AppShell's mount effect, which runs after this one; nothing is read from
  // or written to rank memory until then, so a first render never overwrites saved state.
  useEffect(() => {
    setReady(true);
  }, []);

  /** Switch board, scope or length, remembering where every row was so the new order can glide. */
  const change = (update: () => void) => {
    const tops = new Map<string, number>();
    rowEls.current.forEach((el, id) => tops.set(id, el.getBoundingClientRect().top));
    before.current = tops;
    setNotes((all) => Object.fromEntries(Object.entries(all).map(([k, v]) => [k, { ...v, fresh: false }])));
    update();
  };

  // FLIP after a switch: moved rows glide from their old place, new rows rise in, a new #1 pops.
  useLayoutEffect(() => {
    const tops = before.current;
    before.current = null;
    const firstId = latest.current.entries[0]?.id ?? null;
    const newTop = topId.current !== null && firstId !== topId.current;
    topId.current = firstId;
    if (!tops || reducedMotion()) return;
    const ordered = new Map<string, HTMLElement>();
    for (const row of latest.current.rows) {
      if (row.kind !== "entry") continue;
      const el = rowEls.current.get(row.entry.id);
      if (el) ordered.set(row.entry.id, el);
    }
    flip(ordered, tops, { stagger: 18, duration: 420 });
    let entering = 0;
    ordered.forEach((el, id) => {
      if (tops.has(id)) return;
      el.animate(
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 260, easing: EASE_OUT, delay: 80 + entering++ * 30, fill: "backwards" },
      );
    });
    if (newTop && firstId) popCrown(ordered.get(firstId));
  });

  // Keep the chosen board tab in view on phones, where the board tabs scroll sideways (clear of the
  // faded edges).
  useLayoutEffect(() => {
    const scroller = boardsRef.current;
    const tab = scroller?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!scroller || !tab) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left < scroller.scrollLeft + EDGE || right > scroller.scrollLeft + scroller.clientWidth - EDGE) {
      scroller.scrollTo({ left: Math.max(0, left - EDGE), behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }, [key]);

  // When the board tabs run past an edge, that edge fades out so the cut-off tab reads as "more".
  useEffect(() => {
    const scroller = boardsRef.current;
    if (!scroller) return;
    const edges = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      scroller.toggleAttribute("data-fade-start", scroller.scrollLeft > 1);
      scroller.toggleAttribute("data-fade-end", scroller.scrollLeft < max - 1);
    };
    edges();
    scroller.addEventListener("scroll", edges, { passive: true });
    const observer = new ResizeObserver(edges);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", edges);
      observer.disconnect();
    };
  }, []);

  // Overtake: rank memory, and the moment you pass someone.
  useLayoutEffect(() => {
    if (!ready) return;
    const { state, entries } = latest.current;

    // First look this visit: remember boards you have not been ranked on, let drops settle
    // silently, and open on a board where you moved up so the moment has somewhere to play.
    if (!booted.current) {
      booted.current = true;
      lastSquad.current = squadSig;
      let pick: [BoardKey, Scope] | null = null;
      const baseline: Record<string, number> = {};
      for (const b of BOARDS) {
        for (const s of SCOPES) {
          const k = boardKeyOf(b.key, s);
          const rank = rankOf(rankBoard(state, b.key, s));
          const was = state.ranksSeen[k];
          if (was === undefined || rank > was) baseline[k] = rank;
          else if (rank < was && !pick) pick = [b.key, s];
        }
      }
      // One store write for every board, not one per board (this runs before paint).
      actions.seeRanks(baseline);
      if (pick && boardKeyOf(pick[0], pick[1]) !== boardKey) {
        setKey(pick[0]);
        setScope(pick[1]);
        return;
      }
    }

    // Removing someone above you (or adding someone) changes squad ranks without anyone being
    // passed, so squad boards re-baseline quietly.
    if (lastSquad.current !== squadSig) {
      lastSquad.current = squadSig;
      const rebased: Record<string, number> = {};
      for (const b of BOARDS) {
        const k = boardKeyOf(b.key, "friends");
        const rank = rankOf(rankBoard(state, b.key, "friends"));
        if (state.ranksSeen[k] !== undefined && state.ranksSeen[k] !== rank) rebased[k] = rank;
      }
      actions.seeRanks(rebased);
      if (scope === "friends") return;
    }

    if (seen === undefined) {
      actions.seeRank(boardKey, myRank);
      return;
    }
    if (myRank >= seen) {
      if (myRank > seen) {
        actions.seeRank(boardKey, myRank);
        setNotes((all) => {
          const next = { ...all };
          delete next[boardKey];
          return next;
        });
      }
      return;
    }

    // You moved up since you last looked.
    const passed = passedSince(entries, seen);
    const text = passedLine(passed) ?? "moved up";
    const from = seen;
    const to = myRank;
    const memoryKey = boardKey;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setHeld(null);
      setNotes((all) => ({ ...all, [memoryKey]: { text, fresh: true } }));
      actions.seeRank(memoryKey, to);
    };

    const you = rowEls.current.get("you");
    const passedEls = passed.map((p) => rowEls.current.get(p.id)).filter((el): el is HTMLLIElement => Boolean(el));
    const last = passedEls.at(-1);
    if (!you || !last || reducedMotion()) {
      finish();
      if (to === 1) popCrown(you, true);
      return;
    }

    // Render the new order, but hold your row in its old slot (and the people you passed one slot
    // up) with paused animations until the row is actually on screen.
    const h = you.offsetHeight;
    const dy = last.offsetTop + last.offsetHeight - (you.offsetTop + h);
    const glide = you.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 640, easing: SPRING, fill: "backwards" });
    const nudges = passedEls.map((el, i) =>
      el.animate(
        [{ transform: `translateY(${-h}px)` }, { transform: "translateY(3px)", offset: 0.72 }, { transform: "none" }],
        { duration: 460, delay: 80 + i * 40, easing: EASE_OUT, fill: "backwards" },
      ),
    );
    const moves = [glide, ...nudges];
    for (const move of moves) move.pause();
    you.dataset["overtaking"] = "";
    const slip = you.querySelector<HTMLElement>("[data-row]");
    const passedIds = passed.map((p) => p.id);
    setHeld({ boardKey: memoryKey, rank: from, passed: passedIds });

    const timers: number[] = [];
    let started = false;
    let visible = false;
    const begin = () => {
      if (started || !visible || document.hidden) return;
      started = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", begin);
      // Lift, glide past, roll the rank, set down, then write the note.
      timers.push(window.setTimeout(() => slip?.setAttribute("data-lift", ""), 200));
      timers.push(
        window.setTimeout(() => {
          for (const move of moves) move.play();
        }, 320),
      );
      timers.push(
        window.setTimeout(() => {
          flushSync(() => setHeld({ boardKey: memoryKey, rank: null, passed: passedIds }));
          if (to === 1) popCrown(you, true);
        }, 640),
      );
      timers.push(window.setTimeout(() => slip?.removeAttribute("data-lift"), 840));
      timers.push(window.setTimeout(finish, 980));
    };
    const observer = new IntersectionObserver(
      (records) => {
        visible = records.some((r) => r.isIntersecting && r.intersectionRatio >= 0.6);
        begin();
      },
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(you);
    document.addEventListener("visibilitychange", begin);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", begin);
      for (const timer of timers) window.clearTimeout(timer);
      slip?.removeAttribute("data-lift");
      delete you.dataset["overtaking"];
      if (done) return;
      for (const move of moves) move.cancel();
      // Interrupted mid-glide still counts as seen; never shown means it can play next time.
      if (started) finish();
      else setHeld(null);
    };
  }, [ready, boardKey, scope, myRank, seen, sig, squadSig]);

  return (
    <section id="ranks" aria-labelledby="ranks-heading" className={`scroll-mt-24 ${className ?? ""}`}>
      <PageHeader
          title={<span id="ranks-heading">Ranks</span>}
          eyebrow="a little friendly competition"
          action={
            <div className="legends-scope" role="group" aria-label="Who to compare with" data-scope={scope}>
              <span className="legends-scope-indicator" aria-hidden />
              {SCOPES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={scope === option}
                  aria-controls="legends-panel"
                  onClick={() => {
                    if (scope !== option) change(() => setScope(option));
                  }}
                >
                  {SCOPE_LABEL[option]}
                </button>
              ))}
            </div>
          }
      />

      <div ref={boardsRef} className="legends-boards hide-scrollbar -mx-5 mt-3 overflow-x-auto px-5 py-1 md:-mx-1 md:px-1">
        <Tabs
          idPrefix="legends-board"
          label="Leaderboard"
          value={key}
          onChange={(next) => change(() => setKey(next))}
          tabs={BOARDS.map((b) => ({ id: b.key, label: b.title, controls: "legends-panel" }))}
          className="w-max min-w-full whitespace-nowrap"
        />
      </div>

      <div id="legends-panel" role="tabpanel" aria-labelledby={`legends-board-${key}-tab`} className="mt-2">
        <ol className="legends-list">
          {rows.map((row) => {
            if (row.kind === "gap") return <li key={row.id} aria-hidden className="legend-gap" />;
            const { entry, rank } = row;
            const sharedSquads = scope === "friends"
              ? state.squads.filter((squad) => entry.you || squad.memberIds.includes(entry.id) || squad.leaderId === entry.id)
              : [];
            // Mid-overtake, you and the people you passed show the old order's ranks, then all roll together.
            const passedRow = rolling?.passed.includes(entry.id) ?? false;
            const before = rolling && rolling.rank !== null ? (entry.you ? rolling.rank : passedRow ? rank - 1 : null) : null;
            const shown = before ?? rank;
            return (
              <li
                key={entry.id}
                ref={(el) => {
                  if (el) rowEls.current.set(entry.id, el);
                  else rowEls.current.delete(entry.id);
                }}
                className="legend-item"
                data-you={entry.you || undefined}
              >
                <Link
                  to="/profile"
                  search={{ handle: entry.handle }}
                  data-row
                  aria-label={`${shown}. ${entry.name}${entry.you ? " (you)" : ""}, ${board.unit(entry.value)}${sharedSquads.length ? `, squads: ${sharedSquads.map((squad) => squad.name).join(", ")}` : ""}`}
                  className="legend-row"
                >
                  {shown === 1 ? (
                    <span data-crown className="legend-crown">
                      <Doodle name="competitive" size={34} />
                      <span className="sr-only">1</span>
                    </span>
                  ) : (
                    <span className="legend-rank">{entry.you || passedRow ? <Tally value={shown} /> : shown}</span>
                  )}
                  <Avatar name={entry.name} you={entry.you} size={40} imageUrl={entry.photo} />
                  <span className="relative min-w-0">
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span className="truncate font-semibold">{entry.name}</span>
                      {entry.you ? <span className="shrink-0 font-hand text-base leading-none text-muted-foreground">you</span> : null}
                    </span>
                    {entry.you ? (
                      <span className="block min-h-5 font-hand text-base leading-tight text-pretty" aria-live="polite">
                        {holding ? null : note ? (
                          <span key={note.text} className="passed-note" data-fresh={note.fresh || undefined}>
                            {note.text}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{hint ?? entry.level}</span>
                        )}
                      </span>
                    ) : (
                      <span className="block truncate text-sm text-muted-foreground">{entry.level}</span>
                    )}
                    {sharedSquads.length > 0 ? (
                      <span className="legend-squads" aria-label={entry.you ? "Your squads" : "Shared squads"}>
                        {sharedSquads.map((squad) => (
                          <span className="legend-squad" key={squad.id}>{squad.name}</span>
                        ))}
                      </span>
                    ) : null}
                    {entry.you && note && !holding ? (
                      <span aria-hidden className="legend-stamp max-sm:hidden">
                        <Stamp label="passed" size={58} tilt={-9} slam={note.fresh} />
                      </span>
                    ) : null}
                  </span>
                  <span className="whitespace-nowrap text-right">
                    <Tally value={entry.value} className="text-base font-semibold text-foreground" />
                    <span className="ml-1 text-sm text-muted-foreground">{board.suffix(entry.value)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>

      {collapsible ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="legends-panel"
          onClick={() => change(() => setExpanded((open) => !open))}
          className={`${textButtonClass} mt-2`}
        >
          {expanded ? "Show fewer" : `Show all ${entries.length}`}
        </button>
      ) : null}

      {onlyYou ? (
        <p className="mt-6 text-muted-foreground text-pretty">
          It's just you so far.{" "}
          <a href="#find-squad" className="font-semibold text-foreground underline underline-offset-4">
            Find people for your squad
          </a>{" "}
          to see how you stack up.
        </p>
      ) : null}
    </section>
  );
}
