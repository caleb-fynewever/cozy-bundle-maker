import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppDatabase } from "@/lib/database.types";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RemoteSquadMember = { id: string; name: string; handle: string; avatarUrl: string | null; demo?: boolean };
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
    const { data: members, error: membersError } = await sb.from("squad_members").select("squad_id, user_id").in("squad_id", ids);
    if (membersError) throw new Error("Could not load squad members.");
    const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
    const { data: profiles, error: profilesError } = userIds.length
      ? await sb.from("profiles").select("id, name, handle, avatar_url").in("id", userIds)
      : { data: [], error: null };
    if (profilesError) throw new Error("Could not load squad profiles.");
    const { data: demoMembers, error: demoError } = await (sb as unknown as SupabaseClient<AppDatabase>).from("squad_demo_members").select("squad_id, person_id").in("squad_id", ids);
    if (demoError) throw new Error("Could not load demo squadmates.");
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return {
      me: context.userId,
      squads: squads.map((s) => ({
        id: s.id,
        name: s.name,
        leaderId: s.leader_id,
        members: [...(members ?? [])
          .filter((m) => m.squad_id === s.id)
          .map((m) => {
            const p = byId.get(m.user_id);
            return {
              id: m.user_id,
              name: p?.name || (p?.handle ? `@${p.handle}` : "Squadmate"),
              handle: p?.handle ?? "",
              avatarUrl: p?.avatar_url ?? null,
            };
          }), ...(demoMembers ?? []).filter(m => m.squad_id === s.id).map(m => ({id: m.person_id, name: "Demo squadmate", handle: "", avatarUrl: null, demo: true}))],
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
    const { error, data: changed } = await context.supabase.from("squads").update({ name: data.name }).eq("id", data.id).select("id").single();
    if (error || !changed) throw new Error("Could not rename this squad.");
    return { ok: true };
  });

export const deleteRemoteSquad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: changed } = await context.supabase.from("squads").delete().eq("id", data.id).eq("leader_id", context.userId).select("id").single();
    if (error || !changed) throw new Error("Could not delete this squad.");
    return { ok: true };
  });

/** Leave a squad yourself, or (as leader) remove someone. */
export const removeRemoteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ squadId: z.string().uuid(), userId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("squad_members")
      .delete()
      .eq("squad_id", data.squadId)
      .eq("user_id", data.userId ?? context.userId);
    if (error) throw new Error("Could not remove this member.");
    return { ok: true };
  });
