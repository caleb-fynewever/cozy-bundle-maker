import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar, Chip } from "@/components/ui-kit";
import { BOARDS, nextUp, rankBoard, type BoardKey } from "@/lib/leaderboard";
import { useUserState } from "@/lib/store";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Local Legends — wego" },
      { name: "description", content: "See who's done the most side quests, made the most, and kept the longest streak." },
      { property: "og:title", content: "Local Legends — wego" },
      { property: "og:description", content: "Friendly competition: quests done, quests made, streaks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const state = useUserState();
  const [key, setKey] = useState<BoardKey>("week");
  const [scope, setScope] = useState<"friends" | "everyone">("friends");
  const board = BOARDS.find((b) => b.key === key)!;
  const entries = useMemo(() => rankBoard(state, key, scope), [state, key, scope]);
  const gap = nextUp(entries, board.unit);
  const onlyYou = entries.length === 1;

  return (
    <AppShell>
       <p className="mt-6 font-hand text-xl">a little friendly competition</p>
       <h1 className="mt-2 text-5xl font-medium leading-tight sm:text-6xl">Local Legends</h1>
      {gap ? <p className="mt-3 text-lg text-muted-foreground">{gap}</p> : null}

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Leaderboard">
        {BOARDS.map((b) => (
          <Chip key={b.key} active={key === b.key} onClick={() => setKey(b.key)}>
            {b.title}
          </Chip>
        ))}
      </div>
      <div className="mt-4 flex gap-5 text-sm" role="group" aria-label="Who to compare with">
        {(["friends", "everyone"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={scope === s}
            onClick={() => setScope(s)}
             className={`min-h-11 font-medium ${
              scope === s ? "text-foreground underline decoration-2 underline-offset-8" : "text-muted-foreground"
            }`}
          >
            {s === "friends" ? "Your squad" : "Around campus"}
          </button>
        ))}
      </div>

      <ol className="mt-6 divide-y divide-border border-y border-border">
        {entries.map((entry, i) => (
          <li
            key={entry.id}
              className={`flex items-center gap-4 py-4 ${entry.you ? "-mx-3 border-l-4 border-primary bg-card px-3" : ""}`}
          >
             <span className={`w-6 text-right font-hand text-2xl ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>
              {i + 1}
            </span>
            <Avatar name={entry.name} you={entry.you} size={i < 3 ? 48 : 40} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{entry.you ? `${entry.name} (you)` : entry.name}</span>
              <span className="block text-sm text-muted-foreground">{entry.level}</span>
            </span>
            <span className="text-sm text-muted-foreground">{board.unit(entry.value)}</span>
          </li>
        ))}
      </ol>

      {onlyYou ? (
        <p className="mt-6 text-muted-foreground">
          It's just you so far.{" "}
          <Link to="/squad" className="font-semibold text-foreground underline underline-offset-4">
            Add friends to your squad
          </Link>{" "}
          to see how you stack up.
        </p>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Finish a quest to move up. Making one others finish counts too.
        </p>
      )}
    </AppShell>
  );
}
