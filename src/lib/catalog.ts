import { ALL_QUESTS, QUESTS } from "@/data/quests";
import type { UserState } from "@/lib/store";
export function questCatalog(state: UserState, includeArchived = false) {
  const remote = includeArchived
    ? [...state.remoteQuests, ...state.remoteArchivedQuests]
    : state.remoteQuests;
  const fallback = includeArchived ? ALL_QUESTS : QUESTS;
  const archived = new Set(state.remoteArchivedQuests.map((q) => q.id));
  const mine = state.createdQuests.filter((q) => includeArchived || !archived.has(q.id));
  return [
    ...new Map(
      [...(state.catalogLoaded ? [] : fallback), ...remote, ...mine].map((q) => [q.id, q]),
    ).values(),
  ];
}
export function findQuest(state: UserState, id: string) {
  return questCatalog(state, true).find((q) => q.id === id);
}
