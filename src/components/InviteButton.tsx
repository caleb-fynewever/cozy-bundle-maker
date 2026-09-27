import { Check, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { actions, useUserState } from "@/lib/store";
import { buttonClass } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

/**
 * Invite someone to your squad. The button knows the relationship: Invite, then (morphing in
 * place, with a check that draws itself) Sent. It stays the same button, so keyboard focus stays
 * on it. Someone already in your squad gets a quiet note instead of a button that does nothing.
 */
export function InviteButton({
  personId,
  name,
  className,
  full = false,
}: {
  personId: string;
  name: string;
  className?: string;
  full?: boolean;
}) {
  const state = useUserState();
  const activeSquad = state.squads.find((squad) => squad.id === state.activeSquadId);
  const inSquad = activeSquad?.memberIds.includes(personId);
  const sent = state.squadInvites.some(
    (invite) =>
      invite.personId === personId &&
      invite.squadId === activeSquad?.id &&
      invite.direction === "sent",
  );

  if (inSquad) {
    return (
      <span
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground",
          className,
        )}
      >
        <Check aria-hidden className="h-4 w-4 text-ring" strokeWidth={2.5} />
        In your squad
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-disabled={sent || undefined}
      onClick={() => {
        if (sent) return;
        if (!activeSquad || activeSquad.leaderId !== "me") {
          toast.error("Choose a squad you lead on the Squad page first.");
          return;
        }
        actions.inviteSquadMember(personId, name);
        toast(`Invite sent to ${name}.`);
      }}
      className={cn(
        buttonClass({ variant: "outline", size: "sm", full }),
        "min-w-32",
        sent && "cursor-default border-border bg-surface hover:bg-surface active:scale-100",
        className,
      )}
      aria-label={sent ? `Invite sent to ${name}` : `Invite ${name} to your squad`}
    >
      <span
        key={sent ? "sent" : "invite"}
        className={cn("inline-flex items-center gap-1.5", sent && "morph-in")}
      >
        {sent ? (
          <Check aria-hidden className="draw-check h-4 w-4 text-ring" strokeWidth={2.5} />
        ) : (
          <UserPlus aria-hidden className="h-4 w-4" />
        )}
        {sent ? "Sent" : "Invite"}
      </span>
    </button>
  );
}
