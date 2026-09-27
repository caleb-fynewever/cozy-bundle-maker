import { Check, Navigation } from "lucide-react";
import type { QuestLocation, SessionContext } from "@/lib/types";
import { distanceMi } from "@/lib/engine";
import { mapsLinks, walkLabel } from "@/lib/maps";
import { SectionHeading, buttonClass } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

const APPROXIMATE = "Your approximate area";

/**
 * The way there: how long the walk is (a section title, like "the quest" beside it), where it
 * starts, and one button that opens walking directions. No box around it; it belongs to the page.
 *
 * `compact` is for a row that already says how far and how long (Lists): it drops the heading and
 * keeps only where the walk starts and the ways to get there.
 */
export function QuestDirections({
  destination,
  origin,
  compact = false,
  className,
}: {
  destination: QuestLocation;
  origin: SessionContext["origin"];
  compact?: boolean;
  className?: string;
}) {
  const miles = distanceMi(origin, destination);
  const links = mapsLinks(destination);
  const from = origin.label === APPROXIMATE ? "your approximate area" : origin.label;
  const route = `From ${from} to ${destination.name}`;
  const textLink =
    "inline-flex min-h-11 items-center rounded-sm px-1 underline-offset-4 transition-colors duration-(--dur-quick) hover:text-foreground hover:underline";

  return (
    <div className={cn("grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6", compact ? "sm:items-center" : "sm:items-end", className)}>
      <div className="min-w-0">
        {compact ? (
          <p className="text-[13px] text-muted-foreground text-pretty">{route}</p>
        ) : (
          <SectionHeading
            eyebrow="the way there"
            title={
              <span className="tabular-nums">
                {walkLabel(miles)} · {miles.toFixed(1)} mi
              </span>
            }
            detail={<span className="text-pretty">{route}</span>}
          />
        )}
      </div>
      <div className="flex flex-col gap-0.5 sm:items-end">
        <a
          href={links.directions}
          target="_blank"
          rel="noreferrer"
          aria-label={`Walk there: walking directions to ${destination.name}`}
          className={cn(buttonClass({ variant: "outline", size: "sm" }), "max-sm:w-full")}
        >
          <Navigation aria-hidden className="h-4 w-4" /> Walk there
        </a>
        <p className="flex items-center gap-1 text-[13px] text-muted-foreground max-sm:justify-center">
          <a href={links.google} target="_blank" rel="noreferrer" aria-label={`Open ${destination.name} in Google Maps`} className={textLink}>
            Google Maps
          </a>
          <span aria-hidden>·</span>
          <a href={links.apple} target="_blank" rel="noreferrer" aria-label={`Open ${destination.name} in Apple Maps`} className={textLink}>
            Apple Maps
          </a>
        </p>
      </div>
    </div>
  );
}

/**
 * A quest's steps as stops on a walk: numbered paper discs joined by a dotted path, the last one
 * the clover finish (with a small hand note saying so). Give it `onToggle` and each stop becomes a
 * checkbox you tick off while out.
 */
export function RouteStops({
  steps,
  ticked,
  onToggle,
  className,
}: {
  steps: string[];
  ticked?: number[];
  onToggle?: (index: number) => void;
  className?: string;
}) {
  return (
    <ol className={cn("route-stops", className)}>
      {steps.map((step, index) => {
        const done = ticked?.includes(index) ?? false;
        const last = index === steps.length - 1;
        const dot = (
          <span aria-hidden className="route-stop-dot" data-last={last ? "" : undefined} data-ticked={done ? "" : undefined}>
            {done ? <Check className="draw-check h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
          </span>
        );
        return (
          <li key={`${index}-${step}`} className="route-stop">
            {onToggle ? (
              <button type="button" role="checkbox" aria-checked={done} onClick={() => onToggle(index)} className="route-stop-toggle">
                {dot}
                <span className="route-strike">{step}</span>
              </button>
            ) : (
              <>
                {dot}
                <span className="route-stop-body">{step}</span>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
