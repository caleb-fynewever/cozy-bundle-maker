import { NEARBY_STUDENTS, levelFor } from "@/data/people";
import { weeklyStreak, DEMO_TOTAL_XP, DEMO_WEEK_XP, levelName, weekXp } from "@/lib/progress";
import type { UserState } from "@/lib/store";

export type BoardKey = "week" | "xp" | "completed" | "created" | "streak";

export const BOARDS: { key: BoardKey; title: string; unit: (n: number) => string }[] = [
  { key: "week", title: "This week", unit: (n) => `${n} XP` },
  { key: "xp", title: "All-time XP", unit: (n) => `${n} XP` },
  { key: "completed", title: "Most quests", unit: (n) => `${n} ${n === 1 ? "quest" : "quests"}` },
  { key: "created", title: "Top creators", unit: (n) => `${n} made` },
  { key: "streak", title: "Weekly streaks", unit: (n) => `${n}-week streak` },
];

export type Entry = { id: string; name: string; handle: string; you: boolean; value: number; inSquad: boolean; level: string };

/** Ranks you against your squad or everyone nearby. Ties keep you above. */
export function rankBoard(state: UserState, key: BoardKey, scope: "friends" | "everyone"): Entry[] {
  const mine = {
    week: weekXp(state),
    xp: state.xp,
    completed: state.completed.length,
    created: state.createdQuests.length,
    streak: weeklyStreak(state),
  }[key];
  const others = NEARBY_STUDENTS.filter((u) => scope === "everyone" || state.squadIds.includes(u.id)).map((u) => ({
    id: u.id,
    name: u.name,
    handle: u.handle,
    you: false,
    value: key === "week" ? (DEMO_WEEK_XP[u.id] ?? 0) : key === "xp" ? (DEMO_TOTAL_XP[u.id] ?? 0) : key === "streak" ? u.weeklyStreak : key === "completed" ? u.completed : u.created,
    inSquad: state.squadIds.includes(u.id),
    level: levelName(u.level),
  }));
  const you = { id: "you", name: state.name, handle: state.handle, you: true, value: mine, inSquad: false, level: levelFor(state.xp).name };
  return [you, ...others].sort((a, b) => b.value - a.value || Number(b.you) - Number(a.you));
}

/** Human sentence about the gap to the next person up. */
export function nextUp(entries: Entry[], unit: (n: number) => string): string | null {
  const i = entries.findIndex((e) => e.you);
  if (i < 0) return null;
  if (i === 0) return entries.length > 1 ? "You're on top. For now." : null;
  const ahead = entries[i - 1]!;
  const gap = ahead.value - entries[i]!.value;
  return `${unit(gap + 1)} to pass ${ahead.name}.`;
}
