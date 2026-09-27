import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { MapPin, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, PageHeader, Tally, buttonClass, textButtonClass } from "@/components/ui-kit";
import { HelpDot } from "@/components/HelpDot";
import { actions } from "@/lib/store";
import { punchUpQuest } from "@/lib/punch-up.server";
import { VIBES, VIBE_LABEL, type Quest, type Vibe } from "@/lib/types";
import { VIBE_ICON } from "@/lib/vibes";
import { EASE_OUT, reducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type PlaceResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
};

type Errors = { title?: string | undefined; place?: string | undefined };

/** One field recipe for the whole form: white paper, an edge you can see, ink when it's yours. */
const FIELD =
  "min-h-12 w-full rounded-md border border-input bg-card px-4 text-base transition-[border-color,opacity] duration-(--dur-quick) ease-(--ease-out) placeholder:text-muted-foreground/80 hover:border-muted-foreground focus-visible:border-border-strong aria-invalid:border-destructive";

/*
 * The nine vibes as a 3x3 sticker sheet: every chip the same width, the doodle leading its label.
 * On phones there isn't room for a doodle beside "Competitive" in a third of the width, so each
 * sticker stacks its doodle over its label instead.
 */
const VIBE_SHEET = cn(
  "grid grid-cols-3 gap-2",
  "[&>button]:w-full [&>button]:min-w-0 [&>button]:justify-start [&>button]:gap-2 [&>button]:px-3.5",
  "max-sm:[&>button]:flex-col max-sm:[&>button]:justify-center max-sm:[&>button]:gap-1 max-sm:[&>button]:px-1 max-sm:[&>button]:py-2 max-sm:[&>button]:text-[13px]",
);

function placeArea(place: PlaceResult) {
  const address = place.address ?? {};
  return (
    address["neighbourhood"] ??
    address["suburb"] ??
    address["city_district"] ??
    address["city"] ??
    address["town"] ??
    address["village"] ??
    "Nearby"
  );
}

function placeName(place: PlaceResult) {
  return place.display_name.split(",")[0]?.trim() || place.display_name;
}

/** A short "where" for a search result: the area plus the city ("Mill District, Minneapolis"). */
function placeLine(place: PlaceResult) {
  const address = place.address ?? {};
  const area = placeArea(place);
  const city = address["city"] ?? address["town"] ?? address["village"] ?? address["county"] ?? address["state"] ?? "";
  const parts = [area === "Nearby" ? "" : area, city].filter((part, index, all) => part && all.indexOf(part) === index);
  return parts.join(", ") || area;
}

/*
 * Place search is kept to the Twin Cities first (a box around Minneapolis and St Paul), so
 * "Stone Arch Bridge" finds the one by the river, not one in New Hampshire. Only when that finds
 * nothing does it widen to a search that still prefers the Twin Cities but can reach further.
 */
const TWIN_CITIES_BOX = "-93.40,45.08,-93.00,44.87";

async function searchPlaces(query: string, signal: AbortSignal) {
  const lookup = async (bounded: boolean) => {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      "accept-language": "en",
      countrycodes: "us",
      viewbox: TWIN_CITIES_BOX,
      bounded: bounded ? "1" : "0",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal });
    if (!response.ok) throw new Error("Search is temporarily unavailable.");
    return (await response.json()) as PlaceResult[];
  };
  const near = await lookup(true);
  if (near.length || signal.aborted) return near;
  // OpenStreetMap's search asks for at most one request a second; wait before widening.
  await new Promise((resolve) => window.setTimeout(resolve, 1000));
  if (signal.aborted) return [];
  return lookup(false);
}

/** A small "no" shake for the field that needs attention. */
function shake(el: HTMLElement) {
  if (reducedMotion()) return;
  el.animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(5px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }],
    { duration: 260, easing: EASE_OUT },
  );
}

