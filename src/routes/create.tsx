import { createFileRoute, redirect } from "@tanstack/react-router";

// Making a quest lives in the Quests page's Create tab; old /create links land there.
export const Route = createFileRoute("/create")({
  staticData: { sitemap: false },
  beforeLoad: () => {
    throw redirect({ to: "/", search: { tab: "create" }, replace: true });
  },
});
