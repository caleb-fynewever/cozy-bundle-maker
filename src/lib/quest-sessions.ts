import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getActiveQuestSession, type QuestSession } from "@/lib/quest-sessions.functions";

const listeners = new Set<() => void>();
/** Ask every mounted hook to refetch (e.g. right after heading out or wrapping up). */
export function refreshQuestSessions() {
  for (const l of listeners) l();
}

/** The quest you're on right now — started by you or including you — polled every 30s. */
export function useActiveQuestSession() {
  const { session } = useAuth();
  const get = useServerFn(getActiveQuestSession);
  const [active, setActive] = useState<QuestSession | null>(null);

  const load = useCallback(async () => {
    if (!session) {
      setActive(null);
      return;
    }
    try {
      setActive(await get());
    } catch {
      /* offline or table not created yet — nothing to show */
    }
  }, [session, get]);

  useEffect(() => {
    void load();
    listeners.add(load);
    const timer = window.setInterval(load, 30000);
    return () => {
      listeners.delete(load);
      window.clearInterval(timer);
    };
  }, [load]);

  return active;
}
