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
  onSelect: (id: string | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const didFit = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || mapRef.current) return;
    const map = L.map(host, {
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
      center: [44.9778, -93.2277],
      zoom: 13,
    });
    // The container may not have its final size yet on first paint.
    requestAnimationFrame(() => map.invalidateSize());
    L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution:
        'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    // Tap anywhere on the map itself to deselect and see the whole thing.
    map.on("click", () => onSelectRef.current(null));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const points: L.LatLngExpression[] = [];
    for (const item of items.slice(0, 20)) {
      const { lat, lng } = item.quest.location;
      const active = item.quest.id === selectedId;
      // Selected quests get a clover teardrop pin; the rest are quiet ink dots.
      const html = active
        ? `<span style="display:block;width:26px;height:26px;border-radius:9999px 9999px 9999px 0;background:#367850;border:2px solid #FFFFFF;box-shadow:0 2px 5px rgba(0,0,0,.35);transform:rotate(-45deg)"></span>`
        : `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#1E1E1E;border:2px solid #FFFFFF;box-shadow:0 1px 3px rgba(0,0,0,.3)"></span>`;
      const size = active ? 26 : 14;
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "",
          html,
          iconSize: [size, size],
          iconAnchor: active ? [13, 24] : [7, 7],
        }),
        title: item.quest.title,
        riseOnHover: true,
      });
      marker.on("click", () => onSelectRef.current(item.quest.id));
      marker.addTo(layer);
      points.push([lat, lng]);
    }
    const selected = items.find((i) => i.quest.id === selectedId);
    if (selected) {
      map.setView([selected.quest.location.lat, selected.quest.location.lng], Math.max(map.getZoom(), 14), { animate: true });
    } else if (points.length && !didFit.current) {
      // Only frame every quest once on first load; after that, deselecting
      // keeps the view right where the person left it.
      didFit.current = true;
      map.fitBounds(L.latLngBounds(points).pad(0.12), { animate: true });
    }
  }, [items, selectedId]);

  return <div ref={hostRef} className="absolute inset-0 h-full w-full" aria-label="Topographic map of quests" />;
}
