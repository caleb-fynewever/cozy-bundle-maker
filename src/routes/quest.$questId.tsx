import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowLeft, Bookmark, Check, MapPin, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { reasonLine } from "@/components/QuestCard";
import { PageHeader, PhotoPrint, SectionHeading, StatLedger, buttonClass, textButtonClass } from "@/components/ui-kit";
import { Stamp } from "@/components/Stamp";
import { QuestDirections, RouteStops } from "@/components/QuestDirections";
import { QUESTS, getQuest } from "@/data/quests";
import { NEARBY_STUDENTS } from "@/data/people";
import { questImage, questPhoto } from "@/lib/imagery";
import { actions, hydrate, useUserState, type UserState } from "@/lib/store";
import { CAMPUS_ORIGIN, currentTimeSlot, distanceMi, recommend } from "@/lib/engine";
import { walkLabel } from "@/lib/maps";
import { EASE_OUT, flyToNav, reducedMotion } from "@/lib/motion";
import type { Quest } from "@/lib/types";
import { cn } from "@/lib/utils";

type From = "feed" | "map" | "lists";

export const Route = createFileRoute("/quest/$questId")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>) => ({
    ...(search["from"] === "feed" || search["from"] === "map" || search["from"] === "lists" ? { from: search["from"] as From } : {}),
  }),
  loader: ({ params }) => {
    const quest = getQuest(params.questId);
    // A quest you made lives in this browser's storage, so the server can't know its title yet.
    return { title: quest?.title ?? null, hook: quest?.hook ?? null, local: params.questId.startsWith("q_user_") };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.title) {
      return {
        meta: [{ title: loaderData?.local ? "Quest — wego" : "Quest unavailable — wego" }, { name: "robots", content: "noindex" }],
      };
    }
    return {
      meta: [
        { title: `${loaderData.title} — wego` },
        { name: "description", content: loaderData.hook ?? "" },
        { property: "og:title", content: `${loaderData.title} — wego` },
        { property: "og:description", content: loaderData.hook ?? "" },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: QuestDetail,
});

/** "Basically around the corner." reads as a margin note: "basically around the corner". */
function asNote(sentence: string) {
  const trimmed = sentence.trim().replace(/\.$/, "");
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

/** The date line on a stamp: "sep 26". */
function stampDate(at: number) {
  return new Date(at).toLocaleDateString([], { month: "short", day: "numeric" }).toLowerCase();
}

/** "The $10 Mystery Snack Crawl" and "the snack crawl" both boil down to letters and digits. */
function plain(text: string) {
  return text.toLowerCase().replace(/^did\s+/, "").replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");
}

/**
 * When you did it: the XP log's entry for the quest, else your own post about it, else (older saved
 * state, whose log lines carry no quest id) the "Did …" line that names it.
 */
function completedAt(state: UserState, quest: Quest) {
  const logged = state.log.find((event) => event.refId === quest.id && (event.kind === "complete" || event.kind === "squad"));
  if (logged) return logged.at;
  const post = state.posts.find((item) => item.questId === quest.id && item.authorId === "me");
  if (post) return post.at;
  const title = plain(quest.title);
  return state.log.find((event) => {
    if (event.kind !== "complete" || event.refId) return false;
    const said = plain(event.label);
    return said.length >= 6 && title.includes(said);
  })?.at;
}

/**
 * True once this browser's saved state is loaded (before paint). Until then the page matches the
 * server, which has never seen the quests you made.
 */
function useHydrated() {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    hydrate();
    setReady(true);
  }, []);
  return ready;
}

/** The bookmark gives a little hop when a quest is saved. */
function pop(el: Element | null | undefined) {
  if (!el || reducedMotion()) return;
  el.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.3)", offset: 0.35 }, { transform: "scale(0.95)", offset: 0.7 }, { transform: "scale(1)" }],
    { duration: 320, easing: EASE_OUT },
  );
}

const backClass =
  "group inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors duration-(--dur-quick) hover:text-foreground";

/** Save / Send / Share in the laptop rail: three even cells, icon over a short label. */
const railItem =
  "press flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-md px-1 text-[13px] font-medium text-muted-foreground hover:bg-surface hover:text-foreground";

