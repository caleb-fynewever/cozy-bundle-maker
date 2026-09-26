import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { SwipeDeck } from "@/components/SwipeDeck";
import { currentTimeSlot, recommend } from "@/lib/engine";
import { QUESTS } from "@/data/quests";
import { useUserState } from "@/lib/store";
import type { SessionContext } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "wego — What's the move tonight?" },
      {
        name: "description",
        content:
          "wego turns 'what should we do?' into a real plan. One tap and you're headed somewhere worth the walk.",
      },
      { property: "og:title", content: "wego — What's the move tonight?" },
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

const ORIGIN = { lat: 44.9741, lng: -93.2277, label: "East Bank, UMN" };

// Plan details are set when you hit "Let's go", so Discover keeps plain defaults.
function defaultContext(squadIds: string[]): SessionContext {
  return {
    groupSize: 3,
    timeBudgetMin: 90,
    maxCost: 25,
    vibes: [],
    chaos: 3,
    timeSlot: currentTimeSlot(),
    origin: ORIGIN,
    radiusMi: 3,
    squadIds,
  };
}

function Discover() {
  const state = useUserState();

  const allQuests = useMemo(() => [...state.createdQuests, ...QUESTS], [state.createdQuests]);
  // Passed quests aren't gone: they come back after everything fresh, oldest pass first.
  const { results } = useMemo(
    () => recommend(defaultContext(state.squadIds), { ...state, passed: [] }, allQuests, allQuests.length),
    [state, allQuests],
  );
  const deck = useMemo(() => {
    const open = results.filter(({ quest }) => !state.saved.includes(quest.id) && !state.completed.includes(quest.id));
    const fresh = open.filter(({ quest }) => !state.passed.includes(quest.id));
    const later = state.passed.map((id) => open.find(({ quest }) => quest.id === id)).filter((x): x is (typeof open)[number] => !!x);
    return [...fresh, ...later];
  }, [results, state.saved, state.completed, state.passed]);

  return (
    <AppShell compact>
      <div className="mx-auto max-w-2xl">
        <section className="pt-0">
          <p className="font-hand text-base sm:text-lg">Minneapolis · a little detour from the usual</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl">Find your next story.</h1>
        </section>

        <SwipeDeck items={deck} />
      </div>
    </AppShell>
  );
}
