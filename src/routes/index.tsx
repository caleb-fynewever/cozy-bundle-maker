import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SwipeDeck } from "@/components/SwipeDeck";
import { Button, Chip } from "@/components/ui-kit";
import { currentTimeSlot, recommend } from "@/lib/engine";
import { QUESTS } from "@/data/quests";
import { NEARBY_STUDENTS } from "@/data/people";
import { useUserState } from "@/lib/store";
import { VIBES, VIBE_LABEL, type SessionContext, type Vibe } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "wego — What's the move tonight?" },
      {
        name: "description",
        content:
          "wego turns 'what should we do?' into a real plan. Tell it your group, time, budget and mood, and it builds a personalized mission near you.",
      },
      { property: "og:title", content: "wego — What's the move tonight?" },
      {
        property: "og:description",
        content:
          "Personalized side quests for students: your group, your budget, your neighborhood, one actual plan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Discover,
});

const GROUPS = [
  { label: "Solo", value: 1 },
  { label: "2 people", value: 2 },
  { label: "3 people", value: 3 },
  { label: "4+ people", value: 4 },
];

const TIMES = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "All afternoon", value: 240 },
  { label: "All night", value: 300 },
];

const BUDGETS = [
  { label: "Free", value: 0 },
  { label: "Under $10", value: 10 },
  { label: "Under $25", value: 25 },
  { label: "Doesn't matter", value: null },
];

const CHAOS_LABEL = ["Keep it easy", "Mild", "Curious", "Bold", "Unhinged"];

const AREAS = [
  { label: "East Bank, UMN", lat: 44.9741, lng: -93.2277 },
  { label: "Dinkytown", lat: 44.9807, lng: -93.2355 },
  { label: "Downtown", lat: 44.9762, lng: -93.2716 },
  { label: "Uptown", lat: 44.9485, lng: -93.2977 },
  { label: "Northeast", lat: 45.0001, lng: -93.2472 },
];

function Discover() {
  const state = useUserState();
  const [groupSize, setGroupSize] = useState(3);
  const [timeBudgetMin, setTimeBudget] = useState(90);
  const [maxCost, setMaxCost] = useState<number | null>(25);
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [chaos, setChaos] = useState(3);
  const [area, setArea] = useState(AREAS[0]!);
  const [radiusMi, setRadius] = useState(3);
  const [adjusting, setAdjusting] = useState(false);

  const context: SessionContext = useMemo(
    () => ({
      groupSize,
      timeBudgetMin,
      maxCost,
      vibes,
      chaos,
      timeSlot: currentTimeSlot(),
      origin: { lat: area.lat, lng: area.lng, label: area.label },
      radiusMi,
      squadIds: state.squadIds,
    }),
    [groupSize, timeBudgetMin, maxCost, vibes, chaos, area, radiusMi, state.squadIds],
  );

  const allQuests = useMemo(() => [...state.createdQuests, ...QUESTS], [state.createdQuests]);
  // Passed quests aren't gone: they come back after everything fresh, oldest pass first.
  const { results } = useMemo(() => recommend(context, { ...state, passed: [] }, allQuests, allQuests.length), [context, state, allQuests]);
  const deck = useMemo(() => {
    const open = results.filter(({ quest }) => !state.saved.includes(quest.id) && !state.completed.includes(quest.id));
    const fresh = open.filter(({ quest }) => !state.passed.includes(quest.id));
    const later = state.passed.map((id) => open.find(({ quest }) => quest.id === id)).filter((x): x is (typeof open)[number] => !!x);
    return [...fresh, ...later];
  }, [results, state.saved, state.completed, state.passed]);
  const squad = NEARBY_STUDENTS.filter((u) => state.squadIds.includes(u.id));

  const toggleVibe = (vibe: Vibe) =>
    setVibes((current) => (current.includes(vibe) ? current.filter((v) => v !== vibe) : [...current, vibe]));

  const summary = [
    groupSize === 1 ? "Solo" : `${groupSize}${groupSize === 4 ? "+" : ""} people`,
    timeBudgetMin >= 240 ? "all night" : timeBudgetMin >= 60 ? `${timeBudgetMin / 60} hr` : `${timeBudgetMin} min`,
    maxCost === null ? "any budget" : maxCost === 0 ? "free" : `$${maxCost}`,
  ].join(" · ");


  return (
      <AppShell compact>
        <div className="mx-auto max-w-2xl">
          <section className="pt-0">
            <p className="font-hand text-base sm:text-lg">Minneapolis · a little detour from the usual</p>
            <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <h1 className="min-w-0 text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl">Find your next story.</h1>
             <Button variant="outline" onClick={() => setAdjusting((v) => !v)} ariaLabel="Change the plan">
               <SlidersHorizontal aria-hidden className="h-4 w-4" /> <span className="hidden sm:inline">Change the plan</span>
             </Button>
           </div>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-3">For {summary}{squad.length ? ` · with ${squad.map((s) => s.name).join(" & ")}` : ""}</p>
         </section>

         {adjusting ? (
            <div id="adjust" className="mt-6 grid gap-6 border-b border-border pb-8 md:grid-cols-2">
            <Group label="Who's coming">
              {GROUPS.map((g) => (
                <Chip key={g.value} active={groupSize === g.value} onClick={() => setGroupSize(g.value)}>
                  {g.label}
                </Chip>
              ))}
            </Group>
            <Group label="How long">
              {TIMES.map((t) => (
                <Chip key={t.value} active={timeBudgetMin === t.value} onClick={() => setTimeBudget(t.value)}>
                  {t.label}
                </Chip>
              ))}
            </Group>
            <Group label="Budget">
              {BUDGETS.map((b) => (
                <Chip key={String(b.value)} active={maxCost === b.value} onClick={() => setMaxCost(b.value)}>
                  {b.label}
                </Chip>
              ))}
            </Group>
            <Group label="What are you feeling?">
              {VIBES.map((vibe) => (
                <Chip key={vibe} active={vibes.includes(vibe)} onClick={() => toggleVibe(vibe)}>
                  {VIBE_LABEL[vibe]}
                </Chip>
              ))}
            </Group>
            <div>
              <label htmlFor="chaos" className="text-sm font-semibold">
                How adventurous? <span className="font-normal text-muted-foreground">{CHAOS_LABEL[chaos - 1]}</span>
              </label>
              <input
                id="chaos"
                type="range"
                min={1}
                max={5}
                step={1}
                value={chaos}
                onChange={(event) => setChaos(Number(event.target.value))}
                className="mt-3 block w-full max-w-sm accent-primary"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label htmlFor="area" className="font-semibold">
                Near
              </label>
              <select
                id="area"
                value={area.label}
                onChange={(event) => setArea(AREAS.find((a) => a.label === event.target.value) ?? AREAS[0]!)}
               className="min-h-11 rounded-md border border-border bg-card px-4"
              >
                {AREAS.map((a) => (
                  <option key={a.label} value={a.label}>
                    {a.label}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="radius">
                Distance
              </label>
              <select
                id="radius"
                value={radiusMi}
                onChange={(event) => setRadius(Number(event.target.value))}
                 className="min-h-11 rounded-md border border-border bg-card px-4"
              >
                {[1, 3, 5, 10].map((r) => (
                  <option key={r} value={r}>
                    within {r} mi
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}


       <SwipeDeck items={deck} />
         
        </div>
    </AppShell>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}
