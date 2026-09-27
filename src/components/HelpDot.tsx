import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/*
 * The app's one "how does this work?" affordance: a small circled question mark beside a heading.
 * It draws small (20px, so it never competes with the heading) but answers to a 44px target, and
 * opens a slip of paper with the explanation, so rules and fine print never lengthen the page.
 */
export function HelpDot({
  label,
  title,
  children,
  align = "start",
  side = "bottom",
  className,
  contentClassName,
}: {
  /** What the button explains, for screen readers ("How XP works"). */
  label: string;
  /** Optional heading printed at the top of the slip. */
  title?: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "help-dot press relative inline-grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-full border border-border-strong bg-card text-[12px] font-bold leading-none text-muted-foreground transition-colors duration-(--dur-quick) hover:border-foreground hover:text-foreground data-[state=open]:border-foreground data-[state=open]:bg-foreground data-[state=open]:text-background",
            className,
          )}
        >
          <span aria-hidden>?</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} side={side} collisionPadding={16} aria-label={label} className={cn("w-[min(20rem,calc(100vw-2rem))]", contentClassName)}>
        {title ? <p className="mb-2 text-[15px] font-semibold leading-snug">{title}</p> : null}
        <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
