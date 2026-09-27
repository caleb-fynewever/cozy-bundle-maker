import { useRef } from "react";
import { Doodle } from "@/components/Doodle";
import { Bookmark, Stamp as StampIcon } from "lucide-react";
import type { ScoredQuest } from "@/lib/engine";
import { questImage } from "@/lib/imagery";
import { QuestMeta, reasonLine } from "@/components/QuestCard";
import { Button, TextButton } from "@/components/ui-kit";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { QuestDirections, RouteStops } from "@/components/QuestDirections";
import { CAMPUS_ORIGIN } from "@/lib/engine";
import { useUserState } from "@/lib/store";
import { reducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/*
 * The postcard, opened. On laptops and tablets it is a centred sheet of paper with the same
 * corners as the deck card; on phones it rises from the bottom edge like a sheet. One surface
 * (white paper), one main action (Let's go).
 */
const SHEET = cn(
  "flex h-[min(88dvh,850px)] max-h-[92dvh] max-w-2xl flex-col gap-0 overflow-hidden border-border-strong bg-card p-0 sm:rounded-lg",
  "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-xl max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0",
  "max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=closed]:slide-out-to-bottom",
);

// The dialog's own close button sits on the photo here, so it becomes a paper disc you can see on
// a bright sky, with a full 44px target. It is the sheet's only X: Pass below is a word.
const CLOSE_ON_PHOTO =
  "[&>button:last-child]:right-3 [&>button:last-child]:top-3 [&>button:last-child]:size-11 [&>button:last-child]:rounded-full [&>button:last-child]:border [&>button:last-child]:border-border-strong [&>button:last-child]:bg-card [&>button:last-child]:text-foreground [&>button:last-child]:hover:bg-surface [&>button:last-child_svg]:size-[18px]";

/* Pass and Save: the deck's secondary look (paper, ink edge). Labels stay on phones too. */
const SECONDARY = "max-sm:gap-1.5 max-sm:px-2 sm:px-4";

export function QuestPreviewDialog({
  item,
  open,
  onOpenChange,
  onPass,
  onSave,
  onAlreadyDone,
  onGo,
  onReturnFocus,
  onClosed,
}: {
  item: ScoredQuest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPass: () => void;
  onSave: () => void;
  /** "Already did this one?": log a quest you've done before; the deck stamps its postcard. */
  onAlreadyDone: () => void;
  onGo: () => void;
  /** Where focus goes when the sheet closes (the deck's new top card, since the old one may be gone). */
  onReturnFocus?: () => void;
  /** The sheet has finished closing (its exit is over), so what's under it can be seen again. */
  onClosed?: () => void;
}) {
  const { quest } = item;
  const state = useUserState();
  const origin = state.approximateLocation ?? CAMPUS_ORIGIN;
  const title = useRef<HTMLHeadingElement>(null);
  const photo = useRef<HTMLImageElement>(null);

  function go() {
    // Name the photo just before leaving so it can morph into the plan's photo (View Transitions).
    if (photo.current && !reducedMotion()) photo.current.style.setProperty("view-transition-name", "quest-photo");
    onGo();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(SHEET, CLOSE_ON_PHOTO)}
        // Open on the title, not on Pass: a stray Enter shouldn't throw the quest away.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          title.current?.focus({ preventScroll: true });
        }}
        // Runs once the exit animation has finished and the sheet is gone.
        onCloseAutoFocus={(event) => {
          if (onReturnFocus) {
            event.preventDefault();
            onReturnFocus();
          }
          onClosed?.();
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <img ref={photo} src={questImage(quest)} alt={`${quest.location.name}, ${quest.location.area}`} className="aspect-[16/9] w-full bg-muted object-cover" />
          <div className="px-5 pb-8 pt-5 sm:px-8 sm:pt-7">
            <p className="font-hand text-lg leading-snug text-foreground/75 sm:text-xl">{reasonLine(item)}</p>
            <DialogTitle
              ref={title}
              tabIndex={-1}
              className="mt-1 text-balance text-3xl font-semibold leading-[1.1] tracking-[-0.015em] outline-none sm:text-4xl"
            >
              {quest.title}
            </DialogTitle>
            <QuestMeta item={item} className="mt-3 text-sm text-muted-foreground" />
            <DialogDescription className="mt-4 text-pretty text-base leading-relaxed text-foreground">{quest.hook}</DialogDescription>
            <section className="mt-7 border-t border-border pt-5">
              {/* A margin note, like "the way there" below: handwriting labels, it doesn't headline. */}
              <h3 className="font-hand text-[17px] font-normal leading-tight text-muted-foreground">the quest</h3>
              <p className="mt-2 text-pretty leading-relaxed">{quest.mission}</p>
              {/* The same stops on a walk as the quest page and Let's go, one tap on. */}
              <RouteStops steps={quest.steps} className="mt-5" />
            </section>
            <QuestDirections destination={quest.location} origin={origin} className="mt-7 border-t border-border pt-5" />
          </div>
        </div>
        {/*
          The same decision as the deck, Pass and Save side by side, then Let's go, the one clover
          action. "Already did this one?" is the quiet way to log a quest you've done before: it
          stamps the postcard. Phones: it's a line above the buttons, which stay one row within the
          thumb's reach. Wider: one row, the quiet action at the start, the buttons at the end.
        */}
        <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.45fr)] gap-x-2 border-t border-border bg-card px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-1 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center sm:gap-x-2.5 sm:px-5 sm:pb-4 sm:pt-4">
          <TextButton onClick={onAlreadyDone} className="col-span-3 mb-1 justify-self-start px-1 sm:col-span-1 sm:mb-0 sm:-ml-1">
            <StampIcon aria-hidden className="size-4" strokeWidth={1.75} />
            Already did this one?
            <span className="sr-only"> Stamp it as done.</span>
          </TextButton>
          <Button variant="outline" onClick={onPass} className={cn(SECONDARY, "text-muted-foreground hover:text-foreground")}>
            Pass
          </Button>
          <Button variant="outline" onClick={onSave} className={SECONDARY}>
            <Bookmark aria-hidden className="size-[18px]" strokeWidth={1.75} />
            Save
          </Button>
          <Button onClick={go} className="max-sm:gap-1.5 max-sm:px-3">
            <Doodle name="steps" size={20} /> Let&rsquo;s go
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
