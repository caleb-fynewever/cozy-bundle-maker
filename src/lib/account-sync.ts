import type { AccountPayload } from "./backend-schema";
import type { UserState } from "./store";
export const ACCOUNT_FIELDS = [
  "hiddenDemoSquadIds",
  "hearted",
  "comments",
  "saved",
  "completed",
  "passed",
  "inProgress",
  "scheduledQuests",
  "favoriteVibes",
  "publicProfile",
  "optInNearby",
  "xp",
  "xpClaims",
  "streak",
  "log",
  "lastQuestDay",
] as const;
export function accountPayload(state: UserState): AccountPayload {
  return Object.fromEntries(ACCOUNT_FIELDS.map((key) => [key, state[key]])) as AccountPayload;
}
/** Preserve independent membership changes; scalar conflicts prefer this device's deliberate edit. */
export function mergeAccount(
  base: AccountPayload,
  local: AccountPayload,
  remote: AccountPayload,
): AccountPayload {
  const result = { ...remote };
  for (const key of ACCOUNT_FIELDS) {
    if (JSON.stringify(local[key]) === JSON.stringify(base[key])) continue;
    if (key === "comments") {
      result.comments = { ...remote.comments };
      for (const [postId, comments] of Object.entries(local.comments)) {
        result.comments[postId] = [
          ...new Map(
            [...(remote.comments[postId] ?? []), ...comments].map((c) => [c.id, c]),
          ).values(),
        ];
      }
      continue;
    }
    const b = base[key],
      l = local[key],
      r = remote[key];
    if (Array.isArray(b) && Array.isArray(l) && Array.isArray(r)) {
      const identity = (value: unknown) => {
        if (key === "scheduledQuests") return (value as { questId: string }).questId;
        if (key === "log") {
          const event = value as { kind: string; refId?: string; at: number };
          return event.refId ? `${event.kind}:${event.refId}` : JSON.stringify(value);
        }
        return typeof value === "object" ? JSON.stringify(value) : String(value);
      };
      const before = new Set(b.map(identity));
      const current = new Set(l.map(identity));
      const removed = new Set([...before].filter((v) => !current.has(v)));
      const merged = [...r.filter((v) => !removed.has(identity(v)))];
      const seen = new Set(merged.map(identity));
      for (const value of l) {
        const id = identity(value);
        const previous = b.find((v) => identity(v) === id);
        if (JSON.stringify(previous) === JSON.stringify(value)) continue;
        const index = merged.findIndex((v) => identity(v) === id);
        if (index >= 0) merged[index] = value;
        else {
          merged.push(value);
          seen.add(id);
        }
      }
      Object.assign(result, { [key]: merged });
    } else Object.assign(result, { [key]: l });
  }
  // XP mirrors the merged event history, including completions on another device.
  const unlogged = Math.max(0, remote.xp - remote.log.reduce((sum, event) => sum + event.xp, 0));
  result.xp = unlogged + result.log.reduce((sum, event) => sum + event.xp, 0);
  return result;
}

export const EMPTY_ACCOUNT: AccountPayload = {
  hiddenDemoSquadIds: [],
  hearted: [],
  comments: {},
  saved: [],
  completed: [],
  passed: [],
  inProgress: [],
  scheduledQuests: [],
  favoriteVibes: [],
  publicProfile: true,
  optInNearby: false,
  xp: 0,
  xpClaims: [],
  streak: 0,
  log: [],
  lastQuestDay: null,
};
