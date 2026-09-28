import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QuestSession = {
  id: string;
  quest_id: string;
  quest_title: string;
  location_name: string;
  starter_id: string;
  starter_name: string;
  member_ids: string[];
  started_at: string;
};

const startSchema = z.object({
  questId: z.string().min(1).max(100),
  questTitle: z.string().trim().min(1).max(140),
  locationName: z.string().trim().max(140).default(""),
  memberIds: z.array(z.string().uuid()).max(50).default([]),
});

/** Heads-out: record a live quest session for the starter and everyone included. */
export const startQuestSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => startSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Close any session you still have open so there's only one "right now".
    await (context.supabase as any)
      .from("quest_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("starter_id", context.userId)
      .is("ended_at", null);
    const { data: row, error } = await (context.supabase as any)
      .from("quest_sessions")
      .insert({
        quest_id: data.questId,
        quest_title: data.questTitle,
        location_name: data.locationName,
        starter_id: context.userId,
        member_ids: data.memberIds.filter((id) => id !== context.userId),
      })
      .select("id")
      .single();
    if (error || !row) throw new Error("Couldn't start the quest session.");
    return { id: row.id as string };
  });

/** The quest you're on right now (started by you or including you), if any. */
export const getActiveQuestSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QuestSession | null> => {
    const { data, error } = await (context.supabase as any)
      .from("quest_sessions")
      .select("id, quest_id, quest_title, location_name, starter_id, member_ids, started_at")
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) throw new Error("Couldn't load active quests.");
    const mine = (data ?? []).find(
      (row: { starter_id: string; member_ids: string[] }) =>
        row.starter_id === context.userId || row.member_ids.includes(context.userId),
    );
    if (!mine) return null;
    const { data: starter } = await context.supabase
      .from("profiles")
      .select("name, handle")
      .eq("id", mine.starter_id)
      .maybeSingle();
    return {
      ...(mine as Omit<QuestSession, "starter_name">),
      starter_name: (starter?.name as string) || (starter?.handle ? `@${starter.handle}` : "A friend"),
    };
  });

/** Wrap up: end a session you started. */
export const endQuestSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await (context.supabase as any)
      .from("quest_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("starter_id", context.userId);
    return { ok: true };
  });
