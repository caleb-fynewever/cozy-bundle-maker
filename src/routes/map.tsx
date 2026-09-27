import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Bookmark, Navigation, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { QuestMap } from "@/components/QuestMap";
import { Stamp } from "@/components/Stamp";
import { buttonClass } from "@/components/ui-kit";
import { mapsLinks } from "@/lib/maps";
import { metaLine } from "@/components/QuestCard";
import { QUESTS } from "@/data/quests";
import { CAMPUS_ORIGIN, distanceMi } from "@/lib/engine";
import { questImage } from "@/lib/imagery";
import { actions, useUserState } from "@/lib/store";
import { EASE_IN, EASE_OUT, flyToNav, reducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/map")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Map — wego" },
      { name: "description", content: "Every quest on one map. Tap a pin to see it." },
      { property: "og:title", content: "Map — wego" },
      { property: "og:description", content: "Every quest on one map. Tap a pin to see it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    // Open the tile server connection before the map asks for its first tiles.
    links: [{ rel: "preconnect", href: "https://server.arcgisonline.com", crossOrigin: "anonymous" }],
  }),
  component: MapPage,
});

function MapPage() {
  const state = useUserState();
  const origin = state.approximateLocation ?? CAMPUS_ORIGIN;
  const quests = useMemo(() => [...state.createdQuests, ...QUESTS], [state.createdQuests]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const thumb = useRef<HTMLImageElement>(null);
  const closing = useRef<Animation | null>(null);
  const quest = selectedId ? quests.find((q) => q.id === selectedId) : undefined;
  const saved = quest ? state.saved.includes(quest.id) : false;
  const done = quest ? state.completed.includes(quest.id) : false;

  // A trackpad pinch that starts on the map or its quest card would otherwise zoom the whole page.
  // Only here, though: a pinch over the header still zooms the page, so text can always be enlarged.
  useEffect(() => {
    const el = stage.current;
    if (!el || mapUnavailable) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) event.preventDefault();
    };
    const onGesture = (event: Event) => event.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGesture);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGesture);
    };
  }, [mapUnavailable]);

  function pick(id: string | null) {
    if (id !== null) {
      closing.current?.cancel();
      closing.current = null;
      setSelectedId(id);
      return;
    }
    close();
  }

  /**
   * The card steps down and fades (quick, ease-in) before it goes. Closed from the card itself (its
   * Close button, or Escape), keyboard focus goes back to the pin that opened it.
   */
  function close(returnFocus = false) {
    if (returnFocus && selectedId) {
      document.querySelector<HTMLElement>(`[data-quest-pin="${CSS.escape(selectedId)}"]`)?.focus({ preventScroll: true });
    }
    const el = card.current;
    if (!el || reducedMotion()) {
      setSelectedId(null);
      return;
    }
    const leave = el.animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "translateY(8px)" },
      ],
      { duration: 140, easing: EASE_IN, fill: "forwards" },
    );
    closing.current = leave;
    leave.onfinish = () => {
      if (closing.current !== leave) return;
      closing.current = null;
      setSelectedId(null);
    };
  }

  // Escape puts the card away, from the card or from the pin that opened it.
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const focus = document.activeElement;
      const fromCard = Boolean(card.current?.contains(focus));
      const fromPin = focus instanceof HTMLElement && focus.dataset["questPin"] === selectedId;
      if (!fromCard && !fromPin && focus !== document.body) return;
      event.preventDefault();
      closeRef.current(fromCard || fromPin);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedId]);

  function toggleSave(button: HTMLButtonElement) {
    if (!quest) return;
    const saving = !saved;
    actions.toggleSave(quest.id);
    if (!saving) return;
    const icon = button.querySelector("svg");
    if (icon && !reducedMotion()) {
      icon.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.3)", offset: 0.35 }, { transform: "scale(0.95)", offset: 0.7 }, { transform: "scale(1)" }],
        { duration: 320, easing: EASE_OUT },
      );
    }
    flyToNav(thumb.current ?? button, "lists", questImage(quest));
  }

  /** The card's photo glides into the quest page's hero (the Let's go morph). */
  function namePhoto(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    thumb.current?.style.setProperty("view-transition-name", "quest-photo");
  }

  return (
    <AppShell bleed>
      <h1 className="sr-only">Map</h1>
      <div ref={stage} className="relative h-full w-full">
        <QuestMap
          quests={quests}
          origin={origin}
          selectedId={selectedId}
          onSelect={pick}
          onUnavailable={() => setMapUnavailable(true)}
          onReady={() => setMapReady(true)}
          saved={state.saved}
          done={state.completed}
        />

        {mapUnavailable ? (
          <NoMapList origin={origin} completed={state.completed} saved={state.saved} />
        ) : !quest ? (
          mapReady ? (
            <p className="map-hint pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-border-strong bg-card px-3 py-1.5 font-hand text-base leading-tight md:left-5 md:top-5">
              pick a pin to see the quest
            </p>
          ) : null
        ) : (
          <div className="pointer-events-none absolute inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-10 flex justify-center px-3 md:bottom-5 md:justify-start md:px-5">
            <article
              ref={card}
              aria-label={quest.title}
              className="map-card pointer-events-auto w-full max-w-md rounded-lg border border-border-strong bg-card p-3 shadow-(--shadow-lift)"
            >
              <div key={quest.id} className="map-card-swap">
                <div className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-start gap-3 sm:grid-cols-[88px_minmax(0,1fr)_auto]">
                  <span className="relative block">
                    <span className="block rounded-md border border-border-strong bg-card p-[3px]">
                      <img
                        ref={thumb}
                        src={questImage(quest)}
                        alt=""
                        className="block aspect-square w-full rounded-[3px] bg-muted object-cover"
                      />
                    </span>
                    {done ? (
                      <span className="pointer-events-none absolute -bottom-3 -right-3">
                        <Stamp backed label="did it" size={50} tilt={-12} />
                      </span>
                    ) : null}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h2 className="line-clamp-2 text-base font-semibold leading-snug text-balance">{quest.title}</h2>
                    <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{quest.hook}</p>
                    <p className="mt-1.5 text-[13px] font-medium tabular-nums">
                      {quest.location.area} · {metaLine(distanceMi(origin, quest.location), quest.durationMin, quest.costPerPerson)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => close(true)}
                    aria-label="Close"
                    className="press -mr-1.5 -mt-1.5 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground"
                  >
                    <X aria-hidden className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Link
                    to="/quest/$questId"
                    params={{ questId: quest.id }}
                    search={{ from: "map" }}
                    viewTransition
                    onClick={namePhoto}
                    className={cn(buttonClass({ size: "sm" }), "flex-1")}
                  >
                    View quest
                  </Link>
                  <a
                    href={mapsLinks(quest.location).directions}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Get walking directions to ${quest.location.name}`}
                    className={cn(buttonClass({ variant: "outline", size: "sm" }), "max-[380px]:w-11 max-[380px]:px-0")}
                  >
                    <Navigation aria-hidden className="h-4 w-4" />
                    <span className="max-[380px]:sr-only">Directions</span>
                  </a>
                  <button
                    type="button"
                    onClick={(event) => toggleSave(event.currentTarget)}
                    aria-pressed={saved}
                    aria-label={saved ? `Remove ${quest.title} from saved` : `Save ${quest.title}`}
                    className={cn(buttonClass({ variant: "outline", size: "sm" }), "w-11 px-0")}
                  >
                    <Bookmark aria-hidden className="h-5 w-5" fill={saved ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
            </article>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/** No WebGL: the map page still works, as every quest in a list, nearest first. */
function NoMapList({ origin, completed, saved }: { origin: { lat: number; lng: number; label: string }; completed: string[]; saved: string[] }) {
  const state = useUserState();
  const all = useMemo(() => [...state.createdQuests, ...QUESTS], [state.createdQuests]);
  const nearest = useMemo(
    () => all.map((quest) => ({ quest, miles: distanceMi(origin, quest.location) })).sort((a, b) => a.miles - b.miles),
    [all, origin],
  );
  return (
    <div className="absolute inset-0 z-10 touch-pan-y overflow-y-auto overscroll-contain bg-background">
      {/* The same column as the other tabs' pages (Quests, Lists), so the title doesn't jump. */}
      <div className="mx-auto max-w-4xl px-5 pb-[calc(96px+env(safe-area-inset-bottom))] pt-6 md:box-content md:px-8 md:pb-12 md:pt-10">
        <p className="font-hand text-xl leading-tight text-muted-foreground">no map in this browser, here’s the list</p>
        <h2 className="mt-1 text-xl font-semibold leading-tight tracking-[-0.01em] sm:text-[1.375rem]">Quests near you</h2>
        <p className="mt-1 text-sm text-muted-foreground">Nearest first. Turn on WebGL or try another browser to see them on the map.</p>
        <ul className="mt-4 max-w-2xl divide-y divide-border">
          {nearest.map(({ quest, miles }) => (
            <li key={quest.id}>
              <Link
                to="/quest/$questId"
                params={{ questId: quest.id }}
                search={{ from: "map" }}
                className="grid grid-cols-[56px_minmax(0,1fr)] items-start gap-3.5 py-3.5 transition-transform duration-(--dur-quick) ease-(--ease-spring) active:scale-[0.985]"
              >
                <span className="block rounded-md border border-border bg-card p-[2px]">
                  <img src={questImage(quest)} alt="" loading="lazy" className="block aspect-square w-full rounded-[4px] bg-muted object-cover" />
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{quest.title}</span>
                  <span className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
                    {completed.includes(quest.id) ? <span className="font-semibold text-foreground">Done · </span> : saved.includes(quest.id) ? <span className="font-semibold text-foreground">Saved · </span> : null}
                    {quest.location.area} · {metaLine(miles, quest.durationMin, quest.costPerPerson)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
