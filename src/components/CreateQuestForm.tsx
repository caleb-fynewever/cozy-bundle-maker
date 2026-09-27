import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Chip } from "@/components/ui-kit";
import { PageHeader } from "@/components/ui-kit";
import { actions } from "@/lib/store";
import { punchUpQuest } from "@/lib/punch-up.server";
import { VIBES, VIBE_EMOJI, VIBE_LABEL, type Quest, type Vibe } from "@/lib/types";

type PlaceResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
};

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

export function CreateQuestForm({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const runPunchUp = useServerFn(punchUpQuest);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const placeRequest = useRef(0);

  useEffect(() => {
    const query = placeQuery.trim();
    if (place || query.length < 3) {
      setPlaceResults([]);
      setPlaceLoading(false);
      return;
    }
    const requestId = ++placeRequest.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPlaceLoading(true);
      setPlaceError("");
      try {
        const params = new URLSearchParams({
          q: query,
          format: "jsonv2",
          addressdetails: "1",
          limit: "5",
          "accept-language": "en",
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search is temporarily unavailable.");
        const results = (await response.json()) as PlaceResult[];
        if (placeRequest.current === requestId) setPlaceResults(results);
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
    if (!title.trim()) {
      toast.error("Give the quest a title");
      return;
    }
    if (!place) {
      toast.error("Search for and choose a location");
      return;
    }
    const quest: Quest = {
      id: `q_user_${Date.now()}`,
      title: title.trim(),
      hook: description.trim().slice(0, 120) || "A quest made by a student, for students.",
      mission: description.trim() || title.trim(),
      steps: steps.length ? steps : ["Meet up.", "Do the thing.", "Rank how it went."],
      vibes: vibes.length ? vibes : ["social"],
      location: {
        name: place.display_name.split(",")[0] ?? place.display_name,
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
      toast.success("AI built your quest — edit anything before publishing");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t write that quest. Try again.");
    } finally {
      setIsPunching(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="got an idea?" title="Make a quest" className={embedded ? "mb-5" : "mt-6"} />
      <form
        className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"
        onSubmit={(event) => {
          event.preventDefault();
          publish();
        }}
      >
        <div className="space-y-4 border-t border-border pt-6">
          <Field label="Title" htmlFor="title">
            <input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Go get ice cream"
              className="min-h-12 w-full rounded-sm border border-input bg-card px-4 text-sm"
            />
          </Field>

          <Field label="Description" htmlFor="description">
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="What actually happens?"
              className="w-full rounded-sm border border-input bg-card p-4 text-sm"
            />
            {steps.length ? (
              <div className="mt-3 rounded-sm border border-border bg-muted/30 p-3">
                <h3 className="text-sm font-semibold">Quest steps</h3>
                <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {steps.map((step, index) => (
                    <li key={`${index}-${step}`}>
                      {index + 1}. {step}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </Field>

          <Field label="Location" htmlFor="location">
            {place ? (
              <div className="flex min-h-12 items-center justify-between gap-3 rounded-sm border border-input bg-card px-4 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{place.display_name}</span>
                  <span className="text-muted-foreground">{placeArea(place)}</span>
                </span>
                <button
                  type="button"
                  className="shrink-0 underline underline-offset-2"
                  onClick={() => {
                    setPlace(null);
                    setPlaceQuery("");
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  id="location"
                  value={placeQuery}
                  onChange={(event) => setPlaceQuery(event.target.value)}
                  placeholder="Search a place or street address"
                  autoComplete="off"
                  aria-describedby="location-help"
                  className="min-h-12 w-full rounded-sm border border-input bg-card px-4 text-sm"
                />
                <p id="location-help" className="mt-1 text-xs text-muted-foreground">
                  {placeLoading
                    ? "Searching…"
                    : placeError ||
                      (placeQuery.trim().length < 3
                        ? "Enter at least 3 characters to search."
                        : placeResults.length
                          ? "Choose the place you mean."
                          : "No places found yet.")}{" "}
                  · Search by OpenStreetMap
                </p>
                {placeResults.length > 0 && (
                  <ul
                    className="mt-2 divide-y divide-border rounded-sm border border-border bg-card"
                    aria-label="Location search results"
                  >
                    {placeResults.map((result) => (
                      <li key={`${result.lat},${result.lon}`}>
                        <button
                          type="button"
                          className="w-full px-3 py-3 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setPlace(result);
                            setPlaceQuery("");
                            setPlaceResults([]);
                          }}
                        >
                          {result.display_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Category</legend>
            <div className="flex flex-wrap gap-2">
              {VIBES.map((vibe) => (
                <Chip
                  key={vibe}
                  active={vibes.includes(vibe)}
                  onClick={() =>
                    setVibes((current) =>
                      current.includes(vibe)
                        ? current.filter((v) => v !== vibe)
                        : [...current, vibe],
                    )
                  }
                >
                  {VIBE_EMOJI[vibe]} {VIBE_LABEL[vibe]}
                </Chip>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Duration (min)" htmlFor="duration">
              <input
                id="duration"
                type="number"
                min={15}
                max={300}
                step={15}
                value={durationMin}
                onChange={(event) => setDuration(Number(event.target.value))}
                className="min-h-12 w-full rounded-sm border border-input bg-card px-4 text-sm"
              />
            </Field>
            <Field label="Cost per person ($)" htmlFor="cost">
              <input
                id="cost"
                type="number"
                min={0}
                max={100}
                value={costPerPerson}
                onChange={(event) => setCost(Number(event.target.value))}
                className="min-h-12 w-full rounded-sm border border-input bg-card px-4 text-sm"
              />
            </Field>
            <Field label="Max group size" htmlFor="group">
              <input
                id="group"
                type="number"
                min={2}
                max={10}
                value={groupMax}
                onChange={(event) => setGroupMax(Number(event.target.value))}
                className="min-h-12 w-full rounded-sm border border-input bg-card px-4 text-sm"
              />
            </Field>
          </div>

          <Field label={`Adventure level: ${adventure}/5`} htmlFor="adventure">
            <input
              id="adventure"
              type="range"
              min={1}
              max={5}
              value={adventure}
              onChange={(event) => setAdventure(Number(event.target.value))}
              className="h-2 w-full max-w-sm accent-primary"
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="submit">Publish quest</Button>
            <Button type="button" variant="outline" onClick={makeSmarter} disabled={isPunching}>
              {isPunching ? "Writing your quest…" : "Punch it up with AI"}
            </Button>
          </div>
        </div>

        <aside className="space-y-3 border-t border-border pt-6">
          <h3 className="text-lg font-medium">Make it a mission, not an errand</h3>
          <p className="text-sm text-muted-foreground">
            "Go get ice cream" is a plan. "Ice Cream Draft Night" is a quest: everyone picks a
            different flavor, you rank all four worst to best, and last place buys the next round.
          </p>
          <p className="text-sm text-muted-foreground">
            The smartener adds secret picks, a scoring rule and a consequence — the three things
            that turn an outing into a story. You can edit every word before publishing.
          </p>
          <p className="text-sm text-muted-foreground">+90 XP per published quest</p>
        </aside>
      </form>
    </>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}
