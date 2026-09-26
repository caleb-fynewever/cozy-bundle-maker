import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { QuestDna } from "@/components/QuestDna";
import { Avatar, Verified } from "@/components/ui-kit";
import { rankBoard } from "@/lib/leaderboard";
import { levelFor } from "@/data/people";
import { getQuest } from "@/data/quests";
import { buildTasteVector } from "@/lib/engine";
import { actions, useUserState } from "@/lib/store";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Side Quest" },
      {
        name: "description",
        content:
          "Track your quest level, streak, saved and completed missions, and watch your Quest DNA change as the engine learns your taste.",
      },
      { property: "og:title", content: "Your profile — Side Quest" },
      {
        property: "og:description",
        content: "Levels, streaks, leaderboards and the taste profile powering your recommendations.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const state = useUserState();
  const taste = useMemo(() => buildTasteVector(state), [state]);
  const level = levelFor(state.xp);
  const entries = useMemo(() => rankBoard(state, "completed", "friends"), [state]);
  const myRank = entries.findIndex((e) => e.you) + 1;
  const completed = state.completed.map((id) => getQuest(id)).filter(Boolean);
  const saved = state.saved.map((id) => getQuest(id)).filter(Boolean);

  const toggles = [
    ["optInNearby", "Show me to students nearby"],
    ["shareLocation", "Use my rough location"],
    ["publicProfile", "Public profile"],
  ] as const;

  return (
    <AppShell>
      <section className="pt-6 text-center sm:text-left">
        <div className="flex justify-center sm:justify-start">
          <Avatar name={state.name} you size={104} />
        </div>
         <h1 className="mt-5 text-5xl font-medium leading-tight">{state.name}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
          <span className="text-sm text-muted-foreground">@{state.handle}</span>
          {state.verified ? <Verified label="University of Minnesota" /> : null}
        </div>
        <p className="mt-4 text-lg">{state.bio}</p>
      </section>

      <dl className="mt-10 grid grid-cols-3 border-y border-border py-6 text-center sm:text-left">
        {[
          [state.completed.length, "quests done"],
          [state.createdQuests.length, "created"],
          [state.streak, "day streak"],
        ].map(([n, label]) => (
          <div key={label as string}>
            <dt className="sr-only">{label}</dt>
             <dd className="font-display text-4xl font-medium">{n}</dd>
            <dd className="text-sm text-muted-foreground">{label}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-[15px]">
          <span className="font-semibold">{level.name}</span>
          <span className="text-muted-foreground">
            {level.next ? ` · ${level.next.xp - state.xp} XP to ${level.next.name}` : " · top level"}
          </span>
        </p>
        <Link to="/leaderboard" className="min-h-11 content-center text-sm font-semibold text-primary">
          {entries.length > 1 ? `#${myRank} in your squad →` : "Leaderboard →"}
        </Link>
      </div>

      <div className="mt-12">
        <QuestDna vibes={taste.vibes} note={taste.hasHistory ? "Changes as you go." : "Do a few quests and this fills in."} />
      </div>

      {completed.length ? (
        <section className="mt-12">
          <h2 className="text-lg font-bold">Done</h2>
          <ul className="mt-3 divide-y divide-border">
            {completed.map((q) => (
              <li key={q!.id}>
                <Link to="/quest/$questId" params={{ questId: q!.id }} className="flex min-h-12 items-center justify-between py-3">
                  <span className="font-medium">{q!.title}</span>
                  <span className="text-sm text-muted-foreground">{q!.location.area}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {saved.length ? (
        <section className="mt-10">
          <h2 className="text-lg font-bold">Saved for later</h2>
          <ul className="mt-3 divide-y divide-border">
            {saved.map((q) => (
              <li key={q!.id}>
                <Link to="/quest/$questId" params={{ questId: q!.id }} className="flex min-h-12 items-center justify-between py-3">
                  <span className="font-medium">{q!.title}</span>
                  <span className="text-sm text-muted-foreground">{q!.durationMin} min</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-10">
        <Link to="/create" className="font-semibold underline underline-offset-4">
          Make a quest
        </Link>
      </p>

      <section className="mt-16 border-t border-border pt-8">
        <h2 className="text-lg font-bold">Privacy</h2>
        <p className="text-sm text-muted-foreground">We never show your exact location. Only rough distance.</p>
        <ul className="mt-4 space-y-1">
          {toggles.map(([key, label]) => (
            <li key={key}>
              <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={state[key]}
                  onChange={(e) => actions.setPrivacy({ [key]: e.target.checked })}
                  className="h-5 w-5 accent-primary"
                />
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-6 text-sm">
          <button type="button" onClick={actions.loadDemo} className="min-h-11 text-muted-foreground underline underline-offset-4">
            Load demo profile
          </button>
          <button type="button" onClick={actions.reset} className="min-h-11 text-muted-foreground underline underline-offset-4">
            Start over
          </button>
        </div>
      </section>
    </AppShell>
  );
}
