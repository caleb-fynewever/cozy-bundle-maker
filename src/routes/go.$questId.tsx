import { useRemoteQuest } from "@/lib/use-remote-quest";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Doodle } from "@/components/Doodle";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowLeft,
  Bookmark,
  CalendarPlus,
  Check,
  Download,
  ImagePlus,
  ListChecks,
  Newspaper,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  Avatar,
  Button,
  Chip,
  PageHeader,
  SectionHeading,
  Tally,
  TextButton,
  buttonClass,
} from "@/components/ui-kit";
import { Stamp } from "@/components/Stamp";
import { HelpDot } from "@/components/HelpDot";
import { QuestDirections, RouteStops } from "@/components/QuestDirections";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getQuest } from "@/data/quests";
import { NEARBY_STUDENTS } from "@/data/people";
import { questImage } from "@/lib/imagery";
import { XP, UUID_RE, actions, hydrate, useUserState, type UserState } from "@/lib/store";
import { useServerFn } from "@tanstack/react-start";
import { endQuestSession, startQuestSession } from "@/lib/quest-sessions.functions";
import { refreshQuestSessions } from "@/lib/quest-sessions";
import { CAMPUS_ORIGIN } from "@/lib/engine";
import { EASE_IN, SPRING, burst, flyToNav, reducedMotion, useCountUp } from "@/lib/motion";
import {
  downloadCalendarFile,
  googleCalendarUrl,
  isAhead,
  joinWhen,
  normalizeWhen,
  parseWhen,
  slotLabel,
  splitWhen,
  timeSlots,
  upcomingDays,
  whenLabel,
  type CalendarEvent,
} from "@/lib/when";
import type { Quest } from "@/lib/types";
import { cn } from "@/lib/utils";

type From = "quest" | "lists";
type Stage = "plan" | "out" | "share";
/** What finishing just earned, kept on the page so the moment can show it. */
type Finished = { earned: number; squad: boolean; at: number; fresh: boolean };

export const Route = createFileRoute("/go/$questId")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>) => ({
    ...(search["from"] === "quest" || search["from"] === "lists"
      ? { from: search["from"] as From }
      : {}),
  }),
  loader: ({ params }) => {
    const quest = getQuest(params.questId);
    // Authenticated database records load on the client; seed titles are available during SSR.
    return { title: quest?.title ?? null, local: params.questId.startsWith("q_user_") };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.title
      ? [
          { title: `Let's go: ${loaderData.title} | wego` },
          {
            name: "description",
            content: `Pick your crew and a time, then head out for ${loaderData.title}.`,
          },
          { property: "og:title", content: `Let's go: ${loaderData.title} | wego` },
          { property: "og:description", content: "Pick your crew, pick a time, walk over." },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
        ]
      : [
          { title: loaderData?.local ? "Let's go | wego" : "Quest unavailable | wego" },
          { name: "description", content: "Plan a quest with your crew on wego." },
          { property: "og:title", content: loaderData?.local ? "Let's go | wego" : "Quest unavailable | wego" },
          { property: "og:description", content: "Plan a quest with your crew on wego." },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
          { name: "robots", content: "noindex" },
        ],
  }),
  component: GoPage,
});

/**
 * The plan as a calendar event: the real start, the quest's own length, where it is, and a line
 * about it that links back to the quest.
 */
function questEvent(quest: Quest, when: string, endWhen?: string): CalendarEvent | null {
  const start = parseWhen(when);
  if (!start) return null;
  const url = `${typeof window === "undefined" ? "" : window.location.origin}/quest/${quest.id}`;
  return {
    id: `quest-${quest.id}`,
    title: `wego: ${quest.title}`,
    location: quest.location.name,
    start,
    minutes:
      endWhen && parseWhen(endWhen)
        ? Math.max(1, (parseWhen(endWhen)!.getTime() - start.getTime()) / 60_000)
        : quest.durationMin,
    details: `${quest.hook}\n\nThe quest on wego: ${url}`,
    url,
  };
}

/** The date line on a stamp: "sep 26". */
function stampDate(at: number) {
  return new Date(at).toLocaleDateString([], { month: "short", day: "numeric" }).toLowerCase();
}

/** "The $10 Mystery Snack Crawl" and "the snack crawl" both boil down to letters and digits. */
function plain(text: string) {
  return text
    .toLowerCase()
    .replace(/^did\s+/, "")
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * When you did it: the XP log's entry for the quest, else your own post about it, else (older saved
 * state, whose log lines carry no quest id) the "Did …" line that names it.
 */
