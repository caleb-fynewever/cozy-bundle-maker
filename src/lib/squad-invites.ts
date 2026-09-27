import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { actions, useUserState } from "@/lib/store";
import { listSquadInvites, respondSquadInvite, type RemoteInvite } from "@/lib/squad-invites.functions";
import { getProfileById } from "@/lib/profiles.functions";

const listeners = new Set<() => void>();
/** Ask every mounted invite hook to refetch (e.g. right after sending one). */
export function refreshSquadInvites() {
  for (const l of listeners) l();
}

/** Real invites from the backend; also folds accepted invites into your squads. */
export function useSquadInvites() {
  const { session } = useAuth();
  const state = useUserState();
  const list = useServerFn(listSquadInvites);
  const respond = useServerFn(respondSquadInvite);
  const getProfile = useServerFn(getProfileById);
  const [received, setReceived] = useState<RemoteInvite[]>([]);
  const [sent, setSent] = useState<RemoteInvite[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const res = await list();
      setReceived(res.received);
      setSent(res.sent);
      for (const inv of res.sent) {
        if (inv.status === "accepted" && inv.invitee_id) {
          actions.addFriendToSquad(inv.squad_key, {
            id: `f_${inv.invitee_id}`,
            name: inv.invitee_name ?? inv.invitee_email.split("@")[0]!,
            email: inv.invitee_email,
          });
        }
      }
    } catch {
      /* offline or signed out — keep what we have */
    }
  }, [session, list]);

  useEffect(() => {
    void load();
    listeners.add(load);
    const timer = window.setInterval(load, 30000);
    return () => {
      listeners.delete(load);
      window.clearInterval(timer);
    };
  }, [load]);

  const answer = async (invite: RemoteInvite, accept: boolean) => {
    const row = await respond({ data: { id: invite.id, accept, name: state.name === "You" ? (session?.user.email?.split("@")[0] ?? "Friend") : state.name } });
    if (accept) {
      let leaderName = row.inviter_name;
      if (!leaderName || leaderName === "A friend") {
        try {
          const profile = await getProfile({ data: { id: row.inviter_id } });
          if (profile) leaderName = profile.name || `@${profile.handle}`;
        } catch {
          /* keep the name from the invite */
        }
      }
      actions.joinFriendSquad(`remote_${row.inviter_id}_${row.squad_key}`, row.squad_name, {
        id: `f_${row.inviter_id}`,
        name: leaderName || "Squad leader",
        email: "",
      });
    }
    setReceived((cur) => cur.filter((i) => i.id !== invite.id));
  };

  return { received, sent, answer, reload: load };
}
