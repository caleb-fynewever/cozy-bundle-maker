import { Link, useRouterState } from "@tanstack/react-router";
import { Doodle } from "@/components/Doodle";
import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Bookmark, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { CAMPUS_ORIGIN, distanceMi } from "@/lib/engine";
import { ALL_QUESTS } from "@/data/quests";
import { actions, useUserState } from "@/lib/store";
import type { Quest, SessionContext } from "@/lib/types";
import { questImage } from "@/lib/imagery";
import { walkLabel } from "@/lib/maps";
import { EASE_IN, flip, reducedMotion } from "@/lib/motion";
import { parseWhen, whenLabel } from "@/lib/when";
import { QuestDirections } from "@/components/QuestDirections";
import { SectionHeading, Tally, buttonClass, textButtonClass } from "@/components/ui-kit";
import { cn } from "@/lib/utils";


type ShelfKind = "active" | "scheduled" | "saved" | "created";

/**
 * Names the clicked row's photo so it can glide into the next page (the Let's go morph). Only one
 * element may carry the name at a time, so any earlier one is cleared first.
 */
function namePhoto(event: MouseEvent<HTMLElement>) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  document.querySelectorAll<HTMLElement>("[data-thumb]").forEach((el) => el.style.removeProperty("view-transition-name"));
  event.currentTarget.closest("li")?.querySelector<HTMLElement>("[data-thumb]")?.style.setProperty("view-transition-name", "quest-photo");
}

