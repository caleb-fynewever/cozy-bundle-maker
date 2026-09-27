import { useRouterState } from "@tanstack/react-router";
import { HelpDot } from "@/components/HelpDot";

const PAGE_HELP: Record<string, { title: string; text: string }> = {
  quests: { title: "Find your next quest", text: "In Discover, swipe right to save a quest or left to pass. Tap a quest for details. Use My Quests to revisit your plans, or Create quest to share an idea of your own." },
  feed: { title: "Your squad’s adventures", text: "See the quests your squadmates have done, their photos, and their ratings out of 10. Tap a person or quest to explore more. Complete a quest and share your experience to add your own post." },
  squad: { title: "Make plans with your people", text: "Create a squad, invite friends, and switch between your squads to manage who’s in each one. Bring people together around a quest you want to try." },
  leaderboard: { title: "How Ranks works", text: "Switch between Your Squads and Global, then choose weekly XP, all-time XP, quests, creations, or streaks. Squad cards show which squads you share. Global includes public profiles and demo people." },
  profile: { title: "Your field notes", text: "Explore completed quests, rankings, and XP. On your own profile, use settings to edit your details and preferences. Tap the XP info button to learn how progress works." },
  quest: { title: "Get to know the quest", text: "Check the location, time, cost, and steps. Save the quest for later or choose Let’s go when you’re ready to head out." },
  go: { title: "Do the quest", text: "Follow the quest steps and use directions to get there. When you finish, mark it done, rate the experience, and share a photo or note with your people." },
  map: { title: "Explore the map", text: "Move and zoom the map to explore quests. Tap a pin to preview a quest, then open its details to save it or get going." },
};

export function PageHelp() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const key = pathname.split("/")[1] || "quests";
  const help = PAGE_HELP[key];
  if (!help) return null;
  return <HelpDot className="self-center border-border bg-transparent font-normal hover:border-border-strong hover:bg-surface data-[state=open]:border-border-strong data-[state=open]:bg-surface data-[state=open]:text-foreground" label={`About this page: ${help.title}`} title={help.title}>{help.text}</HelpDot>;
}
