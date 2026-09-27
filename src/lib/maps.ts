import type { QuestLocation } from "@/lib/types";

/** Hands a quest's place off to a real maps app. Directions start from the phone's own location. */
export function mapsLinks(place: QuestLocation) {
  const at = `${place.lat},${place.lng}`;
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${at}`,
    apple: `https://maps.apple.com/?ll=${at}&q=${encodeURIComponent(place.name)}`,
    directions: `https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${at}`,
  };
}

/** Rough walking time at an easy 3 mph, never under two minutes. */
export function walkMinutes(miles: number) {
  return Math.max(2, Math.round(miles * 20));
}

/** "~30 min walk", or "~1 hr 15 min walk" once it's past the hour. */
export function walkLabel(miles: number) {
  const minutes = walkMinutes(miles);
  if (minutes < 60) return `~${minutes} min walk`;
  const rounded = Math.round(minutes / 5) * 5;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `~${hours} hr ${rest} min walk` : `~${hours} hr walk`;
}
