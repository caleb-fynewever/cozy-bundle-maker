import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent } from "react";
import { reducedMotion } from "@/lib/motion";

/*
 * The phone tab bar: a floating sheet of glass with a liquid lens, like Instagram's iOS tab bar.
 * Tap a tab and the lens jumps over with a spring. Press and hold, and the lens swells under your
 * finger; slide left or right and it follows, stretching with speed and magnifying the icons it
 * passes over; let go and it snaps to the nearest tab and opens it. Everything moves with
 * transforms driven by a small spring, so it tracks the finger at the display's frame rate.
 */

export type GlassTab = {
  to: string;
  params?: Record<string, string>;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
  dot?: boolean;
};

const PAD = 5; // inner padding between the bar's edge and the lens
const LIFT = 1.14; // how much the lens swells while held
const SPRING = { stiffness: 620, damping: 40 }; // position: quick, barely any overshoot
const SWELL = { stiffness: 420, damping: 22 }; // swell: soft and bouncy, like a droplet

let hapticSwitch: HTMLLabelElement | null = null;
/** A light tick: vibrate on Android; iOS 18+ Safari ticks when a switch toggles. */
function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.(8);
    return;
  }
  if (typeof document === "undefined") return;
  if (!hapticSwitch) {
    hapticSwitch = document.createElement("label");
    hapticSwitch.ariaHidden = "true";
    hapticSwitch.style.cssText = "position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9999px";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    hapticSwitch.append(input);
    document.body.append(hapticSwitch);
  }
  hapticSwitch.click();
}

