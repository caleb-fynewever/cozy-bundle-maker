import type { CSSProperties } from "react";

export function RatingRing({ rating, label }: { rating: number; label: string }) {
  const score = Math.min(10, Math.max(0, rating));
  const display = Number.isInteger(score) ? String(score) : score.toFixed(1);

  return (
    <div
      role="img"
      aria-label={`${label}: ${display} out of 10`}
      className="rating-ring"
      style={{ "--rating-fill": `${score * 10}%` } as CSSProperties}
    >
      <span>{display}</span>
    </div>
  );
}
