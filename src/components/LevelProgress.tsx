import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { SectionHeading } from "@/components/ui-kit";
import { LEVELS, levelFor } from "@/data/people";

/*
 * The living XP bar. The fill is clover liquid in a vial: it pours in on arrival, fizzes when it
 * is fed XP and then settles, and a level-up pops at the right end like a cork before the vial
 * refills. Everything moves with transform/opacity (a CSS var drives the fill; particles use the
 * Web Animations API), so it stays off the layout path. Reduced motion shows the final state.
 */

type Level = ReturnType<typeof levelFor>;
type Token = { cancelled: boolean };
type Els = {
  root: HTMLDivElement;
  track: HTMLDivElement;
  fill: HTMLDivElement;
  wave: HTMLSpanElement;
  edge: HTMLSpanElement;
  fizz: HTMLDivElement;
  burst: HTMLDivElement;
  hit: HTMLDivElement;
  count: HTMLSpanElement;
  into: HTMLSpanElement;
  toNext: HTMLSpanElement;
  name: HTMLSpanElement;
  eyebrow: HTMLSpanElement;
};

// The particle layer overhangs the track by this much so bursts aren't cut off.
const OVERHANG_X = 36;
const OVERHANG_Y = 36;
const STAR = '<svg viewBox="0 0 10 10" width="100%" height="100%" aria-hidden="true"><path fill="currentColor" d="M5 0Q5.7 4.3 10 5Q5.7 5.7 5 10Q4.3 5.7 0 5Q4.3 4.3 5 0Z"/></svg>';

const fmt = (n: number) => Math.round(n).toLocaleString();
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Where xp sits inside a level, 0..1. The top level is always full. */
function within(level: Level, xp: number) {
  return level.next ? clamp01((xp - level.xp) / (level.next.xp - level.xp)) : 1;
}

/**
 * The captions under the bar, read off the bar itself so the words and the fill always agree.
 * (" this level" is a static suffix next to the first one, so phones can drop it and stay on one line.)
 */
function captions(level: Level, bar: number): [string, string] {
  if (!level.next) return ["Top level reached", "All the way up"];
  const span = level.next.xp - level.xp;
  const into = Math.round(clamp01(bar) * span);
  return [`${into.toLocaleString()} / ${span.toLocaleString()} XP`, `${(span - into).toLocaleString()} XP to ${level.next.name}`];
}

