import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RemoteSquadMember = { id: string; name: string; handle: string; avatarUrl: string | null };
export type RemoteSquad = { id: string; name: string; leaderId: string; members: RemoteSquadMember[] };

/** Every shared squad you belong to, with its members' public profile info. */
export const listMySquads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ me: string; squads: RemoteSquad[] }> => {
    const sb = context.supabase;
    const { data: squads, error } = await sb.from("squads").select("id, name, leader_id");
    if (error) throw new Error("Couldn't load your squads.");
    if (!squads?.length) return { me: context.userId, squads: [] };
    const ids = squads.map((s) => s.id);
    const { data: members } = await sb.from("squad_members").select("squad_id, user_id").in("squad_id", ids);
    const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
    const { data: profiles } = userIds.length
      ? await sb.from("profiles").select("id, name, handle, avatar_url").in("id", userIds)
      : { data: [] };
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return {
      me: context.userId,
      squads: squads.map((s) => ({
        id: s.id,
        name: s.name,
        leaderId: s.leader_id,
        members: (members ?? [])
          .filter((m) => m.squad_id === s.id)
          .map((m) => {
            const p = byId.get(m.user_id);
            return {
              id: m.user_id,
              name: p?.name || (p?.handle ? `@${p.handle}` : "Squadmate"),
              handle: p?.handle ?? "",
              avatarUrl: p?.avatar_url ?? null,
            };
          }),
      })),
    };
  });

export const createRemoteSquad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("squads")
      .insert({ name: data.name, leader_id: context.userId })
      .select("id")
      .single();
    if (error || !row) throw new Error("Couldn't create that squad.");
    return { id: row.id };
  });

export const renameRemoteSquad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("squads").update({ name: data.name }).eq("id", data.id);
    await context.supabase
      .from("squad_invites")
      .update({ squad_name: data.name })
      .eq("squad_key", data.id)
      .eq("inviter_id", context.userId)
      .eq("status", "pending");
    return { ok: true };
  });

export const deleteRemoteSquad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("squads").delete().eq("id", data.id).eq("leader_id", context.userId);
    await context.supabase
      .from("squad_invites")
      .delete()
      .eq("squad_key", data.id)
      .eq("inviter_id", context.userId)
      .eq("status", "pending");
    return { ok: true };
  });

/** Leave a squad yourself, or (as leader) remove someone. */
export const removeRemoteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ squadId: z.string().uuid(), userId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("squad_members")
      .delete()
      .eq("squad_id", data.squadId)
      .eq("user_id", data.userId ?? context.userId);
    return { ok: true };
  });
