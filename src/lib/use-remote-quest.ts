import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRemoteQuest } from "@/lib/database.functions";
import { findQuest } from "@/lib/catalog";
import { getBoundUserId, setState, useUserState } from "@/lib/store";
import type { Quest } from "@/lib/types";

/** Deep links fetch the requested record instead of waiting for a full catalog sync. */
export function useRemoteQuest(id: string) {
  const state = useUserState();
  const quest = findQuest(state, id);
  const load = useServerFn(getRemoteQuest);
  const [attempt, retry] = useState(0);
  const [result, setResult] = useState<{ id: string; status: "loading" | "missing" | "error" }>({
    id,
    status: "loading",
  });
  useEffect(() => {
    if (quest) return;
    let active = true;
    const userId = getBoundUserId();
    setResult({ id, status: "loading" });
    void load({ data: { id } })
      .then((row) => {
        if (!active || getBoundUserId() !== userId) return;
        if (!row) {
          setResult({ id, status: "missing" });
          return;
        }
        if (row.userId !== userId) return;
        setState((s) => ({
          ...s,
          [row.archived ? "remoteArchivedQuests" : "remoteQuests"]: [
            ...(row.archived ? s.remoteArchivedQuests : s.remoteQuests).filter((q) => q.id !== id),
            row.quest as Quest,
          ],
        }));
      })
      .catch(() => {
        if (active) setResult({ id, status: "error" });
      });
    return () => {
      active = false;
    };
  }, [id, Boolean(quest), load, attempt]);
  return {
    quest,
    status: result.id === id ? result.status : "loading",
    retry: () => retry((n) => n + 1),
  };
}