/** A spring on s from 0 to 1, stepped on animation frames. Resolves when settled or cancelled. */
function spring(token: Token, onFrame: (s: number) => void, stiffness: number, damping: number) {
  return new Promise<void>((resolve) => {
    let s = 0;
    let v = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (token.cancelled) return resolve();
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      for (let i = 0; i < 4; i++) {
        v += (stiffness * (1 - s) - damping * v) * (dt / 4);
        s += v * (dt / 4);
      }
      const settled = Math.abs(1 - s) < 0.001 && Math.abs(v) < 0.01;
      onFrame(settled ? 1 : s);
      if (settled) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function createEngine(els: Els, startLevel: Level, onSeen: { current: (xp: number) => void }, onSettled: { current: ((xp: number) => void) | undefined }) {
  let token: Token = { cancelled: true };
  let level = startLevel;
  let entered = false;
  let energy = 0; // how fizzy the liquid is, 0..1; decays back to calm
  let energyAt = performance.now();
  let width = els.track.clientWidth;
  let height = els.track.clientHeight;
  let visible = true;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let edgeAnim: Animation | undefined;
  let lastHoverBubble = 0;
  const cur = { xp: 0, bar: 0 };

  function paint(xp: number, bar: number) {
    cur.xp = xp;
    cur.bar = clamp01(bar);
    els.root.style.setProperty("--xp", String(cur.bar));
    els.count.textContent = fmt(xp);
    const [into, toNext] = captions(level, cur.bar);
    els.into.textContent = into;
    els.toNext.textContent = toNext;
  }

  function energize(amount: number) {
    energy = Math.max(currentEnergy(), amount);
    energyAt = performance.now();
  }

  function currentEnergy() {
    return energy * Math.exp(-(performance.now() - energyAt) / 1600);
  }

  /* ---------- particles ---------- */

  function particle(parent: HTMLElement, className: string, x: number, y: number, size: number, tone?: string) {
    const el = document.createElement("span");
    el.className = `${className} pointer-events-none absolute`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    if (tone) el.dataset["tone"] = tone;
    parent.append(el);
    return el;
  }

  function fly(el: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    const animation = el.animate(keyframes, options);
    animation.onfinish = () => el.remove();
    animation.oncancel = () => el.remove();
  }

  /** A bubble drifting toward the leading edge, inside the liquid. */
  function bubble(atX?: number) {
    const liquid = cur.bar * width;
    if (liquid < 12 || els.fizz.childElementCount > 14) return;
    const e = currentEnergy();
    const size = rand(2, 3.6) + e * 1.2;
    const x = atX ?? rand(4, liquid - 6);
    const y = rand(1.5, height - size - 1.5);
    const el = particle(els.fizz, "xp-bubble", x, y, size);
    fly(
      el,
      [
        { transform: "translate(0, 0) scale(0.4)", opacity: 0 },
        { opacity: rand(0.45, 0.8), offset: 0.25 },
        { transform: `translate(${rand(6, 18)}px, ${rand(-2, 2)}px) scale(1)`, opacity: 0 },
      ],
      { duration: lerp(3200, 1500, e) * rand(0.8, 1.2), easing: "cubic-bezier(.25,.6,.35,1)" },
    );
  }

  /** A short streak of light gliding along the top of the liquid. */
  function glint() {
    const liquid = cur.bar * width;
    if (liquid < 40) return;
    const el = particle(els.fizz, "xp-glint", rand(4, liquid - 34), 2, 14);
    el.style.height = "2px";
    fly(
      el,
      [
        { transform: "translateX(0)", opacity: 0 },
        { opacity: 0.85, offset: 0.4 },
        { transform: "translateX(22px)", opacity: 0 },
      ],
      { duration: 900, easing: "ease-out" },
    );
  }

  /** A spark thrown off the leading edge, in the unclipped layer above the track. */
  function spark(x: number) {
    const size = rand(3, 5.5);
    const el = particle(els.burst, "xp-spark", x + OVERHANG_X - size / 2, height / 2 + OVERHANG_Y - size / 2, size, Math.random() < 0.6 ? "deep" : undefined);
    const angle = (rand(-165, 15) * Math.PI) / 180;
    const distance = rand(9, 18);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    fly(
      el,
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.7}px, ${dy * 0.7}px) scale(0.85)`, opacity: 0.9, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0 },
      ],
      { duration: rand(520, 700), easing: "cubic-bezier(.16,.84,.44,1)" },
    );
  }

  /** Drops sparks along the way as the edge moves; tops up to `min` when the move is short. */
  function edgeEmitter(min: number, max: number) {
    let emitted = 0;
    let lastX = -Infinity;
    return {
      move(bar: number) {
        const x = clamp01(bar) * width;
        if (emitted < max && x - lastX >= 7) {
          spark(x);
          emitted++;
          lastX = x;
        }
      },
      finish() {
        for (let i = emitted; i < min; i++) setTimeout(() => spark(cur.bar * width), (i - emitted) * 45);
      },
    };
  }

  /** The level-up pop at the right end: a ring, a few stars and sparks. */
  function starburst() {
    const x = width - 4 + OVERHANG_X;
    const y = height / 2 + OVERHANG_Y;
    const ring = particle(els.burst, "xp-ring", x - 11, y - 11, 22);
    fly(ring, [{ transform: "scale(0.3)", opacity: 0.95 }, { transform: "scale(2.4)", opacity: 0 }], { duration: 680, easing: "cubic-bezier(.2,.8,.3,1)" });
    for (let i = 0; i < 8; i++) {
      const size = rand(10, 14);
      const star = particle(els.burst, "xp-star", x - size / 2, y - size / 2, size);
      star.innerHTML = STAR;
      const angle = ((-160 + i * 42 + rand(-10, 10)) * Math.PI) / 180;
      const distance = rand(20, 30);
      const spin = rand(-110, 110);
      fly(
        star,
        [
          { transform: "translate(0, 0) scale(0.2) rotate(0deg)", opacity: 0 },
          { transform: `translate(${Math.cos(angle) * distance * 0.6}px, ${Math.sin(angle) * distance * 0.6}px) scale(1) rotate(${spin * 0.5}deg)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0.3) rotate(${spin}deg)`, opacity: 0 },
        ],
        { duration: rand(720, 900), easing: "cubic-bezier(.2,.75,.3,1)" },
      );
    }
    for (let i = 0; i < 6; i++) {
      const size = rand(3.5, 5.5);
      const dot = particle(els.burst, "xp-spark", x - size / 2, y - size / 2, size, i % 2 ? "deep" : undefined);
      const angle = ((-170 + i * 62 + rand(-15, 15)) * Math.PI) / 180;
      const distance = rand(14, 26);
      fly(
        dot,
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0.3)`, opacity: 0 },
        ],
        { duration: rand(500, 700), easing: "cubic-bezier(.16,.84,.44,1)" },
      );
    }
  }

  /* ---------- the vial itself ---------- */

  function pulseEdge(times: number) {
    edgeAnim?.cancel();
    edgeAnim = els.edge.animate(
      [
        { opacity: 0.55, transform: "scaleX(1)" },
        { opacity: 1, transform: "scaleX(1.8)" },
        { opacity: 0.55, transform: "scaleX(1)" },
      ],
      { duration: 760, iterations: times, easing: "ease-in-out" },
    );
  }

  /** XP arriving: a pressure squeeze through the vial and a wave rolling to the edge. */
  function pressure(fromBar: number) {
    els.track.animate(
      [{ transform: "scale(1, 1)" }, { transform: "scale(1, 1.2)", offset: 0.35 }, { transform: "scale(1, 0.96)", offset: 0.7 }, { transform: "scale(1, 1)" }],
      { duration: 420, easing: "ease-out" },
    );
    els.wave.animate(
      [
        { transform: `translateX(${(1 - fromBar) * 100}%)`, opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { transform: "translateX(100%)", opacity: 0.3 },
      ],
      { duration: 560, easing: "cubic-bezier(.4,0,.2,1)" },
    );
  }

  function squash() {
    els.track.animate(
      [
        { transform: "scale(1, 1)" },
        { transform: "scale(1.012, 0.68)", offset: 0.18 },
        { transform: "scale(0.994, 1.34)", offset: 0.45 },
        { transform: "scale(1.004, 0.9)", offset: 0.7 },
        { transform: "scale(1, 1)" },
      ],
      { duration: 580, easing: "cubic-bezier(.3,.7,.3,1)" },
    );
  }

  async function setLevel(next: Level, animate: boolean) {
    if (next.level === level.level) return;
    if (animate) {
      const out: Keyframe[] = [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-7px)" }];
      const leaving = [els.name.animate(out, { duration: 150, easing: "ease-in", fill: "forwards" }), els.eyebrow.animate(out, { duration: 130, easing: "ease-in", fill: "forwards" })];
      await Promise.all(leaving.map((a) => a.finished.catch(() => undefined)));
      level = next;
      els.name.textContent = next.name;
      els.eyebrow.textContent = `level ${next.level}`;
      const arrive: Keyframe[] = [{ opacity: 0, transform: "translateY(10px) scale(0.96)" }, { opacity: 1, transform: "translateY(0) scale(1)" }];
      els.name.animate(arrive, { duration: 460, easing: "cubic-bezier(.34,1.56,.64,1)" });
      els.eyebrow.animate(arrive, { duration: 380, delay: 50, easing: "cubic-bezier(.34,1.4,.64,1)", fill: "backwards" });
      leaving.forEach((a) => a.cancel());
    } else {
      level = next;
      els.name.textContent = next.name;
      els.eyebrow.textContent = `level ${next.level}`;
    }
  }

  async function gain(t: Token, from: number, to: number) {
    const target = levelFor(to);
    const fromBar = within(level, from);
    energize(1);
    pressure(fromBar);
    pulseEdge(1);

    if (target.level === level.level || !level.next) {
      const sparks = edgeEmitter(5, 8);
      const toBar = within(level, to);
      await spring(t, (s) => {
        paint(lerp(from, to, Math.min(1, s)), lerp(fromBar, toBar, s));
        sparks.move(cur.bar);
      }, 190, 21);
      if (t.cancelled) return;
      sparks.finish();
      pulseEdge(2);
      return;
    }

    // Level up: pour to full, pop, flip the name, drain, refill into the new level.
    const threshold = level.next.xp;
    const sparks = edgeEmitter(3, 5);
    await spring(t, (s) => {
      paint(lerp(from, threshold, Math.min(1, s)), lerp(fromBar, 1, s));
      sparks.move(cur.bar);
    }, 240, 30);
    if (t.cancelled) return;
    squash();
    starburst();
    energize(1);
    const renamed = setLevel(target, true);
    await wait(230);
    if (t.cancelled) return;
    await els.fill.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: "ease-in" }).finished.catch(() => undefined);
    await renamed;
    if (t.cancelled) return;
    paint(threshold, 0);
    els.fill.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "ease-out" });
    const toBar = within(target, to);
    await spring(t, (s) => paint(lerp(threshold, to, Math.min(1, s)), lerp(0, toBar, s)), 230, 25);
    if (t.cancelled) return;
    pulseEdge(2);
  }

  /** Plays whatever the vial owes, then tells the page it has come to rest (so stamps can follow). */
  async function run(xp: number, seen: number) {
    token.cancelled = true;
    const t: Token = { cancelled: false };
    token = t;
    await play(t, xp, seen);
    if (!t.cancelled) onSettled.current?.(xp);
  }

  async function play(t: Token, xp: number, seen: number) {
    const done = () => {
      if (seen !== xp) onSeen.current(xp);
    };

    if (reducedMotion()) {
      await setLevel(levelFor(xp), false);
      paint(xp, within(levelFor(xp), xp));
      entered = xp > 0;
      done();
      return;
    }

    if (!entered) {
      const start = Math.min(xp, seen);
      if (start > 0) {
        entered = true;
        await setLevel(levelFor(start), false);
        paint(0, 0);
        pulseEdge(2);
        energize(0.6);
        const toBar = within(level, start);
        await spring(t, (s) => paint(lerp(0, start, Math.min(1, s)), lerp(0, toBar, s)), 110, 16);
        if (t.cancelled) return;
      }
      if (xp <= seen) {
        if (start > 0) done();
        return;
      }
      entered = true;
    }

    const from = cur.xp;
    if (xp === from) return done();
    if (xp < from) {
      // XP went down (a reset): settle quietly, no celebration.
      const fromBar = cur.bar;
      await setLevel(levelFor(xp), false);
      const toBar = within(level, xp);
      await spring(t, (s) => paint(lerp(from, xp, Math.min(1, s)), lerp(fromBar, toBar, s)), 260, 30);
      if (!t.cancelled) done();
      return;
    }
    await gain(t, from, xp);
    if (!t.cancelled) done();
  }

  /* ---------- ambient fizz and touch ---------- */

  function scheduleFizz() {
    const e = currentEnergy();
    if (visible && !document.hidden && cur.bar > 0.02) {
      bubble();
      if (Math.random() < 0.06 + e * 0.2) glint();
    }
    // Busy right after something happens, then calm: one faint bubble every few seconds.
    idle = setTimeout(scheduleFizz, lerp(2800, 170, e) * rand(0.7, 1.3));
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType === "touch") return;
    const x = event.clientX - els.track.getBoundingClientRect().left;
    // The sheen lives inside the fill, which is shifted left by (1 - bar) of the track.
    els.fill.style.setProperty("--hx", `${x + (1 - cur.bar) * width}px`);
    els.root.dataset["hover"] = "";
    energize(Math.max(currentEnergy(), 0.3));
    const now = performance.now();
    if (now - lastHoverBubble > 150 && x > 6 && x < cur.bar * width - 6) {
      lastHoverBubble = now;
      bubble(x + rand(-6, 4));
    }
  }

  function onPointerLeave() {
    delete els.root.dataset["hover"];
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType !== "touch") return;
    const x = event.clientX - els.track.getBoundingClientRect().left;
    energize(0.7);
    if (x < cur.bar * width) for (let i = 0; i < 3; i++) setTimeout(() => bubble(x + rand(-8, 8)), i * 70);
    glint();
  }

  const resize = new ResizeObserver(() => {
    width = els.track.clientWidth;
    height = els.track.clientHeight;
  });
  resize.observe(els.track);
  const seenOnScreen = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
  });
  seenOnScreen.observe(els.track);
  if (!reducedMotion()) {
    els.hit.addEventListener("pointermove", onPointerMove);
    els.hit.addEventListener("pointerleave", onPointerLeave);
    els.hit.addEventListener("pointerdown", onPointerDown);
    idle = setTimeout(scheduleFizz, 900);
  }

  return {
    run,
    dispose() {
      token.cancelled = true;
      clearTimeout(idle);
      resize.disconnect();
      seenOnScreen.disconnect();
      els.hit.removeEventListener("pointermove", onPointerMove);
      els.hit.removeEventListener("pointerleave", onPointerLeave);
      els.hit.removeEventListener("pointerdown", onPointerDown);
      els.fizz.replaceChildren();
      els.burst.replaceChildren();
    },
  };
}

