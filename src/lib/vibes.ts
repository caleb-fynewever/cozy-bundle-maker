import { createElement, type ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { doodleSrc, type DoodleName } from "@/lib/doodles";
import type { Vibe } from "@/lib/types";

/*
 * One hand-drawn doodle per vibe (public/doodles), used instead of emoji wherever a vibe shows up.
 * They take the same props as a lucide icon (className sizes the box, e.g. "h-4 w-4") so any
 * `<VIBE_ICON[v] className="h-5 w-5" />` just works. They're drawn at their box size (so spacing
 * next to a label is even); give them 20px or more, where the hand-drawn detail reads.
 */
const DOODLE_FOR: Record<Vibe, DoodleName> = {
  chill: "chill",
  active: "active",
  food: "food",
  creative: "creative",
  social: "social",
  weird: "weird",
  outdoors: "outdoors",
  competitive: "competitive",
  "late-night": "late-night",
};

function vibeDoodle(vibe: Vibe): ComponentType<LucideProps> {
  const Icon = ({ className, size, style }: LucideProps) =>
    createElement("img", {
      src: doodleSrc(DOODLE_FOR[vibe]),
      alt: "",
      "aria-hidden": true,
      draggable: false,
      decoding: "async",
      className: ["doodle inline-block shrink-0 select-none object-contain", vibe === "chill" && "doodle-moon", className].filter(Boolean).join(" "),
      style: { ...(size ? { width: size, height: size } : {}), ...style },
    });
  Icon.displayName = `VibeDoodle(${vibe})`;
  return Icon;
}

export const VIBE_ICON: Record<Vibe, ComponentType<LucideProps>> = {
  chill: vibeDoodle("chill"),
  active: vibeDoodle("active"),
  food: vibeDoodle("food"),
  creative: vibeDoodle("creative"),
  social: vibeDoodle("social"),
  weird: vibeDoodle("weird"),
  outdoors: vibeDoodle("outdoors"),
  competitive: vibeDoodle("competitive"),
  "late-night": vibeDoodle("late-night"),
};

export const VIBE_DOODLE = DOODLE_FOR;
