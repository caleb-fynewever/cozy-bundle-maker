import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, SlidersHorizontal, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { metaLine, reasonLine } from "@/components/QuestCard";
import { Button, Chip } from "@/components/ui-kit";
import { currentTimeSlot, recommend, tonightTrio } from "@/lib/engine";
import { QUESTS } from "@/data/quests";
import { NEARBY_STUDENTS } from "@/data/people";
import { actions, useUserState } from "@/lib/store";
import { EVENTS } from "@/data/events";
import { PHOTOS } from "@/data/photos";
import { questImage } from "@/lib/imagery";
import { VIBES, VIBE_LABEL, type SessionContext, type Vibe } from "@/lib/types";
import type { ScoredQuest } from "@/lib/engine";

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
  const feed = [
    ...results.slice(0, 2).map((item) => ({ kind: "quest" as const, item })),
    ...EVENTS.slice(0, 1).map((event) => ({ kind: "event" as const, event })),
    ...results.slice(2, 4).map((item) => ({ kind: "quest" as const, item })),
    ...EVENTS.slice(1, 3).map((event) => ({ kind: "event" as const, event })),
    ...results.slice(4).map((item) => ({ kind: "quest" as const, item })),
    ...EVENTS.slice(3).map((event) => ({ kind: "event" as const, event })),
  ];

  return (
      <AppShell>
        <div className="mx-auto max-w-2xl">
         <section className="pt-3 md:pt-8">
           <p className="font-hand text-xl">a little detour from the usual · Minneapolis</p>
           <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
             <h1 className="text-[38px] font-semibold leading-tight md:text-5xl">Find your next story.</h1>
             <Button variant="outline" onClick={() => setAdjusting((v) => !v)} ariaLabel="Change the plan">
               <SlidersHorizontal aria-hidden className="h-4 w-4" /> Change the plan
             </Button>
           </div>
           <p className="mt-3 text-sm text-muted-foreground">For {summary}{squad.length ? ` · with ${squad.map((s) => s.name).join(" & ")}` : ""}</p>
           {state.completed.length === 0 ? (
             <div className="mt-1"><Button variant="ghost" onClick={actions.loadDemo}>Try with a demo profile</Button></div>
           ) : null}
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


       {tonightOpen && trio.length ? (
          <section aria-labelledby="tonight" className="mt-10 border-b border-border pb-10">
           <div className="flex items-baseline justify-between">
             <h2 id="tonight" className="text-3xl font-medium">
              Three ways to go
            </h2>
             <Button variant="ghost" onClick={() => setTonightOpen(false)}>Close</Button>
          </div>
            <div className="mt-6 grid gap-8 sm:grid-cols-3">
            {trio.map(({ tone, item }) => (
               <div key={tone} className="min-w-0">
                 <p className="mb-2 font-hand text-lg">{TRIO_LABEL[tone]}</p>
                 <Link to="/quest/$questId" params={{ questId: item.quest.id }} className="block">
                   <img src={questImage(item.quest)} alt={item.quest.location.name} className="aspect-square w-full object-cover" />
                   <h3 className="mt-2 text-base font-semibold">{item.quest.title}</h3>
                 </Link>
               </div>
            ))}
          </div>
        </section>
      ) : null}
        <section className="mt-10 border-t border-border pt-5" aria-label="Discover feed">
          <div className="mb-8 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <p className="font-hand text-xl">the good stuff, one scroll at a time</p>
            <Button variant="ghost" onClick={() => setTonightOpen(true)}>Three ways to go <span aria-hidden>→</span></Button>
          </div>
          <div className="space-y-14 md:space-y-24">
            {feed.map((entry, index) => entry.kind === "quest" ? (
              <FeedQuest key={entry.item.quest.id} item={entry.item} index={index} saved={state.saved.includes(entry.item.quest.id)} />
            ) : (
              <article key={entry.event.id} className="min-w-0">
                <p className="mb-3 font-hand text-xl">out in the world · {entry.event.when}</p>
                <div className="bg-secondary p-2.5 sm:p-4">
                  <img src={(PHOTOS[entry.event.photo] ?? PHOTOS["isles"]!).url} alt={entry.event.where} loading="lazy" className="aspect-[16/10] w-full bg-muted object-cover" />
                </div>
                <div className="mt-5 px-1 sm:px-3">
                  <h2 className="text-2xl font-semibold leading-tight md:text-3xl">{entry.event.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{entry.event.where} · {entry.event.price}</p>
                  <p className="mt-3 leading-relaxed">{entry.event.blurb}</p>
                  <a href={entry.event.source.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-1 font-semibold underline decoration-primary underline-offset-4">Details via {entry.event.source.name} <ArrowUpRight aria-hidden className="h-4 w-4" /></a>
                </div>
              </article>
            ))}
            {results.length === 0 ? <p className="text-muted-foreground">Nothing fits that. Try a bigger budget or more time.</p> : null}
          </div>
          <div className="pb-10 pt-20 text-center">
            <span aria-hidden className="mx-auto block h-12 w-px bg-primary" />
            <p className="mt-4 font-hand text-xl">that's the latest for now</p>
            <p className="mt-4">Got your own idea? <Link to="/create" className="font-semibold underline decoration-primary underline-offset-4">Make a quest</Link></p>
          </div>
        </section>
        </div>
    </AppShell>
  );
}

function FeedQuest({ item, index, saved }: { item: ScoredQuest; index: number; saved: boolean }) {
  const { quest } = item;
  return (
    <article className="group min-w-0">
      <p className="mb-3 font-hand text-xl">{index === 0 ? "a good place to start" : reasonLine(item)}</p>
      <Link to="/quest/$questId" params={{ questId: quest.id }} className="block" aria-label={`Explore ${quest.title}`}>
        <div className={`${index % 3 === 1 ? "bg-secondary" : "bg-card"} p-2.5 sm:p-4`}>
          <img src={questImage(quest)} alt={`${quest.location.name}, ${quest.location.area}`} loading={index === 0 ? "eager" : "lazy"} width={1200} height={900} className={`w-full bg-muted object-cover transition-transform duration-500 group-hover:scale-[1.01] ${index % 3 === 1 ? "aspect-[16/10]" : "aspect-[4/3]"}`} />
        </div>
      </Link>
      <div className="mt-5 flex items-start justify-between gap-3 px-1 sm:px-3">
        <div className="min-w-0">
          <Link to="/quest/$questId" params={{ questId: quest.id }}><h2 className="text-2xl font-semibold leading-tight md:text-3xl">{quest.title}</h2></Link>
          <p className="mt-2 text-sm text-muted-foreground">{quest.location.area} · {metaLine(item.distance, quest.durationMin, quest.costPerPerson)}</p>
          <p className="mt-3 leading-relaxed">{quest.hook}</p>
          <Link to="/quest/$questId" params={{ questId: quest.id }} className="mt-3 inline-flex min-h-11 items-center gap-1 font-semibold underline decoration-primary underline-offset-4">See the quest <ArrowUpRight aria-hidden className="h-4 w-4" /></Link>
        </div>
        <Button variant="ghost" onClick={() => actions.toggleSave(quest.id)} ariaLabel={saved ? `Remove ${quest.title} from saved` : `Save ${quest.title}`}>
          <Bookmark aria-hidden className="h-5 w-5 shrink-0" fill={saved ? "currentColor" : "none"} />
        </Button>
      </div>
    </article>
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
