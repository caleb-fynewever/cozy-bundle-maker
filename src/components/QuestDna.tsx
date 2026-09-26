import { VIBE_EMOJI, VIBE_LABEL, type Vibe } from "@/lib/types";
import { topVibes } from "@/lib/engine";

export function QuestDna({
  vibes,
  title = "Quest DNA",
  note,
  count = 5,
}: {
  vibes: Record<Vibe, number>;
  title?: string;
  note?: string;
  count?: number;
}) {
  const rows = topVibes(vibes, count);
  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-bold">{title}</h3>
        {note ? <p className="font-mono text-xs text-primary">{note}</p> : null}
      </div>
      <ul className="mt-4 space-y-3">
        {rows.map(({ vibe, value }) => {
          const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
          return (
            <li key={vibe} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm">
                {VIBE_EMOJI[vibe]} {VIBE_LABEL[vibe]}
              </span>
              <div
                className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${VIBE_LABEL[vibe]} ${pct} percent`}
              >
                <div className="h-full acid-fill" style={{ width: `${Math.max(pct, 3)}%` }} />
              </div>
              <span className="w-10 text-right font-mono text-xs text-muted-foreground">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
