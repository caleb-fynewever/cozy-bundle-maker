import { PHOTOS, QUEST_PHOTO, type Photo } from "@/data/photos";
import type { Quest, Vibe } from "@/lib/types";

const BY_VIBE: Partial<Record<Vibe, string>> = {
  food: "eatstreet",
  weird: "spoon",
  active: "stone",
  competitive: "fulton",
  outdoors: "minnehaha",
  chill: "isles",
  creative: "goldmedal",
  social: "dinkytown",
  "late-night": "greenway",
};

/** Real, licensed place photo for a quest (Wikimedia Commons). */
export function questPhoto(quest: Quest): Photo {
  const key = QUEST_PHOTO[quest.id] ?? quest.vibes.map((v) => BY_VIBE[v]).find(Boolean) ?? "isles";
  return PHOTOS[key] ?? PHOTOS["isles"]!;
}

export function questImage(quest: Quest): string {
  return questPhoto(quest).url;
}
