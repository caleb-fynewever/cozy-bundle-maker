import { useState, type ComponentProps, type ReactNode } from "react";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHelp } from "@/components/PageHelp";
import { Doodle } from "@/components/Doodle";

/*
 * wego's shared primitives. Color roles: clover (primary) is the one main action on a screen plus
 * progress and achievements; ink (foreground) means selected or current; surface is the hover wash.
 * Type: page titles 32/40px, section titles 20/22px, body 16px, meta 13-14px, handwriting only for
 * short human notes. Depth comes from paper and ink (hairlines, an ink edge on things you press),
 * not from shadows on everything.
 */

export function PageHeader({
  eyebrow,
  kicker,
  title,
  meta,
  leading,
  action,
  bare = false,
  className,
}: {
  /** A short handwritten note under the title ("with your people"). */
  eyebrow?: ReactNode;
  /** A short handwritten note above the title, for when the note leads ("basically around the corner"). */
  kicker?: ReactNode;
  title: ReactNode;
  /** Anything that belongs to the title block (handle, bio, stats line), kept above the rule. */
  meta?: ReactNode;
  leading?: ReactNode;
  action?: ReactNode;
  /** No rule under the header, for pages where tabs or a hero draw the line instead. */
  bare?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 pb-6", !bare && "border-b border-border", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {leading}
          <div className="min-w-0">
            {kicker ? <p className="mb-1 font-hand text-lg leading-tight text-muted-foreground">{kicker}</p> : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-[2rem] font-semibold leading-[1.08] tracking-[-0.02em] text-balance sm:text-[2.5rem]">{title}</h1>
              <PageHelp />
            </div>
            {eyebrow ? <p className="mt-1.5 font-hand text-lg leading-tight text-muted-foreground">{eyebrow}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {meta ? <div className="mt-4">{meta}</div> : null}
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
      <div className="min-w-0">
        {eyebrow ? <p className="font-hand text-[17px] leading-tight text-muted-foreground">{eyebrow}</p> : null}
        <h2 id={id} className="text-xl font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-[1.375rem]">{title}</h2>
        {detail ? <p className="mt-1 text-sm text-muted-foreground">{detail}</p> : null}
      </div>
      {action ? <div className="shrink-0 text-sm tabular-nums text-muted-foreground">{action}</div> : null}
    </div>
  );
}

/** A sheet of paper for the one grouped object on a page. Not a card for everything. */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-lg border border-border bg-card p-5 sm:p-6", className)} {...props} />;
}

/**
 * A selectable option: quiet at rest, ink when selected. Without onClick it is a plain label
 * (so it never pretends to be a button).
 */
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
  if (!onClick) {
    return <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-foreground">{children}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={Boolean(active)}
      aria-label={pressedLabel}
      className={cn(
        "press inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-4 text-sm font-medium",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-transparent text-foreground hover:border-border-strong hover:bg-card",
      )}
    >
      {children}
    </button>
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
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

type ButtonVariant = "primary" | "ink" | "ghost" | "outline" | "signal" | "destructive";
type ButtonSize = "md" | "sm";

/**
 * Button styles, also for links that act like buttons. The primary and ink buttons sit on a 2px
 * ink ledge and press flat into it, like a stamp; the quieter ones give a little under the finger.
 */
export function buttonClass({ variant = "primary", size = "md", full = false }: { variant?: ButtonVariant; size?: ButtonSize; full?: boolean } = {}) {
  const variants = {
    primary: "ledge border-foreground bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_88%,var(--card))]",
    signal: "ledge border-foreground bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_88%,var(--card))]",
    ink: "ledge-soft border-foreground bg-foreground text-background hover:bg-[color-mix(in_srgb,var(--foreground)_86%,var(--card))]",
    outline: "press border-border-strong bg-card text-foreground hover:bg-surface",
    ghost: "press border-transparent text-foreground hover:bg-surface",
    // Deleting is never the happy path: danger ink on paper, not a loud slab.
    destructive: "press border-destructive bg-card text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_8%,var(--card))]",
  } as const;
  const sizes = {
    md: "min-h-12 px-6 text-[15px] font-semibold",
    sm: "min-h-11 px-4 text-sm font-semibold",
  } as const;
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45 [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    full && "w-full",
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  type = "button",
  disabled,
  full,
  ariaLabel,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: "button" | "submit";
  disabled?: boolean;
  full?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} aria-label={ariaLabel} className={cn(buttonClass({ variant, size, full: Boolean(full) }), className)}>
      {children}
    </button>
  );
}

/** A quiet secondary action: no underline at rest, ink on hover. */
export const textButtonClass =
  "press inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:underline hover:decoration-primary hover:decoration-2 hover:underline-offset-4";

export function TextButton({ children, onClick, className, ariaLabel }: { children: ReactNode; onClick?: () => void; className?: string; ariaLabel?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={cn(textButtonClass, className)}>
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

/** A person's tile: their photo, or their initial hand-lettered like a name tag. */
export function Avatar({ name, size = 44, you = false, imageUrl }: { name: string; size?: number; you?: boolean; imageUrl?: string | null }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-[30%] border border-foreground font-hand leading-none",
        you ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
      )}
      style={{ width: size, height: size, fontSize: size * 0.52 }}
    >
      {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="translate-y-[4%]">{name.slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}

export function Verified({ label = "Verified student" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <BadgeCheck aria-hidden className="h-4 w-4 text-ring" />
      {label}
    </span>
  );
}

/**
 * A photo printed on the app's paper: a thin white margin, an ink hairline, and a soft fade-in
 * once it loads (the placeholder is the muted paper, never a broken box). A `priority` photo (the
 * one the page is about) shows as soon as it arrives, without waiting for the app to start. If a
 * photo can't load, the print keeps its paper and shows a doodle in a shorter frame instead.
 */
export function PhotoPrint({
  src,
  alt,
  className,
  imgClassName,
  priority = false,
  fallback,
  onDoubleClick,
  children,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  /** What a failed photo shows instead (a vibe doodle, say). */
  fallback?: ReactNode;
  onDoubleClick?: () => void;
  children?: ReactNode;
}) {
  const [loaded, setLoaded] = useState(priority);
  const [failed, setFailed] = useState(false);
  return (
    <figure className={cn("relative overflow-hidden rounded-md border border-border-strong bg-card p-1.5", className)} onDoubleClick={onDoubleClick}>
      {failed ? (
        <div role="img" aria-label={alt} className="grid aspect-[3/1] w-full place-items-center rounded-[4px] bg-muted">
          {fallback ?? <Doodle name="steps" size={44} faint />}
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          {...(priority ? { fetchPriority: "high" as const } : {})}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          ref={(img) => {
            if (!img?.complete) return;
            // Settled before the app started: loaded, or (an eager photo only; a lazy one that
            // hasn't started can also report complete) broken.
            if (img.naturalWidth) setLoaded(true);
            else if (priority && img.getAttribute("src")) setFailed(true);
          }}
          className={cn(
            "block w-full rounded-[4px] bg-muted object-cover",
            !priority && "transition-opacity duration-(--dur-base) ease-(--ease-out)",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
        />
      )}
      {children}
    </figure>
  );
}

/**
 * A row of figures: the number big and tabular, its label small underneath. Reads label-then-value
 * to screen readers. No icons, no boxes: hairlines between cells.
 */
export function StatLedger({ items, className }: { items: { label: ReactNode; value: ReactNode; key?: string }[]; className?: string }) {
  return (
    <dl className={cn("grid border-y border-border", items.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : items.length === 3 ? "grid-cols-3" : "grid-cols-2", className)}>
      {items.map((item, index) => (
        <div
          key={item.key ?? index}
          className={cn(
            "flex flex-col-reverse justify-end gap-1 px-3 py-4 first:pl-0 sm:px-5",
            index > 0 && "border-l border-border",
            items.length >= 4 && index === 2 && "max-sm:border-l-0 max-sm:pl-0",
            items.length >= 4 && index >= 2 && "max-sm:border-t",
          )}
        >
          <dt className="text-[13px] leading-tight text-muted-foreground">{item.label}</dt>
          <dd className="text-2xl font-semibold leading-none tracking-[-0.01em] tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A number that rolls to its new value (up when it grows, down when it shrinks). */
export function Tally({ value, className }: { value: number; className?: string }) {
  const [last, setLast] = useState(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  if (value !== last) {
    setDir(value > last ? "up" : "down");
    setLast(value);
  }
  return (
    <span className={cn("inline-grid overflow-hidden tabular-nums", className)} aria-live="off">
      <span key={value} className={dir ? "tally" : undefined} data-dir={dir ?? undefined}>
        {value.toLocaleString()}
      </span>
    </span>
  );
}
