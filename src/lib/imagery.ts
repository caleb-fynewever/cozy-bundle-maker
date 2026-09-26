import food from "@/assets/vibe-food.jpg";
import weird from "@/assets/vibe-weird.jpg";
import active from "@/assets/vibe-active.jpg";
import chill from "@/assets/vibe-chill.jpg";
import type { Quest, Vibe } from "@/lib/types";

const BY_VIBE: Partial<Record<Vibe, string>> = {
  food,
  weird,
  active,
  competitive: active,
  outdoors: active,
  chill,
  creative: weird,
  social: food,
  "late-night": food,
};

export function questImage(quest: Quest): string {
  for (const vibe of quest.vibes) {
    const image = BY_VIBE[vibe];
    if (image) return image;
  }
  return chill;
}
