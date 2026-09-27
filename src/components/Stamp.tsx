import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { EASE_OUT, reducedMotion } from "@/lib/motion";
import { doodleSrc, type DoodleName } from "@/lib/doodles";

/*
 * An ink stamp, like the ones in a passport. Finishing a quest stamps its postcard, and profile
 * achievements are stamps too, so "done" always looks the same across the app. `slam` presses it
 * on: it drops in large and tilted, hits the paper with a small overshoot, and leaves an ink ring.
 */
export function Stamp({
  label,
  sub,
  size = 96,
  tilt = -10,
  slam = false,
  faint = false,
  backed = false,
  art,
  className,
  onLanded,
}: {
  label: string;
  sub?: string;
  size?: number;
  tilt?: number;
  slam?: boolean;
  faint?: boolean;
  /** Put a disc of paper behind the ink, so the stamp reads over a photo. */
  backed?: boolean;
  /** A hand-drawn doodle pressed into the middle of the stamp, like a sticker in a passport. */
  art?: DoodleName;
  className?: string;
  onLanded?: () => void;
}) {
  const stamp = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const landed = useRef(onLanded);
  landed.current = onLanded;

  useEffect(() => {
    if (!slam || !stamp.current) return;
    if (reducedMotion()) {
      landed.current?.();
      return;
    }
    const press = stamp.current.animate(
      [
        { transform: `rotate(${tilt - 14}deg) scale(1.9)`, opacity: 0 },
        { transform: `rotate(${tilt - 4}deg) scale(1.15)`, opacity: 1, offset: 0.45 },
        { transform: `rotate(${tilt}deg) scale(0.9)`, offset: 0.62 },
        { transform: `rotate(${tilt}deg) scale(1.03)`, offset: 0.8 },
        { transform: `rotate(${tilt}deg) scale(1)` },
      ],
      { duration: 460, easing: EASE_OUT, fill: "backwards" },
    );
    ring.current?.animate(
      [
        { transform: "scale(0.85)", opacity: 0 },
        { transform: "scale(0.9)", opacity: 0.5, offset: 0.6 },
        { transform: "scale(1.45)", opacity: 0 },
      ],
      { duration: 620, easing: EASE_OUT, fill: "backwards" },
    );
    press.onfinish = () => landed.current?.();
    return () => press.cancel();
  }, [slam, tilt]);

  // The face: a doodle (if any) over the label, and the date only where it's big enough to read.
  const showSub = Boolean(sub) && size >= (art ? 110 : 80);
  const fontSize = labelSize(label, Boolean(art));
  const labelY = art ? (showSub ? 64 : 70) : showSub ? 50 : 57;
  const fit = fitWidth(label, fontSize, labelY);

  return (
    <span
      className={cn("stamp relative inline-grid shrink-0 place-items-center", faint && "stamp-faint", className)}
      style={{ width: size, height: size }}
      data-backed={backed ? "" : undefined}
      role="img"
      aria-label={sub ? `${label}, ${sub}` : label}
    >
      <span ref={ring} aria-hidden className="stamp-ring pointer-events-none absolute inset-0 rounded-full opacity-0" />
      <span ref={stamp} aria-hidden className="block h-full w-full" style={{ transform: `rotate(${tilt}deg)` }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          {backed ? <circle className="stamp-paper" cx="50" cy="50" r="48.5" /> : null}
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="3.2" />
          <circle cx="50" cy="50" r="39.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.5 3.2" />
          {art ? <image href={doodleSrc(art)} x="34" y={showSub ? 14 : 16} width="32" height="32" preserveAspectRatio="xMidYMid meet" style={faint ? { filter: "grayscale(1)", opacity: 0.4 } : undefined} /> : null}
          <text
            x="50"
            y={labelY}
            textAnchor="middle"
            fill="currentColor"
            fontFamily="Schoolbell, cursive"
            fontSize={fontSize}
            {...(fit ? { textLength: fit, lengthAdjust: "spacingAndGlyphs" } : {})}
          >
            {label}
          </text>
          {showSub ? (
            <text x="50" y={art ? 78 : 67} textAnchor="middle" fill="currentColor" fontFamily="Figtree, sans-serif" fontSize={art ? 8.5 : 9} fontWeight="600">
              {sub}
            </text>
          ) : null}
        </svg>
      </span>
    </span>
  );
}

/** Big enough to read at a glance: short words fill the ring, longer ones step down a little. */
function labelSize(label: string, withArt: boolean) {
  const n = label.length;
  if (withArt) return n > 12 ? 13 : n > 9 ? 14.5 : 16;
  return n > 12 ? 12 : n > 9 ? 15 : 21;
}

/** If the label would cross the inner ring at its baseline, squeeze it to fit (in viewBox units). */
function fitWidth(label: string, fontSize: number, y: number) {
  const r = 36; // just inside the dashed ring
  const dy = Math.abs(y - fontSize * 0.35 - 50);
  const room = 2 * Math.sqrt(Math.max(0, r * r - dy * dy));
  const estimate = label.length * fontSize * 0.5;
  return estimate > room ? Math.floor(room) : null;
}
