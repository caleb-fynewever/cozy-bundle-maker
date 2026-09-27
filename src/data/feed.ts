export type FeedComment = { id: string; author: string; text: string; at: number };

export type FeedPost = {
  id: string;
  author: string;
  authorId: string;
  questId: string;
  /** Average of the listed ratings, on a 0–10 scale. */
  rating: number;
  /** Number of people whose ratings are included in the average. */
  ratingCount: number;
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
  { id: "p_caleb_1", author: "Caleb", authorId: "u_caleb", questId: "q_midnight_photo_hunt", rating: 9, ratingCount: 3, caption: "Midnight photo hunt with the team. Zuan found a glowing vending machine and wouldn't leave it.", photo: null, withNames: ["Zuan", "Jacob"], at: now - 3 * h, hearts: 9, comments: [{ id: "cf1", author: "Zuan", text: "it was calling to me", at: now - 2 * h }] },
  { id: "p_reeha_1", author: "Reeha", authorId: "u_reeha", questId: "q_weisman_mimic", rating: 8.5, ratingCount: 2, caption: "Copied a painting pose at the Weisman. A guard laughed, so that counts as a win.", photo: null, withNames: ["Evan"], at: now - 9 * h, hearts: 7, comments: [] },
  { id: "p_jacob_1", author: "Jacob", authorId: "u_jacob", questId: "q_snack_crawl", rating: 8, ratingCount: 4, caption: "$5 snack draft. I picked the spicy chips and regret nothing.", photo: null, withNames: ["Caleb", "Reeha", "Evan"], at: now - 20 * h, hearts: 11, comments: [{ id: "cf2", author: "Caleb", text: "you regret something", at: now - 19 * h }] },
  { id: "p_evan_1", author: "Evan", authorId: "u_evan", questId: "q_stone_arch_freeze", rating: 9, ratingCount: 1, caption: "Stone Arch at sunset. Freezing but the photo made it worth it.", photo: null, withNames: [], at: now - 30 * h, hearts: 6, comments: [] },
  { id: "p_zuan_1", author: "Zuan", authorId: "u_zuan", questId: "q_boom_island_sunset", rating: 8.5, ratingCount: 2, caption: "Boom Island sunset. Brought snacks, forgot napkins, still great.", photo: null, withNames: ["Caleb"], at: now - 44 * h, hearts: 5, comments: [] },
  {
    id: "p_alex_1",
    author: "Alex",
    authorId: "u_alex",
    questId: "q_midnight_photo_hunt",
    rating: 8.5,
    ratingCount: 2,
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
    rating: 8,
    ratingCount: 3,
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
    rating: 8,
    ratingCount: 1,
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
    rating: 8,
    ratingCount: 2,
    caption: "Got 7 of 9 squares. The last two are a myth.",
    photo: null,
    withNames: ["Deven"],
    at: now - 50 * h,
    hearts: 3,
    comments: [],
  },
];
