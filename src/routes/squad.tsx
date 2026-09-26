import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { QuestDna } from "@/components/QuestDna";
import { Button, Chip, SectionTitle, Tag } from "@/components/ui-kit";
import { NEARBY_STUDENTS } from "@/data/people";
import { QUESTS } from "@/data/quests";
import {
  CAMPUS_ORIGIN,
  buildTasteVector,
  compatibility,
  currentTimeSlot,
  groupTasteVector,
  recommend,
  topVibes,
} from "@/lib/engine";
import { actions, useUserState } from "@/lib/store";
import { VIBE_EMOJI, VIBE_LABEL } from "@/lib/types";

export const Route = createFileRoute("/squad")({
  head: () => ({
    meta: [
      { title: "Build a squad — Side Quest" },
      {
        name: "description",
        content:
          "Start a temporary squad with friends or verified students nearby. Compatibility is scored on taste, shared interests, distance and group size.",
      },
      { property: "og:title", content: "Build a squad — Side Quest" },
      {
        property: "og:description",
        content: "Match with verified students nearby by vibe compatibility — approximate distance only.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SquadPage,
});

function SquadPage() {
  const state = useUserState();
  const [radiusMi, setRadius] = useState(3);
  const [scope, setScope] = useState<"friends" | "nearby">("nearby");
  const [email, setEmail] = useState("");
  const [requested, setRequested] = useState<string[]>([]);

  const taste = useMemo(() => buildTasteVector(state), [state]);
  const squad = NEARBY_STUDENTS.filter((u) => state.squadIds.includes(u.id));
  const groupVibes = useMemo(() => groupTasteVector(taste, squad), [taste, squad]);
  const groupSize = squad.length + 1;

  const nearby = useMemo(
    () =>
      NEARBY_STUDENTS.filter(
        (user) => user.optInNearby && user.distanceMi <= radiusMi && !state.squadIds.includes(user.id),
      )
        .map((user) => ({ user, ...compatibility(taste, user, { groupSize, radiusMi }) }))
        .sort((a, b) => b.score - a.score),
    [radiusMi, state.squadIds, taste, groupSize],
  );

  const groupQuest = useMemo(() => {
    const { results } = recommend(
      {
        groupSize,
        timeBudgetMin: 120,
        maxCost: 25,
        vibes: topVibes(groupVibes, 2).map((v) => v.vibe),
        chaos: 3,
        timeSlot: currentTimeSlot(),
        origin: CAMPUS_ORIGIN,
        radiusMi: 5,
        squadIds: state.squadIds,
      },
      state,
      [...state.createdQuests, ...QUESTS],
      1,
    );
    return results[0];
  }, [groupSize, groupVibes, state]);

  const verifyEmail = () => {
    if (!/^[^@\s]+@[^@\s]+\.edu$/i.test(email)) {
      toast.error("Use a .edu address, like you@umn.edu");
      return;
    }
    actions.verify(email);
    toast.success("University verified");
  };

  return (
    <AppShell>
      <SectionTitle kicker="Squad" title="Who's coming?" />

      {!state.verified ? (
        <section className="rounded-3xl border border-border bg-card p-5">
          <h3 className="text-lg font-bold">Verify your student email</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Nearby matching is students only. Your email is never shown on your profile.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="edu">
              Student email
            </label>
            <input
              id="edu"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@umn.edu"
              className="min-h-12 flex-1 rounded-full border border-input bg-surface px-4 text-sm"
            />
            <Button onClick={verifyEmail}>Verify</Button>
          </div>
        </section>
      ) : (
        <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-card p-5">
          <Tag tone="primary">
            <BadgeCheck aria-hidden className="h-3.5 w-3.5" /> University verified
          </Tag>
          <p className="text-sm text-muted-foreground">
            {state.name}'s squad · {groupSize}/4 players{" "}
            {groupSize < 4 ? `· looking for ${4 - groupSize} more` : ""}
          </p>
        </section>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={scope === "friends"} onClick={() => setScope("friends")}>
              Friends only
            </Chip>
            <Chip active={scope === "nearby"} onClick={() => setScope("nearby")}>
              Nearby students
            </Chip>
            {[1, 3, 5].map((r) => (
              <Chip key={r} active={radiusMi === r} onClick={() => setRadius(r)}>
                {r} mile{r > 1 ? "s" : ""}
              </Chip>
            ))}
          </div>

          {!state.optInNearby ? (
            <div className="rounded-3xl border border-border bg-card p-5">
              <h3 className="flex items-center gap-2 text-lg font-bold">
                <ShieldCheck aria-hidden className="h-5 w-5 text-primary" /> Nearby discovery is off
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Opt in to appear to other verified students. Your exact location is never shared —
                others only see an approximate distance. You can leave the queue instantly.
              </p>
              <div className="mt-4">
                <Button onClick={() => actions.setPrivacy({ optInNearby: true, shareLocation: true })}>
                  Opt in to nearby discovery
                </Button>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {(scope === "friends" ? nearby.slice(0, 2) : nearby).map(({ user, score, shared }) => (
                <li key={user.id} className="rounded-3xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="flex items-center gap-2 font-semibold">
                        {user.name}
                        {user.verified ? (
                          <BadgeCheck aria-label="University verified" className="h-4 w-4 text-primary" />
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {user.distanceMi} mi away · Level {user.level} · {user.completed} quests
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {topVibes(user.taste, 3).map(({ vibe }) => (
                          <Tag key={vibe}>
                            {VIBE_EMOJI[vibe]} {VIBE_LABEL[vibe]}
                          </Tag>
                        ))}
                      </div>
                    </div>
                    <p className="shrink-0 text-right">
                      <span className="font-mono text-2xl font-bold text-primary">{score}%</span>
                      <span className="block text-xs text-muted-foreground">compatibility</span>
                    </p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {shared.length
                      ? `You both like ${shared.map((v) => VIBE_LABEL[v].toLowerCase()).join(" and ")} quests`
                      : "Different taste — good for novelty"}
                    , prefer groups of {user.preferredGroup[0]}–{user.preferredGroup[1]}, and are
                    within {user.distanceMi} miles.
                  </p>
                  <div className="mt-3 flex gap-2">
                    {requested.includes(user.id) ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          actions.toggleSquadMember(user.id);
                          setRequested((r) => r.filter((id) => id !== user.id));
                          toast.success(`${user.name} accepted — squad updated`);
                        }}
                      >
                        {user.name} accepted · add to squad
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          setRequested((r) => [...r, user.id]);
                          toast.success(`Request sent to ${user.name}`);
                        }}
                      >
                        Request to join
                      </Button>
                    )}
                  </div>
                </li>
              ))}
              {nearby.length === 0 ? (
                <li className="rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground">
                  No verified students in this radius right now. Try widening it.
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <aside className="space-y-4">
          <QuestDna vibes={groupVibes} title="Group vibe" note={`${groupSize} players`} />

          <div className="rounded-3xl border border-border bg-card p-5">
            <h3 className="text-lg font-bold">Your squad</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span>{state.name} (you)</span>
                <span className="font-mono text-xs text-muted-foreground">host</span>
              </li>
              {squad.map((member) => (
                <li key={member.id} className="flex items-center justify-between">
                  <span>{member.name}</span>
                  <button
                    type="button"
                    onClick={() => actions.toggleSquadMember(member.id)}
                    className="min-h-11 text-xs text-muted-foreground underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {groupQuest ? (
            <div className="rounded-3xl border border-border bg-card p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
                Group quest generated
              </p>
              <h3 className="mt-2 text-xl font-bold">{groupQuest.quest.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{groupQuest.quest.hook}</p>
              <div className="mt-4">
                <Link
                  to="/quest/$questId"
                  params={{ questId: groupQuest.quest.id }}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-full acid-fill text-sm font-semibold text-primary-foreground"
                >
                  Open the mission
                </Link>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}
