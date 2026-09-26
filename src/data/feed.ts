export type FeedComment = { id: string; author: string; text: string; at: number };

export type FeedPost = {
  id: string;
  author: string;
  authorId: string;
  questId: string;
  /** 1–5 */
  rating: number;
  caption: string;
  /** Uploaded photo (data URL) or null to use the quest photo. */
  photo: string | null;
  withNames: string[];
  at: number;
  hearts: number;
  comments: FeedComment[];
};

const h = 3_600_000;
const now = Date.now();

/** Seeded friend activity so the feed has something to show without a backend. */
export const FRIEND_POSTS: FeedPost[] = [
  {
    id: "p_alex_1",
    author: "Alex",
    authorId: "u_alex",
    questId: "q_midnight_photo_hunt",
    rating: 5,
    caption: "Found a neon sign I've walked past 400 times and never noticed. Jordan got the best shot, I'll never admit it.",
    photo: null,
    withNames: ["Jordan"],
    at: now - 2 * h,
    hearts: 12,
    comments: [
      { id: "c1", author: "Maya", text: "ok this is going on my list", at: now - h },
      { id: "c2", author: "Jordan", text: "admit it", at: now - h / 2 },
    ],
  },
  {
    id: "p_maya_1",
    author: "Maya",
    authorId: "u_maya",
    questId: "q_snack_crawl",
    rating: 4,
    caption: "Three stops, one clear winner. Go hungry, leave humbled.",
    photo: null,
    withNames: ["Sam", "Priya"],
    at: now - 7 * h,
    hearts: 8,
    comments: [{ id: "c3", author: "Alex", text: "which one won??", at: now - 6 * h }],
  },
  {
    id: "p_jordan_1",
    author: "Jordan",
    authorId: "u_jordan",
    questId: "q_stone_arch_freeze",
    rating: 4,
    caption: "Cold. Worth it. The skyline at dusk did most of the work.",
    photo: null,
    withNames: [],
    at: now - 26 * h,
    hearts: 5,
    comments: [],
  },
  {
    id: "p_sam_1",
    author: "Sam",
    authorId: "u_sam",
    questId: "q_northeast_mural_bingo",
    rating: 3,
    caption: "Got 7 of 9 squares. The last two are a myth.",
    photo: null,
    withNames: ["Deven"],
    at: now - 50 * h,
    hearts: 3,
    comments: [],
  },
];
