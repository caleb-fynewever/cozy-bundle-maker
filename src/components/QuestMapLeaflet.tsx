import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ScoredQuest } from "@/lib/engine";

/** Browser-only Leaflet map using OpenTopoMap tiles. Never import from SSR modules. */
export default function QuestMapLeaflet({
  items,
  selectedId,
  onSelect,
}: {
  items: ScoredQuest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || mapRef.current) return;
    const map = L.map(host, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution:
        'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    const points: L.LatLngExpression[] = [];
    for (const item of items.slice(0, 20)) {
      const { lat, lng } = item.quest.location;
      const active = item.quest.id === selectedId;
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "",
          html: `<span style="display:block;width:${active ? 22 : 14}px;height:${active ? 22 : 14}px;border-radius:9999px;background:${active ? "#367850" : "#1E1E1E"};border:2px solid #FFFFFF;box-shadow:0 1px 3px rgba(0,0,0,.35)"></span>`,
          iconSize: [active ? 22 : 14, active ? 22 : 14],
          iconAnchor: [active ? 11 : 7, active ? 11 : 7],
        }),
        title: item.quest.title,
      });
      marker.on("click", () => onSelectRef.current(item.quest.id));
      marker.addTo(map);
      markersRef.current.set(item.quest.id, marker);
      points.push([lat, lng]);
    }
    const selected = items.find((i) => i.quest.id === selectedId) ?? items[0];
    if (selected) {
      map.setView([selected.quest.location.lat, selected.quest.location.lng], Math.max(map.getZoom(), 14), { animate: true });
    } else if (points.length) {
      map.fitBounds(L.latLngBounds(points).pad(0.15));
    }
  }, [items, selectedId]);

  return <div ref={hostRef} className="absolute inset-0 h-full w-full" aria-label="Topographic map of quests" />;
}
