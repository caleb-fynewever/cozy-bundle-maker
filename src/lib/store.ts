import { useSyncExternalStore } from "react";
import type { Quest, Vibe } from "@/lib/types";
import type { FeedComment, FeedPost } from "@/data/feed";

export type UserState = {
  /** False until the account finishes first-time setup. */
  configured: boolean;
  name: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
  eduEmail: string | null;
  verified: boolean;
  optInNearby: boolean;
  shareLocation: boolean;
  approximateLocation: ApproximateLocation | null;
  publicProfile: boolean;
  saved: string[];
  scheduledQuests: ScheduledQuest[];
  inProgress: string[];
  completed: string[];
  passed: string[];
  squads: UserSquad[];
  activeSquadId: string | null;
  squadIds: string[];
  squadLeaderId: string | null;
  squadInvites: SquadInvite[];
  /** Real signed-up friends who joined your squads through email invites. */
  friends: Friend[];
  xp: number;
  xpClaims: string[];
  streak: number;
  createdQuests: Quest[];
  favoriteVibes: Vibe[];
  /** Every XP gain, newest first. Drives weekly boards and the profile history. */
  log: XpEvent[];
  /** Local day (YYYY-MM-DD) of the last completed quest, for streaks. */
  lastQuestDay: string | null;
  /** Posts you shared after finishing a quest. */
  posts: FeedPost[];
  /** Post ids you hearted. */
  hearted: string[];
  /** Your comments on any post, keyed by post id. */
  comments: Record<string, FeedComment[]>;
};

export type ApproximateLocation = { lat: number; lng: number; label: string };
export type ScheduledQuest = { questId: string; when: string; endWhen?: string };
export type UserSquad = { id: string; name: string; leaderId: string; memberIds: string[] };
export type Friend = { id: string; name: string; email: string };
export type SquadInvite = { id: string; personId: string; personName: string; squadId?: string; squadName?: string; direction: "sent" | "received"; at: number };
export type XpKind = "complete" | "squad" | "create" | "join" | "verify";
export type XpEvent = { kind: XpKind; xp: number; at: number; label: string; refId?: string };

const BASE_KEY = "wego.state.v1";
/** Signed-out devices share the base key; each account gets its own slot. */
let activeKey = BASE_KEY;

const initialState: UserState = {
  configured: false,
  name: "You",
  handle: "sidequester",
  bio: "New around here. Looking for something to do.",
  avatarUrl: null,
  eduEmail: null,
  verified: false,
  optInNearby: false,
  shareLocation: false,
  approximateLocation: null,
  publicProfile: true,
  saved: [],
  scheduledQuests: [],
  inProgress: [],
  completed: [],
  passed: [],
  squads: [],
  activeSquadId: null,
  squadIds: [],
  squadLeaderId: null,
  squadInvites: [],
  friends: [],
  xp: 0,
  xpClaims: [],
  streak: 0,
  createdQuests: [],
  favoriteVibes: [],
  log: [],
  lastQuestDay: null,
  posts: [],
  hearted: [],
  comments: {},
};

let state: UserState = initialState;
let hydrated = false;
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(activeKey, JSON.stringify(state));
  } catch {
    /* storage unavailable — in-memory only */
  }
}

function emit() {
  for (const listener of listeners) listener();
}

/**
 * Points the store at the signed-in account's slot. First sign-in on a
 * device carries over whatever the signed-out session had saved.
 */
export function bindUser(userId: string | null) {
  if (typeof window === "undefined") return;
  const nextKey = userId ? `${BASE_KEY}.u.${userId}` : BASE_KEY;
  if (nextKey === activeKey && hydrated) return;
  activeKey = nextKey;
  hydrated = false;
  state = initialState;
  try {
    if (userId && !localStorage.getItem(activeKey)) {
      const legacy = localStorage.getItem(BASE_KEY);
      if (legacy) localStorage.setItem(activeKey, legacy);
    }
  } catch {
    /* storage unavailable */
  }
  hydrate();
}

