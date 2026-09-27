import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { QuestLocation, SessionContext } from "@/lib/types";
import { distanceMi } from "@/lib/engine";

export function QuestRouteMap({ destination, origin }: { destination: QuestLocation; origin: SessionContext["origin"] }) {
  const element = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const miles = distanceMi(origin, destination);

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    const from: [number, number] = [origin.lat, origin.lng];
    const to: [number, number] = [destination.lat, destination.lng];

    void import("leaflet").then(({ default: L }) => {
      if (disposed || !element.current) return;
      const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
      map = L.map(element.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        dragging: false,
        touchZoom: false,
        keyboard: false,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
        className: "quest-map-tiles",
      }).addTo(map);
      const points: [number, number][] = [from, to];
      L.polyline(points, { color: primary || "#76B98C", weight: 4, opacity: 0.95, dashArray: "5 9", lineCap: "round" }).addTo(map);
      L.circleMarker(from, { radius: 9, color: "#fff", weight: 3, fillColor: primary || "#76B98C", fillOpacity: 1 }).addTo(map);
      L.circleMarker(to, { radius: 9, color: "#fff", weight: 3, fillColor: "#1E1E1E", fillOpacity: 1 }).addTo(map);
      map.fitBounds(points, { padding: [28, 28], maxZoom: 15 });
      setLoaded(true);
    });

    return () => {
      disposed = true;
      map?.remove();
    };
  }, [destination.lat, destination.lng, origin.lat, origin.lng]);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <p className="font-hand text-base leading-tight">the way there</p>
          <p className="truncate text-xs text-muted-foreground">{origin.label} → {destination.name}</p>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{miles.toFixed(1)} mi</span>
      </div>
      <div
        ref={element}
        role="img"
        aria-label={`Approximate map from ${origin.label} to ${destination.name}`}
        className="quest-map h-44 w-full bg-muted"
      />
      <p className="bg-card px-3 py-2 text-[11px] text-muted-foreground">
        {loaded ? `Approximate area · ${origin.label} to destination` : "Loading map…"}
      </p>
    </div>
  );
}
