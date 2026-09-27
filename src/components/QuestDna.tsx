import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { SectionHeading } from "@/components/ui-kit";
import { topVibes } from "@/lib/engine";
import { SPRING, reducedMotion } from "@/lib/motion";
import { VIBE_LABEL, type Vibe } from "@/lib/types";

/*
 * What you're into: your top vibes as thin clover bars, poured in like the XP vial the first time
 * they come into view. Rank comes from position (a handwritten numeral, the top one in ink), not
 * from color. With no history yet the tracks are dashed and empty, never stubs that look broken.
 */
export function QuestDna({
  id,
  vibes,
  title = "What you're into",
  eyebrow,
  empty = false,
  emptyNote,
  count = 4,
}: {
  id?: string;
  vibes: Record<Vibe, number>;
  title?: ReactNode;
  eyebrow?: ReactNode;
  /** Not enough history to say yet: dashed, unfilled tracks. */
  empty?: boolean;
  emptyNote?: ReactNode;
  count?: number;
}) {
  const rows = topVibes(vibes, count);
  const max = Math.max(0.01, ...rows.map((r) => r.value));
  const list = useRef<HTMLOListElement>(null);

  // Pour once, on first view. Without JS (or with reduced motion) the bars simply show their value.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el || empty || reducedMotion() || typeof IntersectionObserver === "undefined") return;
    const fills = Array.from(el.querySelectorAll<HTMLElement>("[data-fill]"));
    fills.forEach((fill) => fill.style.setProperty("transform", "translateX(-100%)"));
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        fills.forEach((fill, i) => {
          const p = Number(fill.dataset["fill"]) || 0;
          fill.style.removeProperty("transform");
          fill.animate([{ transform: "translateX(-100%)" }, { transform: `translateX(${(p - 1) * 100}%)` }], {
            duration: 640,
            delay: 180 + i * 60,
            easing: SPRING,
            fill: "backwards",
          });
        });
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      fills.forEach((fill) => fill.style.removeProperty("transform"));
    };
  }, [empty]);

  return (
    <>
      <SectionHeading {...(id ? { id } : {})} eyebrow={eyebrow} title={title} />
      {empty && emptyNote ? <p className="mt-2 text-sm text-muted-foreground text-pretty">{emptyNote}</p> : null}
      <ol ref={list} className="mt-4 space-y-2.5">
        {rows.map(({ vibe, value }, i) => {
          // The top vibe stops short of the end so it never reads as "complete".
          const p = empty ? 0 : Math.max(0.06, (Math.max(0, value) / max) * 0.92);
          const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
          return (
            <li key={vibe} className="grid min-h-7 grid-cols-[1.25rem_6.25rem_minmax(0,1fr)] items-center gap-x-3">
              <span aria-hidden className={`font-hand text-lg leading-none ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                {empty ? null : i + 1}
              </span>
              <span className={`truncate text-sm ${i === 0 && !empty ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}>{VIBE_LABEL[vibe]}</span>
              {empty ? (
                <span aria-hidden className="h-1.5 rounded-full border border-dashed border-border" />
              ) : (
                <span
                  className="dna-track relative h-1.5 overflow-hidden rounded-full bg-muted"
                  role="meter"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={VIBE_LABEL[vibe]}
                >
                  <span data-fill={p} className="dna-fill absolute inset-0 rounded-full bg-primary" style={{ "--p": p } as CSSProperties} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
