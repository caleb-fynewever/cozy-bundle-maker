import { CAMPUS_BOARD_IDS, NEARBY_STUDENTS, levelFor } from "@/data/people";
import { weeklyStreak, DEMO_TOTAL_XP, DEMO_WEEK_XP, levelName, weekXp } from "@/lib/progress";
import type { UserState } from "@/lib/store";

export type BoardKey = "week" | "xp" | "completed" | "created" | "streak";
export type Scope = "friends" | "everyone";

export const SCOPES: Scope[] = ["friends", "everyone"];

type Board = {
  key: BoardKey;
  title: string;
  /** The whole value as a phrase ("540 XP", "3-week streak"). */
  unit: (n: number) => string;
  /** Just the word that follows the number in a row ("XP", "quests"), so the number can stand alone. */
  suffix: (n: number) => string;
  /** How far you are from someone, as a phrase ("140 XP", "2 more quests"). */
  gap: (n: number) => string;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const BOARDS: Board[] = [
  { key: "week", title: "This week", unit: (n) => `${n} XP`, suffix: () => "XP", gap: (n) => `${n} XP` },
  { key: "xp", title: "All-time XP", unit: (n) => `${n} XP`, suffix: () => "XP", gap: (n) => `${n} XP` },
  {
    key: "completed",
    title: "Most quests",
    unit: (n) => `${n} ${plural(n, "quest", "quests")}`,
    suffix: (n) => plural(n, "quest", "quests"),
    gap: (n) => `${n} more ${plural(n, "quest", "quests")}`,
  },
  {
    key: "created",
    title: "Top creators",
    unit: (n) => `${n} made`,
    suffix: () => "made",
    gap: (n) => `${n} more ${plural(n, "quest", "quests")} made`,
  },
  {
    key: "streak",
    title: "Weekly streaks",
    unit: (n) => `${n}-week streak`,
    suffix: (n) => plural(n, "week", "weeks"),
    gap: (n) => `${n} more ${plural(n, "week", "weeks")}`,
  },
];

export type Entry = { id: string; name: string; handle: string; you: boolean; value: number; inSquad: boolean; level: string; photo: string | null };

/** Ranks you against your squad, or Around campus (the curated campus board). Ties keep you above. */
export function rankBoard(state: UserState, key: BoardKey, scope: Scope): Entry[] {
  const mine = {
    week: weekXp(state),
    xp: state.xp,
    completed: state.completed.length,
    created: state.createdQuests.length,
    streak: weeklyStreak(state),
  }[key];
  // Around campus is the curated campus board only; your squad board is whoever is in your squad.
  const others = (state.catalogLoaded ? state.remotePeople : NEARBY_STUDENTS).filter((u) => (scope === "everyone" ? CAMPUS_BOARD_IDS.includes(u.id) : state.squadIds.includes(u.id))).map((u) => ({
    id: u.id,
    name: u.name,
    handle: u.handle,
    you: false,
    value: key === "week" ? (DEMO_WEEK_XP[u.id] ?? 0) : key === "xp" ? (DEMO_TOTAL_XP[u.id] ?? 0) : key === "streak" ? u.weeklyStreak : key === "completed" ? u.completed : u.created,
    inSquad: state.squadIds.includes(u.id),
    level: levelName(u.level),
    photo: u.photo ?? null,
  }));
  const you = { id: "you", name: state.name, handle: state.handle, you: true, value: mine, inSquad: false, level: levelFor(state.xp).name, photo: state.avatarUrl };
  const real = state.directory.filter(p => p.handle !== state.handle && (scope === "everyone" || state.squadIds.includes(`f_${p.id}`))).map(p => ({
    id: `f_${p.id}`, name: p.name, handle: p.handle, you: false,
    value: key === "week" ? p.week_xp : key === "xp" ? p.xp : key === "completed" ? p.completed : key === "created" ? p.created : p.weekly_streak,
    inSquad: state.squadIds.includes(`f_${p.id}`), level: levelFor(p.xp).name, photo: p.avatar_url,
  }));
  return [you, ...others, ...real].sort((a, b) => b.value - a.value || Number(b.you) - Number(a.you));
}

/** The key a board is remembered under (store.ranksSeen). */
export function boardKeyOf(key: BoardKey, scope: Scope) {
  return `${key}:${scope}`;
}

/** Your 1-based rank on a ranked board. */
export function rankOf(entries: Entry[]) {
  return entries.findIndex((e) => e.you) + 1;
}

/** The people you moved past since you were last seen at `oldRank`: they now sit just below you. */
export function passedSince(entries: Entry[], oldRank: number): Entry[] {
  const now = entries.findIndex((e) => e.you);
  if (now < 0 || oldRank - 1 <= now) return [];
  return entries.slice(now + 1, Math.min(entries.length, oldRank));
}

/** "passed Alex", "passed Alex and Maya", "passed 3 people". */
export function passedLine(passed: Entry[]): string | null {
  if (passed.length === 0) return null;
  if (passed.length === 1) return `passed ${passed[0]!.name}`;
  if (passed.length === 2) return `passed ${passed[0]!.name} and ${passed[1]!.name}`;
  return `passed ${passed.length} people`;
}

/**
 * The gap to the next person up, as a short note. Ties keep you above, so closing the gap exactly
 * is enough to pass them.
 */
export function nextUp(entries: Entry[], board: Pick<Board, "gap">): string | null {
  const i = entries.findIndex((e) => e.you);
  if (i < 0) return null;
  if (i === 0) return entries.length > 1 ? "you're on top. for now." : null;
  const ahead = entries[i - 1]!;
  const gap = Math.max(1, ahead.value - entries[i]!.value);
  return `${board.gap(gap)} to pass ${ahead.name}`;
}
