import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PublicProfile = {
  id: string;
  handle: string;
  name: string;
  bio: string;
  avatar_url: string | null;
};

const syncSchema = z.object({
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{2,24}$/),
  name: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(160),
  avatarUrl: z.string().max(400_000).nullable(),
});

/** Upserts the signed-in user's public profile so friends can find them. */
export const syncProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => syncSchema.parse(data))
  .handler(async ({ data, context }) => {
    const email = String(context.claims.email ?? "").toLowerCase();
    const { data: taken } = await context.supabase
      .from("profiles")
      .select("id")
      .ilike("handle", data.handle)
      .neq("id", context.userId)
      .maybeSingle();
    if (taken) throw new Error(`@${data.handle} is taken. Try another handle.`);
    const { error } = await context.supabase.from("profiles").upsert({
      id: context.userId,
      handle: data.handle,
      name: data.name,
      bio: data.bio,
      avatar_url: data.avatarUrl,
      email,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Couldn't save your profile. Try again.");
    return { ok: true };
  });

/** Returns the signed-in user's own profile, or null if they never set one up. */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: row, error } = await context.supabase
      .from("profiles")
      .select("id, handle, name, bio, avatar_url")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Couldn't load your profile. Try again.");
    return (row ?? null) as PublicProfile | null;
  });

/** Looks up one profile by handle. Returns null when nobody has it. */
export const findProfileByHandle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ handle: z.string().trim().toLowerCase().min(2).max(24) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("profiles")
      .select("id, handle, name, bio, avatar_url")
      .ilike("handle", data.handle)
      .maybeSingle();
    if (error) throw new Error("Couldn't look that up. Try again.");
    return (row ?? null) as PublicProfile | null;
  });
