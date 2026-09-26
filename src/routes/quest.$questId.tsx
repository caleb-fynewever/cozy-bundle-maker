import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Bookmark, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { QuestDna } from "@/components/QuestDna";
import { WhyPanel, QuestMeta } from "@/components/QuestCard";
import { Button, Tag } from "@/components/ui-kit";
import { QUESTS, getQuest } from "@/data/quests";
import { NEARBY_STUDENTS } from "@/data/people";
import { questImage } from "@/lib/imagery";
import { actions, useUserState } from "@/lib/store";
import {
  CAMPUS_ORIGIN,
  buildTasteVector,
  currentTimeSlot,
  distanceMi,
  groupTasteVector,
  recommend,
} from "@/lib/engine";
import { VIBE_EMOJI, VIBE_LABEL } from "@/lib/types";

export const Route = createFileRoute("/quest/$questId")({
  loader: ({ params }) => {
    const quest = getQuest(params.questId);
    return { title: quest?.title ?? null, hook: quest?.hook ?? null };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.title) {
      return {
        meta: [
          { title: "Quest unavailable — Side Quest" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    return {
      meta: [
        { title: `${loaderData.title} — Side Quest` },
        { name: "description", content: loaderData.hook ?? "" },
        { property: "og:title", content: `${loaderData.title} — Side Quest` },
        { property: "og:description", content: loaderData.hook ?? "" },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: QuestDetail,
});

function QuestDetail() {
  const { questId } = Route.useParams();
  const state = useUserState();
  const [started, setStarted] = useState(false);

  const quest = useMemo(
    () => state.createdQuests.find((q) => q.id === questId) ?? getQuest(questId),
    [questId, state.createdQuests],
  );

  const context = useMemo(
    () => ({
      groupSize: Math.max(2, state.squadIds.length + 1),
      timeBudgetMin: 120,
      maxCost: null,
      vibes: [],
      chaos: 3,
      timeSlot: currentTimeSlot(),
      origin: CAMPUS_ORIGIN,
      radiusMi: 10,
      squadIds: state.squadIds,
    }),
    [state.squadIds],
  );

  const scored = useMemo(() => {
    const { results } = recommend(context, { ...state, passed: [] }, [...state.createdQuests, ...QUESTS], 40);
    return results.find((r) => r.quest.id === questId);
  }, [context, state, questId]);

  const taste = useMemo(() => buildTasteVector(state), [state]);
  const squad = NEARBY_STUDENTS.filter((u) => state.squadIds.includes(u.id));
  const groupVibes = useMemo(() => groupTasteVector(taste, squad), [taste, squad]);

  if (!quest) throw notFound();

  const saved = state.saved.includes(quest.id);
  const completed = state.completed.includes(quest.id);
  const distance = distanceMi(CAMPUS_ORIGIN, quest.location);

  const rivalId = state.completed.find((id) => id !== quest.id);
  const rival = rivalId ? getQuest(rivalId) : undefined;

  return (
    <AppShell>
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to Discover
      </Link>

      <article className="mt-3 overflow-hidden rounded-3xl border border-border bg-card lift">
        <div className="relative">
          <img
            src={questImage(quest)}
            alt={`${quest.location.name}, ${quest.location.area}`}
            width={1200}
            height={912}
            className="h-64 w-full object-cover sm:h-96"
          />
          <div aria-hidden className="absolute inset-0 night-fade" />
          <div className="absolute bottom-6 left-5 right-5">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
              {quest.location.area} · {distance.toFixed(1)} mi away
            </p>
            <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">
              {quest.title}
            </h1>
          </div>
        </div>

        <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <div>
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-signal">The mission</h2>
              <p className="mt-2 text-lg leading-relaxed">{quest.mission}</p>
            </div>

            <div>
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Objective</h2>
              <ol className="mt-3 space-y-3">
                {quest.steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-xs text-primary">
                      {index + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-wrap gap-2">
              {quest.vibes.map((vibe) => (
                <Tag key={vibe}>
                  {VIBE_EMOJI[vibe]} {VIBE_LABEL[vibe]}
                </Tag>
              ))}
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["📍 Location", `${quest.location.name}`],
                ["⏱ Duration", `${quest.durationMin} min`],
                ["💰 Cost", quest.costPerPerson === 0 ? "Free" : `$${quest.costPerPerson}/person`],
                ["👥 Group", `${quest.groupMin}-${quest.groupMax} people`],
                ["🎲 Weirdness", `${quest.weirdness}/5`],
                ["🔥 Adventure", `${quest.adventure}/5`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border bg-surface/60 p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-2 sm:grid-cols-2">
              {completed ? (
                <Button variant="outline" full>
                  ✓ Quest completed
                </Button>
              ) : started ? (
                <Button
                  full
                  onClick={() => {
                    actions.complete(quest.id);
                    toast.success("Quest complete — +120 XP");
                  }}
                >
                  Mark complete
                </Button>
              ) : (
                <Button full onClick={() => setStarted(true)}>
                  Start quest
                </Button>
              )}
              <Button variant="ghost" full onClick={() => actions.toggleSave(quest.id)}>
                <Bookmark aria-hidden className="h-4 w-4" /> {saved ? "Saved" : "Save"}
              </Button>
              <Button
                variant="ghost"
                full
                onClick={() =>
                  toast.success(
                    squad.length
                      ? `Sent to ${squad.map((s) => s.name).join(" & ")}`
                      : "Add squad members first",
                  )
                }
              >
                <Send aria-hidden className="h-4 w-4" /> Send to squad
              </Button>
              <Button
                variant="ghost"
                full
                onClick={() => {
                  const url = typeof window !== "undefined" ? window.location.href : "";
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    void navigator.clipboard.writeText(url);
                  }
                  toast.success("Quest link copied");
                }}
              >
                <Share2 aria-hidden className="h-4 w-4" /> Share
              </Button>
            </div>

            {completed && rival ? (
              <section className="rounded-3xl border border-border bg-surface/60 p-5">
                <h2 className="text-lg font-bold">Which one was better?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pairwise rankings teach the engine faster than stars. Your Quest DNA updates
                  immediately.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    full
                    onClick={() => {
                      actions.rank(quest.id, rival.id);
                      toast.success("Taste profile updated");
                    }}
                  >
                    {quest.title}
                  </Button>
                  <Button
                    variant="outline"
                    full
                    onClick={() => {
                      actions.rank(rival.id, quest.id);
                      toast.success("Taste profile updated");
                    }}
                  >
                    {rival.title}
                  </Button>
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-4">
            {scored ? (
              <div className="rounded-3xl border border-border bg-surface/60 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
                  {Math.round(scored.score * 100)}% personalized match
                </p>
                <div className="mt-3">
                  <QuestMeta item={scored} />
                </div>
                <div className="mt-4">
                  <WhyPanel item={scored} />
                </div>
              </div>
            ) : null}
            <QuestDna
              vibes={groupVibes}
              title={squad.length ? "Group vibe" : "Your Quest DNA"}
              note={taste.hasHistory ? `${taste.signals} signals` : "No history yet"}
            />
          </aside>
        </div>
      </article>
    </AppShell>
  );
}