export function CreateQuestForm({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const runPunchUp = useServerFn(punchUpQuest);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [activeResult, setActiveResult] = useState(-1);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const placeRequest = useRef(0);
  const titleRef = useRef<HTMLInputElement>(null);
  const placeRef = useRef<HTMLInputElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const query = placeQuery.trim();
    if (place || query.length < 3) {
      setPlaceResults([]);
      setActiveResult(-1);
      setPlaceLoading(false);
      return;
    }
    const requestId = ++placeRequest.current;
    const controller = new AbortController();
    // Say "Searching…" from the first keystroke, not only once the debounce fires.
    setPlaceLoading(true);
    setPlaceError("");
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchPlaces(query, controller.signal);
        if (placeRequest.current === requestId && !controller.signal.aborted) {
          setPlaceResults(results);
          setActiveResult(-1);
        }
      } catch (error) {
        if (!controller.signal.aborted && placeRequest.current === requestId) {
          setPlaceError(error instanceof Error ? error.message : "Could not search places.");
        }
      } finally {
        if (placeRequest.current === requestId) setPlaceLoading(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [placeQuery, place]);
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [durationMin, setDuration] = useState(60);
  const [costPerPerson, setCost] = useState(10);
  const [groupMax, setGroupMax] = useState(4);
  const [adventure, setAdventure] = useState(3);
  const [steps, setSteps] = useState<string[]>([]);
  const [isPunching, setIsPunching] = useState(false);

  const publish = () => {
    const found: Errors = {};
    if (!title.trim()) found.title = "Give the quest a title";
    if (!place) found.place = "Search for and choose a location";
    setErrors(found);
    const firstInvalid = found.title ? titleRef.current : found.place ? placeRef.current : null;
    if (found.title || found.place) {
      if (firstInvalid) {
        firstInvalid.focus();
        shake(firstInvalid);
      }
      return;
    }
    if (!place) return;
    const quest: Quest = {
      id: `q_user_${Date.now()}`,
      title: title.trim(),
      hook: description.trim().slice(0, 120) || "A quest made by a student, for students.",
      mission: description.trim() || title.trim(),
      steps: steps.length ? steps : ["Meet up.", "Do the thing.", "Rank how it went."],
      vibes: vibes.length ? vibes : ["social"],
      location: {
        name: placeName(place),
        area: placeArea(place),
        lat: Number(place.lat),
        lng: Number(place.lon),
      },
      durationMin,
      costPerPerson,
      groupMin: 2,
      groupMax,
      weirdness: Math.min(5, Math.max(1, adventure)) as Quest["weirdness"],
      adventure: Math.min(5, Math.max(1, adventure)) as Quest["adventure"],
      bestTime: ["afternoon", "evening"],
      indoor: false,
      createdBy: "you",
    };
    actions.addQuest(quest);
    toast.success("Quest published — +90 XP");
    void navigate({ to: "/quest/$questId", params: { questId: quest.id } });
  };

  const makeSmarter = async () => {
    if (isPunching) return;
    if (!title.trim() && !description.trim()) {
      toast.error("Add a title or a rough idea first");
      return;
    }
    setIsPunching(true);
    try {
      const result = await runPunchUp({ data: { title, description, vibes, adventure } });
      setTitle(result.title);
      setDescription(result.description);
      setSteps(result.steps);
      setErrors((current) => ({ ...current, title: undefined }));
      toast.success("Punched up. Edit anything before publishing.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t write that quest. Try again.");
    } finally {
      setIsPunching(false);
    }
  };

  function choosePlace(result: PlaceResult) {
    setPlace(result);
    setPlaceQuery("");
    setPlaceResults([]);
    setActiveResult(-1);
    setErrors((current) => ({ ...current, place: undefined }));
    window.setTimeout(() => changeRef.current?.focus(), 0);
  }

  function onPlaceKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!placeResults.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResult((index) => (index + 1) % placeResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResult((index) => (index <= 0 ? placeResults.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      // With results open, Enter picks a place instead of submitting the whole form.
      event.preventDefault();
      const chosen = placeResults[activeResult];
      if (chosen) choosePlace(chosen);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setPlaceResults([]);
      setActiveResult(-1);
    }
  }

  const placeStatus =
    placeError ||
    (placeQuery.trim().length < 3
      ? "Enter at least 3 characters to search."
      : placeLoading
        ? "Searching…"
        : placeResults.length
          ? "Choose the place you mean."
          : "No places found yet.");

  return (
    <>
      {embedded ? (
        // The tab already says "Create quest"; the page keeps one h1. The form starts right at Title.
        <h2 className="sr-only">Make a quest</h2>
      ) : (
        <PageHeader title="Make a quest" className="mt-6" />
      )}
      <form
        noValidate
        className={cn("grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12", !embedded && "mt-6 lg:mt-0")}
        onSubmit={(event) => {
          event.preventDefault();
          publish();
        }}
      >
        <div className="min-w-0 space-y-6">
          <Field label="Title" htmlFor="title" error={errors.title}>
            <input
              ref={titleRef}
              id="title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (errors.title) setErrors((current) => ({ ...current, title: undefined }));
              }}
              placeholder="Name your quest"
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? "title-error" : undefined}
              className={cn(FIELD, isPunching && "opacity-60")}
            />
          </Field>

          <Field label="Description" htmlFor="description">
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="What actually happens?"
              className={cn(FIELD, "min-h-28 resize-none py-3 leading-relaxed [field-sizing:content]", isPunching && "opacity-60")}
            />
            {/* The rewrite lives next to what it rewrites, so it's found before everything else is
                filled in. Below laptop width the aside that explains it isn't there, so its
                explanation opens from a question mark beside the button instead. */}
            <div className="mt-2.5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={makeSmarter}
                aria-busy={isPunching}
                className={cn(buttonClass({ variant: "outline", size: "sm" }), isPunching && "cursor-progress")}
              >
                <PenLine aria-hidden className="size-4" strokeWidth={1.75} />
                {isPunching ? "Writing your quest…" : "Punch it up with AI"}
              </button>
              <HelpDot label="What Punch it up does" title="Punch it up" side="top" align="end" className="lg:hidden">
                {PUNCH_IT_UP}
              </HelpDot>
            </div>
            {steps.length ? (
              <div className="reveal mt-3 rounded-md border border-border bg-card px-4 py-3.5">
                <h3 className="text-sm font-semibold">Quest steps</h3>
                <ol className="mt-2 space-y-1.5">
                  {steps.map((step, index) => (
                    <li key={`${index}-${step}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-1.5 text-sm leading-relaxed">
                      <span aria-hidden className="font-hand text-lg leading-tight">
                        {index + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </Field>

          <Field label="Location" htmlFor={place ? undefined : "location"} error={errors.place}>
            {place ? (
              <div className="flex min-h-12 items-center gap-3 rounded-md border border-input bg-card py-1.5 pl-4 pr-1.5">
                <MapPin aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{placeName(place)}</span>
                  <span className="block truncate text-sm text-muted-foreground">{placeLine(place)}</span>
                </span>
                <button
                  ref={changeRef}
                  type="button"
                  aria-label={`Change location, ${placeName(place)}`}
                  className={cn(textButtonClass, "px-2.5")}
                  onClick={() => {
                    setPlace(null);
                    setPlaceQuery("");
                    window.setTimeout(() => placeRef.current?.focus(), 0);
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={placeRef}
                  id="location"
                  value={placeQuery}
                  onChange={(event) => setPlaceQuery(event.target.value)}
                  onKeyDown={onPlaceKeyDown}
                  placeholder="Search a place or street address"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={placeResults.length > 0}
                  aria-controls="location-results"
                  aria-autocomplete="list"
                  aria-activedescendant={activeResult >= 0 ? `location-option-${activeResult}` : undefined}
                  aria-invalid={errors.place ? true : undefined}
                  aria-describedby={errors.place ? "location-error location-help" : "location-help"}
                  className={FIELD}
                />
                <div className="mt-1.5 flex items-start justify-between gap-3 text-xs text-muted-foreground">
                  <p id="location-help" aria-live="polite">
                    {placeStatus}
                  </p>
                  <span className="shrink-0 text-[11px]">Search by OpenStreetMap</span>
                </div>
                {placeResults.length > 0 && (
                  <ul
                    id="location-results"
                    role="listbox"
                    aria-label="Location search results"
                    className="mt-2 divide-y divide-border overflow-hidden rounded-md border border-border-strong bg-card"
                  >
                    {placeResults.map((result, index) => (
                      <li
                        key={`${result.lat},${result.lon}`}
                        id={`location-option-${index}`}
                        role="option"
                        aria-selected={index === activeResult}
                        // Keep focus in the search box while a place is picked with the mouse.
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choosePlace(result)}
                        className="flex cursor-pointer items-start gap-2.5 px-3.5 py-3 text-sm transition-colors duration-(--dur-quick) hover:bg-surface aria-selected:bg-surface"
                      >
                        <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                        <span className="min-w-0">
                          <span className="block font-medium">{placeName(result)}</span>
                          <span className="block truncate text-muted-foreground">{placeLine(result)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Category</legend>
            <div className={VIBE_SHEET}>
              {VIBES.map((vibe) => {
                const Icon = VIBE_ICON[vibe];
                const active = vibes.includes(vibe);
                return (
                  <Chip
                    key={vibe}
                    active={active}
                    onClick={() =>
                      setVibes((current) =>
                        current.includes(vibe)
                          ? current.filter((v) => v !== vibe)
                          : [...current, vibe],
                      )
                    }
                  >
                    {/* Drawn at its real size (no scale-up), so every doodle sits the same distance from its label. */}
                    <Icon aria-hidden className="size-[22px]" style={{ transform: "none" }} />
                    {VIBE_LABEL[vibe]}
                  </Chip>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-3 items-end gap-3 sm:gap-4">
            <NumberField id="duration" label="Duration" unit="minutes" suffix="min" min={15} max={300} step={15} value={durationMin} onChange={setDuration} />
            <NumberField id="cost" label="Cost per person" unit="dollars" prefix="$" min={0} max={100} value={costPerPerson} onChange={setCost} />
            <NumberField id="group" label="Max group size" min={2} max={10} value={groupMax} onChange={setGroupMax} />
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <label htmlFor="adventure" className="text-sm font-semibold">
                Adventure level
              </label>
              <span aria-hidden className="text-sm text-muted-foreground">
                <Tally value={adventure} className="font-semibold text-foreground" />/5
              </span>
            </div>
            <input
              id="adventure"
              type="range"
              min={1}
              max={5}
              step={1}
              value={adventure}
              aria-valuetext={`${adventure} of 5`}
              onChange={(event) => setAdventure(Number(event.target.value))}
              className="quest-range"
              style={{ "--pct": `calc(13px + ${(adventure - 1) / 4} * (100% - 26px))` } as CSSProperties}
            />
            <div aria-hidden className="quest-range-ticks">
              {[1, 2, 3, 4, 5].map((level) => (
                <span key={level} data-on={level <= adventure ? "" : undefined} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
            <Button type="submit">Publish quest</Button>
            <span className="font-hand text-lg text-muted-foreground">+90 XP</span>
          </div>
        </div>

        {/* Laptops: the guidance sits beside the form (phones get Punch it up's note from its "?"). */}
        <aside className="hidden lg:sticky lg:top-28 lg:block lg:self-start lg:pt-1">
          <h3 className="text-lg font-semibold leading-snug text-balance">Make it a mission, not an errand</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">{PUNCH_IT_UP}</p>
        </aside>
      </form>
    </>
  );
}

const PUNCH_IT_UP =
  "Punch it up adds secret picks, a scoring rule and a consequence — the three things that turn an outing into a story. You can edit every word before publishing.";

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {error && htmlFor ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A small number with its unit inside the box ("$ 10", "60 min"), so every label stays one line. */
function NumberField({
  id,
  label,
  unit,
  prefix,
  suffix,
  value,
  onChange,
  min,
  max,
  step,
}: {
  id: string;
  label: string;
  unit?: string;
  prefix?: string;
  suffix?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold leading-tight sm:text-sm">
        {label}
        {unit ? <span className="sr-only"> ({unit})</span> : null}
      </label>
      <div className="relative">
        {prefix ? (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className={cn(FIELD, "quest-number tabular-nums", prefix ? "pl-7" : "pl-3.5 sm:pl-4", suffix ? "pr-11" : "pr-3")}
        />
        {suffix ? (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3.5 grid place-items-center text-sm text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}
