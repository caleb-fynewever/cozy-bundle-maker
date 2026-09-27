import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RemoteInvite = {
  id: string;
  squad_key: string;
  squad_name: string;
  inviter_id: string;
  inviter_name: string;
  invitee_email: string;
  invitee_id: string | null;
  invitee_name: string | null;
  status: string;
  created_at: string;
};

const sendSchema = z.object({
  squadKey: z.string().min(1).max(100),
  squadName: z.string().trim().min(1).max(60),
  inviterName: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(254),
});

export const sendSquadInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => sendSchema.parse(data))
  .handler(async ({ data, context }) => {
    const myEmail = String(context.claims.email ?? "").toLowerCase();
    if (myEmail && myEmail === data.email) throw new Error("That's your own email.");

    const { data: existing } = await context.supabase
      .from("squad_invites")
      .select("id")
      .eq("inviter_id", context.userId)
      .eq("squad_key", data.squadKey)
      .eq("invitee_email", data.email)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return { ok: true, emailed: false, already: true };

    const { data: invite, error } = await context.supabase
      .from("squad_invites")
      .insert({
        squad_key: data.squadKey,
        squad_name: data.squadName,
        inviter_id: context.userId,
        inviter_name: data.inviterName,
        invitee_email: data.email,
      })
      .select("id")
      .single();
    if (error || !invite) throw new Error("Couldn't send that invite. Try again.");

    let emailed = false;
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const result = await sendTemplateEmail("squad-invite", data.email, {
        templateData: { inviterName: data.inviterName, squadName: data.squadName, link: "https://wegoquests.com/squad" },
        idempotencyKey: `squad-invite-${invite.id}`,
      });
      emailed = result.sent;
    } catch (err) {
      console.error("squad invite email failed", err);
    }
    return { ok: true, emailed, already: false };
  });

export const listSquadInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("squad_invites")
      .select("id, squad_key, squad_name, inviter_id, inviter_name, invitee_email, invitee_id, invitee_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Couldn't load invites.");
    const myEmail = String(context.claims.email ?? "").toLowerCase();
    const rows = (data ?? []) as RemoteInvite[];
    return {
      received: rows.filter((r) => r.status === "pending" && r.invitee_email.toLowerCase() === myEmail && r.inviter_id !== context.userId),
      sent: rows.filter((r) => r.inviter_id === context.userId),
    };
  });

export const respondSquadInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), accept: z.boolean(), name: z.string().trim().min(1).max(60) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("squad_invites")
      .update({
        status: data.accept ? "accepted" : "declined",
        invitee_id: context.userId,
        invitee_name: data.name,
        responded_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pending")
      .select("id, squad_key, squad_name, inviter_id, inviter_name")
      .maybeSingle();
    if (error || !row) throw new Error("That invite isn't available anymore.");
    return row;
  });
