import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { LocalLegends } from "@/components/LocalLegends";
import { PageHeader } from "@/components/ui-kit";

export const Route = createFileRoute("/leaderboard")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Local Legends — wego" },
      { name: "description", content: "See how you stack up with your squad and around campus on quests, XP and streaks." },
      { property: "og:title", content: "Local Legends — wego" },
      { property: "og:description", content: "Friendly competition on wego: weekly XP, quests done, quests made and streaks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Ranks" eyebrow="a little friendly competition" />
        <LocalLegends />
      </div>
    </AppShell>
  );
}
