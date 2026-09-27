import { Clock, MapPin, Wallet } from "lucide-react";
import type { ScoredQuest } from "@/lib/engine";
import { cn } from "@/lib/utils";

/*
 * Quest copy shared by the deck, the preview sheet, the quest page and the map: why it showed up,
 * and its address line. (The old list-card component lived here; nothing uses it any more.)
 */

/** One human sentence for why a quest showed up. No numbers. */
export function reasonLine(item: ScoredQuest): string {
  const b = item.breakdown;
  if (item.isNew && b.novelty > 0.6) return "A little outside your usual.";
  if (b.social > 0.65) return "Your squad would be into this.";
  if (b.preference > 0.7) return "Feels like your kind of thing.";
  if (b.proximity > 0.8) return "Basically around the corner.";
  return item.reasons[0] ?? "Picked for you.";
}

export function metaLine(distance: number, durationMin: number, cost: number) {
  return `${distance.toFixed(1)} mi · ${durationMin} min · ${cost === 0 ? "Free" : `$${cost}`}`;
}

/**
 * A postcard's address line: where, how long, what it costs. Small line icons and tabular figures
 * so 0.3 mi and 1.2 mi don't jitter from card to card. Style the colour and size from outside.
 * `lines` writes it the way the back of a postcard does: one ruled line each for the place, the
 * time and the cost (the landscape deck card, where the copy half has the room).
 */
export function QuestMeta({ item, lines = false, className }: { item: ScoredQuest; lines?: boolean; className?: string }) {
  const { quest } = item;
  const icon = "size-3.5 shrink-0 opacity-80";
  const cost = quest.costPerPerson === 0 ? "Free" : `$${quest.costPerPerson}`;

  if (lines) {
    const row = "flex min-w-0 items-center gap-2 border-b border-border py-2.5";
    return (
      <div className={cn("tabular-nums", className)}>
        <p className={row}>
          <MapPin aria-hidden className={icon} strokeWidth={1.75} />
          <span className="min-w-0 truncate">
            {quest.location.name} · {quest.location.area}
          </span>
          <span className="sr-only">, </span>
          <span className="ml-auto shrink-0 pl-3">{item.distance.toFixed(1)} mi</span>
        </p>
        <p className={row}>
          <Clock aria-hidden className={icon} strokeWidth={1.75} />
          {quest.durationMin} min
        </p>
        <p className={row}>
          <Wallet aria-hidden className={icon} strokeWidth={1.75} />
          {cost}
        </p>
      </div>
    );
  }

  return (
    <p className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums", className)}>
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <MapPin aria-hidden className={icon} strokeWidth={1.75} />
        <span className="truncate">
          {quest.location.area} · {item.distance.toFixed(1)} mi
        </span>
      </span>
      <span className="sr-only">, </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock aria-hidden className={icon} strokeWidth={1.75} />
        {quest.durationMin} min
      </span>
      <span className="sr-only">, </span>
      <span className="inline-flex items-center gap-1.5">
        <Wallet aria-hidden className={icon} strokeWidth={1.75} />
        {cost}
      </span>
    </p>
  );
}
