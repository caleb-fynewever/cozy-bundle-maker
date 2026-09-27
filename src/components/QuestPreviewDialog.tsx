import { Bookmark, Footprints, X } from "lucide-react";
import type { ScoredQuest } from "@/lib/engine";
import { questImage } from "@/lib/imagery";
import { metaLine } from "@/components/QuestCard";
import { Button } from "@/components/ui-kit";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { QuestRouteMap } from "@/components/QuestRouteMap";
import { CAMPUS_ORIGIN } from "@/lib/engine";
import { useUserState } from "@/lib/store";

export function QuestPreviewDialog({
  item,
  open,
  onOpenChange,
  onPass,
  onSave,
  onGo,
}: {
  item: ScoredQuest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPass: () => void;
  onSave: () => void;
  onGo: () => void;
}) {
  const { quest } = item;
  const state = useUserState();
  const origin = state.approximateLocation ?? CAMPUS_ORIGIN;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92dvh,850px)] max-h-[92dvh] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border-border-strong p-0 sm:h-[min(88dvh,850px)]">
        <div className="min-h-0 flex-1 overflow-y-auto">
        <img src={questImage(quest)} alt={`${quest.location.name}, ${quest.location.area}`} className="aspect-[16/9] w-full bg-muted object-cover" />
        <div className="p-5 sm:p-8">
          <p className="font-hand text-lg text-muted-foreground">{quest.location.area} · {metaLine(item.distance, quest.durationMin, quest.costPerPerson)}</p>
          <DialogTitle className="mt-2 pr-7 text-3xl leading-tight sm:text-4xl">{quest.title}</DialogTitle>
          <DialogDescription className="mt-3 text-base leading-relaxed text-foreground">{quest.hook}</DialogDescription>
          <section className="mt-6 border-t border-border pt-5">
            <h3 className="font-hand text-xl">the quest</h3>
            <p className="mt-2 leading-relaxed">{quest.mission}</p>
            <ol className="mt-4 space-y-3">
              {quest.steps.map((step, index) => (
                <li key={`${index}-${step}`} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 leading-relaxed">
                  <span className="font-hand text-xl">{index + 1}.</span><span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
          <QuestRouteMap destination={quest.location} origin={origin} />
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${quest.location.lat},${quest.location.lng}`}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
          >
            {quest.location.name} · open in Maps
          </a>
        </div>
        </div>
        <div className="relative z-10 flex shrink-0 flex-wrap justify-between gap-2 border-t border-border bg-card/95 p-3 backdrop-blur sm:p-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onPass} ariaLabel="Not now"><X aria-hidden className="h-4 w-4" /> Not now</Button>
            <Button variant="outline" onClick={onSave} ariaLabel="Save for later"><Bookmark aria-hidden className="h-4 w-4" /> Save</Button>
          </div>
          <Button onClick={onGo}><Footprints aria-hidden className="h-5 w-5" /> Let&apos;s go</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
