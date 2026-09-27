/** The hand-drawn doodles in public/doodles (drawn by a friend of the team). */
export type DoodleName = "chill" | "food" | "creative" | "social" | "steps" | "outdoors" | "competitive" | "late-night" | "active" | "weird";

export function doodleSrc(name: DoodleName) {
  return `/doodles/${name}.png`;
}
