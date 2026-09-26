import { NEARBY_STUDENTS } from "@/data/people";
import type { UserState } from "@/lib/store";

export type BoardKey = "completed" | "created" | "streak";

export const BOARDS: { key: BoardKey; title: string; unit: (n: number) => string }[] = [
  { key: "completed", title: "Most quests", unit: (n) => `${n} ${n === 1 ? "quest" : "quests"}` },
  { key: "created", title: "Top creators", unit: (n) => `${n} made` },
  { key: "streak", title: "Longest streaks", unit: (n) => `${n}-day streak` },
];

export type Entry = { id: string; name: string; you: boolean; value: number; inSquad: boolean };

/** Ranks you against friends (squad + nearby students). Ties keep you above. */
export function rankBoard(state: UserState, key: BoardKey, scope: "friends" | "everyone"): Entry[] {
  const mine = {
    completed: state.completed.length,
    created: state.createdQuests.length,
    streak: state.streak,
  }[key];
  const others = NEARBY_STUDENTS.filter((u) => scope === "everyone" || state.squadIds.includes(u.id)).map(
    (u) => ({ id: u.id, name: u.name, you: false, value: u[key], inSquad: state.squadIds.includes(u.id) }),
  );
  return [{ id: "you", name: state.name, you: true, value: mine, inSquad: false }, ...others].sort(
    (a, b) => b.value - a.value || Number(b.you) - Number(a.you),
  );
}

/** Human sentence about the gap to the next person up. */
export function nextUp(entries: Entry[], unit: (n: number) => string): string | null {
  const i = entries.findIndex((e) => e.you);
  if (i < 0) return null;
  if (i === 0) return entries.length > 1 ? "You're on top. For now." : null;
  const ahead = entries[i - 1]!;
  const gap = ahead.value - entries[i]!.value;
  return `${unit(gap)} behind ${ahead.name}.`;
}
