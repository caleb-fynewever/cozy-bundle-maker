import { useMemo } from "react";
import type { ScoredQuest } from "@/lib/engine";
import { questImage } from "@/lib/imagery";

const BOUNDS = { north: 45.015, south: 44.905, west: -93.325, east: -93.19 };

function project(lat: number, lng: number) {
  const x = ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 100;
  const y = ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * 100;
  return { x: Math.max(3, Math.min(97, x)), y: Math.max(4, Math.min(96, y)) };
}

export function QuestMap({
  items,
  selectedId,
  onSelect,
  origin,
}: {
  items: ScoredQuest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  origin: { lat: number; lng: number; label: string };
}) {
  const markers = useMemo(
    () => items.map((item) => ({ item, pos: project(item.quest.location.lat, item.quest.location.lng) })),
    [items],
  );
  const you = project(origin.lat, origin.lng);

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-border bg-map-land sm:aspect-[16/10]">
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        {/* Mississippi river */}
        <path
          d="M 8 4 C 24 16, 30 26, 44 34 C 56 41, 62 52, 70 62 C 78 72, 86 82, 96 96"
          stroke="var(--color-map-water)"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
        {/* Lakes */}
        <ellipse cx="18" cy="42" rx="6" ry="9" fill="var(--color-map-water)" />
        <ellipse cx="16" cy="70" rx="8" ry="10" fill="var(--color-map-water)" />
        {/* Parks */}
        <rect x="58" y="80" width="26" height="14" rx="5" fill="var(--color-map-park)" opacity="0.7" />
        <rect x="30" y="18" width="16" height="10" rx="4" fill="var(--color-map-park)" opacity="0.6" />
        {/* Street grid */}
        {Array.from({ length: 11 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={i * 10}
            y1="0"
            x2={i * 10}
            y2="100"
            stroke="var(--color-map-road)"
            strokeWidth="0.35"
          />
        ))}
        {Array.from({ length: 11 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1="0"
            y1={i * 10}
            x2="100"
            y2={i * 10}
            stroke="var(--color-map-road)"
            strokeWidth="0.35"
          />
        ))}
      </svg>

      <div
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${you.x}%`, top: `${you.y}%` }}
      >
        <span className="relative grid h-4 w-4 place-items-center">
          <span className="absolute h-8 w-8 animate-ping rounded-full bg-primary/25" />
          <span className="h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
        </span>
        <span className="sr-only">Your approximate area: {origin.label}</span>
      </div>

      {markers.map(({ item, pos }) => {
        const selected = selectedId === item.quest.id;
        return (
          <button
            key={item.quest.id}
            type="button"
            onClick={() => onSelect(item.quest.id)}
            aria-pressed={selected}
            aria-label={`${item.quest.title}, ${item.distance.toFixed(1)} miles away`}
            className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 transition-transform ${
              selected
                ? "z-30 scale-110 border-primary glow"
                : "border-background/80 hover:scale-105"
            }`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <img
              src={questImage(item.quest)}
              alt=""
              loading="lazy"
              width={1200}
              height={912}
              className="h-10 w-10 rounded-xl object-cover"
            />
          </button>
        );
      })}
    </div>
  );
}