function completedAt(state: UserState, quest: Quest) {
  const logged = state.log.find(
    (event) => event.refId === quest.id && (event.kind === "complete" || event.kind === "squad"),
  );
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

function score(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** "you + Alex, Jordan", or "you + Alex, Jordan and 4 more" once the crew gets big. */
function crewNote(names: string[]) {
  if (!names.length) return "going solo works too";
  if (names.length <= 3) return `you + ${names.join(", ")}`;
  return `you + ${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/*
 * Photos are stored with the post in localStorage (about 5MB for everything), so a phone photo is
 * developed down to a small JPEG first: long edge 1280px, which lands around 150-300KB.
 */
const MAX_EDGE = 1280;

async function decodePhoto(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall back to an <img> decode below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function developPhoto(file: File) {
  const source = await decodePhoto(file);
  const w = "naturalWidth" in source ? source.naturalWidth : source.width;
  const h = "naturalHeight" in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  // JPEG has no transparency: lay a transparent PNG on the card's paper instead of black.
  context.fillStyle =
    getComputedStyle(document.documentElement).getPropertyValue("--card").trim() || "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

const backClass =
  "group inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors duration-(--dur-quick) hover:text-foreground";

function GoPage() {
  const { questId } = Route.useParams();
  const { from } = Route.useSearch();
  const { title: knownTitle } = Route.useLoaderData();
  const state = useUserState();
  const ready = useHydrated();
  const navigate = useNavigate();
  const questLookup = useRemoteQuest(questId);
  const {quest} = questLookup;
  const [selectedSquadIds, setSelectedSquadIds] = useState<string[]>(() =>
    state.activeSquadId ? [state.activeSquadId] : [],
  );
  const [endTime, setEndTime] = useState("");
  const [crew, setCrew] = useState<string[] | null>(null);
  /** The last person you ticked in or out, so only their check draws itself. */
  const [lastToggled, setLastToggled] = useState<string | null>(null);
  const [when, setWhen] = useState<string | null>(null);
  const [whenTouched, setWhenTouched] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("plan");
  /** True once you've moved between stages here, so entrances and focus only follow your actions. */
  const [moved, setMoved] = useState(false);
  const [rating, setRating] = useState(8);
  const [memberRatings, setMemberRatings] = useState<Record<string, number>>({});
  const [caption, setCaption] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [developing, setDeveloping] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [ticked, setTicked] = useState<number[]>([]);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [slam, setSlam] = useState(false);
  const [xpReady, setXpReady] = useState(false);
  const [announce, setAnnounce] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const printRef = useRef<HTMLSpanElement>(null);
  const stampRef = useRef<HTMLSpanElement>(null);
  const doneRef = useRef<HTMLSpanElement>(null);
  const swapping = useRef(false);
  /** The plan you just scheduled here, so its calendar step can arrive (and take focus) once. */
  const [scheduledHere, setScheduledHere] = useState<string | null>(null);
  const calendarRef = useRef<HTMLAnchorElement>(null);
  const startSession = useServerFn(startQuestSession);
  const endSession = useServerFn(endQuestSession);
  /** The live session this page started, so finishing here wraps it up for everyone. */
  const sessionId = useRef<string | null>(null);
  const scheduledWhen = state.scheduledQuests.find((item) => item.questId === questId)?.when;
  const scheduledEndWhen = state.scheduledQuests.find((item) => item.questId === questId)?.endWhen;
  useEffect(() => {
    setEndTime(scheduledEndWhen?.slice(11, 16) ?? "");
  }, [questId, scheduledEndWhen]);
  // Older saves hold just "HH:MM"; read those as today, or tomorrow once the time has passed.
  const savedWhen = useMemo(
    () => (scheduledWhen ? normalizeWhen(scheduledWhen) : null),
    [scheduledWhen],
  );

  useEffect(() => {
    if (swapping.current) return;
    if (state.inProgress.includes(questId))
      setStage((current) => (current === "plan" ? "out" : current));
  }, [questId, state.inProgress]);

  useEffect(() => {
    if (savedWhen && !state.inProgress.includes(questId)) setWhen(savedWhen);
  }, [questId, savedWhen, state.inProgress]);

  // Just scheduled: the calendar step is the next thing to do, so it takes focus (the Schedule
  // button it replaces is gone) and scrolls clear of the dock if it landed under it.
  useEffect(() => {
    const link = calendarRef.current;
    if (!scheduledHere || !link) return;
    link.focus({ preventScroll: true });
    const box = link.getBoundingClientRect();
    if (box.bottom > window.innerHeight - 180 || box.top < 80) {
      link.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }, [scheduledHere]);

  // After you move to a new stage: bring the top back into view, focus the new stage's heading,
  // and, if you just finished, press the postmark once the header is back on screen.
  useEffect(() => {
    if (!moved) return;
    headingRef.current?.focus({ preventScroll: true });
    const scrolled = window.scrollY > 4;
    if (scrolled) window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
    if (stage !== "share" || !finished?.fresh) return;
    const timer = window.setTimeout(() => setSlam(true), scrolled && !reducedMotion() ? 460 : 160);
    return () => window.clearTimeout(timer);
  }, [stage, moved, finished]);

  // The postmark hits the page: ink sparks fly off it, and the XP counts up beside it.
  useEffect(() => {
    if (!slam) return;
    const still = reducedMotion();
    const contact = window.setTimeout(
      () => {
        const mark = stampRef.current;
        if (still || !mark) return;
        const box = mark.getBoundingClientRect();
        burst(box.left + box.width / 2, box.top + box.height / 2, {
          sparks: 10,
          stars: 3,
          spread: 48,
        });
        navigator.vibrate?.(12);
      },
      still ? 0 : 250,
    );
    const receipt = window.setTimeout(() => setXpReady(true), still ? 0 : 420);
    return () => {
      window.clearTimeout(contact);
      window.clearTimeout(receipt);
    };
  }, [slam]);

  const allTicked = Boolean(
    quest && quest.steps.length > 0 && ticked.length === quest.steps.length,
  );

  // Every stop ticked: "We did it" gives one small nudge.
  useEffect(() => {
    if (!allTicked || reducedMotion()) return;
    doneRef.current?.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.04)", offset: 0.4 },
        { transform: "scale(1)" },
      ],
      { duration: 360, easing: SPRING },
    );
  }, [allTicked]);

  // A quest you made has no title on the server; name the tab once it's found here.
  useEffect(() => {
    if (quest && !knownTitle) document.title = `Let's go: ${quest.title} | wego`;
  }, [quest, knownTitle]);

  if (!quest) {
    if (questLookup.status === "error") return <AppShell><p role="alert">Could not load this quest.</p><button type="button" className="underline" onClick={questLookup.retry}>Try again</button></AppShell>;
    if (!ready || questLookup.status === "loading") {
      return (
        <AppShell>
          <div aria-busy="true" className="mx-auto max-w-2xl pt-12">
            <p className="font-hand text-lg leading-tight text-muted-foreground">
              finding your quest…
            </p>
            <div
              aria-hidden
              className="mt-4 size-[72px] rounded-md border border-border bg-card sm:size-24"
            />
          </div>
        </AppShell>
      );
    }
    throw notFound();
  }

  const selectedSquads = state.squads.filter((squad) => selectedSquadIds.includes(squad.id));
  const selectedMemberIds = [...new Set(selectedSquads.flatMap((squad) => squad.memberIds))];
  const chosen = (crew ?? selectedMemberIds).filter((id) => selectedMemberIds.includes(id));
  const people = [
    ...NEARBY_STUDENTS.filter((person) => selectedMemberIds.includes(person.id)),
    ...state.friends
      .filter((person) => selectedMemberIds.includes(person.id))
      .map((friend) => ({ ...friend, photo: null })),
  ];
  const origin = state.approximateLocation ?? CAMPUS_ORIGIN;
  const toggle = (id: string) => {
    setLastToggled(id);
    setCrew(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  };
  const names = people.filter((u) => chosen.includes(u.id)).map((u) => u.name);
  const members = people.filter((u) => chosen.includes(u.id));
  const ratedMembers = members.filter((member) => memberRatings[member.id] !== undefined);
  const ratingTotal =
    rating + ratedMembers.reduce((sum, member) => sum + memberRatings[member.id]!, 0);
  const ratingAverage = ratingTotal / (ratedMembers.length + 1);
  const allMembersRated = ratedMembers.length === members.length;
  const alreadyDone = state.completed.includes(quest.id);
  /** Doing a quest you've already stamped: it still works, it just doesn't pay out again. */
  const repeat = alreadyDone && !finished;
  const doneAt = finished?.at ?? (alreadyDone ? completedAt(state, quest) : undefined);
  // The postmark is the payoff of finishing, so it only appears once you've shared that you did it.
  const stamped = stage === "share" && (finished?.fresh ? slam : true);
  /** The picked time is the one saved in Lists. */
  const listed =
    when !== null &&
    when === savedWhen &&
    (endTime || undefined) === (scheduledEndWhen?.slice(11, 16) || undefined);
  /** The picked time is scheduled (a quest you've done isn't kept in Lists, but still gets its calendar step). */
  const planned = listed || (when !== null && when === scheduledHere);
  const endWhen =
    when && endTime
      ? (() => {
          const start = parseWhen(when);
          if (!start) return undefined;
          const end = new Date(start);
          const [h, m] = endTime.split(":").map(Number);
          end.setHours(h!, m!, 0, 0);
          if (end <= start) end.setDate(end.getDate() + 1);
          return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}T${endTime}`;
        })()
      : undefined;
  const event = planned && when ? questEvent(quest, when, endWhen) : null;

  /** Old stage steps back and fades (quick, ease-in); the new one rises in. */
  function swapStage(next: Stage) {
    swapping.current = true;
    const done = () => {
      swapping.current = false;
      setMoved(true);
      setStage(next);
    };
    const el = stageRef.current;
    if (!el || reducedMotion()) return done();
    const leave = el.animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "translateY(-6px)" },
      ],
      { duration: 140, easing: EASE_IN, fill: "forwards" },
    );
    leave.onfinish = done;
    leave.oncancel = done;
  }

  async function takePhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("That file isn’t a photo.");
      return;
    }
    setDeveloping(true);
    try {
      setPhoto(await developPhoto(file));
    } catch {
      toast.error("Couldn’t read that photo. Try a JPG or PNG.");
    } finally {
      setDeveloping(false);
    }
  }

  function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    void takePhoto(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void takePhoto(event.dataTransfer.files[0]);
  }

  // Every member can organize and complete their own squad activity.
  function finish() {
    if (swapping.current) return;
    const fresh = !state.completed.includes(quest!.id);
    const withSquad = chosen.length > 0;
    const earned = actions.complete(quest!.id, quest!.title, withSquad);
    setFinished({ earned, squad: withSquad && earned > 0, at: Date.now(), fresh });
    setAnnounce(earned ? `Quest complete. Plus ${earned} XP.` : "Quest complete.");
    swapStage("share");
    if (sessionId.current) {
      void endSession({ data: { id: sessionId.current } })
        .catch(() => {})
        .finally(() => {
          sessionId.current = null;
          refreshQuestSessions();
        });
    }
  }

  async function headOut() {
    if (swapping.current) return;
    actions.startQuest(quest!.id);
    setAnnounce(repeat ? "You’re out again." : "You’re out. Your quest is active.");
    swapStage("out");
    // Tell the backend so everyone included sees they're on this quest right now.
    const memberIds = chosen
      .filter((id) => id.startsWith("f_"))
      .map((id) => id.slice(2))
      .filter((id) => UUID_RE.test(id));
    void startSession({
      data: {
        questId: quest!.id,
        questTitle: quest!.title,
        locationName: quest!.location.name,
        memberIds,
      },
    })
      .then((row) => {
        sessionId.current = row.id;
        refreshQuestSessions();
      })
      .catch(() => {});
    if (!names.length) return;
    const time = when === null ? "right now" : whenLabel(when);
    const text = `Want to join us for ${quest!.title} at ${quest!.location.name} ${time}?`;
    try {
      if (navigator.share) {
        await navigator.share({ title: quest!.title, text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(`${text} ${window.location.href}`);
        toast.success("Plan copied. Send it to your squad.");
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        toast.error("Could not share the plan.");
    }
  }

  // Scheduling files the plan into Lists (the print flies to the tab) and stays here, where the
  // calendar step appears under the time. Lists doesn't keep a quest you've already done, so a
  // repeat only gets the calendar step, and nothing claims it was saved.
  function scheduleQuest() {
    if (!when) return;
    const keeps = !alreadyDone && !state.inProgress.includes(quest!.id);
    if (keeps) actions.scheduleQuest(quest!.id, when, endWhen);
    setScheduledHere(when);
    const planEvent = questEvent(quest!, when, endWhen);
    const label = whenLabel(when);
    const said = keeps ? `Scheduled for ${label}.` : `Picked ${label}.`;
    setAnnounce(`${said} Add it to your calendar below.`);
    toast.success(
      keeps ? said : `${said} Add it to your calendar below.`,
      planEvent
        ? {
            action: {
              label: "Add to Google Calendar",
              onClick: () =>
                window.open(googleCalendarUrl(planEvent), "_blank", "noopener,noreferrer"),
            },
          }
        : undefined,
    );
    if (keeps && printRef.current) flyToNav(printRef.current, "quests", questImage(quest!));
  }

  function saveCalendarFile() {
    if (!event) return;
    downloadCalendarFile(event);
    setAnnounce("Calendar file downloaded. Open it to add the quest to your calendar.");
  }

  function saveForLater() {
    if (!state.saved.includes(quest!.id)) actions.toggleSave(quest!.id);
    if (printRef.current) flyToNav(printRef.current, "quests", questImage(quest!));
    toast("Saved for later");
    void navigate({ to: "/" });
  }

  /** A new day and time; `done` closes the picker (a pick alone keeps it open until Done). */
  function pickTime(value: string, done = true) {
    setWhenTouched(true);
    setWhen(value);
    if (done) setTimeOpen(false);
  }

  function toggleStep(index: number) {
    setTicked((current) =>
      current.includes(index) ? current.filter((i) => i !== index) : [...current, index],
    );
  }

  function share() {
    const ratingCount = ratedMembers.length + 1;
    actions.sharePost({
      id: `p_me_${Date.now()}`,
      author: state.name,
      authorId: "me",
      questId: quest!.id,
      rating: Math.round(ratingAverage * 10) / 10,
      ratingCount,
      caption: caption.trim(),
      photo,
      withNames: names,
      at: Date.now(),
      hearts: 0,
      comments: [],
    });
    void navigate({ to: "/feed" });
  }

  const rise = (i: number) =>
    moved
      ? { className: "reveal", style: { "--i": i } as CSSProperties }
      : { className: "", style: {} };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {from === "quest" ? (
          <Link
            to="/quest/$questId"
            params={{ questId: quest.id }}
            viewTransition
            className={backClass}
          >
            <BackArrow /> Back to quest
          </Link>
        ) : from === "lists" ? (
          <Link to="/" search={{ tab: "mine" }} className={backClass}>
            <BackArrow /> Back to My quests
          </Link>
        ) : (
          <Link to="/" className={backClass}>
            <BackArrow /> Back to Quests
          </Link>
        )}

        <PageHeader
          className="mt-2"
          eyebrow={
            <span key={stage} className={moved ? "morph-in inline-block" : undefined}>
              {stage === "share"
                ? "you did it"
                : stage === "out"
                  ? "good luck out there"
                  : repeat
                    ? "let’s go again · no XP for repeats"
                    : "let’s go"}
            </span>
          }
          title={quest.title}
          leading={
            <span
              ref={printRef}
              className="mr-2 block shrink-0 rounded-md border border-border-strong bg-card p-1"
            >
              <img
                src={questImage(quest)}
                alt=""
                className="block h-[72px] w-[72px] rounded-[3px] bg-muted object-cover [view-transition-name:quest-photo] sm:h-24 sm:w-24"
              />
            </span>
          }
          meta={
            stage === "share" ? (
              // The payoff: the postmark lands on the page's paper, and what it earned counts up beside it.
              <div className="flex items-center gap-5">
                <span ref={stampRef} className="grid size-20 shrink-0 place-items-center">
                  {stamped ? (
                    <Stamp
                      label={finished?.squad ? "we did it" : "did it"}
                      {...(doneAt ? { sub: stampDate(doneAt) } : {})}
                      size={80}
                      tilt={-12}
                      slam={Boolean(finished?.fresh)}
                    />
                  ) : null}
                </span>
                <div className="min-w-0">
                  {finished && finished.earned > 0 ? (
                    <XpReceipt
                      earned={finished.earned}
                      squad={finished.squad}
                      ready={xpReady}
                      pour={state.xpSeen < state.xp}
                    />
                  ) : (
                    <p className="font-hand text-lg leading-tight text-muted-foreground">
                      already stamped · no XP for repeats
                    </p>
                  )}
                </div>
              </div>
            ) : undefined
          }
        />

        {stage === "plan" ? (
          <div key="plan" ref={stageRef} className={cn("space-y-9", moved && "stage-in")}>
            <section aria-labelledby="go-crew">
              <h2
                id="go-crew"
                ref={headingRef}
                tabIndex={-1}
                className="text-lg font-semibold leading-tight"
              >
                Which squad is going?
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip
                  active={selectedSquads.length === 0}
                  onClick={() => {
                    setSelectedSquadIds([]);
                    setCrew(null);
                  }}
                >
                  Going solo
                </Chip>
                {state.squads.map((squad) => (
                  <Chip
                    key={squad.id}
                    active={selectedSquadIds.includes(squad.id)}
                    onClick={() => {
                      // One squad at a time: picking one clears the rest.
                      setSelectedSquadIds((ids) =>
                        ids.includes(squad.id) ? [] : [squad.id],
                      );
                      setCrew(null);
                    }}
                  >
                    {squad.name}
                  </Chip>
                ))}
              </div>
              {selectedMemberIds.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No accepted squad members yet.{" "}
                  <Link
                    to="/squad"
                    className="font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4"
                  >
                    Invite people
                  </Link>
                  , or head out solo.
                </p>
              ) : null}
              {selectedMemberIds.length > 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Tap anyone who can’t make it. You’re always in.
                </p>
              ) : null}
              {people.length ? (
                // Who's coming, as faces: in full colour with an ink check, or faded out when they can't make it.
                <ul className="mt-4 flex flex-wrap gap-x-2 gap-y-3">
                  {people.map((u) => {
                    const on = chosen.includes(u.id);
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={u.name}
                          onClick={() => toggle(u.id)}
                          className="press grid w-16 cursor-pointer justify-items-center gap-1.5 rounded-md pb-1.5 pt-2 hover:bg-surface"
                        >
                          <span className="relative block">
                            <span
                              className={cn(
                                "block transition-opacity duration-(--dur-quick) ease-(--ease-out)",
                                !on && "opacity-45 grayscale",
                              )}
                            >
                              <Avatar name={u.name} size={48} imageUrl={u.photo ?? null} />
                            </span>
                            {on ? (
                              <span
                                aria-hidden
                                className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-foreground text-background ring-2 ring-background"
                              >
                                <Check
                                  className={cn("size-3", lastToggled === u.id && "draw-check")}
                                  strokeWidth={3.5}
                                />
                              </span>
                            ) : null}
                          </span>
                          <span
                            className={cn(
                              "max-w-full truncate text-[13px] leading-tight transition-colors duration-(--dur-quick)",
                              on ? "font-medium text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {u.name}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              <p className="mt-3 font-hand text-lg leading-tight text-muted-foreground">
                {crewNote(names)}
              </p>
            </section>

            <section aria-labelledby="go-when">
              <h2 id="go-when" className="text-lg font-semibold leading-tight">
                When?
              </h2>
              <div className="relative mt-4 grid w-full grid-cols-2 rounded-lg border border-border-strong bg-card p-1 sm:max-w-sm">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-md bg-foreground transition-transform duration-(--dur-slow) ease-(--ease-spring)"
                  style={{ transform: when === null ? "translateX(0)" : "translateX(100%)" }}
                />
                <button
                  type="button"
                  aria-pressed={when === null}
                  onClick={() => {
                    setWhenTouched(true);
                    setWhen(null);
                  }}
                  className={cn(
                    "press relative inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold",
                    when === null ? "text-background" : "text-foreground hover:bg-surface",
                  )}
                >
                  Right now
                </button>
                <Popover open={timeOpen} onOpenChange={setTimeOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "press relative inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold tabular-nums",
                        when !== null ? "text-background" : "text-foreground hover:bg-surface",
                      )}
                    >
                      {when === null ? "Pick a day and time" : whenLabel(when, { start: true })}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    sideOffset={8}
                    aria-label="Choose a day and time"
                    className="w-[min(360px,calc(100vw-2rem))] rounded-lg border-border-strong bg-card p-4 shadow-(--shadow-lift)"
                  >
                    <WhenPicker value={when} onPick={pickTime} />
                  </PopoverContent>
                </Popover>
              </div>
              {when ? (
                <label className="mt-4 block text-sm font-medium">
                  End time (optional)
                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) => {
                      setEndTime(event.target.value);
                      setScheduledHere(null);
                    }}
                    className="ml-3 min-h-11 rounded-md border border-input bg-card px-3"
                  />
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    Earlier than the start means the following day. Leave blank to use the quest’s
                    duration.
                  </span>
                </label>
              ) : null}
              <p className="mt-3 font-hand text-lg leading-tight text-muted-foreground">
                <span
                  key={`${when ?? "now"}:${listed}`}
                  className={
                    whenTouched || scheduledHere ? "morph-in inline-block" : "inline-block"
                  }
                >
                  {/* Only a plan Lists kept is "scheduled"; a repeat you picked a time for is still just aimed at. */}
                  {when === null
                    ? "heading out right now"
                    : `${listed ? "scheduled for" : "aiming for"} ${whenLabel(when)}`}
                </span>
              </p>
              {event ? (
                // The calendar step: plain paper buttons under the plan, never a second clover one.
                <div
                  role="group"
                  aria-label="Add it to your calendar"
                  className={cn(
                    "mt-4 flex flex-wrap items-center gap-2",
                    scheduledHere === when && "reveal",
                  )}
                >
                  <a
                    ref={calendarRef}
                    href={googleCalendarUrl(event)}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonClass({ variant: "outline", size: "sm" })}
                  >
                    <CalendarPlus aria-hidden className="h-4 w-4" />
                    Add to Google Calendar
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  <button
                    type="button"
                    onClick={saveCalendarFile}
                    className={buttonClass({ variant: "outline", size: "sm" })}
                  >
                    <Download aria-hidden className="h-4 w-4" />
                    Apple Calendar
                  </button>
                  <span className="inline-grid size-11 place-items-center">
                    <HelpDot label="How adding to your calendar works" align="center">
                      Google Calendar opens in a new tab with the time, the place and a link back to
                      this quest. Apple Calendar saves a small .ics file: on iPhone, open it and tap
                      Add to Calendar; on a laptop, open it from your downloads (Outlook reads it
                      too).
                    </HelpDot>
                  </span>
                </div>
              ) : null}
            </section>

            <Dock>
              {listed ? (
                // Scheduled: the plan lives in Lists now, and that's where this page leads.
                <Link
                  to="/" search={{ tab: "mine" }}
                  hash={`q-${quest.id}`}
                  className={cn(buttonClass(), "max-sm:flex-1")}
                >
                  <ListChecks aria-hidden className="h-5 w-5" />
                  See it in My quests
                </Link>
              ) : (
                <Button
                  onClick={() => (when === null ? void headOut() : scheduleQuest())}
                  className="max-sm:flex-1"
                >
                  {when === null ? (
                    <Doodle name="steps" size={20} />
                  ) : (
                    <CalendarPlus aria-hidden className="h-5 w-5" />
                  )}
                  {when === null ? "Head out" : "Schedule"}
                </Button>
              )}
              {listed ? null : (
                <TextButton onClick={saveForLater} className="px-2">
                  <Bookmark aria-hidden className="h-4 w-4" /> Save for later
                </TextButton>
              )}
            </Dock>
          </div>
        ) : null}

        {stage === "out" ? (
          <div key="out" ref={stageRef} className={cn("space-y-8", moved && "stage-in")}>
            <section>
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="flex items-center gap-2.5 text-[15px] font-semibold"
              >
                <span
                  aria-hidden
                  className="live-dot relative h-2 w-2 shrink-0 rounded-full bg-primary"
                />
                {repeat ? "You’re out again." : "Your quest is active."}
              </h2>
              <p className="mt-0.5 pl-[18px] text-[15px] text-muted-foreground">
                Come back here when you’re ready to wrap it up.
              </p>
            </section>

            <QuestDirections
              destination={quest.location}
              origin={origin}
              className="border-y border-border py-5"
            />

            <section aria-labelledby="go-steps">
              <SectionHeading id="go-steps" eyebrow="the quest" title="What you’ll do" />
              <p className="mt-3 text-[17px] leading-relaxed text-pretty">{quest.mission}</p>
              <p className="mt-6 font-hand text-lg leading-tight text-muted-foreground">
                tick them off as you go
              </p>
              <RouteStops
                steps={quest.steps}
                ticked={ticked}
                onToggle={toggleStep}
                className="mt-3"
              />
            </section>

            <Dock>
              <span ref={doneRef} className="inline-flex max-sm:flex-1">
                <Button full onClick={finish}>
                  We did it
                </Button>
              </span>
              <p
                className="shrink-0 px-1 font-hand text-lg leading-tight text-muted-foreground tabular-nums"
                aria-live="polite"
              >
                {allTicked
                  ? "that’s all of them"
                  : ticked.length
                    ? `${ticked.length} of ${quest.steps.length}`
                    : ""}
              </p>
            </Dock>
          </div>
        ) : null}

        {stage === "share" ? (
          <div key="share" ref={stageRef} className="space-y-10">
            <section aria-labelledby="go-rate" {...rise(1)}>
              <h2
                id="go-rate"
                ref={headingRef}
                tabIndex={-1}
                className="text-lg font-semibold leading-tight"
              >
                How did it rate?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                {members.length
                  ? "Your rating is enough to share. Add any squad ratings you have; only submitted ratings count toward the average."
                  : "Give it your own score out of 10."}
              </p>
              <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-10">
                <div className="space-y-5">
                  <RatingSlider
                    id="rating-you"
                    label="Your rating"
                    value={rating}
                    onChange={setRating}
                  />
                  {members.map((member) => (
                    <RatingSlider
                      key={member.id}
                      id={`rating-${member.id}`}
                      label={`${member.name}'s rating`}
                      value={memberRatings[member.id]}
                      onChange={(value) =>
                        setMemberRatings((current) => ({ ...current, [member.id]: value }))
                      }
                    />
                  ))}
                </div>
                <figure className="flex items-center gap-3 self-start max-sm:order-first sm:flex-col sm:gap-2 sm:pt-1">
                  <LiveRing
                    rating={ratingAverage}
                    label={
                      members.length
                        ? allMembersRated
                          ? "Squad average"
                          : "Average so far"
                        : "Your rating"
                    }
                  />
                  <figcaption className="font-hand text-base leading-tight text-muted-foreground sm:max-w-[7rem] sm:text-center">
                    how it’ll show on the feed
                  </figcaption>
                </figure>
              </div>
              {members.length ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {allMembersRated ? "Squad average" : "Average so far"}:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {score(ratingAverage)}/10
                  </span>
                  {!allMembersRated
                    ? ` · add ${members.length - ratedMembers.length} more ${members.length - ratedMembers.length === 1 ? "rating" : "ratings"}`
                    : null}
                </p>
              ) : null}
            </section>

            <section {...rise(2)}>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="caption" className="text-lg font-semibold leading-tight">
                  Say something about it
                </label>
                <span className="text-[13px] tabular-nums text-muted-foreground">
                  {caption.length}/280
                </span>
              </div>
              <textarea
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                maxLength={280}
                placeholder="The best part was…"
                className="mt-3 block w-full resize-y rounded-md border border-input bg-card p-3 text-base leading-relaxed transition-colors duration-(--dur-quick) placeholder:text-muted-foreground focus-visible:border-foreground"
              />
            </section>

            <section {...rise(3)}>
              <label
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                data-dragging={dragging ? "" : undefined}
                className={cn(
                  "relative grid aspect-[4/3] w-full cursor-pointer place-items-center overflow-hidden rounded-md border bg-card transition-colors duration-(--dur-quick) sm:w-80",
                  "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring",
                  photo
                    ? "border-border-strong"
                    : "border-dashed border-border-strong hover:bg-surface",
                  dragging && "border-solid bg-surface",
                )}
              >
                {photo ? (
                  <>
                    <img
                      key={photo}
                      src={photo}
                      alt="Your photo"
                      className="proof-in absolute inset-0 h-full w-full object-cover"
                    />
                    <span
                      className={cn(
                        buttonClass({ variant: "outline", size: "sm" }),
                        "absolute bottom-2 right-2",
                      )}
                    >
                      <ImagePlus aria-hidden className="h-4 w-4" />{" "}
                      {developing ? "Developing…" : "Change photo"}
                    </span>
                  </>
                ) : (
                  <span className="grid justify-items-center gap-1.5 px-6 text-center">
                    <ImagePlus aria-hidden className="h-6 w-6" />
                    <span className="text-[15px] font-semibold">Add a photo</span>
                    <span className="font-hand text-lg leading-tight text-muted-foreground">
                      {developing ? "developing…" : "add the proof"}
                    </span>
                  </span>
                )}
                <input type="file" accept="image/*" onChange={onPhoto} className="sr-only" />
              </label>
            </section>

            <Dock>
              <Button onClick={share} className="max-sm:flex-1" disabled={developing}>
                <Newspaper aria-hidden className="h-5 w-5" /> Share to feed
              </Button>
              <Button variant="ghost" onClick={() => void navigate({ to: "/" })}>
                Skip
              </Button>
            </Dock>
          </div>
        ) : null}

        <p role="status" className="sr-only">
          {announce}
        </p>
      </div>
    </AppShell>
  );
}

