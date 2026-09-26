import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QuestMap, walkMinutes } from "@/components/QuestMap";
import { Chip } from "@/components/ui-kit";
import { CAMPUS_ORIGIN, currentTimeSlot, recommend } from "@/lib/engine";
import { QUESTS } from "@/data/quests";
import { useUserState } from "@/lib/store";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Explore nearby — wego" },
      {
        name: "description",
        content: "Find something close by to do right now: walkable side quests around campus, sorted by distance.",
      },
      { property: "og:title", content: "Explore nearby — wego" },
      { property: "og:description", content: "What's close right now — walkable student side quests around Minneapolis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});

const RANGES = [
  { key: "walk", label: "Walkable", mi: 1.2 },
  { key: "ride", label: "Short ride", mi: 3.5 },
  { key: "any", label: "Anywhere", mi: 50 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

function MapPage() {
  const state = useUserState();
  const [range, setRange] = useState<RangeKey>("ride");
  const [nowOnly, setNowOnly] = useState(true);
  const [freeOnly, setFreeOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const slot = currentTimeSlot();

  const { results } = useMemo(
    () =>
      recommend(
        {
          groupSize: Math.max(2, state.squadIds.length + 1),
          timeBudgetMin: 300,
          maxCost: null,
          vibes: [],
          chaos: 3,
          timeSlot: slot,
          origin: CAMPUS_ORIGIN,
          radiusMi: 50,
          squadIds: state.squadIds,
        },
        { ...state, passed: [] },
        [...state.createdQuests, ...QUESTS],
        60,
      ),
    [state, slot],
  );

  const maxMi = RANGES.find((r) => r.key === range)!.mi;
  const nearby = useMemo(
    () =>
      results
        .filter(({ quest, distance }) => {
          if (distance > maxMi) return false;
          if (nowOnly && !quest.bestTime.includes(slot)) return false;
          if (freeOnly && quest.costPerPerson > 0) return false;
          return true;
        })
        .sort((a, b) => a.distance - b.distance),
    [results, maxMi, nowOnly, freeOnly, slot],
  );
  const closest = nearby[0];

  return (
    <AppShell wide>
      <p className="mt-2 font-hand text-xl">what's close right now</p>
      <h1 className="text-3xl font-medium sm:text-4xl">Explore nearby</h1>
      <p className="mt-1 text-muted-foreground">
        {closest
          ? `Closest: ${closest.quest.title}, about ${walkMinutes(closest.distance)} min on foot.`
          : "Nothing this close. Widen the range."}
      </p>

      <div className="hide-scrollbar -mx-5 mt-4 flex items-center gap-2 overflow-x-auto px-5 pb-3" role="group" aria-label="Range and filters">
        {RANGES.map((r) => (
          <Chip key={r.key} active={range === r.key} onClick={() => setRange(r.key)}>
            {r.label}
          </Chip>
        ))}
        <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />
        <Chip active={nowOnly} onClick={() => setNowOnly((v) => !v)}>
          Good right now
        </Chip>
        <Chip active={freeOnly} onClick={() => setFreeOnly((v) => !v)}>
          Free
        </Chip>
      </div>

      <QuestMap items={nearby} selectedId={selectedId} onSelect={setSelectedId} />
      <p className="mt-3 text-sm text-muted-foreground">
        {nearby.length} {nearby.length === 1 ? "spot" : "spots"} nearby, closest first. Your spot is approximate.
      </p>
    </AppShell>
  );
}
