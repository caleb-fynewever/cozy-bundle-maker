import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getState, setState, subscribe, getBoundUserId } from "@/lib/store";
import { loadDatabase, publishQuest, saveAccount, syncSocial } from "@/lib/database.functions";
import { accountPayload, mergeAccount, EMPTY_ACCOUNT } from "@/lib/account-sync";
import { accountSchema, questSchema } from "@/lib/backend-schema";
import type { AccountPayload } from "@/lib/backend-schema";
import type { DemoUser, Quest } from "@/lib/types";

/** One sync worker per signed-in account, with revision checks and account-switch guards. */
export function useDatabaseSync() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const social = useServerFn(syncSocial);
  const load = useServerFn(loadDatabase),
    save = useServerFn(saveAccount),
    publish = useServerFn(publishQuest);
  useEffect(() => {
    if (!userId) return;
    let stopped = false,
      busy = false,
      warned = false,
      backoff = 5000,
      timer: ReturnType<typeof setTimeout>;
    let base: AccountPayload | null = null;
    const cacheKey = `wego.sync.v1.${userId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) base = accountSchema.parse(JSON.parse(cached)) as AccountPayload;
    } catch {
      /* invalid cache is disposable */
    }
    const valid = () => !stopped && getBoundUserId() === userId;
    const sync = async () => {
      if (!valid() || busy || !getState().configured) return;
      busy = true;
      try {
        let remote = await load();
        if (!valid() || remote.userId !== userId) return;
        // Import device-only creations once; never overwrite a newer database edit with cached content.
        const known = new Set(remote.quests.map((q) => q.id));
        let imported = false;
        for (const quest of getState().createdQuests) {
          if (!valid()) return;
          if (!known.has(quest.id)) {
            await publish({ data: { ...quest, expectedUserId: userId } });
            imported = true;
          }
        }
        if (imported) remote = await load();
        if (!valid() || remote.userId !== userId) return;
        const quests = remote.quests.map((row) => ({
          ...row,
          content: questSchema.parse(row.content),
        }));
        const remotePayload = remote.account
          ? (accountSchema.parse(remote.account.payload) as AccountPayload)
          : null;
        const local = accountPayload(getState());
        // Restore server state and retain unsynced local activity on a device connecting for the first time.
        const merged = remotePayload
          ? mergeAccount(base ?? EMPTY_ACCOUNT, local, remotePayload)
          : local;
        const result =
          remote.account && JSON.stringify(merged) === JSON.stringify(remotePayload)
            ? { conflict: false as const, revision: remote.account.revision, awards: remote.awards }
            : await save({
                data: { userId, revision: remote.account?.revision ?? 0, payload: merged },
              });
        if (!valid()) return;
        if (result.conflict) {
          // Another device won the write; reload and retry with growing delay instead of hot-looping.
          clearTimeout(timer);
          timer = setTimeout(() => void sync(), backoff);
          backoff = Math.min(backoff * 2, 60000);
          return;
        }
        const feed = await social({
          data: {
            userId,
            posts: getState().posts,
            hearted: merged.hearted,
            comments: merged.comments,
          },
        });
        if (!valid()) return;
        const confirmed = {
          ...merged,
          xp: result.awards.reduce((sum, e) => sum + e.xp, 0),
          log: result.awards.map((e) => ({
            kind: e.kind,
            refId: e.ref_id,
            xp: e.xp,
            label: e.label,
            at: Date.parse(e.awarded_at),
          })),
        };
        const after = accountPayload(getState());
        const latest = mergeAccount(local, after, confirmed);
        base = confirmed;
        try {
          localStorage.setItem(cacheKey, JSON.stringify(base));
        } catch {
          /* sync still works without disk cache */
        }
        const demoIds = new Set(remote.demoSquads.map((s) => s.id));
        const squads = [
          ...getState().squads.filter((s) => !demoIds.has(s.id)),
          ...remote.demoSquads
            .filter((s) => !latest.hiddenDemoSquadIds.includes(s.id))
            .map((s) => ({
              id: s.id,
              name: s.name,
              leaderId: s.leader_id,
              memberIds: remote.demoMembers
                .filter((m) => m.squad_id === s.id)
                .map((m) => m.person_id),
            })),
        ];
        const activeSquadId = squads.some((s) => s.id === getState().activeSquadId)
          ? getState().activeSquadId
          : (squads[0]?.id ?? null);
        setState((state) => ({
          ...state,
          ...latest,
          squads,
          activeSquadId,
          squadIds: [...new Set(squads.flatMap((s) => s.memberIds))],
          squadLeaderId: squads.find((s) => s.id === activeSquadId)?.leaderId ?? null,
          catalogLoaded: true,
          remotePosts: feed,
          verified: Boolean(remote.verification),
          eduEmail: remote.verification?.email ?? null,
          directory: remote.directory,
          remoteQuests: quests.filter((q) => !q.archived).map((q) => q.content as Quest),
          remoteArchivedQuests: quests.filter((q) => q.archived).map((q) => q.content as Quest),
          remotePeople: remote.people.map((row) => row.data as unknown as DemoUser),
          createdQuests: [
            ...new Map(
              [
                ...state.createdQuests,
                ...quests.filter((q) => q.owner_id === userId).map((q) => q.content as Quest),
              ].map((q) => [q.id, q]),
            ).values(),
          ],
        }));
        warned = false;
      } catch (error) {
        if (valid() && !warned) {
          warned = true;
          toast.error(
            error instanceof Error
              ? error.message
              : "Database sync unavailable; changes remain on this device.",
          );
        }
      } finally {
        busy = false;
      }
    };
    let last = JSON.stringify([
      accountPayload(getState()),
      getState().createdQuests,
      getState().posts,
    ]);
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => void sync(), 800);
    }
    const unsubscribe = subscribe(() => {
      if (!valid()) return;
      const next = JSON.stringify([
        accountPayload(getState()),
        getState().createdQuests,
        getState().posts,
      ]);
      if (next !== last) {
        last = next;
        schedule();
      }
    });
    const refresh = () => void sync();
    const interval = setInterval(refresh, 30000);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    void sync();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(interval);
      unsubscribe();
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [userId, load, save, publish, social]);
}
