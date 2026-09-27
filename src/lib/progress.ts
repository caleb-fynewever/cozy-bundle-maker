import { LEVELS, levelFor, NEARBY_STUDENTS } from "@/data/people";
import type { UserState, XpKind } from "@/lib/store";
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
  u_alex: 540,
  u_jordan: 310,
  u_maya: 420,
  u_sam: 150,
  u_priya: 260,
  u_deven: 90,
};

/** Plausible lifetime totals for the local demo students, aligned to their levels. */
export const DEMO_TOTAL_XP: Record<string, number> = {
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
  let week = monday(new Date(now));
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

export type Badge = { id: string; name: string; note: string; earned: boolean };

export function badges(state: UserState): Badge[] {
  return [
    { id: "first", name: "First step", note: "Finish one quest", earned: state.completed.length >= 1 },
    { id: "regular", name: "Regular", note: "Finish five quests", earned: state.completed.length >= 5 },
    { id: "maker", name: "Quest maker", note: "Make a quest", earned: state.createdQuests.length >= 1 },
    { id: "crew", name: "Full squad", note: "Have three in your squad", earned: state.squadIds.length >= 3 },
    { id: "streak", name: "Four-week run", note: "Finish a quest every week for four weeks", earned: weeklyStreak(state) >= 4 },
  ];
}

export { levelFor };
