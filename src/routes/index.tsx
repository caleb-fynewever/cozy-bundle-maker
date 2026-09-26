import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { QuestCard } from "@/components/QuestCard";
import { Button, Chip } from "@/components/ui-kit";
import { currentTimeSlot, recommend, tonightTrio } from "@/lib/engine";
import { QUESTS } from "@/data/quests";
import { NEARBY_STUDENTS } from "@/data/people";
import { actions, useUserState } from "@/lib/store";
import { VIBES, VIBE_LABEL, type SessionContext, type Vibe } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Side Quest — What's the move tonight?" },
      {
        name: "description",
        content:
          "Side Quest turns 'what should we do?' into a real plan. Tell it your group, time, budget and mood, and it builds a personalized mission near you.",
      },
      { property: "og:title", content: "Side Quest — What's the move tonight?" },
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
  const [tonightOpen, setTonightOpen] = useState(false);

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
  const { results } = useMemo(() => recommend(context, state, allQuests), [context, state, allQuests]);
  const trio = useMemo(() => tonightTrio(results), [results]);
  const squad = NEARBY_STUDENTS.filter((u) => state.squadIds.includes(u.id));

  const toggleVibe = (vibe: Vibe) =>
    setVibes((current) => (current.includes(vibe) ? current.filter((v) => v !== vibe) : [...current, vibe]));

  const summary = [
    groupSize === 1 ? "Solo" : `${groupSize}${groupSize === 4 ? "+" : ""} people`,
    timeBudgetMin >= 240 ? "all night" : timeBudgetMin >= 60 ? `${timeBudgetMin / 60} hr` : `${timeBudgetMin} min`,
    maxCost === null ? "any budget" : maxCost === 0 ? "free" : `$${maxCost}`,
  ].join(" · ");

  const TRIO_LABEL = { safe: "Safe bet", perfect: "Your kind of thing", chaos: "Wildcard" } as const;

  return (
    <AppShell>
      <section className="pt-6 sm:pt-12">
        <h1 className="text-6xl font-extrabold leading-[0.92] sm:text-8xl">
          What's the
          <br />
          move<span className="text-primary">?</span>
        </h1>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setAdjusting((v) => !v)}
            aria-expanded={adjusting}
            aria-controls="adjust"
            className="inline-flex min-h-12 items-center gap-3 rounded-full border border-border-strong px-5 text-[15px] font-medium hover:bg-surface"
          >
            {summary}
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <SlidersHorizontal aria-hidden className="h-4 w-4" /> Adjust
            </span>
          </button>
          {squad.length ? (
            <span className="text-sm text-muted-foreground">with {squad.map((s) => s.name).join(" & ")}</span>
          ) : null}
        </div>

        {adjusting ? (
          <div id="adjust" className="mt-6 space-y-6 border-t border-border pt-6">
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
                className="min-h-11 rounded-full border border-border bg-transparent px-4"
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
                className="min-h-11 rounded-full border border-border bg-transparent px-4"
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

        <div className="mt-8 flex flex-wrap items-center gap-5">
          <Button onClick={() => setTonightOpen(true)}>Find something to do</Button>
          {state.completed.length === 0 ? (
            <button type="button" onClick={actions.loadDemo} className="min-h-11 text-sm text-muted-foreground underline underline-offset-4">
              Try with a demo profile
            </button>
          ) : null}
        </div>
      </section>

      {tonightOpen && trio.length ? (
        <section aria-labelledby="tonight" className="mt-16">
          <div className="flex items-baseline justify-between">
            <h2 id="tonight" className="text-3xl font-bold">
              Three ways to go
            </h2>
            <button type="button" onClick={() => setTonightOpen(false)} className="min-h-11 text-sm text-muted-foreground">
              Close
            </button>
          </div>
          <div className="mt-6 space-y-12">
            {trio.map(({ tone, item }) => (
              <QuestCard key={tone} item={item} label={TRIO_LABEL[tone]} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-20">
        <h2 className="text-3xl font-bold">Picked for you</h2>
        <div className="mt-8 space-y-14">
          {results.map((item, index) => (
            <QuestCard key={item.quest.id} item={item} featured={index === 0} />
          ))}
          {results.length === 0 ? (
            <p className="text-muted-foreground">Nothing fits that. Try a bigger budget or more time.</p>
          ) : null}
        </div>
        <p className="mt-16 text-muted-foreground">
          Got your own idea?{" "}
          <Link to="/create" className="font-semibold text-foreground underline underline-offset-4">
            Make a quest
          </Link>
        </p>
      </section>
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
