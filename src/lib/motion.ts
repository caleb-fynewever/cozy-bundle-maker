import { useEffect, useLayoutEffect, useRef, useState } from "react";

/*
 * The motion language in one place for code (the same values live as CSS vars in styles.css).
 * Things settle with ease-out, leave with ease-in, and only completions get the spring's overshoot.
 */
export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
export const EASE_IN = "cubic-bezier(0.55, 0, 1, 0.45)";
export const SPRING = "linear(0, 0.012, 0.047 2.3%, 0.19 5%, 0.78 13.5%, 0.96 17.4%, 1.034 21%, 1.052 24.6%, 1.04 28.8%, 1.008 37%, 0.997 45%, 1)";
export const DURATION = { press: 110, quick: 180, base: 260, slow: 420 } as const;
/** A small arrival with a little overshoot (a heart, a star, a numeral). */
export const POP = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const STAR =
  '<svg viewBox="0 0 10 10" width="100%" height="100%" aria-hidden="true"><path fill="currentColor" d="M5 0Q5.7 4.3 10 5Q5.7 5.7 5 10Q4.3 5.7 0 5Q4.3 4.3 5 0Z"/></svg>';

/**
 * A small burst from a point on screen: clover sparks and a few ink stars, the same particles the
 * XP bar throws on level-up. Fixed-position and self-cleaning; does nothing under reduced motion.
 */
export function burst(x: number, y: number, { sparks = 7, stars = 0, spread = 26 }: { sparks?: number; stars?: number; spread?: number } = {}) {
  if (reducedMotion() || typeof document === "undefined") return;
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:0;height:0;pointer-events:none;z-index:70`;
  document.body.append(layer);
  let alive = sparks + stars;
  const done = () => {
    alive -= 1;
    if (alive <= 0) layer.remove();
  };
  const fling = (el: HTMLElement, size: number, spin: number, duration: number) => {
    el.style.cssText = `position:absolute;left:${-size / 2}px;top:${-size / 2}px;width:${size}px;height:${size}px`;
    layer.append(el);
    const angle = rand(0, Math.PI * 2);
    const distance = rand(spread * 0.45, spread);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - spread * 0.25;
    const animation = el.animate(
      [
        { transform: "translate(0,0) scale(0.3) rotate(0deg)", opacity: 0 },
        { transform: `translate(${dx * 0.6}px,${dy * 0.6}px) scale(1) rotate(${spin * 0.5}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${dx}px,${dy}px) scale(0.3) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration, easing: EASE_OUT },
    );
    animation.onfinish = done;
    animation.oncancel = done;
  };
  for (let i = 0; i < sparks; i++) {
    const el = document.createElement("span");
    el.className = "xp-spark";
    if (Math.random() < 0.5) el.dataset["tone"] = "deep";
    fling(el, rand(3.5, 5.5), 0, rand(480, 680));
  }
  for (let i = 0; i < stars; i++) {
    const el = document.createElement("span");
    el.className = "xp-star";
    el.innerHTML = STAR;
    fling(el, rand(9, 13), rand(-120, 120), rand(620, 820));
  }
}

/** The visible nav item for a section (the header link on desktop, the tab bar on phones). */
export function navTarget(name: string) {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-nav="${name}"]`));
  return candidates.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

/**
 * Sends a thing to where it now lives: a small copy of `from` (a photo, a card) arcs into the nav
 * item for `name`, which then bumps to say "got it". Used when a quest is saved into Lists.
 */
export function flyToNav(from: Element, name: string, imageUrl?: string) {
  const target = typeof document !== "undefined" ? navTarget(name) : undefined;
  if (!target) return;
  const bump = () => receive(name);
  if (reducedMotion()) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const size = Math.min(96, Math.max(48, a.width * 0.3));
  const ghost = document.createElement("div");
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.cssText = `position:fixed;left:${a.left + a.width / 2 - size / 2}px;top:${a.top + a.height / 2 - size / 2}px;width:${size}px;height:${size}px;border-radius:10px;border:1px solid var(--foreground);background:var(--card) ${imageUrl ? `url("${imageUrl}") center/cover` : ""};box-shadow:var(--shadow-lift);pointer-events:none;z-index:70`;
  document.body.append(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const flight = ghost.animate(
    [
      { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 60}px) scale(0.7) rotate(-8deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px,${dy}px) scale(0.22) rotate(-14deg)`, opacity: 0.6 },
    ],
    { duration: 560, easing: "cubic-bezier(0.5, 0, 0.3, 1)" },
  );
  flight.onfinish = () => {
    ghost.remove();
    bump();
  };
  flight.oncancel = () => ghost.remove();
}

/** The nav item for `name` gives a little "got it" bump (on its own, or at the end of flyToNav). */
export function receive(name: string) {
  if (typeof document === "undefined" || reducedMotion()) return;
  navTarget(name)?.animate([{ transform: "scale(1)" }, { transform: "scale(1.22)", offset: 0.4 }, { transform: "scale(1)" }], { duration: 420, easing: SPRING });
}

/** FLIP: after a list re-orders, each moved row glides from where it was to where it is now. */
export function flip(rows: Map<string, HTMLElement>, before: Map<string, number>, { stagger = 18, duration = 420 } = {}) {
  if (reducedMotion()) return;
  let i = 0;
  for (const [key, el] of rows) {
    const was = before.get(key);
    if (was === undefined) continue;
    const dy = was - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    el.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], { duration, easing: SPRING, delay: i++ * stagger });
  }
}

/** Counts a number up from where it was (0 on first show) to `value`, easing out. */
export function useCountUp(value: number, duration = 700) {
  // Start from 0 on the server and the client alike (so hydration matches); the first paint isn't
  // the final number. With motion off, the layout effect below jumps to it before anything paints.
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  const first = useRef(true);

  useLayoutEffect(() => {
    if (!reducedMotion()) return;
    first.current = false;
    from.current = value;
    setShown(value);
  }, [value]);

  useEffect(() => {
    const start = first.current ? 0 : from.current;
    first.current = false;
    if (reducedMotion() || start === value) {
      from.current = value;
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = start + (value - start) * eased;
      from.current = next;
      setShown(t === 1 ? value : next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return shown;
}
