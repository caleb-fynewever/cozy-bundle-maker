import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { QuestCard } from "@/components/QuestCard";
import { Avatar, Button, Chip } from "@/components/ui-kit";
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
      { title: "Build a squad — wego" },
      {
        name: "description",
        content:
          "Start a temporary squad with friends or verified students nearby. Compatibility is scored on taste, shared interests, distance and group size.",
      },
      { property: "og:title", content: "Build a squad — wego" },
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
      toast.error("That needs to be a .edu email.");
      return;
    }
    actions.verify(email);
    toast("You're verified.");
  };

  const invite = (id: string, name: string) => {
    setRequested((r) => [...r, id]);
    setTimeout(() => {
      actions.toggleSquadMember(id);
      toast(`${name} is in.`);
    }, 1200);
  };

  const people = scope === "friends" ? nearby.filter((p) => p.user.level >= 3) : nearby;

  return (
    <AppShell>
       <p className="mt-6 font-hand text-xl">better together</p>
       <h1 className="mt-2 text-5xl font-medium leading-tight sm:text-6xl">Your squad</h1>

      {squad.length ? (
        <ul className="mt-8 flex flex-wrap gap-5">
          <li className="flex flex-col items-center gap-2">
            <Avatar name={state.name} you size={56} />
            <span className="text-sm font-medium">You</span>
          </li>
          {squad.map((m) => (
            <li key={m.id} className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => actions.toggleSquadMember(m.id)}
                aria-label={`Remove ${m.name} from squad`}
                className="rounded-full"
              >
                <Avatar name={m.name} size={56} />
              </button>
              <span className="text-sm font-medium">{m.name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-lg text-muted-foreground">Just you right now.</p>
      )}

      {groupQuest && squad.length ? (
        <section className="mt-12">
           <h2 className="text-2xl font-medium">Something you'd all like</h2>
          <div className="mt-6">
            <QuestCard item={groupQuest} />
          </div>
        </section>
      ) : null}

      <section className="mt-16 border-t border-border pt-10">
         <h2 className="text-3xl font-medium">Looking for people to join?</h2>

        {!state.verified ? (
          <div className="mt-4">
            <p className="text-muted-foreground">
              Only verified students show up nearby. Your email stays private.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <label className="sr-only" htmlFor="edu">
                Student email
              </label>
              <input
                id="edu"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@umn.edu"
                 className="min-h-12 flex-1 rounded-md border border-border-strong bg-card px-5 text-[15px]"
              />
              <Button variant="ink" onClick={verifyEmail}>
                Verify
              </Button>
            </div>
          </div>
        ) : !state.optInNearby ? (
          <div className="mt-4">
            <p className="text-muted-foreground">
              Turn on nearby so other students can find you. We only ever show rough distance.
            </p>
            <div className="mt-5">
              <Button variant="ink" onClick={() => actions.setPrivacy({ optInNearby: true })}>
                Show me nearby
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Chip active={scope === "nearby"} onClick={() => setScope("nearby")}>
                Nearby
              </Chip>
              <Chip active={scope === "friends"} onClick={() => setScope("friends")}>
                Friends
              </Chip>
              <label className="sr-only" htmlFor="radius">
                Distance
              </label>
              <select
                id="radius"
                value={radiusMi}
                onChange={(e) => setRadius(Number(e.target.value))}
                 className="min-h-11 rounded-md border border-border bg-card px-4 text-sm"
              >
                {[1, 3, 5].map((r) => (
                  <option key={r} value={r}>
                    within {r} mi
                  </option>
                ))}
              </select>
            </div>

            <ul className="mt-6 divide-y divide-border">
              {people.map(({ user, score }) => {
                const pending = requested.includes(user.id);
                return (
                  <li key={user.id} className="flex items-start gap-4 py-6">
                    <Avatar name={user.name} size={52} />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold leading-tight">{user.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.distanceMi} mi away · {score}% vibe match
                      </p>
                      <p className="mt-2 text-[15px]">
                        {topVibes(user.taste, 3)
                          .map((v) => `${VIBE_EMOJI[v.vibe]} ${VIBE_LABEL[v.vibe]}`)
                          .join("   ")}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{user.bio}</p>
                    </div>
                    <Button variant={pending ? "outline" : "ink"} disabled={pending} onClick={() => invite(user.id, user.name)}>
                      {pending ? "Sent" : "Invite"}
                    </Button>
                  </li>
                );
              })}
              {people.length === 0 ? (
                <li className="py-6 text-muted-foreground">No one around right now. Try a wider distance.</li>
              ) : null}
            </ul>
            <button
              type="button"
              onClick={() => actions.setPrivacy({ optInNearby: false })}
              className="mt-4 min-h-11 text-sm text-muted-foreground underline underline-offset-4"
            >
              Stop showing me nearby
            </button>
          </>
        )}
      </section>

      <p className="mt-12 text-muted-foreground">
        See how your squad stacks up on{" "}
        <Link to="/leaderboard" className="font-semibold text-foreground underline underline-offset-4">
          Local Legends
        </Link>
        .
      </p>
    </AppShell>
  );
}
