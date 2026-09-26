import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { BadgeCheck, Flame } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { QuestDna } from "@/components/QuestDna";
import { Button, Meter, SectionTitle, Tag } from "@/components/ui-kit";
import { LEVELS, NEARBY_STUDENTS, levelFor } from "@/data/people";
import { QUESTS, getQuest } from "@/data/quests";
import { buildTasteVector } from "@/lib/engine";
import { actions, useUserState } from "@/lib/store";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile and Quest DNA — Side Quest" },
      {
        name: "description",
        content:
          "Track your quest level, streak, saved and completed missions, and watch your Quest DNA change as the engine learns your taste.",
      },
      { property: "og:title", content: "Your profile and Quest DNA — Side Quest" },
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

const BOARDS = [
  { key: "completed", title: "Most side quests", metric: (u: (typeof NEARBY_STUDENTS)[number]) => u.completed },
  { key: "created", title: "Quest creator", metric: (u: (typeof NEARBY_STUDENTS)[number]) => u.created },
  { key: "streak", title: "Streak", metric: (u: (typeof NEARBY_STUDENTS)[number]) => u.streak },
] as const;

function ProfilePage() {
  const state = useUserState();
  const taste = useMemo(() => buildTasteVector(state), [state]);
  const level = levelFor(state.xp);

  return (
    <AppShell>
      <section className="rounded-3xl border border-border bg-card p-5 sm:p-7 lift">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-2xl acid-fill font-display text-xl font-bold text-primary-foreground">
                {state.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold">
                  {state.name}
                  {state.verified ? (
                    <BadgeCheck aria-label="University verified" className="h-5 w-5 text-primary" />
                  ) : null}
                </h1>
                <p className="text-sm text-muted-foreground">
                  @{state.handle}
                  {state.verified ? " · University of Minnesota" : " · not verified yet"}
                </p>
              </div>
            </div>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">{state.bio}</p>
          </div>

          <div className="min-w-56 flex-1">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
              Level {level.level} — {level.name}
            </p>
            <div className="mt-2">
              <Meter
                label={level.next ? `Toward ${level.next.xp} XP` : "Max level"}
                value={level.progress}
                hint={`${state.xp} XP`}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Tag tone="signal">
                <Flame aria-hidden className="h-3.5 w-3.5" /> {state.streak} day streak
              </Tag>
              <Tag>{state.completed.length} completed</Tag>
              <Tag>{state.createdQuests.length} created</Tag>
              <Tag>{state.saved.length} saved</Tag>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <QuestDna
            vibes={taste.vibes}
            title="Your Quest DNA"
            note={
              taste.hasHistory
                ? `Your taste is evolving · ${taste.signals} signals`
                : "Complete or rank a quest to start training this"
            }
          />

          <QuestList title="Completed" ids={state.completed} />
          <QuestList title="Saved" ids={state.saved} />
          {state.createdQuests.length ? (
            <section className="rounded-3xl border border-border bg-card p-5">
              <h3 className="text-lg font-bold">Created by you</h3>
              <ul className="mt-3 space-y-2">
                {state.createdQuests.map((quest) => (
                  <li key={quest.id}>
                    <Link
                      to="/quest/$questId"
                      params={{ questId: quest.id }}
                      className="flex min-h-12 items-center justify-between rounded-2xl border border-border px-4 text-sm"
                    >
                      {quest.title}
                      <span className="font-mono text-xs text-muted-foreground">
                        {quest.durationMin} min
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-border bg-card p-5">
            <SectionTitle kicker="Leaderboards" title="Local legends" />
            <div className="space-y-5">
              {BOARDS.map((board) => {
                const ranked = [...NEARBY_STUDENTS].sort((a, b) => board.metric(b) - board.metric(a));
                return (
                  <div key={board.key}>
                    <h4 className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
                      {board.title}
                    </h4>
                    <ol className="mt-2 space-y-1.5">
                      {ranked.slice(0, 4).map((user, index) => (
                        <li key={user.id} className="flex items-center gap-3 text-sm">
                          <span className="w-5 font-mono text-xs text-muted-foreground">
                            {index + 1}
                          </span>
                          <span className="flex-1">{user.name}</span>
                          <span className="font-mono text-xs text-primary">{board.metric(user)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5">
            <h3 className="text-lg font-bold">Privacy</h3>
            <ul className="mt-3 space-y-3 text-sm">
              {[
                ["Nearby discovery", "optInNearby"],
                ["Share approximate area", "shareLocation"],
                ["Public profile", "publicProfile"],
              ].map(([label, key]) => {
                const value = state[key as "optInNearby" | "shareLocation" | "publicProfile"];
                return (
                  <li key={label} className="flex items-center justify-between gap-3">
                    <span>{label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={value}
                      onClick={() => actions.setPrivacy({ [key as string]: !value })}
                      className={`h-7 w-12 rounded-full border transition-colors ${
                        value ? "border-primary bg-primary" : "border-border bg-muted"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`block h-5 w-5 rounded-full bg-background transition-transform ${
                          value ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Exact coordinates are never stored or shown. Other students only ever see an
              approximate distance, and your .edu address stays private.
            </p>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5">
            <h3 className="text-lg font-bold">Demo mode</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Load a seeded profile with history, a squad and rankings — or wipe it and watch the
              engine learn from scratch.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={actions.loadDemo}>Load demo profile</Button>
              <Button variant="outline" onClick={actions.reset}>
                Reset everything
              </Button>
            </div>
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              Levels: {LEVELS.map((l) => l.name).join(" · ")}
            </p>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function QuestList({ title, ids }: { title: string; ids: string[] }) {
  const quests = ids.map((id) => getQuest(id) ?? QUESTS.find((q) => q.id === id)).filter(Boolean);
  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <h3 className="text-lg font-bold">{title}</h3>
      {quests.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {quests.map((quest) => (
            <li key={quest!.id}>
              <Link
                to="/quest/$questId"
                params={{ questId: quest!.id }}
                className="flex min-h-12 items-center justify-between rounded-2xl border border-border px-4 text-sm"
              >
                {quest!.title}
                <span className="font-mono text-xs text-muted-foreground">
                  {quest!.location.area}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
