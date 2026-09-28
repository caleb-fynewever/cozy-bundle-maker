import { questCatalog } from "@/lib/catalog";
import { useServerFn } from "@tanstack/react-start";
import { signOut } from "@/lib/auth";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";
import {
  findProfileByHandle,
  syncProfile,
  type PublicProfile as RemotePublicProfile,
} from "@/lib/profiles.functions";
import { createFileRoute, Link, notFound, useCanGoBack, useRouter } from "@tanstack/react-router";
import { Doodle } from "@/components/Doodle";
import type { DoodleName } from "@/lib/doodles";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Action as AlertAction, Cancel as AlertCancel } from "@radix-ui/react-alert-dialog";
import { Check, ChevronLeft, Settings2, Upload, UserPlus } from "lucide-react";
import { sendSquadInviteByHandle } from "@/lib/squad-invites.functions";
import { AppShell } from "@/components/AppShell";
import { HelpDot } from "@/components/HelpDot";
import { InviteButton } from "@/components/InviteButton";
import { LevelJourney } from "@/components/LevelJourney";
import { LevelProgress } from "@/components/LevelProgress";
import { QuestDna } from "@/components/QuestDna";
import { Stamp } from "@/components/Stamp";
import {
  Avatar,
  Button,
  buttonClass,
  Chip,
  PageHeader,
  Panel,
  PhotoPrint,
  SectionHeading,
  StatLedger,
  Tally,
  TextButton,
  textButtonClass,
  Verified,
} from "@/components/ui-kit";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { NEARBY_STUDENTS } from "@/data/people";
import { ALL_QUESTS } from "@/data/quests";
import { buildTasteVector, compatibility } from "@/lib/engine";
import { questImage } from "@/lib/imagery";
import { rankBoard } from "@/lib/leaderboard";
import { burst, reducedMotion } from "@/lib/motion";
import {
  badges,
  levelName,
  weeklyStreak,
  weekXp,
  XP_RULES,
  xpTrail,
  type Badge,
  type TrailEntry,
} from "@/lib/progress";
import { actions, useUserState, type UserState } from "@/lib/store";
import { VIBES, VIBE_LABEL, type DemoUser, type Quest, type Vibe } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LANGUAGE_OPTIONS, translate, type Locale } from "@/lib/i18n";
import { VIBE_DOODLE, VIBE_ICON } from "@/lib/vibes";

async function makeAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose an image smaller than 10 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
  if (dataUrl.length > 400_000)
    throw new Error("That image could not be compressed enough. Try a smaller one.");
  return dataUrl;
}

