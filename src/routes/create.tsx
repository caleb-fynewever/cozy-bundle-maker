import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button, Chip, SectionTitle } from "@/components/ui-kit";
import { actions } from "@/lib/store";
import { VIBES, VIBE_EMOJI, VIBE_LABEL, type Quest, type Vibe } from "@/lib/types";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create a quest — wego" },
      {
        name: "description",
        content:
          "Turn a plain idea into a real side quest: add a location, duration, cost and chaos level, then let the quest smartener sharpen it into a mission.",
      },
      { property: "og:title", content: "Create a quest — wego" },
      {
        property: "og:description",
        content: "Write a side quest for the campus, complete with objectives and a chaos rating.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreatePage,
});

const AREAS = [
  { name: "Dinkytown", area: "Marcy-Holmes", lat: 44.9807, lng: -93.2355 },
  { name: "East Bank, UMN", area: "East Bank", lat: 44.9741, lng: -93.2277 },
  { name: "Stone Arch Bridge", area: "Downtown East", lat: 44.9812, lng: -93.2564 },
  { name: "Uptown", area: "Lowry Hill East", lat: 44.9485, lng: -93.2977 },
  { name: "Northeast Arts District", area: "Northeast", lat: 45.0001, lng: -93.2472 },
  { name: "Bde Maka Ska", area: "East Calhoun", lat: 44.9435, lng: -93.3106 },
];

/**
 * Deterministic "make this quest smarter" transform — turns a flat idea into a
 * competitive, group-shaped mission. Works with zero external services.
 */
function smarten(title: string, description: string, vibes: Vibe[], chaos: number) {
  const subject = title.trim() || "The plan";
  const twistBank = [
    "Nobody picks for themselves — the person on your left decides.",
    "Every choice has to be one nobody in the group has tried before.",
    "Blind-rank the results at the end; last place chooses the next stop.",
    "One rule: no phones until the final vote.",
    "A stranger has to break the tie.",
  ];
  const twists = twistBank.slice(0, Math.max(2, Math.min(4, chaos)));
  const label = vibes.length ? VIBE_LABEL[vibes[0]!] : "Side";

  return {
    title: `${subject.replace(/\.$/, "")} — ${label} Draft`,
    mission:
      `${description.trim() || subject}. Turn it into a competition instead of an errand: ` +
      `everyone commits to a pick in secret, then the group judges all of it together.`,
    steps: [
      "Set a 5 minute window for everyone to commit to a pick in secret.",
      ...twists,
      "Score every pick 1-10 and crown a winner out loud.",
    ],
  };
}

function CreatePage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState(AREAS[0]!.name);
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [durationMin, setDuration] = useState(60);
  const [costPerPerson, setCost] = useState(10);
  const [groupMax, setGroupMax] = useState(4);
  const [adventure, setAdventure] = useState(3);
  const [steps, setSteps] = useState<string[]>([]);

  const publish = () => {
    if (!title.trim()) {
      toast.error("Give the quest a title");
      return;
    }
    const place = AREAS.find((a) => a.name === locationName) ?? AREAS[0]!;
    const quest: Quest = {
      id: `q_user_${Date.now()}`,
      title: title.trim(),
      hook: description.trim().slice(0, 120) || "A quest made by a student, for students.",
      mission: description.trim() || title.trim(),
      steps: steps.length ? steps : ["Meet up.", "Do the thing.", "Rank how it went."],
      vibes: vibes.length ? vibes : ["social"],
      location: place,
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

  const makeSmarter = () => {
    const result = smarten(title, description, vibes, adventure);
    setTitle(result.title);
    setDescription(result.mission);
    setSteps(result.steps);
    toast.success("Sharpened into a mission — edit anything before publishing");
  };

  return (
    <AppShell>
       <p className="mt-6 font-hand text-xl">got an idea?</p>
       <h1 className="mt-2 text-5xl font-medium leading-tight">Make a quest</h1>

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
          </Field>

          <Field label="Location" htmlFor="location">
            <select
              id="location"
              value={locationName}
              onChange={(event) => setLocationName(event.target.value)}
               className="min-h-12 w-full rounded-sm border border-input bg-card px-4 text-sm"
            >
              {AREAS.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name} · {a.area}
                </option>
              ))}
            </select>
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
                      current.includes(vibe) ? current.filter((v) => v !== vibe) : [...current, vibe],
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

          {steps.length ? (
            <div>
              <h3 className="text-sm font-semibold">Objective</h3>
              <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {steps.map((step, index) => (
                  <li key={step}>
                    {index + 1}. {step}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit">Publish quest</Button>
            <Button variant="outline" onClick={makeSmarter}>
              Punch it up
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
            The smartener adds secret picks, a scoring rule and a consequence — the three things that
            turn an outing into a story. You can edit every word before publishing.
          </p>
          <p className="text-sm text-muted-foreground">+90 XP per published quest</p>
        </aside>
      </form>
    </AppShell>
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
