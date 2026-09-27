import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bookmark, Footprints } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SwipeDeck } from "@/components/SwipeDeck";
import { CAMPUS_ORIGIN, currentTimeSlot, distanceMi, recommend } from "@/lib/engine";
import { QUESTS } from "@/data/quests";
import { actions, useUserState } from "@/lib/store";
import type { Quest, SessionContext } from "@/lib/types";
import { questImage } from "@/lib/imagery";
import { CreateQuestForm } from "@/components/CreateQuestForm";
import { PageHeader, SectionHeading } from "@/components/ui-kit";

export const Route = createFileRoute("/")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>) => ({
    ...(search["tab"] === "yours" ? { tab: "yours" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Quests — wego" },
      {
        name: "description",
        content:
          "wego turns 'what should we do?' into a real plan. One tap and you're headed somewhere worth the walk.",
      },
      { property: "og:title", content: "Quests — wego" },
      {
        property: "og:description",
        content:
          "Personalized side quests for students: one card, one decision, somewhere worth the walk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Discover,
});

// Plan details are set when you hit "Let's go", so the quest deck keeps plain defaults.
function defaultContext(squadIds: string[], origin: SessionContext["origin"]): SessionContext {
  return {
    groupSize: 3,
    timeBudgetMin: 90,
    maxCost: 25,
    vibes: [],
    chaos: 3,
    timeSlot: currentTimeSlot(),
    origin,
    radiusMi: 3,
    squadIds,
  };
}

function scheduledTimeLabel(value: { start: string; end?: string }) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const start = value.start.includes("T") ? new Date(value.start) : new Date(`${today}T${value.start}`);
  const startLabel = value.start.includes("T")
    ? start.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (!value.end) return startLabel;
  const end = value.end.includes("T") ? new Date(value.end) : new Date(`${today}T${value.end}`);
  const endLabel = end.toDateString() === start.toDateString()
    ? end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : end.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `${startLabel}–${endLabel}`;
}

function Discover() {
  const state = useUserState();
  const search = Route.useSearch();
  const [tab, setTab] = useState<"discover" | "yours" | "create">(search.tab ?? "discover");
  const origin = state.approximateLocation ?? CAMPUS_ORIGIN;

  const allQuests = useMemo(() => [...state.createdQuests, ...QUESTS], [state.createdQuests]);
  // Passed quests aren't gone: they come back after everything fresh, oldest pass first.
  const { results } = useMemo(
    () => recommend(defaultContext(state.squadIds, origin), { ...state, passed: [] }, allQuests, allQuests.length),
    [state, allQuests, origin],
  );
  const deck = useMemo(() => {
    const open = results.filter(({ quest }) => !state.saved.includes(quest.id) && !state.completed.includes(quest.id));
    const fresh = open.filter(({ quest }) => !state.passed.includes(quest.id));
    const later = state.passed.map((id) => open.find(({ quest }) => quest.id === id)).filter((x): x is (typeof open)[number] => !!x);
    return [...fresh, ...later];
  }, [results, state.saved, state.completed, state.passed]);
  const questById = useMemo(() => new Map(allQuests.map((quest) => [quest.id, quest])), [allQuests]);
  const saved = state.saved
    .filter((id) => !state.inProgress.includes(id) && !state.completed.includes(id) && !state.scheduledQuests.some((item) => item.questId === id))
    .map((id) => questById.get(id))
    .filter((quest): quest is Quest => Boolean(quest));
  const inProgress = state.inProgress.map((id) => questById.get(id)).filter((quest): quest is Quest => quest !== undefined && !state.completed.includes(quest.id));
  const scheduled = state.scheduledQuests.map(({ questId }) => questById.get(questId)).filter((quest): quest is Quest => Boolean(quest));
  const created = state.createdQuests.filter((quest) => !state.inProgress.includes(quest.id) && !state.scheduledQuests.some((item) => item.questId === quest.id));
  const myQuestCount = saved.length + inProgress.length + scheduled.length + created.length;

  return (
    <AppShell compact>
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Quests" eyebrow="with your people" className="mb-4 pb-4" />
        <div className="mt-4 flex border-b border-border" role="tablist" aria-label="Your quests">
          <button id="find-quests-tab" type="button" role="tab" aria-controls="find-quests-panel" aria-selected={tab === "discover"} tabIndex={tab === "discover" ? 0 : -1} onClick={() => setTab("discover")} className={`min-h-12 border-b-2 px-4 text-sm font-semibold ${tab === "discover" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
            Discover
          </button>
          <button id="saved-quests-tab" type="button" role="tab" aria-controls="saved-quests-panel" aria-selected={tab === "yours"} tabIndex={tab === "yours" ? 0 : -1} onClick={() => setTab("yours")} className={`min-h-12 border-b-2 px-4 text-sm font-semibold ${tab === "yours" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
            My quests <span className="ml-1 text-xs text-muted-foreground">{myQuestCount}</span>
          </button>
          <button id="create-quest-tab" type="button" role="tab" aria-controls="create-quest-panel" aria-selected={tab === "create"} tabIndex={tab === "create" ? 0 : -1} onClick={() => setTab("create")} className={`min-h-12 border-b-2 px-4 text-sm font-semibold ${tab === "create" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
            Create quest
          </button>
        </div>

        {tab === "discover" ? <div id="find-quests-panel" role="tabpanel" aria-labelledby="find-quests-tab"><SwipeDeck items={deck} /></div> : tab === "create" ? (
          <div id="create-quest-panel" className="mt-6" role="tabpanel" aria-labelledby="create-quest-tab">
            <CreateQuestForm embedded />
          </div>
        ) : (
      <div id="saved-quests-panel" className="mt-6 space-y-10" role="tabpanel" aria-labelledby="saved-quests-tab">
            <QuestShelf title="In progress" empty="No active quest yet. Start one from Discover, Saved for later, or Created by you." quests={inProgress} origin={origin} active />
            {scheduled.length ? <QuestShelf title="Scheduled" empty="" quests={scheduled} origin={origin} scheduledTimes={Object.fromEntries(state.scheduledQuests.map((item) => [item.questId, { start: item.when, ...(item.endWhen ? { end: item.endWhen } : {}) }]))} scheduled /> : null}
            <QuestShelf title="Saved for later" empty="Saved quests will be waiting here." quests={saved} origin={origin} onRemove={(quest) => actions.toggleSave(quest.id)} />
            <QuestShelf title="Created by you" empty="Quests you create will show up here." quests={created} origin={origin} />
            {!saved.length && !inProgress.length && !scheduled.length && !created.length ? <button type="button" onClick={() => setTab("discover")} className="text-sm font-semibold underline underline-offset-4">Find a quest to save</button> : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function QuestShelf({
  title,
  empty,
  quests,
  origin,
  onRemove,
  active = false,
  scheduled = false,
  scheduledTimes,
}: {
  title: string;
  empty: string;
  quests: Quest[];
  origin: SessionContext["origin"];
  onRemove?: (quest: Quest) => void;
  active?: boolean;
  scheduled?: boolean;
  scheduledTimes?: Record<string, { start: string; end?: string }>;
}) {
  const [pendingUnsave, setPendingUnsave] = useState<Quest | null>(null);

  return (
    <section aria-label={title}>
      <SectionHeading title={title} action={<span className="text-sm text-muted-foreground">{quests.length}</span>} />
      {quests.length ? (
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {quests.map((quest) => (
            <li key={quest.id} className="py-3">
              <div className="flex items-center gap-3">
                <Link to={active || scheduled ? "/go/$questId" : "/quest/$questId"} params={{ questId: quest.id }} className="flex min-w-0 flex-1 items-center gap-3">
                  <img src={questImage(quest)} alt="" className="h-16 w-16 shrink-0 rounded-md bg-muted object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{quest.title}</span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">{scheduledTimes?.[quest.id] ? `Scheduled for ${scheduledTimeLabel(scheduledTimes[quest.id]!)} · ` : ""}{quest.location.name} · {distanceMi(origin, quest.location).toFixed(1)} mi away · {quest.durationMin} min</span>
                  </span>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  {onRemove ? <button type="button" onClick={() => setPendingUnsave(quest)} aria-label={`Remove ${quest.title} from saved`} className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground hover:bg-surface"><Bookmark aria-hidden className="h-4 w-4" fill="currentColor" /></button> : null}
                  <Link to="/go/$questId" params={{ questId: quest.id }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-transparent bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 sm:px-6 sm:text-[15px]">
                    <Footprints aria-hidden className="h-5 w-5" /> {active ? "Continue quest" : scheduled ? "View plan" : "Let’s go"}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 border-y border-border py-4 text-sm text-muted-foreground">{empty}</p>}
      {onRemove ? (
        <AlertDialog open={Boolean(pendingUnsave)} onOpenChange={(open) => { if (!open) setPendingUnsave(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from saved?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingUnsave?.title} will be removed from Saved for later. You can find it again in Discover.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep saved</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (pendingUnsave) onRemove(pendingUnsave); setPendingUnsave(null); }}>
                Remove quest
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </section>
  );
}