function BackArrow() {
  return (
    <ArrowLeft
      aria-hidden
      className="h-4 w-4 transition-transform duration-(--dur-quick) ease-(--ease-out) group-hover:-translate-x-0.5"
    />
  );
}

/** "+180 XP" counting up once the postmark lands, the squad bonus, and a way to the vial. */
function XpReceipt({
  earned,
  squad,
  ready,
  pour,
}: {
  earned: number;
  squad: boolean;
  ready: boolean;
  pour: boolean;
}) {
  const shown = Math.round(useCountUp(ready ? earned : 0, 700));
  return (
    <div
      data-ready={ready ? "" : undefined}
      className="xp-receipt flex flex-wrap items-center gap-x-5 gap-y-1"
    >
      <p className="text-[22px] font-semibold leading-none tabular-nums text-primary-deep">
        <span className="sr-only">Earned </span>+{shown} XP
      </p>
      {squad ? (
        <p className="text-sm text-muted-foreground">includes the +{XP.squadBonus} squad bonus</p>
      ) : null}
      {pour ? (
        <Link
          to="/profile"
          className="inline-flex min-h-11 items-center font-hand text-lg leading-none text-muted-foreground underline decoration-primary decoration-2 underline-offset-4 transition-colors duration-(--dur-quick) hover:text-foreground"
        >
          watch it pour
        </Link>
      ) : null}
    </div>
  );
}

