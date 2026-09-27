import { createFileRoute, redirect } from "@tanstack/react-router";

// Lists moved into Quests › My quests; old links land on that tab.
export const Route = createFileRoute("/lists")({
  staticData: { sitemap: false },
  beforeLoad: ({ location }) => {
    throw redirect({ to: "/", search: { tab: "mine" }, ...(location.hash ? { hash: location.hash } : {}) });
  },
});
