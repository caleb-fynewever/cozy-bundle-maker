import { createFileRoute, redirect } from "@tanstack/react-router";

// Ranks live on the Squad page now; old links land on that section.
export const Route = createFileRoute("/leaderboard")({
  staticData: { sitemap: false },
  beforeLoad: () => {
    throw redirect({ to: "/squad", hash: "ranks" });
  },
});
