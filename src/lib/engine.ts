import { QUESTS } from "@/data/quests";
import { NEARBY_STUDENTS } from "@/data/people";
import { VIBES, type DemoUser, type Quest, type SessionContext, type TasteVector, type TimeSlot, type Vibe } from "@/lib/types";
import type { UserState } from "@/lib/store";

/** Scoring weights — tweak these in one place to change recommendation behaviour. */
export const WEIGHTS = {
  preference: 0.45,
  context: 0.2,
  social: 0.15,
  proximity: 0.1,
  novelty: 0.1,
};

export const CAMPUS_ORIGIN = { lat: 44.9741, lng: -93.2277, label: "East Bank, UMN" };

const emptyVibes = (): Record<Vibe, number> =>
  VIBES.reduce((acc, v) => ({ ...acc, [v]: 0 }), {} as Record<Vibe, number>);

export function emptyTaste(): TasteVector {
  return {
    hasHistory: false,
    signals: 0,
    vibes: emptyVibes(),
    weirdness: 3,
    durationMin: 60,
    costTolerance: 15,
    adventure: 3,
  };
}

export function distanceMi(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Weighted taste vector: completions count most, saves add interest, passes subtract. */
export function buildTasteVector(state: UserState, quests: Quest[] = QUESTS): TasteVector {
  const byId = new Map(quests.map((q) => [q.id, q]));
  const taste = emptyTaste();
  const events: { quest: Quest; weight: number }[] = [];

  state.completed.forEach((id) => {
    const quest = byId.get(id);
    if (quest) events.push({ quest, weight: 1 });
  });
  state.saved.forEach((id) => {
    const quest = byId.get(id);
    if (quest) events.push({ quest, weight: 0.6 });
  });
  state.passed.forEach((id) => {
    const quest = byId.get(id);
    if (quest) events.push({ quest, weight: -0.5 });
  });

  if (events.length === 0) return taste;

  let positiveWeight = 0;
  let weirdness = 0;
  let duration = 0;
  let cost = 0;
  let adventure = 0;

  for (const { quest, weight } of events) {
    for (const vibe of quest.vibes) {
      taste.vibes[vibe] += weight / quest.vibes.length;
    }
    if (weight > 0) {
      positiveWeight += weight;
      weirdness += quest.weirdness * weight;
      duration += quest.durationMin * weight;
      cost += quest.costPerPerson * weight;
      adventure += quest.adventure * weight;
    }
  }

  const peak = Math.max(1, ...VIBES.map((v) => Math.abs(taste.vibes[v])));
  for (const vibe of VIBES) {
    taste.vibes[vibe] = Math.max(0, Math.min(1, taste.vibes[vibe] / peak));
  }

  if (positiveWeight > 0) {
    taste.weirdness = weirdness / positiveWeight;
    taste.durationMin = duration / positiveWeight;
    taste.costTolerance = cost / positiveWeight;
    taste.adventure = adventure / positiveWeight;
  }

  taste.signals = events.length;
  taste.hasHistory = events.length >= 2;
  return taste;
}

/** Blend a user's taste with squad members' taste profiles. */
export function groupTasteVector(taste: TasteVector, squad: DemoUser[]): Record<Vibe, number> {
  const combined = emptyVibes();
  const members = squad.length + 1;
  for (const vibe of VIBES) {
    let sum = taste.hasHistory ? taste.vibes[vibe] : 0.35;
    for (const member of squad) sum += member.taste[vibe] ?? 0;
    combined[vibe] = sum / members;
  }
  return combined;
}

export function topVibes(vibes: Record<Vibe, number>, count = 4) {
  return VIBES.map((vibe) => ({ vibe, value: vibes[vibe] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count);
}

/** Squad compatibility: 35% taste, 25% shared interests, 20% distance, 10% availability, 10% group size. */
export function compatibility(
  taste: TasteVector,
  user: DemoUser,
  context: { groupSize: number; radiusMi: number },
) {
  const mine = taste.hasHistory
    ? taste.vibes
    : (VIBES.reduce((acc, v) => ({ ...acc, [v]: 0.4 }), {} as Record<Vibe, number>) as Record<Vibe, number>);

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const vibe of VIBES) {
    dot += mine[vibe] * user.taste[vibe];
    magA += mine[vibe] ** 2;
    magB += user.taste[vibe] ** 2;
  }
  const tasteSim = magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0.5;

  const myTop = new Set(topVibes(mine, 3).map((v) => v.vibe));
  const theirTop = topVibes(user.taste, 3).map((v) => v.vibe);
  const shared = theirTop.filter((v) => myTop.has(v));
  const sharedScore = shared.length / 3;

  const proximity = Math.max(0, 1 - user.distanceMi / Math.max(context.radiusMi, 1));
  const availability = user.optInNearby ? 1 : 0.2;
  const [min, max] = user.preferredGroup;
  const groupFit = context.groupSize >= min && context.groupSize <= max ? 1 : 0.45;

  const score =
    0.35 * tasteSim + 0.25 * sharedScore + 0.2 * proximity + 0.1 * availability + 0.1 * groupFit;

  return {
    score: Math.round(Math.max(0, Math.min(1, score)) * 100),
    shared,
    tasteSim,
    proximity,
    groupFit,
  };
}

export type ScoredQuest = {
  quest: Quest;
  score: number;
  distance: number;
  isNew: boolean;
  breakdown: {
    preference: number;
    context: number;
    social: number;
    proximity: number;
    novelty: number;
  };
  reasons: string[];
};

export type Trace = {
  candidates: number;
  viable: number;
  personalized: number;
  diverse: number;
};

function timeSlotFit(quest: Quest, slot: TimeSlot) {
  return quest.bestTime.includes(slot) ? 1 : 0.35;
}

function scoreQuest(
  quest: Quest,
  taste: TasteVector,
  groupVibes: Record<Vibe, number>,
  context: SessionContext,
  state: UserState,
): ScoredQuest {
  const distance = distanceMi(context.origin, quest.location);

  const requested = context.vibes.length
    ? context.vibes.filter((v) => quest.vibes.includes(v)).length / context.vibes.length
    : 0.5;
  const tasteMatch = taste.hasHistory
    ? quest.vibes.reduce((sum, v) => sum + taste.vibes[v], 0) / quest.vibes.length
    : 0.5;
  const chaosTarget = 1 + (context.chaos - 1);
  const chaosFit = 1 - Math.abs(quest.weirdness - chaosTarget) / 4;
  const preference = 0.45 * requested + 0.35 * tasteMatch + 0.2 * Math.max(0, chaosFit);

  const durationFit = 1 - Math.min(1, Math.abs(quest.durationMin - context.timeBudgetMin) / 120);
  const costFit =
    context.maxCost === null ? 1 : quest.costPerPerson <= context.maxCost ? 1 : 0.2;
  const groupFit =
    context.groupSize >= quest.groupMin && context.groupSize <= quest.groupMax ? 1 : 0.4;
  const contextScore =
    0.3 * durationFit + 0.25 * costFit + 0.25 * groupFit + 0.2 * timeSlotFit(quest, context.timeSlot);

  const squad = NEARBY_STUDENTS.filter((u) => context.squadIds.includes(u.id));
  const social = quest.vibes.reduce((sum, v) => sum + (groupVibes[v] ?? 0), 0) / quest.vibes.length;

  const proximity = Math.max(0, 1 - distance / Math.max(context.radiusMi, 1));

  const seenVibes = new Set(
    [...state.completed, ...state.saved].flatMap(
      (id) => QUESTS.find((q) => q.id === id)?.vibes ?? [],
    ),
  );
  const unseenVibes = quest.vibes.filter((v) => !seenVibes.has(v)).length;
  const novelty = state.completed.length === 0 ? 0.5 : unseenVibes / quest.vibes.length;

  const score =
    WEIGHTS.preference * preference +
    WEIGHTS.context * contextScore +
    WEIGHTS.social * social +
    WEIGHTS.proximity * proximity +
    WEIGHTS.novelty * novelty;

  const reasons: string[] = [];
  if (requested > 0.5 && context.vibes.length) {
    reasons.push(`Matches the ${context.vibes.slice(0, 2).join(" + ")} vibe you asked for`);
  }
  if (taste.hasHistory && tasteMatch > 0.55) {
    const best = topVibes(taste.vibes, 2).map((v) => v.vibe);
    reasons.push(`You keep choosing ${best.join(" and ")} quests`);
  }
  if (durationFit > 0.8) reasons.push(`${quest.durationMin} min fits your ${context.timeBudgetMin} min window`);
  if (quest.costPerPerson === 0) reasons.push("Completely free");
  else if (costFit === 1) reasons.push(`$${quest.costPerPerson} per person, inside your budget`);
  if (proximity > 0.5) reasons.push(`${distance.toFixed(1)} mi from ${context.origin.label}`);
  if (groupFit === 1) reasons.push(`Built for groups of ${quest.groupMin}-${quest.groupMax}`);
  if (squad.length && social > 0.45) {
    reasons.push(`Overlaps your squad's taste with ${squad.map((s) => s.name).join(" & ")}`);
  }
  if (novelty > 0.6) reasons.push("Introduces something you've never tried");

  return {
    quest,
    score: Math.max(0, Math.min(1, score)),
    distance,
    isNew: novelty > 0.6,
    breakdown: {
      preference,
      context: contextScore,
      social,
      proximity,
      novelty,
    },
    reasons,
  };
}

/**
 * Pipeline: candidates -> hard-constraint filtering -> personalization ->
 * novelty -> diversity re-ranking.
 */
export function recommend(
  context: SessionContext,
  state: UserState,
  quests: Quest[] = QUESTS,
  limit = 6,
): { results: ScoredQuest[]; trace: Trace; taste: TasteVector; groupVibes: Record<Vibe, number> } {
  const taste = buildTasteVector(state, quests);
  const squad = NEARBY_STUDENTS.filter((u) => context.squadIds.includes(u.id));
  const groupVibes = groupTasteVector(taste, squad);

  const candidates = quests.filter((q) => !state.passed.includes(q.id));

  const viable = candidates.filter((quest) => {
    const withinRadius = distanceMi(context.origin, quest.location) <= context.radiusMi;
    const withinTime = quest.durationMin <= context.timeBudgetMin * 1.35;
    const withinBudget = context.maxCost === null || quest.costPerPerson <= context.maxCost;
    return withinRadius && withinTime && withinBudget;
  });

  const pool = viable.length >= 3 ? viable : candidates;
  const scored = pool
    .map((quest) => scoreQuest(quest, taste, groupVibes, context, state))
    .sort((a, b) => b.score - a.score);

  const personalized = scored.slice(0, Math.max(limit * 2, 8));

  // Diversity re-ranking: avoid stacking near-identical quests.
  const diverse: ScoredQuest[] = [];
  const usedVibes = new Map<Vibe, number>();
  for (const item of personalized) {
    const repeats = item.quest.vibes.reduce((max, v) => Math.max(max, usedVibes.get(v) ?? 0), 0);
    if (repeats >= 2 && diverse.length >= 3) continue;
    diverse.push(item);
    for (const vibe of item.quest.vibes) usedVibes.set(vibe, (usedVibes.get(vibe) ?? 0) + 1);
    if (diverse.length === limit) break;
  }
  while (diverse.length < Math.min(limit, personalized.length)) {
    const next = personalized.find((p) => !diverse.includes(p));
    if (!next) break;
    diverse.push(next);
  }

  return {
    results: diverse,
    trace: {
      candidates: candidates.length,
      viable: pool.length,
      personalized: personalized.length,
      diverse: diverse.length,
    },
    taste,
    groupVibes,
  };
}

/** Tonight mode: three deliberately different answers. */
export function tonightTrio(scored: ScoredQuest[]) {
  if (scored.length === 0) return [];
  const byScore = [...scored].sort((a, b) => b.score - a.score);
  const perfect = byScore[0]!;
  const safe =
    [...scored]
      .filter((s) => s !== perfect)
      .sort(
        (a, b) =>
          a.quest.weirdness - b.quest.weirdness || a.distance - b.distance,
      )[0] ?? perfect;
  const chaos =
    [...scored]
      .filter((s) => s !== perfect && s !== safe)
      .sort(
        (a, b) =>
          b.quest.weirdness + b.breakdown.novelty * 5 - (a.quest.weirdness + a.breakdown.novelty * 5),
      )[0] ?? perfect;

  return [
    { label: "Safe bet", tone: "safe" as const, item: safe },
    { label: "Perfect match", tone: "perfect" as const, item: perfect },
    { label: "Chaos mode", tone: "chaos" as const, item: chaos },
  ];
}

export function currentTimeSlot(date = new Date()): TimeSlot {
  const h = date.getHours();
  if (h < 11) return "morning";
  if (h < 17) return "afternoon";
  if (h < 22) return "evening";
  return "late";
}
