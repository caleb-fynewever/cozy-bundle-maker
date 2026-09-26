import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QuestMap } from "@/components/QuestMap";
import { Chip, SectionTitle, Tag } from "@/components/ui-kit";
import { CAMPUS_ORIGIN, currentTimeSlot, recommend } from "@/lib/engine";
import { QUESTS } from "@/data/quests";
import { useUserState } from "@/lib/store";
import { questImage } from "@/lib/imagery";
import { VIBE_EMOJI, VIBE_LABEL } from "@/lib/types";

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
    <AppShell>
      <SectionTitle kicker="Explore" title="Quests around you" />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Chip
            key={filter}
            active={filters.includes(filter)}
            onClick={() =>
              setFilters((current) =>
                current.includes(filter)
                  ? current.filter((f) => f !== filter)
                  : [...current, filter],
              )
            }
          >
            {filter}
          </Chip>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <QuestMap
          items={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
          origin={CAMPUS_ORIGIN}
        />

        <div className="space-y-3">
          {selected ? (
            <article className="overflow-hidden rounded-3xl border border-border bg-card">
              <img
                src={questImage(selected.quest)}
                alt={selected.quest.location.name}
                loading="lazy"
                width={1200}
                height={912}
                className="h-36 w-full object-cover"
              />
              <div className="space-y-3 p-4">
                <h3 className="text-xl font-bold">{selected.quest.title}</h3>
                <p className="text-sm text-muted-foreground">{selected.quest.hook}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  📍 {selected.distance.toFixed(1)} mi · ⏱ {selected.quest.durationMin} min · 🎲
                  Weirdness {selected.quest.weirdness}/5
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.quest.vibes.map((vibe) => (
                    <Tag key={vibe}>
                      {VIBE_EMOJI[vibe]} {VIBE_LABEL[vibe]}
                    </Tag>
                  ))}
                </div>
                <Link
                  to="/quest/$questId"
                  params={{ questId: selected.quest.id }}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-full acid-fill text-sm font-semibold text-primary-foreground"
                >
                  View quest →
                </Link>
              </div>
            </article>
          ) : (
            <p className="rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground">
              Pick a marker to preview a quest. Markers show approximate quest locations only, never
              anyone's live position.
            </p>
          )}

          <ul className="space-y-2">
            {filtered.slice(0, 8).map((item) => (
              <li key={item.quest.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.quest.id)}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 text-left ${
                    selectedId === item.quest.id ? "border-primary" : "border-border"
                  }`}
                >
                  <img
                    src={questImage(item.quest)}
                    alt=""
                    loading="lazy"
                    width={1200}
                    height={912}
                    className="h-9 w-9 rounded-lg object-cover"
                  />
                  <span className="flex-1 text-sm font-medium">{item.quest.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {item.distance.toFixed(1)} mi
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
