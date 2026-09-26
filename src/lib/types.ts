export type Vibe =
  | "chill"
  | "active"
  | "food"
  | "creative"
  | "social"
  | "weird"
  | "outdoors"
  | "competitive"
  | "late-night";

export const VIBES: Vibe[] = [
  "chill",
  "active",
  "food",
  "creative",
  "social",
  "weird",
  "outdoors",
  "competitive",
  "late-night",
];

export const VIBE_LABEL: Record<Vibe, string> = {
  chill: "Chill",
  active: "Active",
  food: "Food",
  creative: "Creative",
  social: "Social",
  weird: "Weird",
  outdoors: "Outdoors",
  competitive: "Competitive",
  "late-night": "Late Night",
};

export const VIBE_EMOJI: Record<Vibe, string> = {
  chill: "🌙",
  active: "🏃",
  food: "🍜",
  creative: "🎨",
  social: "🎉",
  weird: "🎲",
  outdoors: "🌲",
  competitive: "🏆",
  "late-night": "🌃",
};

export type TimeSlot = "morning" | "afternoon" | "evening" | "late";

export type QuestLocation = {
  name: string;
  area: string;
  lat: number;
  lng: number;
};

export type Quest = {
  id: string;
  title: string;
  hook: string;
  mission: string;
  steps: string[];
  vibes: Vibe[];
  location: QuestLocation;
  durationMin: number;
  costPerPerson: number;
  groupMin: number;
  groupMax: number;
  weirdness: 1 | 2 | 3 | 4 | 5;
  adventure: 1 | 2 | 3 | 4 | 5;
  bestTime: TimeSlot[];
  indoor: boolean;
  createdBy?: string;
  generated?: boolean;
};

export type TasteVector = {
  hasHistory: boolean;
  signals: number;
  vibes: Record<Vibe, number>;
  weirdness: number;
  durationMin: number;
  costTolerance: number;
  adventure: number;
};

export type DemoUser = {
  id: string;
  name: string;
  handle: string;
  university: string;
  verified: boolean;
  bio: string;
  color: string;
  level: number;
  completed: number;
  created: number;
  streak: number;
  distanceMi: number;
  optInNearby: boolean;
  preferredGroup: [number, number];
  taste: Record<Vibe, number>;
  socials?: { instagram?: string; tiktok?: string; x?: string; github?: string };
};

export type SessionContext = {
  groupSize: number;
  timeBudgetMin: number;
  maxCost: number | null;
  vibes: Vibe[];
  chaos: number;
  timeSlot: TimeSlot;
  origin: { lat: number; lng: number; label: string };
  radiusMi: number;
  squadIds: string[];
};
