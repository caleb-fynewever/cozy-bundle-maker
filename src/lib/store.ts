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
};

const KEY = "sidequest.state.v1";

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
  create: 90,
  rank: 20,
  save: 10,
  squad: 40,
  verify: 60,
};

export const actions = {
  toggleSave(id: string) {
    setState((s) =>
      s.saved.includes(id)
        ? { ...s, saved: s.saved.filter((x) => x !== id) }
        : { ...s, saved: [...s.saved, id], xp: s.xp + XP.save },
    );
  },
  pass(id: string) {
    setState((s) => ({
      ...s,
      passed: s.passed.includes(id) ? s.passed : [...s.passed, id],
    }));
  },
  complete(id: string) {
    setState((s) =>
      s.completed.includes(id)
        ? s
        : {
            ...s,
            completed: [...s.completed, id],
            passed: s.passed.filter((x) => x !== id),
            xp: s.xp + XP.complete,
            streak: s.streak + 1,
          },
    );
  },
  rank(winner: string, loser: string) {
    setState((s) => ({
      ...s,
      rankings: [...s.rankings, { winner, loser }],
      xp: s.xp + XP.rank,
    }));
  },
  toggleSquadMember(id: string) {
    setState((s) =>
      s.squadIds.includes(id)
        ? { ...s, squadIds: s.squadIds.filter((x) => x !== id) }
        : { ...s, squadIds: [...s.squadIds, id], xp: s.xp + XP.squad },
    );
  },
  verify(email: string) {
    setState((s) => ({ ...s, eduEmail: email, verified: true, xp: s.xp + XP.verify }));
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
      xp: s.xp + XP.create,
    }));
  },
  reset() {
    setState(() => initialState);
  },
  loadDemo() {
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
    }));
  },
};