/** A removed row leaves in place (a quick fade to the left) while the rest close the gap. */
function ghostOut(row: HTMLElement) {
  if (reducedMotion()) return;
  const rect = row.getBoundingClientRect();
  const ghost = row.cloneNode(true) as HTMLElement;
  ghost.removeAttribute("id");
  ghost.removeAttribute("data-row");
  ghost.removeAttribute("data-arrived");
  ghost.setAttribute("aria-hidden", "true");
  ghost.inert = true;
  ghost.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;margin:0;list-style:none;pointer-events:none;z-index:20`;
  document.body.append(ghost);
  const leave = ghost.animate(
    [
      { opacity: 1, transform: "none" },
      { opacity: 0, transform: "translateX(-16px)" },
    ],
    { duration: 200, easing: EASE_IN, fill: "forwards" },
  );
  leave.onfinish = () => ghost.remove();
  leave.oncancel = () => ghost.remove();
  // Belt and braces: a paused timeline (a hidden tab) must never leave the copy behind.
  window.setTimeout(() => ghost.remove(), 600);
}

/** My quests: in progress, scheduled, saved for later and made by you (a tab on Quests). */
export function MyQuests() {
  const state = useUserState();
  const hash = useRouterState({ select: (s) => s.location.hash });
  const savedNow = useRef(state.saved);
  savedNow.current = state.saved;
  const origin = state.approximateLocation ?? CAMPUS_ORIGIN;
  const allQuests = useMemo(() => [...state.createdQuests, ...ALL_QUESTS], [state.createdQuests]);
  const questById = useMemo(() => new Map(allQuests.map((quest) => [quest.id, quest])), [allQuests]);
  // Newest save first, so the quest you just saved from the deck is the first one here.
  const saved = [...state.saved]
    .reverse()
    .filter((id) => !state.inProgress.includes(id) && !state.completed.includes(id) && !state.scheduledQuests.some((item) => item.questId === id))
    .map((id) => questById.get(id))
    .filter((quest): quest is Quest => Boolean(quest));
  const inProgress = state.inProgress.map((id) => questById.get(id)).filter((quest): quest is Quest => quest !== undefined && !state.completed.includes(quest.id));
  // Soonest plan first, now that plans can sit on different days.
  const planAt = (when: string) => parseWhen(when)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const scheduled = [...state.scheduledQuests]
    .sort((a, b) => planAt(a.when) - planAt(b.when))
    .map(({ questId }) => questById.get(questId))
    .filter((quest): quest is Quest => Boolean(quest));
  const created = state.createdQuests.filter((quest) => !state.inProgress.includes(quest.id) && !state.scheduledQuests.some((item) => item.questId === quest.id));
  const scheduledTimes = Object.fromEntries(state.scheduledQuests.map((item) => [item.questId, item.when]));
  const arrived = hash ? hash.replace(/^#/, "") : "";

  const now = inProgress.length > 0 || scheduled.length > 0;
  const later = saved.length > 0 || created.length > 0;
  const split = now && later;

  function unsave(quest: Quest) {
    // Undo puts it back in the same place, not at the end.
    const at = state.saved.indexOf(quest.id);
    actions.toggleSave(quest.id);
    toast(`Removed ${quest.title}`, {
      action: {
        label: "Undo",
        onClick: () => {
          if (!savedNow.current.includes(quest.id)) actions.toggleSave(quest.id, at);
        },
      },
    });
  }

  return (
      <div className="mt-6 sm:mt-8">
        {!now && !later ? (
          <EmptyLists />
        ) : (
          <div
            className={cn(
              "max-w-2xl space-y-12",
              split && "lg:grid lg:max-w-none lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-12 lg:space-y-0",
            )}
          >
            {now ? (
              <div className="space-y-12">
                {inProgress.length ? <QuestShelf kind="active" title="In progress" quests={inProgress} origin={origin} arrived={arrived} /> : null}
                {scheduled.length ? (
                  <QuestShelf kind="scheduled" title="Scheduled" quests={scheduled} origin={origin} arrived={arrived} scheduledTimes={scheduledTimes} />
                ) : null}
              </div>
            ) : null}
            {later ? (
              <div className="space-y-12">
                <QuestShelf
                  kind="saved"
                  title="Saved for later"
                  quests={saved}
                  origin={origin}
                  arrived={arrived}
                  onRemove={unsave}
                  empty={
                    <>
                      Saved quests will be waiting here.{" "}
                      <Link to="/" search={{}} className={cn(textButtonClass, "hit-44 min-h-0 text-foreground")}>
                        Find a quest
                      </Link>
                    </>
                  }
                />
                <QuestShelf
                  kind="created"
                  title="Created by you"
                  quests={created}
                  origin={origin}
                  arrived={arrived}
                  empty={
                    <>
                      Quests you create will show up here.{" "}
                      <Link to="/" search={{ tab: "create" }} className={cn(textButtonClass, "hit-44 min-h-0 text-foreground")}>
                        Make one
                      </Link>
                    </>
                  }
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
  );
}

/** Nothing anywhere yet: one clear way in instead of three empty shelves. */
function EmptyLists() {
  return (
    <div className="py-6 sm:py-10">
      <div
        aria-hidden
        className="grid aspect-[4/3] w-32 -rotate-3 place-items-center rounded-md border border-dashed border-border-strong bg-card"
      >
        <Bookmark className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <p className="mt-6 font-hand text-2xl leading-tight">nothing saved yet</p>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground text-pretty">
        Save a quest from the deck and it waits here. Plan one and it moves to the top.
      </p>
      <Link to="/" className={cn(buttonClass(), "mt-6")}>
        Find a quest
      </Link>
    </div>
  );
}

function QuestShelf({
  kind,
  title,
  quests,
  origin,
  arrived,
  onRemove,
  scheduledTimes,
  empty,
}: {
  kind: ShelfKind;
  title: string;
  quests: Quest[];
  origin: SessionContext["origin"];
  arrived: string;
  onRemove?: (quest: Quest) => void;
  scheduledTimes?: Record<string, string>;
  empty?: ReactNode;
}) {
  const list = useRef<HTMLUListElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const before = useRef<Map<string, number> | null>(null);
  const refocus = useRef<string | null | undefined>(undefined);

  // After a row is removed, the rows below glide up into its place (FLIP), and keyboard focus
  // lands on the next row's bookmark instead of falling off the page.
  useLayoutEffect(() => {
    const tops = before.current;
    before.current = null;
    const rows = new Map<string, HTMLElement>();
    list.current?.querySelectorAll<HTMLElement>("[data-row]").forEach((row) => rows.set(row.dataset["row"]!, row));
    if (tops) flip(rows, tops, { stagger: 0, duration: 380 });
    if (refocus.current !== undefined) {
      const next = refocus.current ? rows.get(refocus.current)?.querySelector<HTMLElement>("[data-unsave]") : null;
      (next ?? heading.current)?.focus({ preventScroll: true });
      refocus.current = undefined;
    }
  }, [quests]);

  function remove(quest: Quest, button: HTMLElement) {
    const row = button.closest<HTMLElement>("[data-row]");
    const tops = new Map<string, number>();
    list.current?.querySelectorAll<HTMLElement>("[data-row]").forEach((el) => tops.set(el.dataset["row"]!, el.getBoundingClientRect().top));
    before.current = tops;
    if (document.activeElement === button) {
      const index = quests.findIndex((q) => q.id === quest.id);
      refocus.current = quests[index + 1]?.id ?? quests[index - 1]?.id ?? null;
    }
    if (row) ghostOut(row);
    onRemove?.(quest);
  }

  return (
    <section aria-label={title}>
      <SectionHeading
        title={
          <span ref={heading} tabIndex={-1}>
            {title}
            {/* An empty shelf doesn't print a 0; it says what will go there instead. */}
            {quests.length ? (
              <span className="ml-2 text-base font-medium text-muted-foreground">
                <Tally value={quests.length} />
              </span>
            ) : null}
          </span>
        }
      />
      {quests.length ? (
        <ul ref={list} className="mt-2 divide-y divide-border">
          {quests.map((quest) => (
            <QuestRow
              key={quest.id}
              quest={quest}
              kind={kind}
              origin={origin}
              arrived={arrived === `q-${quest.id}`}
              time={scheduledTimes?.[quest.id]}
              onRemove={onRemove ? (button) => remove(quest, button) : undefined}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

/**
 * One quest on a shelf: its print, title, where it is, and how far and long, each on its own line
 * so nothing breaks mid-phrase. Let's go sits top-right on wider screens and joins the Directions
 * line on phones, where it keeps its label.
 */
function QuestRow({
  quest,
  kind,
  origin,
  arrived,
  time,
  onRemove,
}: {
  quest: Quest;
  kind: ShelfKind;
  origin: SessionContext["origin"];
  arrived: boolean;
  time: string | undefined;
  onRemove: ((button: HTMLElement) => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const miles = distanceMi(origin, quest.location);
  const toGo = kind === "active" || kind === "scheduled";
  const label = kind === "active" ? "Continue quest" : kind === "scheduled" ? "View plan" : "Let’s go";
  const panelId = `directions-${quest.id}`;
  const rowLink =
    "grid min-w-0 grid-cols-[64px_minmax(0,1fr)] items-start gap-3.5 rounded-md transition-transform duration-(--dur-quick) ease-(--ease-spring) active:scale-[0.985] active:duration-(--dur-press)";

  const body = (
    <>
      {/* At thumbnail size the print is a hairline and a thin mat, so a column of them stays light. */}
      <span className="block rounded-md border border-border bg-card p-[2px]">
        <img
          data-thumb
          src={questImage(quest)}
          alt=""
          loading="lazy"
          className="block aspect-square w-full rounded-[4px] bg-muted object-cover"
        />
      </span>
      <span className="min-w-0 pt-0.5">
        {kind === "active" ? (
          <span className="mb-0.5 flex items-center gap-2 font-hand text-[17px] leading-tight text-muted-foreground">
            <span aria-hidden className="live-dot relative h-2 w-2 rounded-full bg-primary" /> out now
          </span>
        ) : null}
        <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-balance sm:text-base">{quest.title}</span>
        <span className="mt-1 block truncate text-[13px] leading-snug text-muted-foreground">{quest.location.name}</span>
        {/* A plan's day and time get their own line ("Sat, Oct 3 · 7 PM" is a phrase of its own). */}
        {time ? (
          <span className="block text-[13px] font-semibold leading-snug tabular-nums text-foreground">
            {whenLabel(time, { start: true })}
          </span>
        ) : null}
        <span className="block whitespace-nowrap text-[13px] leading-snug tabular-nums text-muted-foreground">
          {miles.toFixed(1)} mi · {quest.durationMin} min
        </span>
      </span>
    </>
  );

  const goLink = (className: string) => (
    <Link
      to="/go/$questId"
      params={{ questId: quest.id }}
      search={{ from: "lists" }}
      viewTransition
      onClick={namePhoto}
      aria-label={`${label}: ${quest.title}`}
      className={cn(buttonClass({ variant: kind === "active" ? "primary" : "outline", size: "sm" }), className)}
    >
      <Doodle name="steps" size={20} />
      {label}
    </Link>
  );

  return (
    <li
      id={`q-${quest.id}`}
      data-row={quest.id}
      data-arrived={arrived ? "" : undefined}
      className="list-row relative isolate scroll-mt-24 py-4"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        {toGo ? (
          <Link to="/go/$questId" params={{ questId: quest.id }} search={{ from: "lists" }} viewTransition onClick={namePhoto} className={rowLink}>
            {body}
          </Link>
        ) : (
          <Link to="/quest/$questId" params={{ questId: quest.id }} search={{ from: "lists" }} viewTransition onClick={namePhoto} className={rowLink}>
            {body}
          </Link>
        )}
        <div className="flex items-center gap-1">
          {onRemove ? (
            <button
              type="button"
              data-unsave
              onClick={(event) => onRemove(event.currentTarget)}
              aria-label={`Remove ${quest.title} from saved`}
              className="press grid h-11 w-11 cursor-pointer place-items-center rounded-md text-foreground hover:bg-surface"
            >
              <Bookmark aria-hidden className="h-5 w-5" fill="currentColor" />
            </button>
          ) : null}
          {goLink("max-sm:hidden")}
        </div>
      </div>

      {/* Phones: Let's go and Directions share one line under the row. Wider: Directions tucks under the meta. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 sm:-mt-1 sm:pl-[78px]">
        {goLink("sm:hidden")}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm text-[13px] font-medium text-muted-foreground transition-colors duration-(--dur-quick) hover:text-foreground"
        >
          <ChevronRight
            aria-hidden
            className={cn("h-4 w-4 transition-transform duration-(--dur-base) ease-(--ease-spring)", open && "rotate-90")}
          />
          Directions · {walkLabel(miles)}
        </button>
      </div>
      <div id={panelId} hidden={!open} className={cn("pb-2 pt-1 sm:pl-[78px]", open && "list-directions")}>
        <QuestDirections compact destination={quest.location} origin={origin} />
      </div>
    </li>
  );
}
