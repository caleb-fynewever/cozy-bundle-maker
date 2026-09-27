import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { actions, useUserState } from "@/lib/store";
import { buttonClass, textButtonClass } from "@/components/ui-kit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Invite someone to a squad. The button opens a picker of the squads you lead; choosing one
 * sends the invite there. Rows for squads they're already in (or already invited to) say so
 * instead of sending a second invite.
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
  const [open, setOpen] = useState(false);
  const ledSquads = state.squads.filter((squad) => squad.leaderId === "me");
  const inAny = state.squads.some((squad) => squad.memberIds.includes(personId));

  if (state.squads.length && inAny && !ledSquads.length) {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(buttonClass({ variant: "outline", size: "sm", full }), "min-w-32", className)}
          aria-label={`Invite ${name} to a squad`}
        >
          <span className="inline-flex items-center gap-1.5">
            <UserPlus aria-hidden className="h-4 w-4" />
            Invite
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite {name}</DialogTitle>
          <DialogDescription>Pick which squad to invite them to.</DialogDescription>
        </DialogHeader>
        {ledSquads.length ? (
          <ul className="mt-2 space-y-2">
            {ledSquads.map((squad) => {
              const member = squad.memberIds.includes(personId);
              const sent = state.squadInvites.some(
                (invite) =>
                  invite.personId === personId &&
                  invite.squadId === squad.id &&
                  invite.direction === "sent",
              );
              return (
                <li key={squad.id}>
                  <button
                    type="button"
                    disabled={member || sent}
                    onClick={() => {
                      actions.inviteSquadMember(personId, name, squad.id);
                      toast(`Invite to ${squad.name} sent to ${name}.`);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-left transition-colors",
                      member || sent
                        ? "cursor-default text-muted-foreground"
                        : "hover:bg-surface active:scale-[0.99]",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{squad.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {squad.memberIds.length}{" "}
                        {squad.memberIds.length === 1 ? "member" : "members"}
                      </span>
                    </span>
                    {member ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm">
                        <Check aria-hidden className="h-4 w-4 text-ring" strokeWidth={2.5} />
                        In squad
                      </span>
                    ) : sent ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm">
                        <Check aria-hidden className="h-4 w-4 text-ring" strokeWidth={2.5} />
                        Sent
                      </span>
                    ) : (
                      <span className="shrink-0 text-sm font-semibold text-ring">Invite</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            You don't lead a squad yet.{" "}
            <Link to="/squad" className={textButtonClass} onClick={() => setOpen(false)}>
              Make one on the Squad page
            </Link>
            .
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
