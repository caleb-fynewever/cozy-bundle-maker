import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SwipeDeck } from "@/components/SwipeDeck";
import { CAMPUS_ORIGIN, currentTimeSlot, recommend } from "@/lib/engine";
import { QUESTS } from "@/data/quests";
import { actions, useUserState } from "@/lib/store";
import type { SessionContext, TimeSlot } from "@/lib/types";
import { CreateQuestForm } from "@/components/CreateQuestForm";
import { PageHeader, buttonClass, textButtonClass } from "@/components/ui-kit";
import { Tabs } from "@/components/Tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type View = "discover" | "create";

export const Route = createFileRoute("/")({
  staticData: { sitemap: false },
  // The Create tab lives in the URL (/?tab=create), so a refresh, Back or a "Make one" link lands on it.
  validateSearch: (search: Record<string, unknown>) => ({
    ...(search["tab"] === "create" ? { tab: "create" as const } : {}),
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

const VIEWS: { id: View; label: string; controls: string }[] = [
  { id: "discover", label: "Discover", controls: "find-quests-panel" },
  { id: "create", label: "Create quest", controls: "create-quest-panel" },
];

// Plan details are set when you hit "Let's go", so the quest deck keeps plain defaults.
function defaultContext(squadIds: string[], origin: SessionContext["origin"], timeSlot: TimeSlot): SessionContext {
  return {
    groupSize: 3,
    timeBudgetMin: 90,
    maxCost: 25,
    vibes: [],
    chaos: 3,
    timeSlot,
    origin,
    radiusMi: 3,
    squadIds,
  };
}

/*
 * The time of day, read on the client only. The server (UTC) and a browser in Minneapolis can be
 * in different slots, so the server renders a fixed slot and the browser switches to its own right
 * after hydration, instead of the two disagreeing about the deck mid-hydration.
 */
const noSubscribe = () => () => {};
const serverTimeSlot = (): TimeSlot => "afternoon";
function useTimeSlot(): TimeSlot {
  return useSyncExternalStore(noSubscribe, () => currentTimeSlot(), serverTimeSlot);
}

function Discover() {
  const state = useUserState();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const tab: View = search.tab === "create" ? "create" : "discover";
  // Panels only animate in once you've switched; the first view is the deck's deal.
  const [switched, setSwitched] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState("");
  const origin = state.approximateLocation ?? CAMPUS_ORIGIN;
  const timeSlot = useTimeSlot();

  function switchTab(next: View) {
    if (next === tab) return;
    setSwitched(true);
    void navigate({ to: "/", search: next === "create" ? { tab: "create" } : {}, replace: true, resetScroll: false });
  }

  function requestLocation() {
    if (locationBusy) return;
    if (!navigator.geolocation) {
      setLocationError("This browser can’t share a location. You can keep using East Bank as the starting point.");
      return;
    }
    setLocationBusy(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        actions.setApproximateLocation(coords.latitude, coords.longitude);
        setLocationBusy(false);
      },
      (error) => {
        setLocationBusy(false);
        setLocationError(error.code === error.PERMISSION_DENIED
          ? "Location access was denied. Allow it in your browser settings, then try again."
          : "Couldn’t get your location. Check your connection and try again.");
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 12_000 },
    );
  }

  const allQuests = useMemo(() => [...state.createdQuests, ...QUESTS], [state.createdQuests]);
  // Passed quests aren't gone: they come back after everything fresh, oldest pass first.
  const { results } = useMemo(
    () => recommend(defaultContext(state.squadIds, origin, timeSlot), { ...state, passed: [] }, allQuests, allQuests.length),
    [state, allQuests, origin, timeSlot],
  );
  const deck = useMemo(() => {
    // Quests you made stay in Lists › Created by you; the deck never deals your own back to you.
    const mine = new Set(state.createdQuests.map((quest) => quest.id));
    const open = results.filter(({ quest }) => !mine.has(quest.id) && !state.saved.includes(quest.id) && !state.completed.includes(quest.id));
    const fresh = open.filter(({ quest }) => !state.passed.includes(quest.id));
    const later = state.passed.map((id) => open.find(({ quest }) => quest.id === id)).filter((x): x is (typeof open)[number] => !!x);
    return [...fresh, ...later];
  }, [results, state.createdQuests, state.saved, state.completed, state.passed]);

  return (
    <AppShell compact>
      {/* Short phones (Safari with its toolbar showing) pull the header in, so the deck's Pass and
          Save clear the floating tab bar (see quests.css, "Short phones"). */}
      <div className="mx-auto max-w-2xl max-sm:[@media(max-height:45rem)]:-mt-2 md:-mt-3 lg:max-w-4xl">
        <PageHeader title="Quests" eyebrow="with your people" bare className="mb-3 pb-0 max-sm:[@media(max-height:45rem)]:mb-1" />
        {/* The tab rule is the page's only divider; tab text starts flush with the title. Where
            distances are measured from is one quiet line at the end of the same row. */}
        <div className="flex items-center justify-between gap-3 border-b border-border">
          <Tabs
            tabs={VIEWS}
            value={tab}
            onChange={switchTab}
            label="Quests"
            idPrefix="quests"
            className="gap-7 border-b-0 [&>[role=tab]]:px-0"
          />
          {tab === "discover" ? (
            <LocationNote
              located={Boolean(state.approximateLocation)}
              busy={locationBusy}
              onUse={requestLocation}
              onClear={() => {
                setLocationError("");
                actions.clearApproximateLocation();
              }}
            />
          ) : null}
        </div>
        {tab === "discover" && locationError ? (
          <p role="alert" className="mt-3 text-sm text-destructive text-pretty">
            {locationError}
          </p>
        ) : null}

        {/* Both panels stay mounted, so a half-written quest survives a look at the deck. */}
        <div
          id="find-quests-panel"
          role="tabpanel"
          aria-labelledby="quests-discover-tab"
          hidden={tab !== "discover"}
          className={switched ? "quests-panel-in" : undefined}
        >
          <SwipeDeck items={deck} />
        </div>
        <div
          id="create-quest-panel"
          role="tabpanel"
          aria-labelledby="quests-create-tab"
          hidden={tab !== "create"}
          className={cn("mt-6 sm:mt-8", switched && "quests-panel-in")}
        >
          <CreateQuestForm embedded />
        </div>
      </div>
    </AppShell>
  );
}

/**
 * Where distances are measured from: one quiet line at the end of the tab row. The controls (turn
 * your location on, update it, turn it off) and the privacy note open from it on a slip of paper.
 * The words carry a thin underline in muted ink and a small chevron, so it reads as something to tap.
 */
function LocationNote({ located, busy, onUse, onClear }: { located: boolean; busy: boolean; onUse: () => void; onClear: () => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(textButtonClass, "group shrink-0 gap-1 text-[13px] hover:no-underline data-[state=open]:text-foreground")}>
          <MapPin aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
          <span className="underline decoration-muted-foreground/45 decoration-1 underline-offset-[5px] transition-[text-decoration-color] duration-(--dur-quick) ease-(--ease-out) group-hover:decoration-foreground group-data-[state=open]:decoration-foreground">
            {located ? "Near your area" : "From East Bank"}
          </span>
          <ChevronDown aria-hidden className="size-3.5 shrink-0 transition-transform duration-(--dur-quick) ease-(--ease-out) group-data-[state=open]:rotate-180" strokeWidth={1.75} />
          <span className="sr-only">, location settings</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={4} aria-label="Location settings" className="w-[min(18rem,calc(100vw-2rem))]">
        <p className="text-sm font-semibold text-pretty">{located ? "Distances are from your approximate area." : "Distances start from East Bank."}</p>
        <p id="quests-location-privacy" className="mt-1 text-[13px] leading-snug text-muted-foreground text-pretty">
          Only an approximate area is saved on this device.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={onUse}
            aria-disabled={busy || undefined}
            aria-describedby="quests-location-privacy"
            className={cn(buttonClass({ variant: "outline", size: "sm" }), "aria-disabled:cursor-progress")}
          >
            {busy ? "Finding you…" : located ? "Update location" : "Use my location"}
          </button>
          {located ? (
            <button type="button" onClick={onClear} className={cn(textButtonClass, "px-1")}>
              Turn off
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