export const Route = createFileRoute("/profile")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search["handle"] === "string" ? { handle: search["handle"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Your profile | wego" },
      { name: "description", content: "Your quests, XP, weekly streak, and badges." },
      { property: "og:title", content: "Your profile | wego" },
      { property: "og:description", content: "Your quests, XP, weekly streak, and badges." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const state = useUserState();
  const { handle } = Route.useSearch();

  if (handle && handle !== state.handle) {
    if (state.directory.some(p => p.handle === handle)) return <RemoteProfile key={handle} handle={handle} />;
    const person = (state.catalogLoaded ? state.remotePeople : NEARBY_STUDENTS).find((candidate) => candidate.handle === handle);
    if (!person) return <RemoteProfile key={handle} handle={handle} />;
    return <PublicProfile person={person} />;
  }
  return <OwnProfile />;
}

/* ---------- your own profile ---------- */

const PREVIEW = 6;
const shortDate = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function OwnProfile() {
  const state = useUserState();
  const allQuests = useMemo(() => questCatalog(state, true), [state.createdQuests, state.remoteQuests, state.remoteArchivedQuests]);
  const questById = useMemo(
    () => new Map(allQuests.map((quest) => [quest.id, quest] as const)),
    [allQuests],
  );
  const taste = useMemo(() => buildTasteVector(state), [state]);
  const entries = useMemo(() => rankBoard(state, "xp", "friends"), [state]);
  const myRank = entries.findIndex((entry) => entry.you) + 1;
  const completed = state.completed
    .map((id) => questById.get(id))
    .filter((quest): quest is Quest => Boolean(quest))
    .reverse();
  const stamps = badges(state);
  const thisWeek = weekXp(state);
  // The XP the vial last came to rest at; stamps wait for it so the page moves in one order.
  const [settledXp, setSettledXp] = useState<number | null>(null);
  const [allDone, setAllDone] = useState(false);
  // Every level on one trail, opened from the level label; focus goes back to it on close.
  const [journeyOpen, setJourneyOpen] = useState(false);
  const journeyFrom = useRef<HTMLElement | null>(null);

  // Before there's history, show the vibes you picked (if any) as the empty tracks.
  const dnaVibes = taste.hasHistory
    ? taste.vibes
    : (Object.fromEntries(
      VIBES.map((vibe) => [vibe, state.favoriteVibes.includes(vibe) ? 1 : 0]),
    ) as Record<Vibe, number>);

  const rankLinkClass =
    "hit-44 text-sm font-semibold underline decoration-border decoration-1 underline-offset-4 transition-colors duration-(--dur-quick) hover:decoration-primary hover:decoration-2";

  return (
    <AppShell>
      <PageHeader
        eyebrow="your field notes"
        title={state.name}
        leading={<Avatar name={state.name} you size={72} imageUrl={state.avatarUrl} />}
        action={<SettingsDialog />}
        meta={
          <div className="space-y-2">
            <MetaLine
              parts={[
                <span key="handle">@{state.handle}</span>,
                state.verified ? <Verified key="verified" label="UMN student" /> : null,
              ]}
            />
            {state.bio ? (
              <p className="max-w-prose text-[15px] leading-relaxed text-muted-foreground text-pretty">
                {state.bio}
              </p>
            ) : null}
          </div>
        }
      />

      <div className="profile-grid">
        <Panel data-area="level" aria-labelledby="level-heading" className="pb-1 sm:pb-2">
          <LevelProgress
            xp={state.xp}
            seenXp={state.xpSeen}
            onSeen={actions.seeXp}
            onSettled={setSettledXp}
            onShowLevels={(opener) => {
              journeyFrom.current = opener;
              setJourneyOpen(true);
            }}
            levelsOpen={journeyOpen}
            aside={
              entries.length > 1 ? (
                <Link to="/leaderboard" className={rankLinkClass}>
                  #{myRank} in your squad
                </Link>
              ) : (
                <Link to="/squad" className={rankLinkClass}>
                  Build a squad leaderboard
                </Link>
              )
            }
          />
          <StatLedger
            className="mt-6 border-b-0"
            items={[
              { key: "week", label: "XP this week", value: `+${thisWeek.toLocaleString()}` },
              { key: "finished", label: "quests finished", value: state.completed.length },
              {
                key: "made",
                // The count stays a number like its neighbours (one baseline); the nudge sits under the label.
                label: state.createdQuests.length ? (
                  "quests made"
                ) : (
                  <>
                    quests made
                    <Link
                      to="/"
                      search={{ tab: "create" }}
                      className={cn(
                        textButtonClass,
                        "hit-44 mt-1 flex min-h-0 w-fit text-[13px] text-foreground",
                      )}
                    >
                      Make one
                    </Link>
                  </>
                ),
                value: state.createdQuests.length,
              },
              { key: "streak", label: "weekly streak", value: weeklyStreak(state) },
            ]}
          />
        </Panel>

        <div className="profile-rail">
          <section data-area="stamps" aria-labelledby="stamps-heading">
            <StampSheet list={stamps} seen={state.stampsSeen} ready={settledXp === state.xp} />
          </section>
          <section data-area="into" aria-labelledby="dna-heading">
            <QuestDna
              id="dna-heading"
              eyebrow="changes as you go"
              vibes={dnaVibes}
              empty={!taste.hasHistory}
              emptyNote="Do a few quests and this fills in."
            />
          </section>
        </div>

        <section data-area="trail" aria-labelledby="activity-heading">
          <SectionHeading
            eyebrow="small steps add up"
            title={
              // The section is named by the words alone; the "?" beside them is its own button.
              <span className="inline-flex items-center gap-2">
                <span id="activity-heading">XP trail</span>
                <XpRules />
              </span>
            }
          />
          <XpTrail log={state.log} questById={questById} />
        </section>

        <section data-area="done" aria-labelledby="done-heading">
          <SectionHeading
            id="done-heading"
            eyebrow="places you've been"
            title="Done"
            action={completed.length ? placeCount(completed.length) : undefined}
          />
          {completed.length ? (
            <>
              <PlaceList quests={allDone ? completed : completed.slice(0, PREVIEW)} />
              {completed.length > PREVIEW ? (
                <TextButton onClick={() => setAllDone((open) => !open)} className="mt-1">
                  {allDone ? "Show fewer" : `Show all ${completed.length}`}
                </TextButton>
              ) : null}
            </>
          ) : (
            <p className="mt-4 flex flex-wrap items-center gap-x-3 text-muted-foreground">
              No places yet.
              <Link to="/" className={textButtonClass}>
                Find a quest
              </Link>
            </p>
          )}
        </section>
      </div>
      <LevelJourney
        open={journeyOpen}
        onOpenChange={setJourneyOpen}
        returnFocus={journeyFrom}
        xp={state.xp}
        log={state.log}
        name={state.name}
        avatarUrl={state.avatarUrl}
      />
    </AppShell>
  );
}

/* ---------- stamps ---------- */

/** Each stamp lands at its own slight angle, like it was pressed by hand. */
const TILT: Record<string, number> = { first: -6, regular: 4, maker: -3, crew: 7, streak: -5 };

/**
 * A passport page of stamps. Earned ones are inked; the rest are pencilled outlines with their
 * progress traced around the edge. A stamp earned since your last visit waits (as a full outline)
 * until the XP vial settles and the sheet is in view, then presses on once.
 */
function StampSheet({ list, seen, ready }: { list: Badge[]; seen: string[]; ready: boolean }) {
  const sheet = useRef<HTMLUListElement>(null);
  const fresh = list
    .filter((badge) => badge.earned && !seen.includes(badge.id))
    .map((badge) => badge.id);
  const freshKey = fresh.join(" ");
  const [pressing, setPressing] = useState<string[]>([]);
  const [landed, setLanded] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const landedIds = useRef(new Set<string>());

  useEffect(() => {
    const el = sheet.current;
    if (!ready || !freshKey || !el) return;
    const ids = freshKey.split(" ");
    const timers: number[] = [];
    const press = () =>
      ids.forEach((id, i) => {
        timers.push(
          window.setTimeout(
            () => setPressing((now) => (now.includes(id) ? now : [...now, id])),
            i * 260,
          ),
        );
      });
    if (typeof IntersectionObserver === "undefined") {
      press();
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        press();
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [ready, freshKey]);

  const land = (badge: Badge) => {
    if (landedIds.current.has(badge.id)) return;
    landedIds.current.add(badge.id);
    setLanded((now) => [...now, badge.id]);
    const cell = sheet.current?.querySelector<HTMLElement>(`[data-stamp="${badge.id}"]`);
    if (cell && !reducedMotion()) {
      const box = cell.getBoundingClientRect();
      burst(box.left + box.width / 2, box.top + box.height / 2, {
        sparks: 7,
        stars: 2,
        spread: box.width * 0.6,
      });
    }
    const ids = freshKey.split(" ").filter(Boolean);
    if (ids.length && ids.every((id) => landedIds.current.has(id))) {
      const names = list.filter((item) => ids.includes(item.id)).map((item) => item.name);
      setAnnouncement(`New ${names.length > 1 ? "stamps" : "stamp"}: ${names.join(" and ")}.`);
      actions.seeStamps(ids);
      // Seen now, so forget the moment; if a reset makes one new again, it gets pressed again.
      ids.forEach((id) => landedIds.current.delete(id));
      setPressing((now) => now.filter((id) => !ids.includes(id)));
      setLanded((now) => now.filter((id) => !ids.includes(id)));
    }
  };

  const shown = list.filter(
    (badge) => badge.earned && (!fresh.includes(badge.id) || landed.includes(badge.id)),
  ).length;
  const next = list
    .filter((badge) => !badge.earned)
    .sort((a, b) => b.have / b.need - a.have / a.need)[0];

  return (
    <>
      <SectionHeading
        id="stamps-heading"
        eyebrow="little milestones"
        title="Stamps"
        action={
          <span>
            <Tally value={shown} /> of {list.length}
          </span>
        }
      />
      <ul ref={sheet} className="stamp-sheet mt-5">
        {list.map((badge) => {
          const isFresh = fresh.includes(badge.id);
          const inked = badge.earned && (!isFresh || pressing.includes(badge.id));
          const pencilled = !badge.earned || (isFresh && !landed.includes(badge.id));
          const date = badge.earnedAt ? shortDate(badge.earnedAt) : undefined;
          // The date stays off the stamp's face (too small to read there); it's in the tooltip and the sr text.
          return (
            <li
              key={badge.id}
              title={`${badge.name}: ${badge.note}${badge.earned && date ? `, earned ${date}` : ""}`}
            >
              <span className="sr-only">
                {badge.name},{" "}
                {badge.earned
                  ? `earned${date ? ` ${date}` : ""}`
                  : `locked. ${badge.note}: ${badge.have} of ${badge.need}`}
                .
              </span>
              <span
                aria-hidden
                className="stamp-cell"
                data-stamp={badge.id}
                data-earned={inked ? "" : undefined}
              >
                {pencilled ? <StampSlot badge={badge} leaving={inked} /> : null}
                {inked ? (
                  <Stamp
                    {...(STAMP_ART[badge.id] ? { art: STAMP_ART[badge.id]! } : {})}
                    label={badge.mark}
                    tilt={TILT[badge.id] ?? -4}
                    size={88}
                    slam={isFresh}
                    onLanded={() => land(badge)}
                    className="h-full! w-full!"
                  />
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      {next ? (
        <p className="mt-4 text-sm text-muted-foreground text-pretty">
          Next up: <span className="font-medium text-foreground">{next.name}</span>, {next.left}.
        </p>
      ) : null}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </>
  );
}

/** The friend's doodle pressed into each stamp. */
const STAMP_ART: Record<string, DoodleName | undefined> = {
  first: "steps",
  regular: "active",
  maker: "creative",
  crew: "social",
  streak: "competitive",
};

/** Where a stamp will go: a dashed outline, its name pencilled in, progress traced in clover. */
function StampSlot({ badge, leaving }: { badge: Badge; leaving: boolean }) {
  const pct = badge.need ? Math.round((badge.have / badge.need) * 100) : 0;
  return (
    <span className="stamp-slot" data-leaving={leaving ? "" : undefined}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          strokeWidth="1.5"
          strokeDasharray="3.2 4.4"
          className="stamp-slot-ring"
        />
        {pct > 0 ? (
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            strokeWidth="3.2"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${pct} 100`}
            transform="rotate(-90 50 50)"
            className="stamp-slot-arc"
          />
        ) : null}
      </svg>
      <span className="relative flex max-w-[76%] flex-col items-center text-center">
        {STAMP_ART[badge.id] ? (
          <Doodle name={STAMP_ART[badge.id]!} size={26} faint className="mb-1" />
        ) : null}
        <span className="stamp-slot-name font-hand leading-[1.05] text-muted-foreground">
          {badge.name}
        </span>
        <span className="stamp-slot-count mt-1 font-semibold tabular-nums text-muted-foreground">
          {badge.have} of {badge.need}
        </span>
      </span>
    </span>
  );
}

/* ---------- XP trail ---------- */

const dayStart = (at: number) => {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

/** A handwritten day marker: today, yesterday, a weekday this week, then a date. */
function dayLabel(at: number, now: number) {
  const days = Math.round((dayStart(now) - dayStart(at)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7)
    return new Date(at).toLocaleDateString(undefined, { weekday: "long" }).toLowerCase();
  return shortDate(at).toLowerCase();
}

function byDay(entries: TrailEntry[], now = Date.now()) {
  const days: { key: number; label: string; iso: string; entries: TrailEntry[] }[] = [];
  for (const entry of entries) {
    const key = dayStart(entry.at);
    let day = days.at(-1);
    if (!day || day.key !== key) {
      const date = new Date(key);
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      day = { key, label: dayLabel(entry.at, now), iso, entries: [] };
      days.push(day);
    }
    day.entries.push(entry);
  }
  return days;
}

/** How XP works, on a slip beside the "XP trail" heading: each way to earn it, with its XP on the right. */
function XpRules() {
  return (
    <HelpDot label="How XP works" title="How XP works">
      <ul className="-my-1 divide-y divide-border">
        {XP_RULES.map((rule) => (
          <li
            key={rule.kind}
            className={cn(
              "flex items-baseline justify-between gap-4 py-1.5",
              rule.kind === "squad" ? "pl-3" : "text-foreground",
            )}
          >
            <span>{rule.label}</span>
            <span className="shrink-0 text-right font-semibold tabular-nums text-foreground">
              +{rule.xp} XP
            </span>
          </li>
        ))}
      </ul>
    </HelpDot>
  );
}

function XpTrail({ log, questById }: { log: UserState["log"]; questById: Map<string, Quest> }) {
  const [all, setAll] = useState(false);
  const trail = useMemo(() => xpTrail(log), [log]);
  if (!trail.length)
    return (
      <p className="mt-4 text-muted-foreground">Your XP trail starts with your first quest.</p>
    );
  const days = byDay(all ? trail : trail.slice(0, PREVIEW));
  return (
    <>
      <ol className="xp-trail mt-5">
        {days.map((day) => (
          <li key={day.key}>
            <p className="xp-trail-day font-hand text-[17px] leading-tight text-muted-foreground">
              <time dateTime={day.iso}>{day.label}</time>
            </p>
            <ul className="mt-0.5">
              {day.entries.map((entry) => (
                <TrailStop key={entry.key} entry={entry} questById={questById} />
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {trail.length > PREVIEW ? (
        <TextButton onClick={() => setAll((open) => !open)} className="mt-1">
          {all ? "Show fewer" : `Show all ${trail.length}`}
        </TextButton>
      ) : null}
    </>
  );
}

function TrailStop({ entry, questById }: { entry: TrailEntry; questById: Map<string, Quest> }) {
  const quest = entry.refId ? questById.get(entry.refId) : undefined;
  const person =
    !quest && entry.kind === "join" && entry.refId
      ? NEARBY_STUDENTS.find((candidate) => candidate.id === entry.refId)
      : undefined;
  const linked = Boolean(quest || person);
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[15px] font-medium",
            linked && "decoration-primary decoration-2 underline-offset-4 group-hover:underline",
          )}
        >
          {entry.label}
        </span>
        {entry.bonus ? (
          <span className="block font-hand text-[15px] leading-tight text-muted-foreground">
            with the squad +{entry.bonus}
          </span>
        ) : null}
      </span>
      <span className="w-14 shrink-0 text-right text-[15px] font-semibold tabular-nums">
        +{entry.xp.toLocaleString()}
      </span>
    </>
  );
  const row = "flex min-h-12 items-center gap-3 py-1.5";
  const linkRow = cn(
    row,
    "group -mx-2 rounded-md px-2 transition-colors duration-(--dur-quick) hover:bg-surface",
  );
  return (
    <li className="xp-trail-row">
      <span aria-hidden className="xp-node" data-kind={entry.kind} />
      {quest ? (
        <Link to="/quest/$questId" params={{ questId: quest.id }} className={linkRow}>
          {body}
        </Link>
      ) : person ? (
        <Link to="/profile" search={{ handle: person.handle }} className={linkRow}>
          {body}
        </Link>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  );
}

const placeCount = (n: number) => `${n} ${n === 1 ? "place" : "places"}`;
const COUNT_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);

/**
 * Places you (or they) have been, as small prints in a notebook: the photo, the title, and the
 * neighborhood under it. `alsoYours` marks the ones you've done too with a pencilled note.
 */
function PlaceList({ quests, alsoYours }: { quests: Quest[]; alsoYours?: string[] }) {
  return (
    <ul className="mt-4 divide-y divide-border border-y border-border">
      {quests.map((quest) => (
        <li key={quest.id}>
          <Link
            to="/quest/$questId"
            params={{ questId: quest.id }}
            className="group -mx-2 flex min-h-[4.5rem] items-center gap-3 rounded-md px-2 py-2 transition-colors duration-(--dur-quick) hover:bg-surface"
          >
            <PhotoPrint
              src={questImage(quest)}
              alt=""
              className="w-14 shrink-0 border-border p-0.5"
              imgClassName="aspect-square"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium decoration-primary decoration-2 underline-offset-4 group-hover:underline">
                {quest.title}
              </span>
              <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                {quest.location.area}
              </span>
            </span>
            {alsoYours?.includes(quest.id) ? (
              <span className="shrink-0 font-hand text-[15px] leading-tight text-muted-foreground">
                you've been too
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** A meta line whose parts are set apart with a middle dot (as in the feed), so it never reads as one run-on phrase. */
function MetaLine({ parts }: { parts: ReactNode[] }) {
  const shown = parts.filter(Boolean);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      {shown.map((part, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {part}
          {i < shown.length - 1 ? <span aria-hidden>·</span> : null}
        </span>
      ))}
    </p>
  );
}

/* ---------- settings ---------- */

type SettingsDraft = Parameters<typeof actions.saveSettings>[0];

const draftFrom = (state: UserState): SettingsDraft => ({
  name: state.name,
  handle: state.handle,
  bio: state.bio,
  avatarUrl: state.avatarUrl,
  favoriteVibes: state.favoriteVibes,
  optInNearby: state.optInNearby,
  shareLocation: state.shareLocation,
  publicProfile: state.publicProfile,
});

const PRIVACY = [
  ["publicProfile", "Public profile"],
  ["optInNearby", "Show me to students nearby"],
  ["shareLocation", "Use my rough location for suggestions"],
] as const;

// An ink thumb on a clover (on) or paper (off) track, with a small spring when it flips.
const SWITCH =
  "h-6 w-10 border border-foreground px-[3px] shadow-none data-[state=unchecked]:bg-card data-[state=checked]:bg-primary [&>span]:h-4 [&>span]:w-4 [&>span]:bg-foreground [&>span]:shadow-none [&>span]:duration-(--dur-quick) [&>span]:ease-(--ease-spring)";

const FIELD =
  "mt-1.5 min-h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] font-normal";

function SettingsDialog() {
  const syncMyProfile = useServerFn(syncProfile);
  const [saving, setSaving] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState("");
  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationError("This browser cannot share your location.");
      return;
    }
    setLocationBusy(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        actions.setApproximateLocation(coords.latitude, coords.longitude);
        setDraft((current) => ({ ...current, shareLocation: true }));
        setLocationBusy(false);
      },
      () => {
        setLocationError("Could not get your location. Check browser permissions and try again.");
        setLocationBusy(false);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 12000 },
    );
  }
  const state = useUserState();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SettingsDraft>(() => draftFrom(state));
  const [avatarError, setAvatarError] = useState("");
  const idBase = useId();
  // A name and a handle of your own, so posts are never signed by nobody and links to someone
  // else's profile never open yours.
  const name = draft.name.trim();
  const nameError = name ? "" : "Add a name so your squad knows it's you.";
  const handleError =
    draft.handle.length < 2
      ? "A handle needs at least 2 characters."
      : NEARBY_STUDENTS.some((person) => person.handle === draft.handle)
        ? "Someone nearby already goes by that handle."
        : "";
  const invalid = Boolean(nameError || handleError);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraft(draftFrom(state));
          setAvatarError("");
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(buttonClass({ variant: "outline", size: "sm" }), "max-sm:w-11 max-sm:px-0")}
        >
          <Settings2 aria-hidden className="h-4 w-4" />
          <span className="max-sm:sr-only">Settings</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader className="pr-10 text-left">
          <DialogTitle className="text-xl leading-tight">Make it yours</DialogTitle>
          <DialogDescription className="text-pretty">
            Choose what your profile says and who can find you. Your exact location is never shown.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <span className="block text-sm font-medium">Profile picture</span>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Avatar name={draft.name || state.name} size={56} you imageUrl={draft.avatarUrl} />
              <label className={cn(buttonClass({ variant: "outline", size: "sm" }), "file-pick")}>
                <Upload aria-hidden className="h-4 w-4" /> Choose image
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (event) => {
                    const input = event.currentTarget;
                    const file = input.files?.[0];
                    input.value = "";
                    if (!file) return;
                    try {
                      setAvatarError("");
                      const avatarUrl = await makeAvatarDataUrl(file);
                      setDraft((current) => ({ ...current, avatarUrl }));
                    } catch (error) {
                      setAvatarError(
                        error instanceof Error ? error.message : "Could not load that image.",
                      );
                    }
                  }}
                />
              </label>
              {draft.avatarUrl ? (
                <TextButton
                  onClick={() => setDraft((current) => ({ ...current, avatarUrl: null }))}
                  ariaLabel="Remove profile picture"
                >
                  Remove
                </TextButton>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Your image stays in this browser on this device.
            </p>
            {avatarError ? (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {avatarError}
              </p>
            ) : null}
          </div>
          <div>
            <label className="block text-sm font-medium">
              Name
              <input
                value={draft.name}
                maxLength={40}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? `${idBase}-name-error` : undefined}
                className={cn(FIELD, nameError && "border-destructive")}
              />
            </label>
            {nameError ? (
              <p
                id={`${idBase}-name-error`}
                className="mt-1.5 text-xs font-medium text-destructive"
              >
                {nameError}
              </p>
            ) : null}
          </div>
          <div>
            <label className="block text-sm font-medium">
              Handle
              <span
                className={cn(
                  "mt-1.5 flex min-h-11 items-center rounded-md border border-input bg-card px-3 text-[15px] font-normal focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
                  handleError && "border-destructive",
                )}
              >
                <span className="text-muted-foreground">@</span>
                <input
                  value={draft.handle}
                  maxLength={24}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      handle: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                    })
                  }
                  aria-invalid={handleError ? true : undefined}
                  aria-describedby={handleError ? `${idBase}-handle-error` : undefined}
                  className="min-w-0 flex-1 bg-transparent pl-1 outline-none"
                />
              </span>
            </label>
            {handleError ? (
              <p
                id={`${idBase}-handle-error`}
                className="mt-1.5 text-xs font-medium text-destructive"
              >
                {handleError}
              </p>
            ) : null}
          </div>
          <label className="block text-sm font-medium">
            Bio
            <textarea
              value={draft.bio}
              maxLength={160}
              rows={3}
              onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
              className={cn(FIELD, "py-2.5")}
            />
          </label>
          <fieldset>
            <legend className="text-sm font-medium">Your vibes</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {VIBES.map((vibe) => {
                const Icon = VIBE_ICON[vibe];
                const on = draft.favoriteVibes.includes(vibe);
                return (
                  <Chip
                    key={vibe}
                    active={on}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        favoriteVibes: on
                          ? current.favoriteVibes.filter((v) => v !== vibe)
                          : [...current.favoriteVibes, vibe],
                      }))
                    }
                  >
                    <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    {VIBE_LABEL[vibe]}
                  </Chip>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">Privacy</legend>
            <div className="mt-1 divide-y divide-border">
              {PRIVACY.map(([key, label]) => (
                <div key={key} className="flex min-h-12 items-center justify-between gap-4">
                  <label
                    htmlFor={`${idBase}-${key}`}
                    className="flex-1 cursor-pointer py-3 text-[15px]"
                  >
                    {label}
                  </label>
                  <Switch
                    id={`${idBase}-${key}`}
                    checked={draft[key]}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, [key]: checked }))
                    }
                    className={SWITCH}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" disabled={locationBusy} onClick={requestLocation}>
                {locationBusy
                  ? "Finding your area…"
                  : state.approximateLocation
                    ? "Update area"
                    : "Use my location"}
              </Button>
              <span className="text-xs text-muted-foreground">
                {state.approximateLocation
                  ? "Using your approximate area."
                  : "Distances start from East Bank."}
              </span>
            </div>
            {locationError ? (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {locationError}
              </p>
            ) : null}
          </fieldset>
          <div>
            <label className="block text-sm font-medium" htmlFor={`${idBase}-language`}>
              Language
            </label>
            <select
              id={`${idBase}-language`}
              value={state.language}
              onChange={(event) => actions.setLanguage(event.target.value as Locale)}
              className="mt-2 min-h-11 w-full rounded-md border border-input bg-card px-3 text-[15px]"
              aria-label="App language"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {translate("The app changes language right away.", state.language)}
            </p>
          </div>
          <div>
            <span className="block text-sm font-medium">Put wego on your phone</span>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">iPhone:</strong> open wegoquests.com in Safari,
                tap Share, then Add to Home Screen.
              </li>
              <li>
                <strong className="text-foreground">Android:</strong> open wegoquests.com in
                Chrome, tap the ⋮ menu, then Install app.
              </li>
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 border-t border-border pt-2">
            <TextButton
              onClick={() =>
                void signOut().catch(() => toast.error("Could not sign out. Try again."))
              }
            >
              Sign out
            </TextButton>
            <span className="text-sm text-muted-foreground">Demo tools</span>
            <TextButton
              onClick={() => {
                actions.loadDemo();
                setOpen(false);
              }}
            >
              Load demo
            </TextButton>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button type="button" className={textButtonClass}>
                  Reset app
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader className="text-left">
                  <AlertDialogTitle className="text-xl leading-tight">
                    Start wego over?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-pretty">
                    Your quests, XP, stamps, squad and settings on this device go back to a fresh
                    start. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:space-x-0">
                  <AlertCancel className={buttonClass({ variant: "outline", size: "sm" })}>
                    Keep everything
                  </AlertCancel>
                  <AlertAction
                    className={buttonClass({ variant: "ink", size: "sm" })}
                    onClick={() => {
                      actions.reset();
                      setOpen(false);
                    }}
                  >
                    Reset app
                  </AlertAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={invalid || saving}
            onClick={async () => {
              if (invalid || saving) return;
              setSaving(true);
              try {
                await syncMyProfile({
                  data: { name, handle: draft.handle, bio: draft.bio, avatarUrl: draft.avatarUrl },
                });
                actions.saveSettings({ ...draft, name });
                setOpen(false);
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Could not save your profile.",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- someone else's profile ---------- */

function PublicProfile({ person }: { person: DemoUser }) {
  const state = useUserState();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const taste = useMemo(() => buildTasteVector(state), [state]);
  const groupSize = NEARBY_STUDENTS.filter((user) => state.squadIds.includes(user.id)).length + 1;
  const match = compatibility(taste, person, { groupSize, radiusMi: 3 });
  // "In common" only means something once your own taste has some history behind it.
  const shared: Vibe[] = taste.hasHistory ? match.shared : [];
  const into = VIBES.map((vibe) => ({ vibe, weight: person.taste[vibe] }))
    .filter((item) => item.weight > 0)
    .sort(
      (a, b) =>
        Number(shared.includes(b.vibe)) - Number(shared.includes(a.vibe)) || b.weight - a.weight,
    )
    .slice(0, 4);
  const recentQuests = (person.recentQuestIds ?? [])
    .map((id) => ALL_QUESTS.find((quest) => quest.id === id))
    .filter((quest): quest is Quest => Boolean(quest));
  const level = levelName(person.level);
  // Already in your squad: that's a fact on the meta line, and the action is what you'd do together.
  const inSquad = state.squadIds.includes(person.id);

  return (
    <AppShell>
      <Link
        to="/squad"
        onClick={(event) => {
          if (!canGoBack) return;
          event.preventDefault();
          router.history.back();
        }}
        className={cn(textButtonClass, "-ml-1 mb-2 pr-2")}
      >
        <ChevronLeft aria-hidden className="h-4 w-4" />
        Back
      </Link>
      <PageHeader
        eyebrow={`demo profile · level ${person.level} · ${level.toLowerCase()}`}
        title={person.name}
        leading={<Avatar name={person.name} size={72} imageUrl={person.photo ?? null} />}
        action={
          inSquad ? (
            <Link
              to="/"
              className={cn(buttonClass({ variant: "outline", size: "sm" }), "max-sm:hidden")}
            >
              Plan a quest
            </Link>
          ) : (
            <InviteButton personId={person.id} name={person.name} className="max-sm:hidden" />
          )
        }
        meta={
          <div className="space-y-2">
            <MetaLine
              parts={[
                <span key="handle">@{person.handle}</span>,
                <span key="school">{person.university}</span>,
                person.verified ? <Verified key="verified" /> : null,
              ]}
            />
            {person.bio ? (
              <p className="max-w-prose text-[15px] leading-relaxed text-muted-foreground text-pretty">
                {person.bio}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">{match.score}%</span>{" "}
              vibe match
              {person.optInNearby ? (
                <span className="whitespace-nowrap"> · {person.distanceMi} mi away</span>
              ) : null}
              {inSquad ? (
                <span className="whitespace-nowrap">
                  {" · "}
                  <Check
                    aria-hidden
                    className="inline h-4 w-4 -translate-y-px align-middle text-ring"
                    strokeWidth={2.5}
                  />{" "}
                  In your squad
                </span>
              ) : null}
            </p>
            {inSquad ? (
              <Link
                to="/"
                className={cn(
                  buttonClass({ variant: "outline", size: "sm", full: true }),
                  "mt-3 sm:hidden",
                )}
              >
                Plan a quest
              </Link>
            ) : (
              <InviteButton
                personId={person.id}
                name={person.name}
                full
                className="mt-3 sm:hidden"
              />
            )}
          </div>
        }
      />

      <div className="public-grid">
        <div data-area="stats">
          {/* The header's rule already sits above it, so the ledger only needs its bottom line. */}
          <StatLedger
            className="border-t-0"
            items={[
              { key: "finished", label: "quests finished", value: person.completed },
              { key: "made", label: "quests made", value: person.created },
              { key: "streak", label: "weekly streak", value: person.weeklyStreak },
            ]}
          />
        </div>

        <section data-area="into" aria-labelledby="public-into">
          {/* Spelled out: in handwriting a "1" reads as an "I". */}
          <SectionHeading
            id="public-into"
            eyebrow={
              shared.length ? `${countWord(shared.length)} in common with you` : "their vibes"
            }
            title="Into lately"
          />
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2.5 text-[15px] lg:flex-col">
            {into.map(({ vibe }) => {
              const mine = shared.includes(vibe);
              const quiet = shared.length > 0 && !mine;
              return (
                <li
                  key={vibe}
                  className={cn(
                    "inline-flex min-h-8 items-center gap-2.5 whitespace-nowrap",
                    quiet ? "text-muted-foreground" : "font-medium text-foreground",
                  )}
                >
                  {/* Big enough for the drawing to read; the ones you don't share are pencilled. */}
                  <Doodle name={VIBE_DOODLE[vibe]} size={24} faint={quiet} />
                  {VIBE_LABEL[vibe]}
                  {mine ? (
                    <>
                      <span
                        aria-hidden
                        className="font-hand text-[15px] font-normal leading-tight text-muted-foreground"
                      >
                        you too
                      </span>
                      <span className="sr-only">(you too)</span>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        {recentQuests.length ? (
          <section data-area="trail" aria-labelledby="public-quest-trail">
            <SectionHeading
              id="public-quest-trail"
              eyebrow="places they've been"
              title="Quest trail"
              action={placeCount(recentQuests.length)}
            />
            <PlaceList quests={recentQuests} alsoYours={state.completed} />
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function RemoteProfile({ handle }: { handle: string }) {
  const state = useUserState();
  const stats = state.directory.find(p => p.handle === handle);
  const findByHandle = useServerFn(findProfileByHandle);
  const [profile, setProfile] = useState<RemotePublicProfile | null | "loading">("loading");

  useEffect(() => {
    let active = true;
    findByHandle({ data: { handle } })
      .then((row) => {
        if (active) setProfile(row);
      })
      .catch(() => {
        if (active) setProfile(null);
      });
    return () => {
      active = false;
    };
  }, [handle, findByHandle]);

  if (profile === "loading") {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl py-16 text-center text-sm text-muted-foreground">
          Looking up @{handle}…
        </div>
      </AppShell>
    );
  }
  if (!profile) throw notFound();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <BackButton
          fallback="/leaderboard"
          label="Back"
          className="mb-4 underline underline-offset-4"
        />
        <PageHeader
          eyebrow="wego profile"
          title={profile.name}
          leading={<Avatar name={profile.name} size={68} imageUrl={profile.avatar_url} />}
          action={<RemoteInviteButton handle={profile.handle} name={profile.name} />}
        />
        <div className="-mt-3 mb-6">
          <p className="text-sm text-muted-foreground">@{profile.handle}</p>
          {profile.bio ? (
            <p className="mt-2 max-w-xl text-muted-foreground">{profile.bio}</p>
          ) : null}
        </div>
        {stats ? <StatLedger items={[
          { label: "XP", value: stats.xp }, { label: "quests finished", value: stats.completed },
          { label: "quests made", value: stats.created }, { label: "weekly streak", value: stats.weekly_streak },
        ]} /> : <p className="font-hand text-lg text-muted-foreground">fresh face on wego.</p>}
      </div>
    </AppShell>
  );
}

/** Invite a real wego account (found by handle) to one of your squads. */
function RemoteInviteButton({ handle, name }: { handle: string; name: string }) {
  const state = useUserState();
  const sendByHandle = useServerFn(sendSquadInviteByHandle);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ledSquads = state.squads.filter((squad) => squad.leaderId === "me");

  const invite = async (squad: (typeof ledSquads)[number]) => {
    setBusy(squad.id);
    try {
      const result = await sendByHandle({
        data: {
          squadKey: squad.id,
          squadName: squad.name,
          inviterName:
            state.name !== "You" ? state.name : state.handle ? `@${state.handle}` : "A friend",
          handle,
        },
      });
      toast(
        result.already
          ? `${name} already has a pending invite to ${squad.name}.`
          : `Invite to ${squad.name} sent to ${name}.`,
      );
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send that invite.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(buttonClass({ variant: "outline", size: "sm" }), "min-w-32")}
          aria-label={`Invite ${name} to a squad`}
        >
          <span className="inline-flex items-center gap-1.5">
            <UserPlus aria-hidden className="h-4 w-4" />
            Invite
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite {name}</DialogTitle>
          <DialogDescription>Pick which squad to invite them to.</DialogDescription>
        </DialogHeader>
        {ledSquads.length ? (
          <ul className="mt-2 space-y-2">
            {ledSquads.map((squad) => (
              <li key={squad.id}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void invite(squad)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-surface active:scale-[0.99] disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{squad.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {squad.memberIds.length}{" "}
                      {squad.memberIds.length === 1 ? "member" : "members"}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-ring">
                    {busy === squad.id ? "Sending…" : "Invite"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            You don't lead a squad yet.{" "}
            <Link to="/squad" className={textButtonClass} onClick={() => setOpen(false)}>
              Make one on the Squad page
            </Link>
            .
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
