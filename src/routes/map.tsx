import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QuestMap } from "@/components/QuestMap";
import { Chip } from "@/components/ui-kit";
import { CAMPUS_ORIGIN, currentTimeSlot, recommend } from "@/lib/engine";
import { QUESTS } from "@/data/quests";
import { useUserState } from "@/lib/store";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Explore the map — wego" },
      {
        name: "description",
        content:
          "See every nearby side quest around campus and the lakes, filter by tonight, free, quick or weird, and open the mission.",
      },
      { property: "og:title", content: "Explore the map — wego" },
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


  return (
    <AppShell wide>
       <h1 className="mb-4 text-3xl font-medium">Around you <span className="font-hand text-xl">↗</span></h1>
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

      <QuestMap items={filtered} selectedId={selectedId} onSelect={setSelectedId} />
      <p className="mt-3 text-sm text-muted-foreground">
        {filtered.length} quests nearby. Your spot is approximate.
      </p>
    </AppShell>
  );
}
