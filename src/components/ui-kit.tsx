import type { ComponentProps, ReactNode } from "react";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  leading,
  action,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  leading?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 border-b border-border pb-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {leading}
          <div className="min-w-0">
            <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h1>
            {eyebrow ? <p className="mt-1 font-hand text-lg leading-tight text-muted-foreground">{eyebrow}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

export function SectionHeading({
  id,
  title,
  eyebrow,
  detail,
  action,
}: {
  id?: string;
  title: ReactNode;
  eyebrow?: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="font-hand text-base leading-tight text-muted-foreground">{eyebrow}</p> : null}
        <h2 id={id} className="text-xl font-semibold leading-tight sm:text-2xl">{title}</h2>
        {detail ? <p className="mt-1 text-sm text-muted-foreground">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-xl border border-border bg-card p-5 sm:p-6", className)} {...props} />;
}

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
         "inline-flex min-h-11 shrink-0 whitespace-nowrap items-center gap-1.5 rounded-md border px-4 text-sm font-medium transition-colors",
         active
            ? "border-foreground bg-primary text-primary-foreground"
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
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ink" | "ghost" | "outline" | "signal";
  type?: "button" | "submit";
  disabled?: boolean;
  full?: boolean;
  ariaLabel?: string;
  className?: string;
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
          "inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-transparent px-6 text-[15px] font-medium transition active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-40",
        variants[variant],
        full && "w-full",
        className,
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
          {kicker ? <p className="font-hand text-xl text-foreground">{kicker}</p> : null}
          <h2 className="text-2xl font-medium">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Avatar({ name, size = 44, you = false, imageUrl }: { name: string; size?: number; you?: boolean; imageUrl?: string | null }) {
  return (
    <span
      aria-hidden
      className={cn(
         "grid shrink-0 place-items-center overflow-hidden rounded-[30%] border border-foreground font-display font-bold",
        you ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
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
