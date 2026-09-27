import { LEVELS, levelFor, NEARBY_STUDENTS } from "@/data/people";
import type { UserState, XpEvent, XpKind } from "@/lib/store";
import { XP } from "@/lib/store";

const WEEK = 7 * 86_400_000;

/** How XP is earned, in the order people actually meet it. */
export const XP_RULES: { kind: XpKind; label: string; xp: number }[] = [
  { kind: "complete", label: "Finish a quest", xp: XP.complete },
  { kind: "squad", label: "…with someone from your squad", xp: XP.squadBonus },
  { kind: "create", label: "Make a quest others can do", xp: XP.create },
  { kind: "join", label: "Add someone to your squad", xp: XP.squad },
  { kind: "verify", label: "Verify your student email", xp: XP.verify },
];

export function weekXp(state: UserState, now = Date.now()) {
  return state.log.filter((e) => now - e.at >= 0 && now - e.at < WEEK).reduce((sum, e) => sum + e.xp, 0);
}

/** Demo students' XP over the last seven days. */
export const DEMO_WEEK_XP: Record<string, number> = {
  u_reeha: 280,
  u_caleb: 360,
  u_jacob: 210,
  u_zuan: 240,
  u_evan: 260,
  u_sydney: 390,
  u_nico: 340,
  u_archit: 560,
  u_owen: 470,
  u_tessa: 350,
  u_mira: 225,
  u_alex: 540,
  u_jordan: 310,
  u_maya: 420,
  u_sam: 150,
  u_priya: 260,
  u_deven: 90,
};

/** Plausible lifetime totals for the local demo students, aligned to their levels. */
export const DEMO_TOTAL_XP: Record<string, number> = {
  u_reeha: 1180,
  u_caleb: 1920,
  u_jacob: 960,
  u_zuan: 620,
  u_evan: 700,
  u_sydney: 2240,
  u_nico: 2010,
  u_archit: 2600,
  u_owen: 1760,
  u_tessa: 2090,
  u_mira: 700,
  u_alex: 1710,
  u_jordan: 3160,
  u_maya: 810,
  u_sam: 1990,
  u_priya: 750,
  u_deven: 3600,
};

function dateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function currentStreak(state: UserState, now = Date.now()) {
  if (!state.lastQuestDay) return 0;
  const today = dateKey(new Date(now));
  const yesterday = dateKey(new Date(now - 86_400_000));
  return state.lastQuestDay === today || state.lastQuestDay === yesterday ? state.streak : 0;
}

/** Consecutive calendar weeks with at least one completed quest. */
export function weeklyStreak(state: UserState, now = Date.now()) {
  const monday = (date: Date) => {
    const day = date.getDay();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - ((day + 6) % 7));
    return date;
  };
  const key = (date: Date) => dateKey(date);
  const activeWeeks = new Set(state.log.filter((event) => event.kind === "complete").map((event) => key(monday(new Date(event.at)))));
  const week = monday(new Date(now));
  if (!activeWeeks.has(key(week))) week.setDate(week.getDate() - 7);
  let count = 0;
  while (activeWeeks.has(key(week))) { count += 1; week.setDate(week.getDate() - 7); }
  return count;
}

export function levelName(level: number) {
  return LEVELS.find((l) => l.level === level)?.name ?? LEVELS[0]!.name;
}

/** Weekly squad goal: quests done together in the last seven days. */
export const SQUAD_GOAL = 3;
export function squadWeek(state: UserState, now = Date.now()) {
  const together = state.log.filter((e) => e.kind === "squad" && now - e.at >= 0 && now - e.at < WEEK).length;
  const members = NEARBY_STUDENTS.filter((u) => state.squadIds.includes(u.id));
  const total = weekXp(state, now) + members.reduce((sum, u) => sum + (DEMO_WEEK_XP[u.id] ?? 0), 0);
  return { together, goal: SQUAD_GOAL, done: together >= SQUAD_GOAL, totalXp: total, members };
}

