import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bookmark, ChevronDown, Clock, DollarSign, MapPin, Sparkles, Users } from "lucide-react";
import type { ScoredQuest } from "@/lib/engine";
import { VIBE_EMOJI, VIBE_LABEL } from "@/lib/types";
import { questImage } from "@/lib/imagery";
import { actions, useUserState } from "@/lib/store";
import { ScoreRing, Tag } from "@/components/ui-kit";

export function WhyPanel({ item }: { item: ScoredQuest }) {
  const [open, setOpen] = useState(false);
  const rows = [
    ["Preference match", item.breakdown.preference],
    ["Context fit", item.breakdown.context],
    ["Squad overlap", item.breakdown.social],
    ["Proximity", item.breakdown.proximity],
    ["Novelty", item.breakdown.novelty],
  ] as const;

  return (
    <div className="rounded-2xl border border-border bg-surface/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-sm font-semibold"
      >
        Why this quest?
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {item.reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span aria-hidden className="text-primary">
                  ✓
                </span>
                {reason}
              </li>
            ))}
          </ul>
          <dl className="space-y-2">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center gap-3">
                <dt className="w-32 shrink-0 text-xs text-muted-foreground">{label}</dt>
                <dd className="flex-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full acid-fill"
                      style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
                    />
                  </div>
                </dd>
                <dd className="w-10 text-right font-mono text-xs text-muted-foreground">
                  {Math.round(Math.max(0, Math.min(1, value)) * 100)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

export function QuestMeta({ item }: { item: ScoredQuest }) {
  const { quest } = item;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <MapPin aria-hidden className="h-3.5 w-3.5" />
        {item.distance.toFixed(1)} mi · {quest.location.name}
      </li>
      <li className="flex items-center gap-1.5">
        <Clock aria-hidden className="h-3.5 w-3.5" />
        {quest.durationMin} min
      </li>
      <li className="flex items-center gap-1.5">
        <DollarSign aria-hidden className="h-3.5 w-3.5" />
        {quest.costPerPerson === 0 ? "Free" : `$${quest.costPerPerson}/person`}
      </li>
      <li className="flex items-center gap-1.5">
        <Users aria-hidden className="h-3.5 w-3.5" />
        {quest.groupMin}-{quest.groupMax}
      </li>
      <li>🎲 {quest.weirdness}/5</li>
      <li>🔥 {quest.adventure}/5</li>
    </ul>
  );
}

export function QuestCard({ item, featured = false }: { item: ScoredQuest; featured?: boolean }) {
  const state = useUserState();
  const { quest } = item;
  const saved = state.saved.includes(quest.id);

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card lift">
      <Link
        to="/quest/$questId"
        params={{ questId: quest.id }}
        className="block"
        aria-label={`Open ${quest.title}`}
      >
        <div className="relative">
          <img
            src={questImage(quest)}
            alt={`${quest.location.name}, ${quest.location.area}`}
            loading={featured ? undefined : "lazy"}
            width={1200}
            height={912}
            className={`w-full object-cover ${featured ? "h-56 sm:h-72" : "h-40"}`}
          />
          <div aria-hidden className="absolute inset-0 night-fade" />
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            {item.isNew ? (
              <Tag tone="primary">
                <Sparkles aria-hidden className="h-3 w-3" /> New for you
              </Tag>
            ) : null}
            <Tag tone="muted">{quest.location.area}</Tag>
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
            <h3 className={`font-bold ${featured ? "text-2xl sm:text-3xl" : "text-lg"}`}>
              {quest.title}
            </h3>
            <ScoreRing score={item.score} size={featured ? 64 : 52} />
          </div>
        </div>
      </Link>

      <div className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">{quest.hook}</p>
        <div className="flex flex-wrap gap-1.5">
          {quest.vibes.map((vibe) => (
            <Tag key={vibe}>
              {VIBE_EMOJI[vibe]} {VIBE_LABEL[vibe]}
            </Tag>
          ))}
        </div>
        <QuestMeta item={item} />
        <WhyPanel item={item} />
        <div className="flex gap-2">
          <Link
            to="/quest/$questId"
            params={{ questId: quest.id }}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full acid-fill text-sm font-semibold text-primary-foreground"
          >
            View mission
          </Link>
          <button
            type="button"
            onClick={() => actions.toggleSave(quest.id)}
            aria-pressed={saved}
            aria-label={saved ? `Remove ${quest.title} from saved` : `Save ${quest.title}`}
            className={`grid min-h-12 w-12 place-items-center rounded-full border ${
              saved ? "border-primary text-primary" : "border-border text-muted-foreground"
            }`}
          >
            <Bookmark aria-hidden className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            onClick={() => actions.pass(quest.id)}
            aria-label={`Pass on ${quest.title}`}
            className="min-h-12 rounded-full border border-border px-4 text-sm text-muted-foreground"
          >
            Pass
          </button>
        </div>
      </div>
    </article>
  );
}