function QuestDetail() {
  const { questId } = Route.useParams();
  const { from } = Route.useSearch();
  const { title: knownTitle } = Route.useLoaderData();
  const state = useUserState();
  const ready = useHydrated();
  const photoRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<"send" | "share" | null>(null);
  const [touched, setTouched] = useState(false);
  const copiedTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const quest = useMemo(
    () => state.createdQuests.find((q) => q.id === questId) ?? getQuest(questId),
    [questId, state.createdQuests],
  );

  // The reason line depends on the hour, so it's only worked out in the browser (a server in
  // another time zone would pick a different one and the page would change under you).
  const scored = useMemo(() => {
    if (!ready) return undefined;
    const { results } = recommend(
      {
        groupSize: Math.max(2, state.squadIds.length + 1),
        timeBudgetMin: 300,
        maxCost: null,
        vibes: [],
        chaos: 3,
        timeSlot: currentTimeSlot(),
        origin: state.approximateLocation ?? CAMPUS_ORIGIN,
        radiusMi: 10,
        squadIds: state.squadIds,
      },
      { ...state, passed: [] },
      [...state.createdQuests, ...QUESTS],
      40,
    );
    return results.find((r) => r.quest.id === questId);
  }, [ready, state, questId]);

  // A quest you made has no title on the server; name the tab once it's found here.
  useEffect(() => {
    if (quest && !knownTitle) document.title = `${quest.title} — wego`;
  }, [quest, knownTitle]);

  if (!quest) {
    if (!ready) {
      return (
        <AppShell>
          <FindingQuest />
        </AppShell>
      );
    }
    throw notFound();
  }

  const squad = NEARBY_STUDENTS.filter((u) => state.squadIds.includes(u.id));
  const saved = state.saved.includes(quest.id);
  const completed = state.completed.includes(quest.id);
  const active = state.inProgress.includes(quest.id);
  const scheduled = state.scheduledQuests.some((item) => item.questId === quest.id);
  const distance = distanceMi(state.approximateLocation ?? CAMPUS_ORIGIN, quest.location);
  const doneAt = completed ? completedAt(state, quest) : undefined;
  const doneDate = doneAt ? stampDate(doneAt) : null;
  const cta = completed ? "Do it again" : active ? "Continue quest" : scheduled ? "View plan" : "Plan this quest";
  const photo = questPhoto(quest);
  const walkFrom = `${walkLabel(distance)} from ${state.approximateLocation ? "you" : CAMPUS_ORIGIN.label}`;

  function flash(which: "send" | "share") {
    setTouched(true);
    setCopied(which);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(null), 1600);
  }

  function toggleSave(button: HTMLElement) {
    setTouched(true);
    const saving = !saved;
    actions.toggleSave(quest!.id);
    if (!saving) return;
    pop(button.querySelector("svg"));
    // Filed away: a little copy of the photo drops into Lists, from the photo if it's on screen.
    const print = photoRef.current;
    const rect = print?.getBoundingClientRect();
    const visible = rect && rect.bottom > 80 && rect.top < window.innerHeight - 80;
    flyToNav(visible && print ? print : button, "lists", questImage(quest!));
  }

  async function sendToSquad() {
    if (!squad.length) {
      toast("Add people to your squad first");
      return;
    }
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: quest!.title, text: "Want to do this quest with me?", url });
      } else {
        await navigator.clipboard.writeText(url);
        flash("send");
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) toast.error("Could not share this quest.");
    }
  }

  async function copyLink() {
    try {
      if (!navigator.clipboard) throw new Error("No clipboard");
      await navigator.clipboard.writeText(window.location.href);
      flash("share");
    } catch {
      toast.error("Could not copy the link.");
    }
  }

  /** `rail`: a cell in the laptop rail's Save / Send / Share row. Otherwise a quiet text button. */
  const saveButton = (rail = false) => (
    <button
      type="button"
      className={rail ? railItem : cn(textButtonClass, "px-1")}
      onClick={(event) => toggleSave(event.currentTarget)}
      aria-pressed={saved}
    >
      <Bookmark aria-hidden className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
      <SwapLabel id={saved ? "saved" : "save"} animate={touched}>
        {saved ? "Saved" : "Save"}
      </SwapLabel>
    </button>
  );

  const shareButtons = (rail = false) => (
    <>
      <button
        type="button"
        className={rail ? railItem : cn(textButtonClass, "px-1")}
        onClick={() => void sendToSquad()}
        aria-label={rail && copied !== "send" ? "Send to squad" : undefined}
      >
        {copied === "send" ? <Check aria-hidden className="draw-check h-4 w-4 text-ring" /> : <Send aria-hidden className="h-4 w-4" />}
        <SwapLabel id={copied === "send" ? "copied" : "send"} animate={touched}>
          {copied === "send" ? "Link copied" : rail ? "Send" : "Send to squad"}
        </SwapLabel>
      </button>
      <button type="button" className={rail ? railItem : cn(textButtonClass, "px-1")} onClick={() => void copyLink()}>
        {copied === "share" ? <Check aria-hidden className="draw-check h-4 w-4 text-ring" /> : <Share2 aria-hidden className="h-4 w-4" />}
        <SwapLabel id={copied === "share" ? "copied" : "share"} animate={touched}>
          {copied === "share" ? "Copied" : "Share"}
        </SwapLabel>
      </button>
    </>
  );

  const planLink = (className: string) => (
    <Link
      to="/go/$questId"
      params={{ questId: quest.id }}
      search={{ from: "quest" }}
      viewTransition
      className={className}
    >
      {cta}
    </Link>
  );

  return (
    <AppShell>
      {from === "feed" ? (
        <Link to="/feed" className={backClass}>
          <BackArrow /> Back to Feed
        </Link>
      ) : from === "map" ? (
        <Link to="/map" className={backClass}>
          <BackArrow /> Back to Map
        </Link>
      ) : from === "lists" ? (
        <Link to="/lists" className={backClass}>
          <BackArrow /> Back to Lists
        </Link>
      ) : (
        <Link to="/" className={backClass}>
          <BackArrow /> Back
        </Link>
      )}

      <article className="mx-auto mt-2 max-w-5xl">
        <PageHeader
          bare
          className="mb-0 pb-6"
          kicker={scored ? asNote(reasonLine(scored)) : "a side quest"}
          title={quest.title}
          meta={
            <>
              <p className="max-w-[52ch] text-lg leading-snug text-muted-foreground text-pretty">{quest.hook}</p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
                <MapPin aria-hidden className="h-4 w-4 text-muted-foreground" />
                {quest.location.name} · {quest.location.area}
              </p>
            </>
          }
        />

        <StatLedger
          items={[
            { key: "away", label: "away", value: `${distance.toFixed(1)} mi` },
            { key: "time", label: "start to finish", value: `${quest.durationMin} min` },
            { key: "cost", label: "per person", value: quest.costPerPerson === 0 ? "Free" : `$${quest.costPerPerson}` },
            { key: "group", label: "people", value: `${quest.groupMin}–${quest.groupMax}` },
          ]}
        />

        <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-12">
          <div className="min-w-0">
            <div ref={photoRef} className="relative">
              <PhotoPrint
                src={questImage(quest)}
                alt={`${quest.location.name}, ${quest.location.area}`}
                priority
                imgClassName="aspect-[16/10] [view-transition-name:quest-photo]"
              />
              {/*
               * Postmarked: the stamp, on its own disc of paper so it reads over any photo, straddles
               * the print's corner. It stays inside the page gutter (80px on phones, 96px from sm).
               */}
              {completed ? (
                <span className="pointer-events-none absolute -right-2 -top-5 origin-top-right max-sm:scale-[0.84] lg:-right-5 lg:-top-7">
                  <Stamp backed label="did it" {...(doneDate ? { sub: doneDate } : {})} size={96} tilt={-10} />
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-right text-[11px] text-muted-foreground">
              <a
                href={photo.source}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 transition-colors duration-(--dur-quick) hover:text-foreground hover:underline"
              >
                Photo: {photo.credit} · {photo.license}
              </a>
            </p>

            {completed ? (
              <p className="mt-5 text-[15px] lg:hidden">
                <span className="font-semibold">You did this</span>
                {doneDate ? ` on ${doneDate}` : ""}.{" "}
                <Link to="/profile" className={cn(textButtonClass, "hit-44 min-h-0 text-[15px]")}>
                  See it on your profile
                </Link>
              </p>
            ) : null}

            <section aria-labelledby="quest-mission" className="mt-10">
              <SectionHeading id="quest-mission" eyebrow="the quest" title="What you’ll do" />
              <p className="mt-3 max-w-[62ch] text-lg leading-relaxed text-pretty">{quest.mission}</p>
              <RouteStops steps={quest.steps} className="mt-7" />
            </section>

            <QuestDirections
              destination={quest.location}
              origin={state.approximateLocation ?? CAMPUS_ORIGIN}
              className="mt-10 border-t border-border pt-6"
            />

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border pt-3 lg:hidden">{shareButtons()}</div>
          </div>

          {/* Laptop: the plan lives in a rail that stays in view beside the quest. */}
          <aside aria-label="Your plan" className="hidden lg:sticky lg:top-[104px] lg:block">
            <div className="rounded-lg border border-border-strong bg-card p-5">
              {completed ? (
                <>
                  <p className="font-hand text-lg leading-tight text-muted-foreground">nice.</p>
                  <p className="mt-1 text-[15px] font-semibold">
                    You did this{doneDate ? ` on ${doneDate}` : ""}.
                  </p>
                  {planLink(cn(buttonClass({ full: true }), "mt-4"))}
                  <Link to="/profile" className={cn(textButtonClass, "mt-1 w-full justify-center")}>
                    See it on your profile
                  </Link>
                </>
              ) : (
                <>
                  {active ? (
                    <p className="flex items-center gap-2 font-hand text-lg leading-tight text-muted-foreground">
                      <span aria-hidden className="live-dot relative h-2 w-2 rounded-full bg-primary" /> out now
                    </p>
                  ) : (
                    <p className="font-hand text-lg leading-tight text-muted-foreground">
                      {squad.length ? `bring ${squadNote(squad.map((person) => person.name))}` : "going solo works too"}
                    </p>
                  )}
                  <p className="mt-1 text-[15px] font-semibold leading-snug tabular-nums">{walkFrom}</p>
                  {planLink(cn(buttonClass({ full: true }), "mt-4"))}
                </>
              )}
              <div className={cn("mt-4 grid gap-1 border-t border-border pt-3", completed ? "grid-cols-2" : "grid-cols-3")}>
                {/* A done quest can't wait in Saved for later, so it isn't offered. */}
                {completed ? null : saveButton(true)}
                {shareButtons(true)}
              </div>
            </div>
          </aside>

          {/* Phones and tablets: the plan rides above the tab bar until you reach it. */}
          <Dock className="mt-8 sm:w-fit lg:hidden" restClassName="lg:hidden">
            {planLink(cn(buttonClass(), "flex-1 sm:min-w-64"))}
            {completed ? null : (
              <button
                type="button"
                onClick={(event) => toggleSave(event.currentTarget)}
                aria-pressed={saved}
                aria-label={saved ? `Remove ${quest.title} from saved` : `Save ${quest.title}`}
                className={cn(buttonClass({ variant: "outline" }), "w-12 px-0")}
              >
                <Bookmark aria-hidden className="h-5 w-5" fill={saved ? "currentColor" : "none"} />
              </button>
            )}
          </Dock>
        </div>
      </article>

      <p role="status" className="sr-only">
        {copied ? "Quest link copied." : ""}
      </p>
    </AppShell>
  );
}

/** Before this browser's saved quests are loaded: a quiet sheet of paper where the quest will be. */
function FindingQuest() {
  return (
    <div aria-busy="true" className="mx-auto max-w-5xl pt-12">
      <p className="font-hand text-lg leading-tight text-muted-foreground">finding your quest…</p>
      <div aria-hidden className="mt-6 aspect-[16/10] w-full rounded-md border border-border bg-card lg:w-[calc(100%-348px)]" />
    </div>
  );
}

/** "Alex", "Alex and Jordan", "Alex, Jordan and 3 more". */
function squadNote(names: string[]) {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

function BackArrow() {
  return (
    <ArrowLeft
      aria-hidden
      className="h-4 w-4 transition-transform duration-(--dur-quick) ease-(--ease-out) group-hover:-translate-x-0.5"
    />
  );
}

/** A label that swaps for its next state (Save to Saved), rising in once the page is touched. */
function SwapLabel({ id, animate, children }: { id: string; animate: boolean; children: ReactNode }) {
  return (
    <span key={id} className={animate ? "morph-in inline-block" : "inline-block"}>
      {children}
    </span>
  );
}

/**
 * The page's one action, sticky just above the phone tab bar. At rest it's the buttons on the
 * page; while it floats, a paper ticket slides in under them.
 */
function Dock({ className, restClassName, children }: { className?: string; restClassName?: string; children: ReactNode }) {
  const dock = useRef<HTMLDivElement>(null);
  const rest = useRef<HTMLDivElement>(null);
  const stuck = useStuck(dock, rest);
  return (
    <>
      <div ref={dock} data-stuck={stuck ? "" : undefined} className={cn("quest-dock !mb-0 flex items-center gap-2", className)}>
        {children}
      </div>
      <div ref={rest} aria-hidden className={cn("h-px", restClassName)} />
    </>
  );
}

/**
 * True while a sticky element is lifted off its resting place (its spot marked by `rest`). Any
 * bottom margin on the element is part of where it rests, not a lift.
 */
function useStuck(el: RefObject<HTMLElement | null>, rest: RefObject<HTMLElement | null>) {
  const [stuck, setStuck] = useState(false);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const node = el.current;
      const box = node?.getBoundingClientRect();
      const spot = rest.current?.getBoundingClientRect();
      if (!node || !box || !spot || box.height === 0) return setStuck(false);
      const margin = parseFloat(getComputedStyle(node).marginBottom) || 0;
      setStuck(spot.top - box.bottom - margin > 1);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [el, rest]);
  return stuck;
}
