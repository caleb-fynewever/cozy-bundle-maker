import { useSyncExternalStore } from "react";
import type { Quest, Vibe } from "@/lib/types";

export type UserState = {
  name: string;
  handle: string;
  bio: string;
  eduEmail: string | null;
  verified: boolean;
  optInNearby: boolean;
  shareLocation: boolean;
  publicProfile: boolean;
  saved: string[];
  completed: string[];
  passed: string[];
  rankings: { winner: string; loser: string }[];
  squadIds: string[];
  xp: number;
  streak: number;
  createdQuests: Quest[];
  favoriteVibes: Vibe[];
  /** Every XP gain, newest first. Drives weekly boards and the profile history. */
  log: XpEvent[];
  /** Local day (YYYY-MM-DD) of the last completed quest, for streaks. */
  lastQuestDay: string | null;
};

export type XpKind = "complete" | "squad" | "create" | "rank" | "save" | "join" | "verify";
export type XpEvent = { kind: XpKind; xp: number; at: number; label: string };

const KEY = "wego.state.v1";

const initialState: UserState = {
  name: "You",
  handle: "sidequester",
  bio: "New around here. Looking for something to do.",
  eduEmail: null,
  verified: false,
  optInNearby: false,
  shareLocation: false,
  publicProfile: true,
  saved: [],
  completed: [],
  passed: [],
  rankings: [],
  squadIds: [],
  xp: 0,
  streak: 0,
  createdQuests: [],
  favoriteVibes: [],
  log: [],
  lastQuestDay: null,
};

let state: UserState = initialState;
let hydrated = false;
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — in-memory only */
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...initialState, ...(JSON.parse(raw) as UserState) };
  } catch {
    /* ignore corrupt state */
  }
  emit();
}

export function setState(update: (current: UserState) => UserState) {
  state = update(state);
  persist();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const getServerSnapshot = () => initialState;

export function useUserState() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const XP = {
  complete: 120,
  /** Extra for doing a quest with at least one squadmate. */
  squadBonus: 60,
  create: 90,
  rank: 20,
  save: 10,
  squad: 40,
  verify: 60,
};

function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function nextStreak(s: UserState) {
  const today = dayKey();
  if (s.lastQuestDay === today) return Math.max(1, s.streak);
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  return s.lastQuestDay === yesterday ? s.streak + 1 : 1;
}

function gain(s: UserState, kind: XpKind, xp: number, label: string): Pick<UserState, "xp" | "log"> {
  return { xp: s.xp + xp, log: [{ kind, xp, at: Date.now(), label }, ...s.log].slice(0, 80) };
}

export const actions = {
  toggleSave(id: string) {
    setState((s) =>
      s.saved.includes(id)
        ? { ...s, saved: s.saved.filter((x) => x !== id) }
        : { ...s, saved: [...s.saved, id], ...gain(s, "save", XP.save, "Saved a quest") },
    );
  },
  pass(id: string) {
    setState((s) => ({
      ...s,
      passed: s.passed.includes(id) ? s.passed : [...s.passed, id],
    }));
  },
  undoChoice(id: string, choice: "pass" | "save") {
    setState((s) => {
      if (choice === "pass") return { ...s, passed: s.passed.filter((x) => x !== id) };
      const i = s.log.findIndex((e) => e.kind === "save");
      return {
        ...s,
        saved: s.saved.filter((x) => x !== id),
        xp: Math.max(0, s.xp - XP.save),
        log: i < 0 ? s.log : [...s.log.slice(0, i), ...s.log.slice(i + 1)],
      };
    });
  },
  /** Returns the XP earned so the caller can say it out loud. */
  complete(id: string, title = "a quest"): number {
    let earned = 0;
    setState((s) => {
      if (s.completed.includes(id)) return s;
      const withSquad = s.squadIds.length > 0;
      earned = XP.complete + (withSquad ? XP.squadBonus : 0);
      const base = gain(s, "complete", XP.complete, `Did ${title}`);
      const next = { ...s, ...base };
      const bonus = withSquad ? gain(next, "squad", XP.squadBonus, "Went with the squad") : base;
      return {
        ...next,
        ...bonus,
        completed: [...s.completed, id],
        passed: s.passed.filter((x) => x !== id),
        streak: nextStreak(s),
        lastQuestDay: dayKey(),
      };
    });
    return earned;
  },
  rank(winner: string, loser: string) {
    setState((s) => ({
      ...s,
      rankings: [...s.rankings, { winner, loser }],
      ...gain(s, "rank", XP.rank, "Ranked two quests"),
    }));
  },
  toggleSquadMember(id: string, name = "someone") {
    setState((s) =>
      s.squadIds.includes(id)
        ? { ...s, squadIds: s.squadIds.filter((x) => x !== id) }
        : { ...s, squadIds: [...s.squadIds, id], ...gain(s, "join", XP.squad, `${name} joined your squad`) },
    );
  },
  verify(email: string) {
    setState((s) => ({ ...s, eduEmail: email, verified: true, ...gain(s, "verify", XP.verify, "Verified your student email") }));
  },
  setPrivacy(patch: Partial<Pick<UserState, "optInNearby" | "shareLocation" | "publicProfile">>) {
    setState((s) => ({ ...s, ...patch }));
  },
  updateProfile(patch: Partial<Pick<UserState, "name" | "handle" | "bio">>) {
    setState((s) => ({ ...s, ...patch }));
  },
  addQuest(quest: Quest) {
    setState((s) => ({
      ...s,
      createdQuests: [quest, ...s.createdQuests],
      ...gain(s, "create", XP.create, `Made “${quest.title}”`),
    }));
  },
  reset() {
    setState(() => initialState);
  },
  loadDemo() {
    const now = Date.now();
    const h = 3_600_000;
    setState((s) => ({
      ...s,
      name: "Caleb",
      handle: "calebf",
      bio: "CS junior. Chronic over-planner of spontaneous nights.",
      eduEmail: "caleb@umn.edu",
      verified: true,
      optInNearby: true,
      shareLocation: true,
      completed: ["q_snack_crawl", "q_midnight_photo_hunt", "q_stone_arch_freeze"],
      saved: ["q_spoon_cherry_standoff", "q_late_diner_menu_dare"],
      passed: ["q_farmers_market_dare"],
      rankings: [
        { winner: "q_midnight_photo_hunt", loser: "q_minnehaha_descent" },
        { winner: "q_snack_crawl", loser: "q_greenway_night_ride" },
        { winner: "q_spoon_cherry_standoff", loser: "q_isles_loop_confession" },
      ],
      squadIds: ["u_alex", "u_jordan"],
      xp: 1680,
      streak: 6,
      lastQuestDay: dayKey(new Date(now - 20 * h)),
      log: [
        { kind: "squad", xp: XP.squadBonus, at: now - 20 * h, label: "Went with the squad" },
        { kind: "complete", xp: XP.complete, at: now - 20 * h, label: "Did Stone Arch freeze frame" },
        { kind: "rank", xp: XP.rank, at: now - 30 * h, label: "Ranked two quests" },
        { kind: "squad", xp: XP.squadBonus, at: now - 52 * h, label: "Went with the squad" },
        { kind: "complete", xp: XP.complete, at: now - 52 * h, label: "Did the midnight photo hunt" },
        { kind: "join", xp: XP.squad, at: now - 70 * h, label: "Jordan joined your squad" },
        { kind: "save", xp: XP.save, at: now - 90 * h, label: "Saved a quest" },
        { kind: "complete", xp: XP.complete, at: now - 10 * 24 * h, label: "Did the snack crawl" },
      ],
    }));
  },
};
