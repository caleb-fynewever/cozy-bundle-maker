import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Chip({
  active,
  children,
  onClick,
  pressedLabel,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  pressedLabel?: string;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? Boolean(active) : undefined}
      aria-label={pressedLabel}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-surface-foreground hover:border-border-strong",
      )}
    >
      {children}
    </Tag>
  );
}

export function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "primary" | "signal" | "accent" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    primary: "bg-primary/15 text-primary",
    signal: "bg-signal/15 text-signal",
    accent: "bg-accent/20 text-accent",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Meter({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{hint ?? `${pct}%`}</span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full rounded-full acid-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const pct = Math.round(score * 100);
  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--color-primary) ${pct}%, var(--color-muted) ${pct}% 100%)`,
      }}
      role="img"
      aria-label={`${pct} percent match`}
    >
      <div className="grid h-[78%] w-[78%] place-items-center rounded-full bg-card">
        <span className="font-mono text-xs font-semibold">{pct}%</span>
      </div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  full,
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline" | "signal";
  type?: "button" | "submit";
  disabled?: boolean;
  full?: boolean;
  ariaLabel?: string;
}) {
  const variants = {
    primary: "acid-fill text-primary-foreground hover:opacity-90",
    signal: "bg-signal text-signal-foreground hover:opacity-90",
    outline: "border border-border-strong bg-transparent text-foreground hover:bg-surface",
    ghost: "bg-surface text-surface-foreground hover:bg-muted",
  } as const;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-opacity disabled:opacity-40",
        variants[variant],
        full && "w-full",
      )}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ kicker, title, action }: { kicker?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {kicker ? (
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">{kicker}</p>
        ) : null}
        <h2 className="mt-1 text-2xl font-bold">{title}</h2>
      </div>
      {action}
    </div>
  );
}
