import { VIBE_LABEL, type Vibe } from "@/lib/types";
import { topVibes } from "@/lib/engine";

/** Favorite quest types as simple ink bars. */
export function QuestDna({
  vibes,
  title = "What you're into",
  note,
  count = 4,
}: {
  vibes: Record<Vibe, number>;
  title?: string;
  note?: string;
  count?: number;
}) {
  const rows = topVibes(vibes, count);
  const max = Math.max(0.01, ...rows.map((r) => r.value));
  return (
    <section>
      <h2 className="text-lg font-bold">{title}</h2>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      <ul className="mt-4 space-y-3">
        {rows.map(({ vibe, value }, i) => {
          const pct = Math.round((Math.max(0, value) / max) * 100);
          return (
            <li key={vibe} className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
              <span className="text-sm font-medium">{VIBE_LABEL[vibe]}</span>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={VIBE_LABEL[vibe]}
              >
                <div
                  className={`h-full rounded-full ${i === 0 ? "bg-primary" : "bg-foreground"}`}
                  style={{ width: `${Math.max(pct, 4)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
