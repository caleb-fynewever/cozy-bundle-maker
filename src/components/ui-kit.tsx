import type { ReactNode } from "react";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small selectable option. Quiet by default, ink when active. */
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
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-transparent text-foreground hover:border-border-strong",
      )}
    >
      {children}
    </Tag>
  );
}

/** Plain text label. Kept for compatibility; renders without a pill. */
export function Tag({ children }: { children: ReactNode; tone?: string }) {
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">{children}</span>;
}

export function Meter({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint ?? `${pct}%`}</span>
      </div>
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
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
  variant?: "primary" | "ink" | "ghost" | "outline" | "signal";
  type?: "button" | "submit";
  disabled?: boolean;
  full?: boolean;
  ariaLabel?: string;
}) {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    signal: "bg-primary text-primary-foreground hover:opacity-90",
    ink: "bg-foreground text-background hover:opacity-90",
    outline: "border border-border-strong text-foreground hover:bg-surface",
    ghost: "text-foreground hover:bg-surface",
  } as const;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-40",
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
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {kicker ? <p className="text-sm text-muted-foreground">{kicker}</p> : null}
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Avatar({ name, size = 44, you = false }: { name: string; size?: number; you?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-display font-bold",
        you ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Verified({ label = "Verified student" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <BadgeCheck aria-hidden className="h-4 w-4 text-primary" />
      {label}
    </span>
  );
}
