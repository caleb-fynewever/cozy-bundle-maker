import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { doodleSrc, type DoodleName } from "@/lib/doodles";

/*
 * Hand-drawn doodles by a friend of the team (public/doodles). They carry wego's personality: the
 * vibes, the footprints of "let's go", the medal for #1, the alien for anything weird or lost.
 * Line icons stay for controls and navigation; doodles are for meaning.
 */

export function Doodle({
  name,
  size = 24,
  label,
  className,
  style,
  faint = false,
  block = false,
}: {
  name: DoodleName;
  size?: number;
  /** Give it a name only when it carries meaning on its own; otherwise it's decoration. */
  label?: string;
  className?: string;
  style?: CSSProperties;
  faint?: boolean;
  /** Its own line (so mx-auto centres it) instead of sitting in the text. */
  block?: boolean;
}) {
  return (
    <img
      src={doodleSrc(name)}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      width={size}
      height={size}
      draggable={false}
      loading="lazy"
      decoding="async"
      className={cn("doodle shrink-0 select-none object-contain", block ? "block" : "inline-block", faint && "doodle-faint", className)}
      style={{ width: size, height: size, ...style }}
    />
  );
}
