import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QuestMap } from "@/components/QuestMap";
import { X } from "lucide-react";
import { Chip } from "@/components/ui-kit";
import { metaLine } from "@/components/QuestCard";
import { CAMPUS_ORIGIN, currentTimeSlot, recommend } from "@/lib/engine";
import { QUESTS } from "@/data/quests";
import { useUserState } from "@/lib/store";
import { questImage } from "@/lib/imagery";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Explore the map — Side Quest" },
      {
        name: "description",
        content:
          "See every nearby side quest around campus and the lakes, filter by tonight, free, quick or weird, and open the mission.",
      },
      { property: "og:title", content: "Explore the map — Side Quest" },
      {
        property: "og:description",
        content: "Nearby student side quests plotted around Minneapolis, filterable by time, cost and vibe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});

const FILTERS = ["Tonight", "Free", "Under 30 min", "Weird", "Food", "Outdoor"] as const;
type Filter = (typeof FILTERS)[number];

function MapPage() {
  const state = useUserState();
  const [filters, setFilters] = useState<Filter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { results } = useMemo(
    () =>
      recommend(
        {
          groupSize: Math.max(2, state.squadIds.length + 1),
          timeBudgetMin: 300,
          maxCost: null,
          vibes: [],
          chaos: 3,
          timeSlot: currentTimeSlot(),
          origin: CAMPUS_ORIGIN,
          radiusMi: 10,
          squadIds: state.squadIds,
        },
        { ...state, passed: [] },
        [...state.createdQuests, ...QUESTS],
        60,
      ),
    [state],
  );

  const filtered = useMemo(
    () =>
      results.filter(({ quest }) =>
        filters.every((filter) => {
          switch (filter) {
            case "Tonight":
              return quest.bestTime.includes("evening") || quest.bestTime.includes("late");
            case "Free":
              return quest.costPerPerson === 0;
            case "Under 30 min":
              return quest.durationMin <= 30;
            case "Weird":
              return quest.vibes.includes("weird");
            case "Food":
              return quest.vibes.includes("food");
            case "Outdoor":
              return !quest.indoor;
            default:
              return true;
          }
        }),
      ),
    [results, filters],
  );

  const selected = filtered.find((item) => item.quest.id === selectedId) ?? null;

  return (
    <AppShell wide>
      <h1 className="sr-only">Quests on the map</h1>
      <div className="hide-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-3" role="group" aria-label="Filters">
        {FILTERS.map((filter) => (
          <Chip
            key={filter}
            active={filters.includes(filter)}
            onClick={() =>
              setFilters((current) =>
                current.includes(filter) ? current.filter((f) => f !== filter) : [...current, filter],
              )
            }
          >
            {filter}
          </Chip>
        ))}
      </div>

      <div className="relative">
        <QuestMap items={filtered} selectedId={selectedId} onSelect={setSelectedId} origin={CAMPUS_ORIGIN} />
        {selected ? (
          <div
            role="dialog"
            aria-label={selected.quest.title}
             className="sheet absolute inset-x-3 bottom-3 z-40 flex items-center gap-4 border border-foreground bg-card p-3 sm:left-auto sm:w-96"
          >
            <img
              src={questImage(selected.quest)}
              alt=""
              width={1200}
              height={912}
               className="h-20 w-20 shrink-0 object-cover"
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold">{selected.quest.title}</h2>
              <p className="text-sm text-muted-foreground">
                {metaLine(selected.distance, selected.quest.durationMin, selected.quest.costPerPerson)}
              </p>
              <Link
                to="/quest/$questId"
                params={{ questId: selected.quest.id }}
                className="mt-1 inline-flex min-h-9 items-center text-sm font-semibold text-primary"
              >
                View quest →
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Close"
              className="grid h-10 w-10 shrink-0 place-items-center self-start rounded-full text-muted-foreground hover:bg-surface"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {filtered.length} quests nearby. Your spot is approximate.
      </p>
    </AppShell>
  );
}
