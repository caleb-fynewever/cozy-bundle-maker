import { Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import type { ScoredQuest } from "@/lib/engine";
import { questImage } from "@/lib/imagery";
import { actions, useUserState } from "@/lib/store";

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

/** Kept for the quest page: a quiet list of plain-language reasons. */
export function WhyPanel({ item }: { item: ScoredQuest }) {
  return (
    <ul className="space-y-1.5 text-sm text-muted-foreground">
      {item.reasons.slice(0, 3).map((reason) => (
        <li key={reason}>— {reason}</li>
      ))}
    </ul>
  );
}

export function QuestCard({
  item,
  featured = false,
  label,
}: {
  item: ScoredQuest;
  featured?: boolean;
  label?: string;
}) {
  const state = useUserState();
  const { quest } = item;
  const saved = state.saved.includes(quest.id);

  return (
     <article className="group min-w-0">
      <Link to="/quest/$questId" params={{ questId: quest.id }} className="block">
          <div className="overflow-hidden rounded-md border border-border-strong bg-card p-1.5 transition-transform duration-300 group-hover:-translate-y-1 group-hover:lift">
          <img
            src={questImage(quest)}
            alt={`${quest.location.name}, ${quest.location.area}`}
            loading={featured ? undefined : "lazy"}
            width={1200}
            height={912}
             className={`w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] ${
               featured ? "aspect-[16/10]" : "aspect-[4/3]"
            }`}
          />
        </div>
      </Link>
       <div className="mt-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
            {label ? <p className="mb-2 font-hand text-xl text-foreground">{label}</p> : null}
          <Link to="/quest/$questId" params={{ questId: quest.id }}>
              <h3 className={`font-medium leading-tight ${featured ? "text-2xl sm:text-3xl" : "text-xl"}`}>
              {quest.title}
            </h3>
          </Link>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{quest.hook}</p>
          <p className="mt-3 text-sm font-medium">
            {metaLine(item.distance, quest.durationMin, quest.costPerPerson)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{reasonLine(item)}</p>
        </div>
        <button
          type="button"
          onClick={() => actions.toggleSave(quest.id)}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${quest.title} from saved` : `Save ${quest.title}`}
          className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <Bookmark aria-hidden className="h-5 w-5" fill={saved ? "currentColor" : "none"} strokeWidth={1.75} />
        </button>
      </div>
    </article>
  );
}