const pickClass = (on: boolean) =>
  cn(
    "press min-h-11 cursor-pointer rounded-md border px-1 text-sm font-semibold tabular-nums",
    on
      ? "border-foreground bg-foreground text-background"
      : "border-border-strong bg-card hover:bg-surface",
  );

/**
 * A day (today, tomorrow, the five after), then a time on it: six quick slots that follow the day
 * (today only offers what's still ahead), or any time on the native wheel.
 */
function WhenPicker({
  value,
  onPick,
}: {
  value: string | null;
  onPick: (value: string, done?: boolean) => void;
}) {
  const days = useMemo(() => upcomingDays(), []);
  const picked = value ? splitWhen(value) : null;
  const [day, setDay] = useState(() => {
    if (picked) return picked.day;
    // Late in the evening today has nothing left, so start on tomorrow.
    return timeSlots(days[0]!.key).length ? days[0]!.key : days[1]!.key;
  });
  const slots = useMemo(() => timeSlots(day), [day]);
  // The wheel starts on your time, or an easy one that's still ahead on the day it opens to.
  const [custom, setCustom] = useState(
    () =>
      picked?.time ?? (day === days[0]!.key ? (slots[2] ?? slots.at(-1)) : undefined) ?? "19:00",
  );
  const customGone = Boolean(custom) && !isAhead(joinWhen(day, custom));

  // A new day keeps the time you already had, if that's still ahead on it; otherwise pick a time.
  function chooseDay(key: string) {
    setDay(key);
    if (picked && picked.day !== key && isAhead(joinWhen(key, picked.time)))
      onPick(joinWhen(key, picked.time), false);
  }

  return (
    <div>
      <p className="font-hand text-lg leading-tight text-muted-foreground">pick a day and time</p>
      <div role="group" aria-label="Day" className="mt-3 grid grid-cols-4 gap-2">
        {days.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={day === option.key}
            onClick={() => chooseDay(option.key)}
            className={pickClass(day === option.key)}
          >
            {option.label}
            <span className="sr-only">{option.spoken}</span>
          </button>
        ))}
      </div>
      <label className="mt-4 block text-[13px] text-muted-foreground">
        Another day
        <input
          type="date"
          min={days[0]!.key}
          value={day}
          onChange={(event) => {
            if (event.target.value) chooseDay(event.target.value);
          }}
          className="mt-1 block min-h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] text-foreground"
        />
      </label>
      <div role="group" aria-label="Time" className="mt-4 border-t border-border pt-4">
        {slots.length ? (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((slot) => {
              const on = value === joinWhen(day, slot);
              return (
                <button
                  key={slot}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPick(joinWhen(day, slot), false)}
                  className={pickClass(on)}
                >
                  {slotLabel(slot)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No more easy times today. Pick another day, or set a time below.
          </p>
        )}
      </div>
      <div className="mt-4 flex items-end gap-2 border-t border-border pt-4">
        <label className="min-w-0 flex-1 text-[13px] text-muted-foreground">
          Other time
          <input
            type="time"
            step={900}
            value={custom}
            aria-describedby={customGone ? "when-gone" : undefined}
            aria-invalid={customGone || undefined}
            onChange={(event) => setCustom(event.target.value)}
            className="mt-1 block h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] tabular-nums text-foreground transition-colors duration-(--dur-quick) focus-visible:border-foreground"
          />
        </label>
        <Button
          variant="ink"
          size="sm"
          disabled={!custom || customGone}
          onClick={() => custom && onPick(joinWhen(day, custom), false)}
        >
          Set time
        </Button>
      </div>
      {customGone ? (
        <p id="when-gone" className="mt-2 text-[13px] text-destructive">
          That time has already passed today.
        </p>
      ) : null}
      <div className="mt-4 flex justify-end border-t border-border pt-4">
        <Button
          variant="ink"
          size="sm"
          disabled={!value}
          onClick={() => value && onPick(value, true)}
        >
          <Check aria-hidden className="size-4" />
          Done
        </Button>
      </div>
    </div>
  );
}

const RING_RADIUS = 20;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * The feed's rating ring (same arc, track and disc as RatingRing), but live: the arc glides to the
 * new average as you slide instead of replaying its fill from zero.
 */
function LiveRing({ rating, label }: { rating: number; label: string }) {
  const value = Math.round(Math.min(10, Math.max(0, rating)) * 10) / 10;
  return (
    <div
      role="img"
      aria-label={`${label}: ${score(value)} out of 10`}
      className="relative grid size-16 shrink-0 place-items-center rounded-full bg-card"
    >
      <svg aria-hidden viewBox="0 0 44 44" className="absolute inset-0 size-full -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="4"
          className="stroke-muted"
        />
        <circle
          cx="22"
          cy="22"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          className="stroke-primary-deep transition-[stroke-dashoffset,opacity] duration-(--dur-slow) ease-(--ease-spring)"
          style={{
            strokeDashoffset: RING_LENGTH * (1 - value / 10),
            opacity: value > 0.05 ? 1 : 0,
          }}
        />
      </svg>
      <span aria-hidden className="relative text-[19px] font-bold leading-none tracking-[-0.01em]">
        <Tally value={value} />
      </span>
    </div>
  );
}

/**
 * A 0-10 rating on a paper track. The score is the big number; a squadmate who hasn't rated yet
 * shows an empty track and a dashed thumb ("tap to rate"), never a pretend 5.
 */
function RatingSlider({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  const rated = value !== undefined;
  const shown = value ?? 5;
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={id} className="text-[15px] font-medium">
          {label}
        </label>
        {rated ? (
          <span aria-hidden className="flex items-baseline gap-0.5 leading-none">
            <Tally value={value} className="text-[28px] font-semibold" />
            <span className="text-sm text-muted-foreground">/10</span>
          </span>
        ) : (
          <span aria-hidden className="font-hand text-lg leading-none text-muted-foreground">
            tap to rate
          </span>
        )}
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={10}
        step={1}
        value={shown}
        aria-valuetext={rated ? `${value} out of 10` : "not rated"}
        data-unrated={rated ? undefined : ""}
        onChange={(event) => onChange(Number(event.target.value))}
        // Tapping the resting spot of an unrated slider doesn't fire a change, so commit it here.
        onPointerUp={(event) => {
          if (!rated) onChange(Number(event.currentTarget.value));
        }}
        className="quest-range mt-1"
        style={{ "--pct": `${shown * 10}%` } as CSSProperties}
      />
      <div aria-hidden className="quest-ticks">
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i} data-label={i % 5 === 0 ? String(i) : undefined} />
        ))}
      </div>
    </div>
  );
}

/**
 * The stage's one action, sticky just above the phone tab bar. At rest it's the buttons on the
 * page; while it floats, a paper ticket slides in under them.
 */
function Dock({ children }: { children: ReactNode }) {
  const dock = useRef<HTMLDivElement>(null);
  const rest = useRef<HTMLDivElement>(null);
  const stuck = useStuck(dock, rest);
  return (
    <>
      {/* The stage's space-y would put a bottom margin on the dock and read as a lift, so it rests flush. */}
      <div
        ref={dock}
        data-stuck={stuck ? "" : undefined}
        className="quest-dock !mt-10 !mb-0 flex flex-wrap items-center gap-2 sm:w-fit sm:gap-3"
      >
        {children}
      </div>
      <div ref={rest} aria-hidden className="!mt-0 h-px" />
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
