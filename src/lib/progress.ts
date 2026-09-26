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
  { kind: "rank", label: "Rank two quests you've done", xp: XP.rank },
  { kind: "save", label: "Save one for later", xp: XP.save },
];

export function weekXp(state: UserState, now = Date.now()) {
  return state.log.filter((e) => now - e.at < WEEK).reduce((sum, e) => sum + e.xp, 0);
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

export function levelName(level: number) {
  return LEVELS.find((l) => l.level === level)?.name ?? LEVELS[0]!.name;
}

/** Weekly squad goal: quests done together in the last seven days. */
export const SQUAD_GOAL = 3;
export function squadWeek(state: UserState, now = Date.now()) {
  const together = state.log.filter((e) => e.kind === "squad" && now - e.at < WEEK).length;
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
    { id: "crew", name: "Full crew", note: "Have three in your squad", earned: state.squadIds.length >= 3 },
    { id: "streak", name: "Seven straight", note: "A seven-day streak", earned: state.streak >= 7 },
    { id: "critic", name: "Taste maker", note: "Rank five pairs", earned: state.rankings.length >= 5 },
  ];
}

export { levelFor };
