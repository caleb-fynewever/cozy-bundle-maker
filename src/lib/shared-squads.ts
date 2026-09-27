import { useCallback, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { actions, getState, UUID_RE } from "@/lib/store";
import { FOUNDERS_SQUAD } from "@/data/people";
import {
  createRemoteSquad,
  deleteRemoteSquad,
  listMySquads,
  removeRemoteMember,
  renameRemoteSquad,
} from "@/lib/squads.functions";

const listeners = new Set<() => void>();
/** Ask the mounted sync hook to pull the latest shared squads. */
export function refreshSharedSquads() {
  for (const l of listeners) l();
}

let uploading = false;

/** Keeps this device's squads in step with the one shared copy in the backend. Mount once. */
export function useSharedSquadSync() {
  const { session } = useAuth();
  const list = useServerFn(listMySquads);
  const create = useServerFn(createRemoteSquad);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      // Squads you made before sharing existed get uploaded once.
      if (!uploading) {
        uploading = true;
        try {
          for (const sq of getState().squads) {
            if (sq.leaderId !== "me" || UUID_RE.test(sq.id) || sq.id === FOUNDERS_SQUAD.id) continue;
            const { id } = await create({ data: { name: sq.name } });
            actions.replaceSquadId(sq.id, id);
          }
        } finally {
          uploading = false;
        }
      }
      const res = await list();
      actions.syncRemoteSquads(res.me, res.squads);
    } catch {
      /* offline — keep what we have */
    }
  }, [session, list, create]);

  useEffect(() => {
    void load();
    listeners.add(load);
    const timer = window.setInterval(load, 30000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      listeners.delete(load);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);
}

/** Squad edits that write to the shared copy first, then update this device. */
export function useSquadMutations() {
  const { session } = useAuth();
  const create = useServerFn(createRemoteSquad);
  const rename = useServerFn(renameRemoteSquad);
  const remove = useServerFn(deleteRemoteSquad);
  const removeMember = useServerFn(removeRemoteMember);

  return {
    async createSquad(name: string) {
      if (!session) return actions.createSquad(name);
      const { id } = await create({ data: { name: name.trim() || "New squad" } });
      actions.createSquad(name, id);
      refreshSharedSquads();
      return id;
    },
    async renameSquad(id: string, name: string) {
      actions.renameSquad(id, name);
      if (session && UUID_RE.test(id)) await rename({ data: { id, name } });
    },
    async deleteSquad(id: string) {
      if (session && UUID_RE.test(id)) await remove({ data: { id } });
      actions.deleteSquad(id);
    },
    async leaveSquad(id: string) {
      if (session && UUID_RE.test(id)) await removeMember({ data: { squadId: id } });
      actions.leaveSquad(id);
    },
    /** Leader toggling a member; real members are removed from the shared copy. */
    async toggleMember(memberId: string, name: string, squadId: string) {
      const squad = getState().squads.find((s) => s.id === squadId);
      const removing = squad?.memberIds.includes(memberId);
      if (session && removing && memberId.startsWith("f_") && UUID_RE.test(squadId))
        await removeMember({ data: { squadId, userId: memberId.slice(2) } });
      actions.toggleSquadMember(memberId, name, squadId);
    },
  };
}