export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(activeKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserState>;
      state = { ...initialState, ...parsed };
      // Accounts from before setup existed count as configured if they have real activity.
      if (parsed.configured === undefined) {
        state.configured = Boolean(
          parsed.xp || parsed.squads?.length || parsed.completed?.length || (parsed.name && parsed.name !== "You"),
        );
      }
      state.inProgress = state.inProgress.filter((id) => !state.completed.includes(id)).slice(-1);
      state.scheduledQuests = state.scheduledQuests.filter((item) => !state.completed.includes(item.questId) && !state.inProgress.includes(item.questId));
      if (!Array.isArray(parsed.squads) && state.squadIds.length) {
        state.squads = [{ id: "squad_main", name: "My squad", leaderId: parsed.squadLeaderId ?? "me", memberIds: state.squadIds }];
        state.activeSquadId = "squad_main";
      }
      state.squads = Array.isArray(state.squads) ? state.squads : [];
      if (!state.squads.some((squad) => squad.id === state.activeSquadId)) state.activeSquadId = state.squads[0]?.id ?? null;
      state.squadIds = [...new Set(state.squads.flatMap((squad) => squad.memberIds))];
      const activeSquad = state.squads.find((squad) => squad.id === state.activeSquadId);
      state.squadLeaderId = activeSquad?.leaderId ?? null;
      if (Array.isArray(parsed.posts)) {
        state.posts = parsed.posts.map((post) => {
          if (typeof post.ratingCount === "number") return post;
          return {
            ...post,
            rating: Math.round(post.rating * 2 * 10) / 10,
            ratingCount: 1,
          };
        });
      }
      // Strip saved-quest XP from local profiles created before saving stopped rewarding XP.
      const storedLog = state.log as { kind: string; xp: number }[];
      const legacySaveEvents = storedLog.filter((event) => event.kind === "save");
      const cleanedLog = storedLog.filter((event) => event.kind !== "save") as XpEvent[];
      const cleanedClaims = state.xpClaims.filter((claim) => !claim.startsWith("save:"));
      if (legacySaveEvents.length || cleanedClaims.length !== state.xpClaims.length) {
        const legacySaveXp = legacySaveEvents.reduce((sum, event) => sum + event.xp, 0);
        state = {
          ...state,
          xp: Math.max(0, state.xp - legacySaveXp),
          log: cleanedLog,
          xpClaims: cleanedClaims,
        };
        persist();
      }
    }
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

function gain(
  s: UserState,
  kind: XpKind,
  xp: number,
  label: string,
  refId?: string,
): Pick<UserState, "xp" | "log"> {
  return {
    xp: s.xp + xp,
    log: [{ kind, xp, at: Date.now(), label, ...(refId ? { refId } : {}) }, ...s.log].slice(0, 80),
  };
}

