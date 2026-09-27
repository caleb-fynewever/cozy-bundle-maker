import { createFileRoute, Link } from "@tanstack/react-router";
import { Doodle } from "@/components/Doodle";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Heart, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RatingRing } from "@/components/RatingRing";
import { Avatar, PageHeader, PhotoPrint, Tally } from "@/components/ui-kit";
import { FRIEND_POSTS, type FeedComment, type FeedPost } from "@/data/feed";
import { getQuest } from "@/data/quests";
import { questImage } from "@/lib/imagery";
import { DURATION, EASE_IN, EASE_OUT, SPRING, burst, reducedMotion } from "@/lib/motion";
import { actions, useUserState } from "@/lib/store";
import { cn } from "@/lib/utils";
import { VIBE_DOODLE } from "@/lib/vibes";

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
  const age = Date.now() - at;
  // A post or comment you just made says "now", not a minute it hasn't been yet.
  if (age < 60_000) return "now";
  const m = Math.round(age / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
}

function When({ at, className }: { at: number; className?: string }) {
  const date = new Date(at);
  // "now" turns into "1m" once the minute is up, if you're still looking at it.
  const [, refresh] = useState(0);
  useEffect(() => {
    const wait = 60_000 - (Date.now() - at);
    if (wait <= 0) return;
    const timer = setTimeout(() => refresh((n) => n + 1), wait + 250);
    return () => clearTimeout(timer);
  }, [at]);
  return (
    <time
      dateTime={date.toISOString()}
      title={date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
      className={className}
      suppressHydrationWarning
    >
      {ago(at)}
    </time>
  );
}

/** The heart and comment toggles: icon plus a rolling count, a sage wash on hover, a give on press. */
const actionClass =
  "press inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm font-medium tabular-nums text-foreground hover:bg-surface";

/** The same heart lucide draws, for the sticker that lands on a double-tapped photo. */
const HEART_PATH =
  "M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5";

function FeedPage() {
  const state = useUserState();
  const posts = [...state.posts, ...FRIEND_POSTS].sort((a, b) => b.at - a.at);

  return (
    <AppShell>
      <div className="mx-auto max-w-xl lg:max-w-[640px]">
        <PageHeader eyebrow="from your people" title="Feed" />
        <ul className="divide-y divide-border sm:mt-2">
          {posts.map((post, index) => (
            <li key={post.id} className="py-6 sm:py-8">
              <Post post={post} priority={index === 0} />
            </li>
          ))}
        </ul>
        <p className="border-t border-border py-10 text-center font-hand text-lg text-muted-foreground">
          {/* Block, so the moon sits centred on its own line above the note instead of inline before it. */}
          <Doodle name="chill" size={32} className="mx-auto mb-2 block rotate-12" />
          that's everyone for now ·{" "}
          <Link
            to="/"
            className="underline decoration-primary decoration-2 underline-offset-4 transition-[text-decoration-color,color] duration-(--dur-quick) hover:text-foreground hover:decoration-foreground"
          >
            go make a post
          </Link>
        </p>
      </div>
    </AppShell>
  );
}

type Pending = { before: Map<string, number>; focus: boolean; landed: boolean };

function Post({ post, priority }: { post: FeedPost; priority: boolean }) {
  const state = useUserState();
  const quest = state.createdQuests.find((q) => q.id === post.questId) ?? getQuest(post.questId);
  const mine = post.authorId === "me";
  const hearted = state.hearted.includes(post.id);
  const heartCount = post.hearts + (hearted ? 1 : 0);
  const myComments = state.comments[post.id] ?? [];
  const myCommentIds = new Set(myComments.map((c) => c.id));
  const comments = [...post.comments, ...myComments];
  const last = comments.at(-1);
  const headingId = `post-${post.id}`;
  const threadId = `thread-${post.id}`;
  const inputId = `c-${post.id}`;

  // Your post, just shared from /go: it arrives with a little rise and a handwritten "posted!".
  const [fresh] = useState(() => mine && Date.now() - post.at < 10_000);
  const [note, setNote] = useState<"on" | "fading" | "off">(fresh ? "on" : "off");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const article = useRef<HTMLElement>(null);
  const heartIcon = useRef<HTMLSpanElement>(null);
  const sticker = useRef<HTMLSpanElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  const pending = useRef<Pending | null>(null);
  const closing = useRef<Animation[]>([]);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const pointer = useRef("mouse");

  useLayoutEffect(() => {
    if (!fresh || reducedMotion()) return;
    article.current?.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], {
      duration: DURATION.slow,
      easing: SPRING,
      fill: "backwards",
    });
  }, [fresh]);

  useEffect(() => {
    if (!fresh) return;
    const fade = setTimeout(() => setNote("fading"), 2500);
    const gone = setTimeout(() => setNote("off"), 2500 + DURATION.slow);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
  }, [fresh]);

  /* ---------- heart ---------- */

  function popHeart(withBurst: boolean) {
    const icon = heartIcon.current;
    if (!icon || reducedMotion()) return;
    icon.animate(
      [
        { transform: "scale(1) rotate(0deg)", easing: EASE_OUT },
        { transform: "scale(1.3) rotate(-10deg)", offset: 0.28, easing: "ease-in-out" },
        { transform: "scale(0.92) rotate(3deg)", offset: 0.6, easing: "ease-in-out" },
        { transform: "scale(1) rotate(0deg)" },
      ],
      { duration: 460 },
    );
    if (withBurst) {
      const r = icon.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, { sparks: 5, stars: 3, spread: 26 });
    }
  }

  function toggleHeart() {
    actions.toggleHeart(post.id);
    if (!hearted) {
      popHeart(true);
      return;
    }
    // Un-hearting settles quietly: no burst, just a small give.
    if (!reducedMotion()) heartIcon.current?.animate([{ transform: "scale(0.86)" }, { transform: "scale(1)" }], { duration: DURATION.quick, easing: EASE_OUT });
  }

  /** Double-tap (or double-click) the photo: hearts it, never un-hearts it, and stamps a heart on the print. */
  function heartFromPhoto() {
    if (!hearted) {
      actions.toggleHeart(post.id);
      popHeart(false);
    }
    const el = sticker.current;
    if (!el) return;
    if (reducedMotion()) {
      el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: 900 });
      return;
    }
    el.animate(
      [
        { opacity: 0, transform: "scale(0.4) rotate(-18deg)", easing: EASE_OUT },
        { opacity: 1, transform: "scale(1.12) rotate(-6deg)", offset: 0.2, easing: "ease-in-out" },
        { opacity: 1, transform: "scale(1) rotate(-8deg)", offset: 0.32 },
        { opacity: 1, transform: "scale(1) rotate(-8deg)", offset: 0.68, easing: EASE_IN },
        { opacity: 0, transform: "translateY(-8px) scale(0.96) rotate(-8deg)" },
      ],
      { duration: 1050 },
    );
    const r = el.getBoundingClientRect();
    setTimeout(() => burst(r.left + r.width / 2, r.top + r.height / 2, { sparks: 7, stars: 3, spread: 46 }), 120);
  }

  /* ---------- thread ---------- */

  const track = (key: string) => (el: HTMLElement | null) => {
    if (el) rows.current.set(key, el);
    else rows.current.delete(key);
  };

  function measure() {
    const tops = new Map<string, number>();
    for (const [key, el] of rows.current) tops.set(key, el.getBoundingClientRect().top);
    return tops;
  }

  function openThread(focus: boolean) {
    if (closing.current.length) {
      // Changed your mind mid-close: stay open, nothing is locked.
      for (const animation of closing.current) animation.cancel();
      closing.current = [];
      if (focus) input.current?.focus();
      return;
    }
    if (open) return;
    pending.current = { before: measure(), focus, landed: false };
    setOpen(true);
  }

  function closeThread(returnFocus: boolean) {
    if (!open || closing.current.length) return;
    const finish = () => {
      closing.current = [];
      pending.current = { before: measure(), focus: false, landed: false };
      setOpen(false);
      if (returnFocus) toggle.current?.focus();
    };
    const leaving = [...rows.current].filter(([key]) => key !== last?.id).map(([, el]) => el);
    if (reducedMotion() || !leaving.length) {
      finish();
      return;
    }
    closing.current = leaving.map((el) =>
      el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-4px)" }], {
        duration: 150,
        easing: EASE_IN,
        fill: "forwards",
      }),
    );
    closing.current[0]!.onfinish = finish;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    pending.current = { before: measure(), focus: false, landed: true };
    actions.comment(post.id, text);
    setDraft("");
  }

  // After the thread opens, closes or gains a comment: rows that moved glide from where they were
  // (FLIP, transform only), rows that are new fade in, and a comment you just posted rises in on a
  // sage wash that fades out.
  useLayoutEffect(() => {
    const change = pending.current;
    if (!change) return;
    pending.current = null;
    const still = reducedMotion();
    for (const [key, el] of rows.current) {
      const was = change.before.get(key);
      if (was === undefined) {
        if (change.landed && key !== "composer") {
          el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1200, easing: EASE_OUT, pseudoElement: "::before" });
          if (!still) el.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: DURATION.base, easing: EASE_OUT });
        } else if (!still) {
          el.animate([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], {
            duration: DURATION.base,
            delay: 40,
            easing: EASE_OUT,
            fill: "backwards",
          });
        }
        continue;
      }
      const dy = was - el.getBoundingClientRect().top;
      if (!still && Math.abs(dy) > 0.5) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: DURATION.base, easing: EASE_OUT });
    }
    if (change.focus && input.current) {
      input.current.focus({ preventScroll: true });
      input.current.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
    }
  });

  /* ---------- pieces ---------- */

  const photo = post.photo ?? (quest ? questImage(quest) : null);
  const place = quest?.location.name;
  const alt = post.photo ? `${mine ? "Your" : `${post.author}'s`} photo${place ? ` at ${place}` : ""}` : (place ?? "Quest photo");
  const takeNote = post.ratingCount > 1 ? "squad avg" : mine ? "your take" : "their take";
  const takeLabel = post.ratingCount > 1 ? `Squad average from ${post.ratingCount} ratings` : mine ? "Your rating" : `${post.author}'s rating`;

  const meta: ReactNode[] = [];
  if (post.withNames.length) meta.push(`with ${post.withNames.join(", ")}`);
  if (quest?.location.area) meta.push(quest.location.area);
  meta.push(<When key="when" at={post.at} />);

  const visible = open ? comments : last ? [last] : [];
  const more = comments.length - 1;

  return (
    <article ref={article} aria-labelledby={headingId} className="lg:grid lg:grid-cols-[44px_minmax(0,1fr)] lg:gap-x-4">
      {/* Laptop: the avatar gets its own gutter so photo, actions, caption and thread share one edge. */}
      <div className="hidden lg:block">
        <div className="sticky top-[92px]">
          <Avatar name={post.author} size={44} you={mine} imageUrl={mine ? state.avatarUrl : null} />
        </div>
      </div>

      <div className="min-w-0">
        <header className="flex items-start gap-3">
          <span className="lg:hidden">
            <Avatar name={post.author} size={44} you={mine} imageUrl={mine ? state.avatarUrl : null} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={headingId} className="text-[15px] font-normal leading-snug text-pretty">
              <span className="font-semibold">{mine ? "You" : post.author}</span> <span className="text-muted-foreground">did</span>{" "}
              {quest ? (
                <Link
                  to="/quest/$questId"
                  params={{ questId: quest.id }}
                  search={{ from: "feed" }}
                  className="font-semibold underline decoration-primary decoration-2 underline-offset-4 transition-[text-decoration-color] duration-(--dur-quick) hover:decoration-foreground"
                >
                  {quest.title}
                </Link>
              ) : (
                "a quest"
              )}
            </h2>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
              {meta.map((part, index) => (
                <Fragment key={index}>
                  {index ? " · " : null}
                  {part}
                </Fragment>
              ))}
              {note !== "off" ? (
                <span
                  className={cn(
                    "ml-2 inline-block -rotate-3 font-hand text-[15px] leading-none text-ring transition-opacity duration-(--dur-slow) ease-(--ease-in)",
                    note === "fading" && "opacity-0",
                  )}
                >
                  posted!
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1 sm:flex-row-reverse sm:gap-2">
            <RatingRing rating={post.rating} label={takeLabel} instant={fresh} />
            <span aria-hidden className="font-hand text-sm leading-none text-muted-foreground">
              {takeNote}
            </span>
          </div>
        </header>

        {photo ? (
          <div
            className="mt-3 touch-manipulation select-none"
            onPointerDown={(event) => {
              pointer.current = event.pointerType;
            }}
            onPointerUp={(event) => {
              if (event.pointerType === "mouse") return;
              const tap = { t: event.timeStamp, x: event.clientX, y: event.clientY };
              const prev = lastTap.current;
              if (prev && tap.t - prev.t < 320 && Math.hypot(tap.x - prev.x, tap.y - prev.y) < 32) {
                lastTap.current = null;
                heartFromPhoto();
              } else {
                lastTap.current = tap;
              }
            }}
          >
            <PhotoPrint
              src={photo}
              alt={alt}
              priority={priority}
              {...(quest?.vibes[0] ? { fallback: <Doodle name={VIBE_DOODLE[quest.vibes[0]]} size={56} faint /> } : {})}
              imgClassName="aspect-[4/3] lg:aspect-[3/2]"
              onDoubleClick={() => {
                if (pointer.current === "mouse") heartFromPhoto();
              }}
            >
              <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
                <span ref={sticker} className="opacity-0">
                  <svg viewBox="-2 -2 28 28" className="size-[76px]">
                    <path d={HEART_PATH} className="fill-card stroke-card" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
                    <path d={HEART_PATH} className="fill-primary stroke-foreground" strokeWidth={1.3} strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                </span>
              </span>
            </PhotoPrint>
          </div>
        ) : null}

        <div className="-ml-2 mt-1 flex items-center gap-1">
          <button type="button" onClick={toggleHeart} aria-pressed={hearted} className={actionClass}>
            <span ref={heartIcon} aria-hidden className="grid">
              <Heart
                className={cn("size-[22px] transition-[fill] duration-(--dur-quick) ease-(--ease-out)", hearted ? "fill-primary" : "fill-transparent")}
                strokeWidth={1.9}
              />
            </span>
            <span className="sr-only">Heart</span>
            <Tally value={heartCount} />
          </button>
          <button
            ref={toggle}
            type="button"
            onClick={() => (open && !closing.current.length ? closeThread(false) : openThread(true))}
            aria-expanded={open}
            aria-controls={threadId}
            className={actionClass}
          >
            <MessageCircle aria-hidden className="size-[22px]" strokeWidth={1.9} />
            <span className="sr-only">Comments</span>
            <Tally value={comments.length} />
          </button>
        </div>

        {post.caption ? <p className="mt-1 max-w-[62ch] leading-relaxed text-pretty">{post.caption}</p> : null}

        <div id={threadId} className="mt-2 empty:hidden">
          {visible.length ? (
            <ul aria-label="Comments" className="space-y-2.5">
              {visible.map((comment) => {
                const own = myCommentIds.has(comment.id);
                return (
                  <li key={comment.id} ref={track(comment.id)} className="comment-row">
                    {!open && comment === last ? (
                      <button
                        type="button"
                        onClick={() => openThread(false)}
                        aria-expanded={false}
                        aria-controls={threadId}
                        className="group -mx-2 -my-3 flex min-h-11 w-[calc(100%+1rem)] cursor-pointer items-start rounded-md px-2 py-3 text-left transition-colors duration-(--dur-quick) hover:bg-surface"
                      >
                        <span className="sr-only">Open comments. Latest: </span>
                        <CommentLine
                          comment={comment}
                          own={own}
                          avatarUrl={state.avatarUrl}
                          trailing={
                            more > 0 ? (
                              <span className="whitespace-nowrap text-muted-foreground transition-colors duration-(--dur-quick) group-hover:text-foreground">
                                {" "}
                                · {more} more
                              </span>
                            ) : null
                          }
                        />
                      </button>
                    ) : (
                      <CommentLine comment={comment} own={own} avatarUrl={state.avatarUrl} />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {open ? (
            <form
              ref={track("composer")}
              onSubmit={submit}
              className={cn(
                "flex min-h-11 items-center rounded-md border border-input bg-card pl-3 transition-colors duration-(--dur-quick)",
                "has-[input:focus-visible]:border-border-strong has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring",
                visible.length ? "mt-3" : null,
              )}
            >
              <label htmlFor={inputId} className="sr-only">
                Add a comment
              </label>
              <input
                ref={input}
                id={inputId}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  closeThread(true);
                }}
                maxLength={200}
                placeholder="Add a comment…"
                autoComplete="off"
                enterKeyHint="send"
                className="h-11 min-w-0 flex-1 scroll-mb-32 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground md:scroll-mb-8"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="press h-11 shrink-0 cursor-pointer rounded-md px-3 text-sm font-semibold text-foreground disabled:cursor-default disabled:text-muted-foreground"
              >
                Post
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CommentLine({ comment, own, avatarUrl, trailing }: { comment: FeedComment; own: boolean; avatarUrl: string | null; trailing?: ReactNode }) {
  return (
    <span className="flex min-w-0 items-start gap-2.5">
      <Avatar name={comment.author} size={20} you={own} imageUrl={own ? avatarUrl : null} />
      <span className="min-w-0 text-sm leading-snug text-pretty">
        <span className="font-semibold">{own ? "You" : comment.author}</span> {comment.text}
        <When at={comment.at} className="ml-1.5 whitespace-nowrap text-xs text-muted-foreground" />
        {trailing}
      </span>
    </span>
  );
}