/*
 * The same circled "?" as HelpDot (src/components/HelpDot.tsx), drawn inside the level label. It
 * turns ink on hover and while the journey is open, as HelpDot does while its slip is out.
 */
const LEVEL_DOT =
  "help-dot relative inline-grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border-strong bg-card font-sans text-[12px] font-bold leading-none text-muted-foreground transition-colors duration-(--dur-quick) group-hover:border-foreground group-hover:text-foreground group-aria-expanded:border-foreground group-aria-expanded:bg-foreground group-aria-expanded:text-background";

/**
 * The level card's heading, total XP, bar and captions, with the living XP bar. `aside` sits under
 * the total (a rank, say); `onSettled` fires each time the vial comes to rest after a pour. With
 * `onShowLevels`, the level label ("level 4 / Adventurer", with a small "?") is a button that opens
 * every level (the quest journey); it gets the label itself so focus can come back to it.
 */
export function LevelProgress({
  xp,
  seenXp,
  onSeen,
  onSettled,
  aside,
  onShowLevels,
  levelsOpen = false,
}: {
  xp: number;
  seenXp: number;
  onSeen: (xp: number) => void;
  onSettled?: (xp: number) => void;
  aside?: ReactNode;
  onShowLevels?: (opener: HTMLElement) => void;
  levelsOpen?: boolean;
}) {
  const hintId = useId();
  // Text below is written by the engine each frame; React renders it once and leaves it alone.
  const [initial] = useState(() => {
    const level = levelFor(Math.min(xp, seenXp));
    const [into, toNext] = captions(level, 0);
    return { level, into, toNext };
  });
  const refs = {
    root: useRef<HTMLDivElement>(null),
    track: useRef<HTMLDivElement>(null),
    fill: useRef<HTMLDivElement>(null),
    wave: useRef<HTMLSpanElement>(null),
    edge: useRef<HTMLSpanElement>(null),
    fizz: useRef<HTMLDivElement>(null),
    burst: useRef<HTMLDivElement>(null),
    hit: useRef<HTMLDivElement>(null),
    count: useRef<HTMLSpanElement>(null),
    into: useRef<HTMLSpanElement>(null),
    toNext: useRef<HTMLSpanElement>(null),
    name: useRef<HTMLSpanElement>(null),
    eyebrow: useRef<HTMLSpanElement>(null),
  };
  const engine = useRef<ReturnType<typeof createEngine> | null>(null);
  const seen = useRef(onSeen);
  seen.current = onSeen;
  const settled = useRef(onSettled);
  settled.current = onSettled;

  useEffect(() => {
    const els = Object.fromEntries(Object.entries(refs).map(([key, ref]) => [key, ref.current])) as Els;
    if (Object.values(els).some((el) => !el)) return;
    const instance = createEngine(els, initial.level, seen, settled);
    engine.current = instance;
    return () => {
      instance.dispose();
      engine.current = null;
    };
    // The engine owns these elements for the life of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void engine.current?.run(xp, seenXp);
  }, [xp, seenXp]);

  const level = levelFor(xp);
  const [finalInto, finalToNext] = captions(level, level.progress);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          {onShowLevels ? (
            <>
              {/*
               * SectionHeading's look, but the eyebrow and the title are one button, so "level 4" and
               * "Adventurer" are a single big target and a single stop for keyboard and screen readers.
               * The "?" rides on the eyebrow line, where it never pushes the total XP onto its own row.
               */}
              <h2 id="level-heading" className="font-semibold leading-tight tracking-[-0.01em]">
                <button
                  type="button"
                  onClick={(event) => onShowLevels(event.currentTarget)}
                  aria-haspopup="dialog"
                  aria-expanded={levelsOpen}
                  aria-describedby={hintId}
                  className="press group block cursor-pointer rounded-md text-left"
                >
                  <span className="flex items-center gap-1.5">
                    <span ref={refs.eyebrow} className="inline-block font-hand text-[17px] font-normal leading-tight text-muted-foreground">
                      level {initial.level.level}
                    </span>
                    <span aria-hidden className={LEVEL_DOT}>
                      ?
                    </span>
                  </span>
                  {/* The level is the panel's headline, so it outranks the section titles around it. */}
                  <span
                    ref={refs.name}
                    className="block w-fit text-[1.75rem] leading-[1.1] tracking-[-0.02em] decoration-primary decoration-2 underline-offset-[5px] group-hover:underline sm:text-[2rem]"
                  >
                    {initial.level.name}
                  </span>
                </button>
              </h2>
              <span id={hintId} hidden>
                See all {LEVELS.length} levels
              </span>
            </>
          ) : (
            <SectionHeading
              id="level-heading"
              eyebrow={<span ref={refs.eyebrow} className="inline-block">level {initial.level.level}</span>}
              // The level is the panel's headline, so it outranks the section titles around it.
              title={<span ref={refs.name} className="inline-block text-[1.75rem] leading-[1.1] tracking-[-0.02em] sm:text-[2rem]">{initial.level.name}</span>}
            />
          )}
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold leading-tight tracking-[-0.01em] tabular-nums">
            <span ref={refs.count} aria-hidden>0</span>
            <span className="sr-only">{xp.toLocaleString()}</span>
          </p>
          <p className="text-sm text-muted-foreground">total XP</p>
          {aside ? <div className="mt-1">{aside}</div> : null}
        </div>
      </div>
      <div ref={refs.root} className="xp-bar relative mt-5" style={{ "--xp": 0 } as React.CSSProperties}>
        <div
          ref={refs.track}
          className="relative h-3 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level.progress * 100)}
          aria-valuetext={level.next ? `${finalInto} this level, ${finalToNext}` : finalInto}
          aria-label="Progress to next level"
        >
          <div ref={refs.fill} className="xp-fill absolute inset-0 rounded-full bg-primary">
            <span className="xp-sheen absolute inset-0" />
            <span ref={refs.wave} className="absolute inset-0 opacity-0">
              <span className="xp-wave absolute inset-y-0 -left-7 w-7" />
            </span>
            <span ref={refs.edge} className="xp-meniscus absolute inset-y-0 right-0 w-3" />
          </div>
          <div ref={refs.fizz} className="xp-fizz absolute inset-0" />
        </div>
        <div ref={refs.burst} aria-hidden className="pointer-events-none absolute -inset-x-9 -inset-y-9 overflow-hidden" />
        <div ref={refs.hit} aria-hidden className="absolute -inset-y-3 inset-x-0" />
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-3 text-xs tabular-nums text-muted-foreground sm:text-sm" aria-hidden>
        <span>
          <span ref={refs.into}>{initial.into}</span>
          {level.next ? <span className="max-sm:hidden"> this level</span> : null}
        </span>
        <span ref={refs.toNext} className="text-right">{initial.toNext}</span>
      </div>
    </>
  );
}
