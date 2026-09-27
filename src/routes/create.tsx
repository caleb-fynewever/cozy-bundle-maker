import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CreateQuestForm } from "@/components/CreateQuestForm";

export const Route = createFileRoute("/create")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Create a quest — wego" },
      {
        name: "description",
        content:
          "Turn a plain idea into a real side quest: add a location, duration, cost and chaos level, then let the quest smartener sharpen it into a mission.",
      },
      { property: "og:title", content: "Create a quest — wego" },
      {
        property: "og:description",
        content:
          "Turn a plain idea into a real side quest: add a location, duration, cost and chaos level, then let the quest smartener sharpen it into a mission.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <CreateQuestForm />
    </AppShell>
  ),
});