export type Badge = {
  id: string;
  name: string;
  note: string;
  earned: boolean;
  /** The short text pressed into the stamp itself. */
  mark: string;
  /** Progress toward it: `have` of `need` (never more than `need`). */
  have: number;
  need: number;
  /** What is still missing, as a phrase that follows the name ("2 more quests"). */
  left: string;
  /** When it was earned, when the XP log still has the whole story. */
  earnedAt?: number;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function badges(state: UserState, now = Date.now()): Badge[] {
  // The log is newest first and capped, so only trust it for a date when it holds every event of a kind.
  const oldestFirst = [...state.log].reverse();
  const completes = oldestFirst.filter((e) => e.kind === "complete");
  const creates = oldestFirst.filter((e) => e.kind === "create");
  const completedAt = (n: number) => (completes.length >= state.completed.length ? completes[n - 1]?.at : undefined);
  const createdAt = (n: number) => (creates.length >= state.createdQuests.length ? creates[n - 1]?.at : undefined);
  const run = weeklyStreak(state, now);

  const badge = (b: Omit<Badge, "earned" | "earnedAt"> & { at?: number | undefined }): Badge => {
    const { at, ...rest } = b;
    const earned = b.have >= b.need;
    return { ...rest, have: Math.min(b.have, b.need), earned, ...(earned && at !== undefined ? { earnedAt: at } : {}) };
  };

  return [
    badge({ id: "first", name: "First step", mark: "first step", note: "Finish one quest", have: state.completed.length, need: 1, left: "finish one quest", at: completedAt(1) }),
    badge({ id: "regular", name: "Regular", mark: "regular", note: "Finish five quests", have: state.completed.length, need: 5, left: plural(5 - Math.min(5, state.completed.length), "more quest", "more quests"), at: completedAt(5) }),
    badge({ id: "maker", name: "Quest maker", mark: "quest maker", note: "Make a quest", have: state.createdQuests.length, need: 1, left: "make a quest", at: createdAt(1) }),
    badge({ id: "crew", name: "Full squad", mark: "full squad", note: "Have three in your squad", have: state.squadIds.length, need: 3, left: `${3 - Math.min(3, state.squadIds.length)} more in your squad` }),
    badge({ id: "streak", name: "Four-week run", mark: "4-week run", note: "Finish a quest every week for four weeks", have: run, need: 4, left: `${plural(4 - Math.min(4, run), "more week", "more weeks")} in a row` }),
  ];
}

/** One stop on the XP trail. A squad bonus folds into the quest it came with. */
export type TrailEntry = { key: string; kind: XpKind; label: string; xp: number; bonus: number; at: number; refId?: string };

/** The XP log as a trail: newest first, each quest done with the squad on one line with its bonus. */
export function xpTrail(log: XpEvent[]): TrailEntry[] {
  const pair = (a: XpEvent, b: XpEvent) =>
    ((a.kind === "squad" && b.kind === "complete") || (a.kind === "complete" && b.kind === "squad")) &&
    (a.refId && b.refId ? a.refId === b.refId : Math.abs(a.at - b.at) < 60_000);
  const trail: TrailEntry[] = [];
  for (let i = 0; i < log.length; i++) {
    const event = log[i]!;
    const next = log[i + 1];
    if (next && pair(event, next)) {
      const quest = event.kind === "complete" ? event : next;
      const bonus = event.kind === "complete" ? next : event;
      trail.push({ key: `${quest.at}-${i}`, kind: "complete", label: quest.label, xp: quest.xp + bonus.xp, bonus: bonus.xp, at: quest.at, ...(quest.refId ? { refId: quest.refId } : {}) });
      i++;
      continue;
    }
    trail.push({ key: `${event.at}-${i}`, kind: event.kind, label: event.label, xp: event.xp, bonus: 0, at: event.at, ...(event.refId ? { refId: event.refId } : {}) });
  }
  return trail;
}

/**
 * When you reached each level, read off the XP log: cumulative XP, oldest first. The log is capped,
 * so whatever XP it no longer holds counts as already banked before its oldest entry; a level crossed
 * back then (and Wanderer, where everyone starts) gets no date. If the log adds up to more than your
 * XP it can't be trusted, so nothing is dated. Level number → when it was reached.
 */
export function levelsReachedAt(xp: number, log: XpEvent[]): Map<number, number> {
  const reached = new Map<number, number>();
  let total = xp - log.reduce((sum, event) => sum + event.xp, 0);
  if (total < 0) return reached;
  for (let i = log.length - 1; i >= 0; i--) {
    const event = log[i]!;
    const before = total;
    total += event.xp;
    for (const level of LEVELS) {
      if (level.xp > before && level.xp <= total && !reached.has(level.level)) reached.set(level.level, event.at);
    }
  }
  return reached;
}

export { levelFor };
