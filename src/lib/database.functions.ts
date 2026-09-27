import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppDatabase } from "@/lib/database.types";
import type { Json } from "@/integrations/supabase/types";
import { accountSchema, questSchema, postSchema } from "@/lib/backend-schema";

export const loadDatabase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as SupabaseClient<AppDatabase>;
    const [quests, people, directory, account, awards, verification, demoSquads, demoMembers] =
      await Promise.all([
        db.from("quests").select("id, owner_id, archived, content").order("id").limit(1000),
        db.from("demo_people").select("data").order("id"),
        db.rpc("people_directory", {}),
        db
          .from("account_state")
          .select("revision, payload")
          .eq("user_id", context.userId)
          .maybeSingle(),
        db
          .from("xp_events")
          .select("kind,ref_id,xp,label,awarded_at")
          .eq("user_id", context.userId)
          .eq("active", true)
          .order("awarded_at", { ascending: false }),
        db
          .from("student_verifications")
          .select("email")
          .eq("user_id", context.userId)
          .maybeSingle(),
        db.from("demo_squads").select("id,name,leader_id"),
        db.from("demo_squad_members").select("squad_id,person_id"),
      ]);
    if (
      quests.error ||
      people.error ||
      account.error ||
      directory.error ||
      awards.error ||
      verification.error ||
      demoSquads.error ||
      demoMembers.error
    )
      throw new Error("Database sync unavailable. Your changes remain on this device.");
    const canonical = account.data
      ? {
          ...account.data,
          payload: {
            ...(account.data.payload as Record<string, Json>),
            xp: (awards.data ?? []).reduce((sum, e) => sum + e.xp, 0),
            log: (awards.data ?? []).map((e) => ({
              kind: e.kind,
              refId: e.ref_id,
              xp: e.xp,
              label: e.label,
              at: Date.parse(e.awarded_at),
            })),
          },
        }
      : null;
    return {
      awards: awards.data ?? [],
      demoSquads: demoSquads.data ?? [],
      demoMembers: demoMembers.data ?? [],
      verification: verification.data,
      directory: directory.data ?? [],
      quests: quests.data ?? [],
      people: people.data ?? [],
      account: canonical,
      userId: context.userId,
    };
  });
export const saveAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        revision: z.number().int().nonnegative(),
        payload: accountSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as SupabaseClient<AppDatabase>;
    if (data.userId !== context.userId) throw new Error("Account changed; retry after signing in.");
    const result = await db.rpc("save_account_state", {
      expected_revision: data.revision,
      new_payload: data.payload as Json,
    });
    if (result.error?.code === "40001") return { conflict: true as const };
    if (result.error) throw new Error("Could not save account progress.");
    const { data: awards, error: awardError } = await db
      .from("xp_events")
      .select("kind, ref_id, xp, label, awarded_at")
      .eq("user_id", context.userId)
      .eq("active", true)
      .order("awarded_at", { ascending: false });
    if (awardError) throw new Error("Saved progress, but could not refresh XP. Sync will retry.");
    return { conflict: false as const, revision: result.data, awards: awards ?? [] };
  });
export const publishQuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    questSchema.and(z.object({ expectedUserId: z.string().uuid().optional() })).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as SupabaseClient<AppDatabase>;
    if (data.expectedUserId && data.expectedUserId !== context.userId)
      throw new Error("Account changed; quest was not published.");
    const { expectedUserId: _expected, ...quest } = data;
    const content = { ...quest, createdBy: context.userId };
    const result = await db.rpc("publish_quest", { quest_content: content as Json });
    if (result.error) throw new Error("Could not publish this quest.");
    return { ok: true };
  });
export const setDemoMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        squadId: z.string().uuid(),
        personId: z.string().startsWith("u_").max(100),
        remove: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as SupabaseClient<AppDatabase>;
    const { data: squad, error: squadError } = await db
      .from("squads")
      .select("id")
      .eq("id", data.squadId)
      .eq("leader_id", context.userId)
      .maybeSingle();
    if (squadError || !squad) throw new Error("Only the squad leader can edit demo members.");
    const result = data.remove
      ? await db
          .from("squad_demo_members")
          .delete()
          .eq("squad_id", data.squadId)
          .eq("person_id", data.personId)
      : await db
          .from("squad_demo_members")
          .upsert(
            { squad_id: data.squadId, person_id: data.personId },
            { onConflict: "squad_id,person_id", ignoreDuplicates: true },
          );
    if (result.error) throw new Error("Could not update this demo squadmate.");
    return { ok: true };
  });

export const syncSocial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        posts: z.array(postSchema).max(1000),
        hearted: accountSchema.shape.hearted,
        comments: accountSchema.shape.comments,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as SupabaseClient<AppDatabase>;
    if (data.userId !== context.userId)
      throw new Error("Account changed; activity was not uploaded.");
    const result = await db.rpc("sync_social", {
      posts: data.posts as Json,
      heart_ids: data.hearted,
      comments: data.comments as Json,
    });
    if (result.error)
      throw new Error("Could not sync feed activity. Your changes remain on this device.");
    return z.array(postSchema).parse(result.data);
  });

export const getRemoteQuest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as SupabaseClient<AppDatabase>;
    const result = await db
      .from("quests")
      .select("content,archived")
      .eq("id", data.id)
      .maybeSingle();
    if (result.error)
      throw new Error("Could not load this quest. Check your connection and try again.");
    return result.data
      ? {
          quest: questSchema.parse(result.data.content),
          archived: result.data.archived,
          userId: context.userId,
        }
      : null;
  });
