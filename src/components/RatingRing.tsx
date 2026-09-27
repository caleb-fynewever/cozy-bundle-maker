import { useLayoutEffect, useRef } from "react";
import { EASE_OUT, reducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const STAR = "M5 0Q5.7 4.3 10 5Q5.7 5.7 5 10Q4.3 5.7 0 5Q4.3 4.3 5 0Z";

const format = (n: number, decimals: number) => (decimals ? n.toFixed(1) : String(Math.round(n)));

/**
 * A Beli-style score: a deep clover arc around the number, on a pale track, printed on a white disc.
 * The first time it sits comfortably in view the arc fills and the number counts up with it (a post
 * you just shared fills right away). A 9 or better earns a small star. Reduced motion shows the
 * final score at once.
 */
export function RatingRing({
  rating,
  label,
  instant = false,
  className,
}: {
  rating: number;
  label: string;
  /** Fill now instead of waiting to be scrolled into view (your own post, just shared). */
  instant?: boolean;
  className?: string;
}) {
  const score = Math.min(10, Math.max(0, rating));
  const decimals = Number.isInteger(score) ? 0 : 1;
  const display = format(score, decimals);
  const earned = score >= 9;
  const root = useRef<HTMLDivElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const number = useRef<HTMLSpanElement>(null);
  const star = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    const ring = arc.current;
    const figure = number.current;
    if (!el || !ring || !figure) return;
    // Write into React's own text node, so the digits and React never disagree.
    const text = figure.firstChild;
    const paint = (p: number) => {
      const filled = (score / 10) * p;
      ring.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - filled));
      // A round cap on a zero-length dash still draws a dot; hide the arc until it has length.
      ring.style.opacity = filled > 0.005 ? "1" : "0";
      if (text) text.nodeValue = format(score * p, decimals);
    };
    const land = (animate: boolean) => {
      const mark = star.current;
      if (!mark) return;
      mark.style.opacity = "1";
      if (animate) {
        mark.animate(
          [
            { transform: "scale(0) rotate(-60deg)", opacity: 0 },
            { transform: "scale(1.35) rotate(12deg)", opacity: 1, offset: 0.55 },
            { transform: "scale(1) rotate(0deg)", opacity: 1 },
          ],
          { duration: 460, easing: EASE_OUT },
        );
      }
    };

    if (reducedMotion() || typeof IntersectionObserver === "undefined") {
      paint(1);
      figure.style.opacity = "1";
      land(false);
      return;
    }

    paint(0);
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let observer: IntersectionObserver | undefined;
    const run = () => {
      figure.style.opacity = "1";
      const duration = 620 + 380 * (score / 10);
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        paint(1 - Math.pow(1 - t, 4));
        if (t < 1) raf = requestAnimationFrame(tick);
        else land(true);
      };
      raf = requestAnimationFrame(tick);
    };

    if (instant) {
      timer = setTimeout(run, 280);
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer?.disconnect();
          run();
        },
        // Start as the ring comes into view, just clear of the very bottom edge, so no ring on
        // screen sits empty while you scroll.
        { threshold: 0.3, rootMargin: "0px 0px -6% 0px" },
      );
      observer.observe(el);
    }
    return () => {
      observer?.disconnect();
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [score, decimals, instant]);

  return (
    <div
      ref={root}
      role="img"
      aria-label={`${label}: ${display} out of 10`}
      className={cn("relative grid size-11 shrink-0 place-items-center rounded-full bg-card", className)}
    >
      <svg aria-hidden viewBox="0 0 44 44" className="absolute inset-0 size-full -rotate-90">
        {/* The track reads on the white disc before the arc fills, so a ring still waiting to be
            scrolled into view is a ring, not a blank circle. */}
        <circle cx="22" cy="22" r={RADIUS} fill="none" strokeWidth="4" className="stroke-border" />
        <circle
          ref={arc}
          cx="22"
          cy="22"
          r={RADIUS}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
          className="stroke-primary-deep"
          style={{ opacity: 0 }}
        />
      </svg>
      <span
        ref={number}
        aria-hidden
        className="relative text-[15px] font-bold leading-none tracking-[-0.01em] tabular-nums opacity-0 transition-opacity duration-(--dur-quick)"
      >
        {display}
      </span>
      {earned ? (
        <span ref={star} aria-hidden className="xp-star pointer-events-none absolute -right-0.5 -top-0.5 size-3 opacity-0">
          <svg viewBox="0 0 10 10" className="size-full">
            <path fill="currentColor" d={STAR} />
          </svg>
        </span>
      ) : null}
    </div>
  );
}
