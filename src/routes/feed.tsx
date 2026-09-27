import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ChevronDown, Heart, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RatingRing } from "@/components/RatingRing";
import { Avatar } from "@/components/ui-kit";
import { PageHeader } from "@/components/ui-kit";
import { FRIEND_POSTS, type FeedPost } from "@/data/feed";
import { getQuest } from "@/data/quests";
import { questImage } from "@/lib/imagery";
import { actions, useUserState } from "@/lib/store";

export const Route = createFileRoute("/feed")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Feed — wego" },
      { name: "description", content: "See what your friends got up to: quests they finished, how they rated them, photos and notes." },
      { property: "og:title", content: "Feed — wego" },
      { property: "og:description", content: "Your friends' finished quests, ratings, photos and comments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeedPage,
});

function ago(at: number) {
  const m = Math.max(1, Math.round((Date.now() - at) / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
}

function FeedPage() {
  const state = useUserState();
  const posts = [...state.posts, ...FRIEND_POSTS].sort((a, b) => b.at - a.at);

  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <PageHeader eyebrow="from your people" title="Feed" />
        <ul className="mt-3 divide-y divide-border">
          {posts.map((post) => <li key={post.id} className="py-6"><Post post={post} /></li>)}
        </ul>
        <p className="py-8 text-center font-hand text-lg text-muted-foreground">that's everyone for now · <Link to="/" className="underline decoration-primary underline-offset-4">go make a post</Link></p>
      </div>
    </AppShell>
  );
}

function Post({ post }: { post: FeedPost }) {
  const state = useUserState();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const quest = state.createdQuests.find((q) => q.id === post.questId) ?? getQuest(post.questId);
  const hearted = state.hearted.includes(post.id);
  const comments = [...post.comments, ...(state.comments[post.id] ?? [])];
  const mine = post.authorId === "me";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    actions.comment(post.id, draft.trim());
    setDraft("");
  }

  return (
    <article>
      <header className="flex items-center gap-3">
        <Avatar name={post.author} size={40} you={mine} imageUrl={mine ? state.avatarUrl : null} />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold">{mine ? "You" : post.author}</span> did{" "}
            {quest ? <Link to="/quest/$questId" params={{ questId: quest.id }} search={{ from: "feed" }} className="font-semibold underline decoration-primary underline-offset-4">{quest.title}</Link> : "a quest"}
          </p>
          <p className="text-xs text-muted-foreground">
            {post.withNames.length ? `with ${post.withNames.join(", ")} · ` : ""}{quest?.location.area ?? ""} · {ago(post.at)}
          </p>
        </div>
        <div className="shrink-0 text-center">
          <RatingRing
            rating={post.rating}
            label={post.ratingCount > 1 ? `Squad average from ${post.ratingCount} ratings` : `${post.author}'s rating`}
          />
          <span className="mt-1 block text-[10px] text-muted-foreground">
            {post.ratingCount > 1 ? "squad avg" : "their take"}
          </span>
        </div>
      </header>
      {quest || post.photo ? (
        <img src={post.photo ?? questImage(quest!)} alt={quest ? `${quest.location.name}` : "Quest photo"} loading="lazy" className="mx-auto mt-3 block aspect-[4/3] w-[86%] max-w-[420px] rounded-2xl border border-border bg-muted object-cover" />
      ) : null}
      {post.caption ? <p className="mt-3 leading-relaxed">{post.caption}</p> : null}
      <div className="mt-2 flex items-center gap-4">
        <button type="button" onClick={() => actions.toggleHeart(post.id)} aria-pressed={hearted} aria-label={hearted ? "Remove heart" : "Heart this"} className="inline-flex min-h-11 items-center gap-1.5 text-sm">
          <Heart aria-hidden className={`h-5 w-5 ${hearted ? "fill-destructive text-destructive" : ""}`} /> {post.hearts + (hearted ? 1 : 0)}
        </button>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex min-h-11 items-center gap-1 text-sm">
          <MessageCircle aria-hidden className="h-5 w-5" /> {comments.length}
          {comments.length ? <ChevronDown aria-hidden className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /> : null}
        </button>
      </div>
      {comments.length && !open ? (
        <p className="text-sm"><span className="font-semibold">{comments[comments.length - 1]!.author}</span> {comments[comments.length - 1]!.text}</p>
      ) : null}
      {open ? (
        <div className="mt-1 space-y-2">
          {comments.map((c) => <p key={c.id} className="text-sm"><span className="font-semibold">{c.author}</span> {c.text}</p>)}
          <form onSubmit={submit} className="flex gap-2 pt-1">
            <label htmlFor={`c-${post.id}`} className="sr-only">Add a comment</label>
            <input id={`c-${post.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} placeholder="Add a comment…" className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm" />
            <button type="submit" className="min-h-11 px-3 text-sm font-semibold">Post</button>
          </form>
        </div>
      ) : null}
    </article>
  );
}
