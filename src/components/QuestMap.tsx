import { lazy, Suspense } from "react";
import type { ScoredQuest } from "@/lib/engine";
import { questImage } from "@/lib/imagery";
import { ClientOnly, Link } from "@tanstack/react-router";
import { metaLine } from "@/components/QuestCard";

// Leaflet is browser-only: load it after hydration, never in the SSR bundle.
const QuestMapLeaflet = lazy(() => import("@/components/QuestMapLeaflet"));

/** OpenTopoMap view of every quest, with a quest strip to switch between. */
export function QuestMap({
  items,
  selectedId,
  onSelect,
}: {
  items: ScoredQuest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = items.find((i) => i.quest.id === selectedId) ?? items[0];

  if (!selected) {
    return (
      <div className="grid aspect-[16/10] w-full place-items-center rounded-2xl border border-border bg-surface">
        <p className="font-hand text-xl text-muted-foreground">nothing matches — loosen a filter</p>
      </div>
    );
  }

  const { lat, lng } = selected.quest.location;
  const full = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

  return (
    <div>
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-border bg-map-land sm:aspect-[16/9]">
        <ClientOnly fallback={<div className="absolute inset-0 grid place-items-center"><p className="font-hand text-xl text-muted-foreground">unfolding the map…</p></div>}>
          <Suspense fallback={<div className="absolute inset-0 grid place-items-center"><p className="font-hand text-xl text-muted-foreground">unfolding the map…</p></div>}>
            <QuestMapLeaflet items={items} selectedId={selected.quest.id} onSelect={onSelect} />
          </Suspense>
        </ClientOnly>
        <div className="absolute inset-x-3 bottom-3 z-[1001] rounded-xl border border-border bg-card p-4 sm:left-auto sm:w-80">
          <p className="font-hand text-base text-muted-foreground">{selected.quest.location.area}</p>
          <h2 className="text-lg font-semibold leading-tight">{selected.quest.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {metaLine(selected.distance, selected.quest.durationMin, selected.quest.costPerPerson)}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 text-sm font-medium">
            <Link
              to="/quest/$questId"
              params={{ questId: selected.quest.id }}
              className="inline-flex min-h-10 items-center rounded-full bg-foreground px-4 text-background"
            >
              See the quest
            </Link>
            <a href={full} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              Open full map ↗
            </a>
          </div>
        </div>
      </div>

      <div className="hide-scrollbar -mx-5 mt-4 flex gap-3 overflow-x-auto px-5 pb-2" role="list" aria-label="Quests on the map">
        {items.slice(0, 20).map((item) => {
          const active = item.quest.id === selected.quest.id;
          return (
            <button
              key={item.quest.id}
              type="button"
              role="listitem"
              onClick={() => onSelect(item.quest.id)}
              aria-pressed={active}
              className={`flex min-h-14 w-60 shrink-0 items-center gap-3 rounded-xl border bg-card p-2 text-left transition-colors ${
                active ? "border-foreground" : "border-border hover:border-foreground/40"
              }`}
            >
              <img src={questImage(item.quest)} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{item.quest.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.quest.location.area} · {item.distance.toFixed(1)} mi
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
