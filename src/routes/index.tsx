import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Wand2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { QuestCard } from "@/components/QuestCard";
import { QuestDna } from "@/components/QuestDna";
import { PipelineTrace } from "@/components/PipelineTrace";
import { Button, Chip, SectionTitle } from "@/components/ui-kit";
import { CAMPUS_ORIGIN, currentTimeSlot, recommend, tonightTrio } from "@/lib/engine";
import { QUESTS } from "@/data/quests";
import { NEARBY_STUDENTS } from "@/data/people";
import { actions, useUserState } from "@/lib/store";
import { VIBES, VIBE_EMOJI, VIBE_LABEL, type SessionContext, type Vibe } from "@/lib/types";

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

const CHAOS_LABEL = ["Safe choice", "Mild", "Curious", "Reckless", "Unhinged"];

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
  const [vibes, setVibes] = useState<Vibe[]>(["weird"]);
  const [chaos, setChaos] = useState(3);
  const [area, setArea] = useState(AREAS[0]!);
  const [radiusMi, setRadius] = useState(3);
  const [tonightOpen, setTonightOpen] = useState(false);
  const [working, setWorking] = useState(true);

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
  const { results, trace, taste, groupVibes } = useMemo(
    () => recommend(context, state, allQuests),
    [context, state, allQuests],
  );
  const trio = useMemo(() => tonightTrio(results), [results]);
  const squad = NEARBY_STUDENTS.filter((u) => state.squadIds.includes(u.id));

  const contextKey = JSON.stringify(context);
  useEffect(() => {
    setWorking(true);
    const timer = setTimeout(() => setWorking(false), 550);
    return () => clearTimeout(timer);
  }, [contextKey]);

  const toggleVibe = (vibe: Vibe) =>
    setVibes((current) =>
      current.includes(vibe) ? current.filter((v) => v !== vibe) : [...current, vibe],
    );

  return (
    <AppShell>
      <section className="rounded-3xl border border-border bg-card p-5 sm:p-8 lift">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          {CAMPUS_ORIGIN.label.split(",")[1]?.trim() ?? "UMN"} · {currentTimeSlot()}
        </p>
        <h1 className="mt-2 text-4xl font-bold leading-[1.05] sm:text-6xl">What's the move?</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Don't recommend places — create reasons to go. Set the session and the engine builds a
          mission for exactly this group, this budget and this hour.
        </p>

        <div className="mt-6 space-y-5">
          <Group label="Group">
            {GROUPS.map((g) => (
              <Chip key={g.value} active={groupSize === g.value} onClick={() => setGroupSize(g.value)}>
                {g.label}
              </Chip>
            ))}
          </Group>

          <Group label="Time available">
            {TIMES.map((t) => (
              <Chip key={t.value} active={timeBudgetMin === t.value} onClick={() => setTimeBudget(t.value)}>
                {t.label}
              </Chip>
            ))}
          </Group>

          <Group label="Budget">
            {BUDGETS.map((b) => (
              <Chip
                key={String(b.value)}
                active={maxCost === b.value}
                onClick={() => setMaxCost(b.value)}
              >
                {b.label}
              </Chip>
            ))}
          </Group>

          <Group label="Vibe">
            {VIBES.map((vibe) => (
              <Chip key={vibe} active={vibes.includes(vibe)} onClick={() => toggleVibe(vibe)}>
                {VIBE_EMOJI[vibe]} {VIBE_LABEL[vibe]}
              </Chip>
            ))}
          </Group>

          <div>
            <label htmlFor="chaos" className="text-sm font-semibold">
              How chaotic are we feeling?
            </label>
            <div className="mt-2 flex items-center gap-4">
              <input
                id="chaos"
                type="range"
                min={1}
                max={5}
                step={1}
                value={chaos}
                onChange={(event) => setChaos(Number(event.target.value))}
                className="h-2 w-full max-w-sm accent-primary"
              />
              <span className="font-mono text-sm text-primary">
                {chaos} · {CHAOS_LABEL[chaos - 1]}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <MapPin aria-hidden className="h-4 w-4 text-primary" /> Searching near
            </span>
            <label className="sr-only" htmlFor="area">
              Search area
            </label>
            <select
              id="area"
              value={area.label}
              onChange={(event) =>
                setArea(AREAS.find((a) => a.label === event.target.value) ?? AREAS[0]!)
              }
              className="min-h-11 rounded-full border border-border bg-surface px-4 text-sm"
            >
              {AREAS.map((a) => (
                <option key={a.label} value={a.label}>
                  {a.label}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="radius">
              Radius in miles
            </label>
            <select
              id="radius"
              value={radiusMi}
              onChange={(event) => setRadius(Number(event.target.value))}
              className="min-h-11 rounded-full border border-border bg-surface px-4 text-sm"
            >
              {[1, 3, 5, 10].map((r) => (
                <option key={r} value={r}>
                  {r} mi radius
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              Approximate area only — your exact location is never shared.
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setTonightOpen(true)}>
              <Wand2 aria-hidden className="h-4 w-4" /> What should we do tonight?
            </Button>
            {state.completed.length === 0 ? (
              <Button variant="outline" onClick={actions.loadDemo}>
                Load demo profile
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-4">
        <PipelineTrace trace={trace} radiusMi={radiusMi} working={working} />
      </div>

      {tonightOpen && trio.length ? (
        <section className="mt-8">
          <SectionTitle
            kicker="Tonight"
            title="Three radically different answers"
            action={
              <button
                type="button"
                onClick={() => setTonightOpen(false)}
                className="text-sm text-muted-foreground underline"
              >
                Hide
              </button>
            }
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {trio.map(({ label, item }) => (
              <div key={label} className="space-y-2">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">{label}</p>
                <QuestCard item={item} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <SectionTitle
            kicker={`${results.length} personalized quests`}
            title={squad.length ? `For you + ${squad.map((s) => s.name).join(" & ")}` : "Picked for you"}
          />
          <div className="space-y-5">
            {results.map((item, index) => (
              <QuestCard key={item.quest.id} item={item} featured={index === 0} />
            ))}
            {results.length === 0 ? (
              <p className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
                Nothing fits those constraints. Widen the radius or budget.
              </p>
            ) : null}
          </div>
        </div>

        <aside className="space-y-4">
          <QuestDna
            vibes={groupVibes}
            title={squad.length ? "Group vibe" : "Your Quest DNA"}
            note={
              taste.hasHistory
                ? `${taste.signals} signals · taste evolving`
                : "Complete a quest to train this"
            }
          />
          <div className="rounded-3xl border border-border bg-card p-5">
            <h3 className="text-lg font-bold">Squad</h3>
            {squad.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {squad.map((member) => (
                  <li key={member.id} className="flex items-center justify-between">
                    <span>{member.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {member.distanceMi} mi
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Nobody in the squad yet. Group taste changes what you get recommended.
              </p>
            )}
            <div className="mt-4">
              <Link
                to="/squad"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-strong px-4 text-sm font-semibold"
              >
                Find nearby students
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}
