import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Bookmark, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { reasonLine } from "@/components/QuestCard";
import { Button } from "@/components/ui-kit";
import { QUESTS, getQuest } from "@/data/quests";
import { NEARBY_STUDENTS } from "@/data/people";
import { questImage } from "@/lib/imagery";
import { actions, useUserState } from "@/lib/store";
import { CAMPUS_ORIGIN, currentTimeSlot, distanceMi, recommend } from "@/lib/engine";

export const Route = createFileRoute("/quest/$questId")({
  loader: ({ params }) => {
    const quest = getQuest(params.questId);
    return { title: quest?.title ?? null, hook: quest?.hook ?? null };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.title) {
      return { meta: [{ title: "Quest unavailable — Side Quest" }, { name: "robots", content: "noindex" }] };
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

  const scored = useMemo(() => {
    const { results } = recommend(
      {
        groupSize: Math.max(2, state.squadIds.length + 1),
        timeBudgetMin: 300,
        maxCost: null,
        vibes: [],
        chaos: 3,
        timeSlot: currentTimeSlot(),
        origin: CAMPUS_ORIGIN,
        radiusMi: 10,
        squadIds: state.squadIds,
      },
      { ...state, passed: [] },
      [...state.createdQuests, ...QUESTS],
      40,
    );
    return results.find((r) => r.quest.id === questId);
  }, [state, questId]);

  if (!quest) throw notFound();

  const squad = NEARBY_STUDENTS.filter((u) => state.squadIds.includes(u.id));
  const saved = state.saved.includes(quest.id);
  const completed = state.completed.includes(quest.id);
  const distance = distanceMi(CAMPUS_ORIGIN, quest.location);
  const rivalId = state.completed.find((id) => id !== quest.id);
  const rival = rivalId ? getQuest(rivalId) : undefined;

  const quiet =
    "inline-flex min-h-11 items-center gap-2 px-1 text-sm font-medium text-muted-foreground hover:text-foreground";

  return (
    <AppShell>
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back
      </Link>

      <article className="mt-2">
        <img
          src={questImage(quest)}
          alt={`${quest.location.name}, ${quest.location.area}`}
          width={1200}
          height={912}
          className="aspect-[4/3] w-full rounded-2xl object-cover"
        />

        <p className="mt-8 text-sm text-muted-foreground">
          {quest.location.name} · {quest.location.area}
        </p>
        <h1 className="mt-2 text-5xl font-extrabold leading-[0.95] sm:text-6xl">{quest.title}</h1>
        <p className="mt-5 text-xl leading-relaxed">{quest.hook}</p>
        {scored ? <p className="mt-3 text-muted-foreground">{reasonLine(scored)}</p> : null}

        <h2 className="mt-12 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">The quest</h2>
        <p className="mt-3 text-lg leading-relaxed">{quest.mission}</p>
        <ol className="mt-6 space-y-5">
          {quest.steps.map((step, index) => (
            <li key={step} className="grid grid-cols-[2rem_1fr] gap-2">
              <span className="font-display text-2xl font-bold leading-none text-primary">{index + 1}</span>
              <span className="text-[17px] leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>

        <p className="mt-12 border-y border-border py-4 text-[15px] font-medium">
          {distance.toFixed(1)} mi · {quest.durationMin} min ·{" "}
          {quest.costPerPerson === 0 ? "Free" : `$${quest.costPerPerson} each`} · {quest.groupMin}–{quest.groupMax} people
        </p>

        <div className="mt-8">
          {completed ? (
            <Button variant="outline" full disabled>
              Done. Nice.
            </Button>
          ) : started ? (
            <Button
              full
              onClick={() => {
                actions.complete(quest.id);
                toast.success("Quest done. +120 XP");
              }}
            >
              I did it
            </Button>
          ) : (
            <Button full onClick={() => setStarted(true)}>
              Start quest
            </Button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-6">
          <button type="button" className={quiet} onClick={() => actions.toggleSave(quest.id)} aria-pressed={saved}>
            <Bookmark aria-hidden className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
            {saved ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            className={quiet}
            onClick={() =>
              toast(squad.length ? `Sent to ${squad.map((s) => s.name).join(" & ")}` : "Add people to your squad first")
            }
          >
            <Send aria-hidden className="h-4 w-4" /> Send to squad
          </button>
          <button
            type="button"
            className={quiet}
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                void navigator.clipboard.writeText(window.location.href);
              }
              toast("Link copied");
            }}
          >
            <Share2 aria-hidden className="h-4 w-4" /> Share
          </button>
        </div>

        {completed && rival ? (
          <section className="mt-16 border-t border-border pt-8">
            <h2 className="text-2xl font-bold">Which was better?</h2>
            <p className="mt-1 text-muted-foreground">Helps us pick your next one.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                [quest, rival],
                [rival, quest],
              ].map(([win, lose]) => (
                <Button
                  key={win!.id}
                  variant="outline"
                  full
                  onClick={() => {
                    actions.rank(win!.id, lose!.id);
                    toast("Got it");
                  }}
                >
                  {win!.title}
                </Button>
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </AppShell>
  );
}