export const actions = {
  toggleSave(id: string) {
    setState((s) => {
      if (s.saved.includes(id)) return { ...s, saved: s.saved.filter((x) => x !== id) };
      return { ...s, saved: [...s.saved, id] };
    });
  },
  pass(id: string) {
    setState((s) => ({
      ...s,
      // Moving to the end keeps passed quests recirculating in order.
      passed: [...s.passed.filter((x) => x !== id), id],
    }));
  },
  undoChoice(id: string, choice: "pass" | "save") {
    setState((s) => {
      if (choice === "pass") return { ...s, passed: s.passed.filter((x) => x !== id) };
      return {
        ...s,
        saved: s.saved.filter((x) => x !== id),
      };
    });
  },
  /** Returns the XP earned so the caller can say it out loud. */
  complete(id: string, title = "a quest", withSquad = false): number {
    let earned = 0;
    setState((s) => {
      if (s.completed.includes(id)) return s;
      earned = XP.complete + (withSquad ? XP.squadBonus : 0);
      const base = gain(s, "complete", XP.complete, `Did ${title}`, id);
      const next = { ...s, ...base };
      const bonus = withSquad
        ? gain(next, "squad", XP.squadBonus, "Went with the squad", id)
        : base;
      return {
        ...next,
        ...bonus,
        saved: s.saved.filter((questId) => questId !== id),
        scheduledQuests: s.scheduledQuests.filter((item) => item.questId !== id),
        inProgress: s.inProgress.filter((questId) => questId !== id),
        completed: [...s.completed, id],
        passed: s.passed.filter((x) => x !== id),
        streak: nextStreak(s),
        lastQuestDay: dayKey(),
      };
    });
    return earned;
  },
  startQuest(id: string) {
    setState((s) => s.completed.includes(id) || (s.inProgress.length === 1 && s.inProgress[0] === id)
      ? s
      : { ...s, inProgress: [id], scheduledQuests: s.scheduledQuests.filter((item) => item.questId !== id), saved: s.saved.filter((questId) => questId !== id) });
  },
  scheduleQuest(id: string, when: string, endWhen?: string) {
    setState((s) => s.completed.includes(id) || s.inProgress.includes(id)
      ? s
      : {
          ...s,
          scheduledQuests: [...s.scheduledQuests.filter((item) => item.questId !== id), { questId: id, when, ...(endWhen ? { endWhen } : {}) }],
          saved: s.saved.filter((questId) => questId !== id),
        });
  },
  createSquad(name: string) {
    const id = `squad_${Date.now()}`;
    const squad: UserSquad = { id, name: name.trim() || "New squad", leaderId: "me", memberIds: [] };
    setState((s) => ({ ...s, squads: [...s.squads, squad], activeSquadId: id, squadLeaderId: "me" }));
    return id;
  },
  setActiveSquad(id: string) {
    setState((s) => {
      const squad = s.squads.find((item) => item.id === id);
      return squad ? { ...s, activeSquadId: id, squadLeaderId: squad.leaderId } : s;
    });
  },
  renameSquad(id: string, name: string) {
    setState((s) => ({ ...s, squads: s.squads.map((squad) => squad.id === id ? { ...squad, name: name.trim() || squad.name } : squad) }));
  },
  deleteSquad(id: string) {
    setState((s) => {
      const squad = s.squads.find((item) => item.id === id);
      if (!squad || squad.leaderId !== "me") return s;
      const squads = s.squads.filter((item) => item.id !== id);
      const activeSquadId = s.activeSquadId === id ? squads[0]?.id ?? null : s.activeSquadId;
      return {
        ...s,
        squads,
        activeSquadId,
        squadIds: [...new Set(squads.flatMap((item) => item.memberIds))],
        squadLeaderId: squads.find((item) => item.id === activeSquadId)?.leaderId ?? null,
        squadInvites: s.squadInvites.filter((invite) => invite.squadId !== id),
      };
    });
  },
  leaveSquad(id: string) {
    setState((s) => {
      const squad = s.squads.find((item) => item.id === id);
      if (!squad || squad.leaderId === "me") return s;
      const squads = s.squads.filter((item) => item.id !== id);
      const activeSquadId = s.activeSquadId === id ? squads[0]?.id ?? null : s.activeSquadId;
      return {
        ...s,
        squads,
        activeSquadId,
        squadIds: [...new Set(squads.flatMap((item) => item.memberIds))],
        squadLeaderId: squads.find((item) => item.id === activeSquadId)?.leaderId ?? null,
        squadInvites: s.squadInvites.filter((invite) => invite.squadId !== id),
      };
    });
  },
  inviteSquadMember(id: string, name: string, squadId: string) {
    setState((s) => {
      const squad = s.squads.find((item) => item.id === squadId);
      if (!squad || s.squadInvites.some((invite) => invite.personId === id && invite.squadId === squadId && invite.direction === "sent")) return s;
      return {
        ...s,
        squadInvites: [...s.squadInvites, { id: `invite_${id}_${Date.now()}`, personId: id, personName: name, squadId, squadName: squad.name, direction: "sent", at: Date.now() }],
      };
    });
  },
  acceptSquadInvite(id: string) {
    setState((s) => {
      const invite = s.squadInvites.find((item) => item.id === id && item.direction === "received");
      if (!invite) return s;
      const squadId = invite.squadId ?? `squad_invite_${invite.id}`;
      const existingSquad = s.squads.find((item) => item.id === squadId);
      const joinedSquad = existingSquad ? {
        ...existingSquad,
        memberIds: [...new Set([...existingSquad.memberIds, invite.personId])],
      } : {
        id: squadId,
        name: invite.squadName ?? `${invite.personName}'s squad`,
        leaderId: invite.personId,
        memberIds: [invite.personId],
      };
      const squads = existingSquad
        ? s.squads.map((item) => item.id === squadId ? joinedSquad : item)
        : [...s.squads, joinedSquad];
      return {
        ...s,
        squads,
        activeSquadId: squadId,
        squadIds: [...new Set(squads.flatMap((item) => item.memberIds))],
        squadInvites: s.squadInvites.filter((item) => item.id !== id),
        squadLeaderId: joinedSquad.leaderId,
      };
    });
  },
  /** Inviter side: a real friend accepted, so add them to that squad. */
  addFriendToSquad(squadId: string, friend: Friend) {
    setState((s) => {
      const squad = s.squads.find((item) => item.id === squadId);
      if (!squad) return s;
      const friends = s.friends.some((f) => f.id === friend.id) ? s.friends.map((f) => f.id === friend.id ? friend : f) : [...s.friends, friend];
      if (squad.memberIds.includes(friend.id)) return { ...s, friends };
      const squads = s.squads.map((item) => item.id === squadId ? { ...item, memberIds: [...item.memberIds, friend.id] } : item);
      return { ...s, friends, squads, squadIds: [...new Set(squads.flatMap((item) => item.memberIds))] };
    });
  },
  /** Invitee side: join the inviter's squad after accepting a real invite. */
  joinFriendSquad(squadId: string, squadName: string, leader: Friend) {
    setState((s) => {
      const friends = s.friends.some((f) => f.id === leader.id) ? s.friends : [...s.friends, leader];
      if (s.squads.some((item) => item.id === squadId)) return { ...s, friends, activeSquadId: squadId };
      const squads = [...s.squads, { id: squadId, name: squadName, leaderId: leader.id, memberIds: [leader.id] }];
      return { ...s, friends, squads, activeSquadId: squadId, squadLeaderId: leader.id, squadIds: [...new Set(squads.flatMap((item) => item.memberIds))] };
    });
  },
  dismissSquadInvite(id: string) {
    setState((s) => ({ ...s, squadInvites: s.squadInvites.filter((invite) => invite.id !== id) }));
  },
  toggleSquadMember(id: string, name = "someone", squadId?: string) {
    setState((s) => {
      const selectedId = squadId ?? s.activeSquadId;
      const selected = s.squads.find((squad) => squad.id === selectedId);
      if (!selected) return s;
      const removing = selected.memberIds.includes(id);
      const squads = s.squads.map((squad) => squad.id === selected.id
        ? { ...squad, memberIds: removing ? squad.memberIds.filter((memberId) => memberId !== id) : [...squad.memberIds, id] }
        : squad);
      const next = { ...s, squads, squadIds: [...new Set(squads.flatMap((squad) => squad.memberIds))] };
      if (removing || s.xpClaims.includes(`join:${id}`)) return next;
      return { ...next, xpClaims: [...s.xpClaims, `join:${id}`], ...gain(s, "join", XP.squad, `${name} joined your squad`, id) };
    });
  },
  verify(email: string) {
    setState((s) =>
      s.verified
        ? s
        : {
            ...s,
            eduEmail: email,
            verified: true,
            ...gain(s, "verify", XP.verify, "Verified your student email"),
          },
    );
  },
  setPrivacy(patch: Partial<Pick<UserState, "optInNearby" | "shareLocation" | "publicProfile">>) {
    setState((s) => ({ ...s, ...patch, ...(patch.shareLocation === false ? { approximateLocation: null } : {}) }));
  },
  updateProfile(patch: Partial<Pick<UserState, "name" | "handle" | "bio">>) {
    setState((s) => ({ ...s, ...patch }));
  },
  saveSettings(patch: Pick<UserState, "name" | "handle" | "bio" | "avatarUrl" | "favoriteVibes" | "optInNearby" | "shareLocation" | "publicProfile">) {
    setState((s) => ({ ...s, ...patch, ...(patch.shareLocation ? {} : { approximateLocation: null }) }));
  },
  setApproximateLocation(lat: number, lng: number) {
    setState((s) => ({
      ...s,
      shareLocation: true,
      approximateLocation: {
        lat: Number(lat.toFixed(2)),
        lng: Number(lng.toFixed(2)),
        label: "Your approximate area",
      },
    }));
  },
  clearApproximateLocation() {
    setState((s) => ({ ...s, shareLocation: false, approximateLocation: null }));
  },
  toggleFavoriteVibe(vibe: Vibe) {
    setState((s) => ({
      ...s,
      favoriteVibes: s.favoriteVibes.includes(vibe)
        ? s.favoriteVibes.filter((item) => item !== vibe)
        : [...s.favoriteVibes, vibe],
    }));
  },
  addQuest(quest: Quest) {
    setState((s) => ({
      ...s,
      createdQuests: [quest, ...s.createdQuests],
      ...gain(s, "create", XP.create, `Made “${quest.title}”`),
    }));
  },
  sharePost(post: FeedPost) {
    setState((s) => ({ ...s, posts: [post, ...s.posts] }));
  },
  toggleHeart(postId: string) {
    setState((s) => ({
      ...s,
      hearted: s.hearted.includes(postId)
        ? s.hearted.filter((x) => x !== postId)
        : [...s.hearted, postId],
    }));
  },
  comment(postId: string, text: string) {
    setState((s) => ({
      ...s,
      comments: {
        ...s.comments,
        [postId]: [
          ...(s.comments[postId] ?? []),
          { id: `c_${Date.now()}`, author: s.name, text, at: Date.now() },
        ],
      },
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
      approximateLocation: { lat: 44.97, lng: -93.23, label: "Your approximate area" },
      completed: ["q_snack_crawl", "q_midnight_photo_hunt", "q_stone_arch_freeze"],
      saved: ["q_spoon_cherry_standoff", "q_late_diner_menu_dare"],
      scheduledQuests: [],
      inProgress: [],
      passed: ["q_farmers_market_dare"],
      squadIds: ["u_alex", "u_jordan"],
      squads: [{ id: "squad_main", name: "The usuals", leaderId: "me", memberIds: ["u_alex", "u_jordan"] }],
      activeSquadId: "squad_main",
      squadLeaderId: "me",
      squadInvites: [{ id: "demo-invite-alex", personId: "u_maya", personName: "Maya Chen", squadId: "squad_maya", squadName: "Maya's crew", direction: "received", at: now - h }],
      xp: 1670,
      streak: 6,
      lastQuestDay: dayKey(new Date(now - 20 * h)),
      log: [
        { kind: "squad", xp: XP.squadBonus, at: now - 20 * h, label: "Went with the squad" },
        {
          kind: "complete",
          xp: XP.complete,
          at: now - 20 * h,
          label: "Did Stone Arch freeze frame",
        },
        { kind: "squad", xp: XP.squadBonus, at: now - 52 * h, label: "Went with the squad" },
        {
          kind: "complete",
          xp: XP.complete,
          at: now - 52 * h,
          label: "Did the midnight photo hunt",
        },
        { kind: "join", xp: XP.squad, at: now - 70 * h, label: "Jordan joined your squad" },
        { kind: "complete", xp: XP.complete, at: now - 10 * 24 * h, label: "Did the snack crawl" },
      ],
    }));
  },
};