export function GlassTabBar({ tabs, active }: { tabs: GlassTab[]; active: number }) {
  const navigate = useNavigate();
  const bar = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  const magnified = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const sim = useRef({
    x: 0, // lens centre, px from the bar's left edge
    v: 0,
    target: 0,
    swell: 1,
    swellV: 0,
    swellTarget: 1,
    raf: 0,
    last: 0,
    placed: false,
    pointer: null as null | { id: number; startX: number; moved: boolean; index: number },
  });
  const count = tabs.length;
  const slot = width > 0 ? (width - PAD * 2) / count : 0;
  const lensWidth = Math.max(0, slot - 2);
  const centreOf = (index: number) => PAD + slot * index + slot / 2;
  const indexAt = (x: number) => Math.max(0, Math.min(count - 1, Math.floor((x - PAD) / slot)));

  // Measure the bar (it resizes with the screen and with the Active-quest tab).
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function paint() {
    const s = sim.current;
    const el = lens.current;
    const inner = magnified.current;
    if (!el || !inner) return;
    // Speed stretches the drop along the direction of travel and thins it, like liquid.
    const speed = Math.min(1, Math.abs(s.v) / 2600);
    const stretch = reducedMotion() ? 0 : speed * 0.42;
    const sx = s.swell * (1 + stretch);
    const sy = s.swell * (1 - stretch * 0.38);
    const left = s.x - lensWidth / 2;
    el.style.transform = `translate3d(${left}px, 0, 0) scale(${sx}, ${sy})`;
    // The magnified copy of the icon row stays aligned with the real one underneath.
    inner.style.transform = `translate3d(${-left}px, 0, 0)`;
  }

  function step(now: number) {
    const s = sim.current;
    const dt = Math.min(0.032, (now - s.last) / 1000 || 0.016);
    s.last = now;
    for (let i = 0; i < 4; i++) {
      const h = dt / 4;
      s.v += (SPRING.stiffness * (s.target - s.x) - SPRING.damping * s.v) * h;
      s.x += s.v * h;
      s.swellV += (SWELL.stiffness * (s.swellTarget - s.swell) - SWELL.damping * s.swellV) * h;
      s.swell += s.swellV * h;
    }
    paint();
    const settled = Math.abs(s.target - s.x) < 0.2 && Math.abs(s.v) < 4 && Math.abs(s.swellTarget - s.swell) < 0.002 && Math.abs(s.swellV) < 0.01;
    if (settled && !s.pointer) {
      s.x = s.target;
      s.v = 0;
      s.swell = s.swellTarget;
      s.swellV = 0;
      paint();
      s.raf = 0;
      return;
    }
    s.raf = requestAnimationFrame(step);
  }

  function kick() {
    const s = sim.current;
    if (reducedMotion()) {
      s.x = s.target;
      s.v = 0;
      s.swell = s.swellTarget;
      paint();
      return;
    }
    if (!s.raf) {
      s.last = performance.now();
      s.raf = requestAnimationFrame(step);
    }
  }

  // Follow the active tab: the first time, place it; after that, spring over.
  useEffect(() => {
    const s = sim.current;
    if (!slot || active < 0) return;
    s.target = centreOf(active);
    if (!s.placed) {
      s.placed = true;
      s.x = s.target;
      paint();
      return;
    }
    if (!s.pointer) kick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, slot]);

  useEffect(() => () => cancelAnimationFrame(sim.current.raf), []);

  function localX(event: ReactPointerEvent) {
    return event.clientX - (bar.current?.getBoundingClientRect().left ?? 0);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!slot) return;
    const s = sim.current;
    const x = localX(event);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic or already-released pointer: the drag still works while over the bar */
    }
    s.pointer = { id: event.pointerId, startX: x, moved: false, index: indexAt(x) };
    s.swellTarget = LIFT;
    lens.current?.setAttribute("data-held", "");
    // Pressing a different tab pulls the lens toward your finger straight away.
    s.target = centreOf(indexAt(x));
    haptic();
    kick();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const s = sim.current;
    const p = s.pointer;
    if (!p || p.id !== event.pointerId) return;
    const x = localX(event);
    if (Math.abs(x - p.startX) > 6) p.moved = true;
    if (!p.moved) return;
    // Rubber-band past the ends so the drop squashes against the edge instead of stopping dead.
    const min = PAD + lensWidth / 2;
    const max = width - PAD - lensWidth / 2;
    const band = (over: number) => Math.sign(over) * Math.min(22, Math.abs(over) * 0.35);
    s.target = x < min ? min + band(x - min) : x > max ? max + band(x - max) : x;
    const index = indexAt(x);
    if (index !== p.index) {
      p.index = index;
      haptic();
    }
    kick();
  }

  function release(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const s = sim.current;
    const p = s.pointer;
    if (!p || p.id !== event.pointerId) return;
    s.pointer = null;
    s.swellTarget = 1;
    lens.current?.removeAttribute("data-held");
    const index = cancelled ? Math.max(0, active) : p.moved ? indexAt(localX(event)) : p.index;
    s.target = centreOf(index);
    kick();
    if (cancelled) return;
    const tab = tabs[index];
    if (tab && index !== active) {
      haptic();
      void navigate({ to: tab.to, ...(tab.params ? { params: tab.params } : {}) } as never);
    }
  }

  const row = (magnify: boolean) =>
    tabs.map((tab, index) => {
      const Icon = tab.icon;
      const on = index === active;
      return (
        <span
          key={tab.to}
          {...(magnify ? {} : { "data-nav": tab.dot ? "active-quest" : tab.label.toLowerCase() })}
          // The real row shares the bar by flex, so it lays out before JS measures anything.
          className={magnify ? "relative grid place-items-center" : "relative grid flex-1 place-items-center"}
          style={magnify ? { width: slot } : undefined}
        >
          <Icon aria-hidden className={magnify ? "h-[26px] w-[26px] text-foreground" : `h-[26px] w-[26px] ${on ? "text-foreground" : "text-muted-foreground"}`} strokeWidth={magnify || on ? 2.3 : 1.9} />
          {tab.dot ? <span aria-hidden className="absolute right-[calc(50%-15px)] top-[calc(50%-15px)] h-2 w-2 rounded-full border border-card bg-primary" /> : null}
        </span>
      );
    });

  return (
    <nav aria-label="Main" className="glass-dock pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] md:hidden">
      <div
        ref={bar}
        className="glass-bar pointer-events-auto relative mx-auto h-[62px] max-w-md touch-none select-none rounded-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => release(event)}
        onPointerCancel={(event) => release(event, true)}
        onClickCapture={(event) => {
          // Pointer gestures already navigated; this keeps a tap from also following the link.
          if ((event.nativeEvent as PointerEvent).pointerType) event.preventDefault();
        }}
      >
        {/* Icons first, then the lens over them, then invisible links on top for taps and keys. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex" style={{ paddingLeft: PAD, paddingRight: PAD }}>
          {row(false)}
        </div>
        {/* The lens: a drop of glass on the active tab. Its copy of the icons swells with it, so held, it magnifies. */}
        <div
          ref={lens}
          aria-hidden
          className="glass-lens pointer-events-none absolute left-0 top-[5px] overflow-hidden rounded-full transition-opacity duration-(--dur-quick)"
          style={
            width > 0
              ? { width: lensWidth, height: 62 - PAD * 2, opacity: active < 0 ? 0 : 1 }
              : // Before it's measured (the server render), place the drop on the active tab with CSS.
                { left: `calc(${PAD + 1}px + (100% - ${PAD * 2}px) * ${Math.max(0, active)} / ${count})`, width: `calc((100% - ${PAD * 2}px) / ${count} - 2px)`, height: 62 - PAD * 2, opacity: active < 0 ? 0 : 1 }
          }
        >
          {width > 0 ? (
            <div ref={magnified} className="absolute left-0 top-0 flex h-full" style={{ width, paddingLeft: PAD }}>
              {row(true)}
            </div>
          ) : null}
        </div>
        <ul className="relative flex h-full items-stretch" style={{ paddingLeft: PAD, paddingRight: PAD }}>
          {tabs.map((tab, index) => (
            <li key={tab.to} className="grid flex-1 place-items-center">
              <Link
                to={tab.to as never}
                {...(tab.params ? { params: tab.params as never } : {})}
                aria-label={tab.label}
                aria-current={index === active ? "page" : undefined}
                draggable={false}
                className="grid h-full w-full place-items-center rounded-full focus-visible:outline-offset-[-4px]"
              >
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
