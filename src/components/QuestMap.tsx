import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Quest, SessionContext } from "@/lib/types";

// Flat satellite imagery (Esri, no key) with crisp vector place names drawn on the GPU on top
// (OpenFreeMap, no key), in the app's own paper and ink instead of a GIS layer's neon.
const IMAGERY =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const NAMES = "https://tiles.openfreemap.org/planet";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const ATTRIBUTION = "Imagery &copy; Esri, Maxar, Earthstar Geographics";
const NAMES_ATTRIBUTION = "Names &copy; OpenStreetMap contributors, OpenFreeMap";
/** The first view frames the quests closest to you, not every quest in the Twin Cities. */
const FIRST_VIEW_QUESTS = 15;
// Room kept clear for the quest card when a picked pin is brought into view.
const SAFE = { top: 64, right: 48, bottom: 220, left: 48 };
const AREA_RADIUS_M = 450;

type MapLibre = typeof import("maplibre-gl");
type MapInstance = import("maplibre-gl").Map;
type Pin = { marker: import("maplibre-gl").Marker; button: HTMLButtonElement; title: string };

/** A ring of points ~radius metres around a centre, for the approximate-area circle. */
function areaRing(lat: number, lng: number, radiusM: number): [number, number][] {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return [lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)];
  });
}

function areaData(lat: number, lng: number) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [areaRing(lat, lng, AREA_RADIUS_M)] },
  };
}

function flag(el: HTMLElement, name: string, on: boolean) {
  if (on) el.setAttribute(name, "");
  else el.removeAttribute(name);
}

/**
 * Every quest as a pin on a GPU map: pinch, scroll and drag follow your fingers. Tap a pin to pick
 * it. Pins carry a quiet mark for what you've done with a quest: an ink centre when it's saved,
 * solid ink with a check once you've done it.
 */
export function QuestMap({
  quests,
  origin,
  selectedId,
  onSelect,
  onUnavailable,
  onReady,
  saved = [],
  done = [],
}: {
  quests: Quest[];
  origin: SessionContext["origin"];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUnavailable?: () => void;
  /** The first tiles are on screen. */
  onReady?: () => void;
  saved?: string[];
  done?: string[];
}) {
  const element = useRef<HTMLDivElement>(null);
  const lib = useRef<MapLibre | null>(null);
  const map = useRef<MapInstance | null>(null);
  const pins = useRef(new Map<string, Pin>());
  const select = useRef(onSelect);
  const unavailable = useRef(onUnavailable);
  const loadedCallback = useRef(onReady);
  const dropped = useRef(false);
  unavailable.current = onUnavailable;
  loadedCallback.current = onReady;
  // Read when the map is built, after the import resolves, so it sees the hydrated store, not the first render.
  const latest = useRef({ quests, origin });
  // Read whenever a pin is dressed, so marks always match the store.
  const marks = useRef({ selectedId, saved, done });
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  select.current = onSelect;
  latest.current = { quests, origin };
  marks.current = { selectedId, saved, done };

  /** Picked, saved and done, as data attributes the stylesheet draws (and words for screen readers). */
  function dress(id: string, pin: Pin) {
    const { selectedId: pickedId, saved: savedIds, done: doneIds } = marks.current;
    const isDone = doneIds.includes(id);
    const isSaved = !isDone && savedIds.includes(id);
    flag(pin.button, "data-picked", id === pickedId);
    flag(pin.button, "data-saved", isSaved);
    flag(pin.button, "data-done", isDone);
    // Marked pins sit above plain ones where they overlap; the picked one above everything.
    pin.marker.getElement().style.zIndex = id === pickedId ? "3" : isDone || isSaved ? "2" : "";
    pin.button.setAttribute("aria-pressed", String(id === pickedId));
    pin.button.setAttribute(
      "aria-label",
      `${pin.title}${isDone ? ", done" : isSaved ? ", saved" : ""}`,
    );
  }

  // The map itself, once.
  useEffect(() => {
    let disposed = false;
    const markers = pins.current;
    void Promise.all([
      import("maplibre-gl"),
      import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"),
    ])
      .then(([maplibre, worker]) => {
        if (disposed || !element.current) return;
        maplibre.setWorkerUrl(worker.default);
        const { quests, origin } = latest.current;
        const tokens = getComputedStyle(document.documentElement);
        const card = tokens.getPropertyValue("--card").trim() || "#fff";
        const ink = tokens.getPropertyValue("--foreground").trim() || "#1e1e1e";
        const name = ["coalesce", ["get", "name:en"], ["get", "name"]] as unknown as string;
        const label = {
          "text-color": card,
          "text-halo-color": ink,
          "text-halo-width": 1.3,
          "text-halo-blur": 0.6,
        };
        let instance: MapInstance;
        try {
          instance = new maplibre.Map({
            container: element.current,
            style: {
              version: 8,
              glyphs: GLYPHS,
              sources: {
                imagery: {
                  type: "raster",
                  tiles: [IMAGERY],
                  tileSize: 256,
                  maxzoom: 19,
                  attribution: ATTRIBUTION,
                },
                names: { type: "vector", url: NAMES, attribution: NAMES_ATTRIBUTION },
                area: { type: "geojson", data: areaData(origin.lat, origin.lng) },
              },
              layers: [
                // Calmer than raw satellite colour, blacks lifted a touch, so the clover pins lead (on the GPU).
                {
                  id: "imagery",
                  type: "raster",
                  source: "imagery",
                  paint: {
                    "raster-fade-duration": 0,
                    "raster-saturation": -0.4,
                    "raster-contrast": -0.08,
                    "raster-brightness-min": 0.08,
                  },
                },
                {
                  id: "area-fill",
                  type: "fill",
                  source: "area",
                  paint: { "fill-color": card, "fill-opacity": 0.18 },
                },
                {
                  id: "area-line",
                  type: "line",
                  source: "area",
                  paint: { "line-color": card, "line-width": 2, "line-dasharray": [2, 3] },
                },
                {
                  id: "water-names",
                  type: "symbol",
                  source: "names",
                  "source-layer": "water_name",
                  minzoom: 12,
                  layout: {
                    "text-field": name,
                    "text-font": ["Noto Sans Italic"],
                    "text-size": 12,
                    "text-letter-spacing": 0.04,
                    "text-max-width": 8,
                  },
                  paint: { ...label, "text-opacity": 0.85 },
                },
                {
                  id: "road-names",
                  type: "symbol",
                  source: "names",
                  "source-layer": "transportation_name",
                  minzoom: 14.5,
                  filter: [
                    "in",
                    ["get", "class"],
                    ["literal", ["trunk", "primary", "secondary", "tertiary"]],
                  ],
                  layout: {
                    "text-field": name,
                    "text-font": ["Noto Sans Regular"],
                    "text-size": 11.5,
                    "symbol-placement": "line",
                    "text-letter-spacing": 0.02,
                  },
                  paint: { ...label, "text-opacity": 0.9 },
                },
                {
                  id: "place-names",
                  type: "symbol",
                  source: "names",
                  "source-layer": "place",
                  filter: [
                    "in",
                    ["get", "class"],
                    ["literal", ["city", "town", "suburb", "neighbourhood", "quarter"]],
                  ],
                  layout: {
                    "text-field": name,
                    "text-font": ["Noto Sans Bold"],
                    "text-size": ["interpolate", ["linear"], ["zoom"], 10, 11, 15, 14],
                    "text-letter-spacing": 0.03,
                    "text-max-width": 7,
                    "text-padding": 6,
                  },
                  paint: label,
                },
              ],
            },
            bounds: boundsOf(nearest(quests, origin, FIRST_VIEW_QUESTS), origin),
            fitBoundsOptions: { padding: 48, maxZoom: 15 },
            minZoom: 10,
            maxZoom: 19,
            fadeDuration: 0,
            // Keep tiles from many zoom levels so pinching back out is instant, not a refetch.
            maxTileCacheZoomLevels: 20,
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
            renderWorldCopies: false,
            attributionControl: { compact: false },
          });
        } catch {
          // No WebGL (switched off, or a very old browser): say so instead of showing a blank map.
          setFailed(true);
          unavailable.current?.();
          return;
        }
        // Faster than the defaults (1/100 trackpad, 1/450 wheel) so a trackpad pinch covers ground quickly.
        instance.scrollZoom.setZoomRate(1 / 50);
        instance.scrollZoom.setWheelZoomRate(1 / 200);
        // Phone pinch starts zooming almost immediately (default waits for ~10% finger spread).
        instance.touchZoomRotate.setZoomThreshold(0.02);
        instance.touchZoomRotate.disableRotation();
        instance.keyboard.disableRotation();
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        instance.on("click", (event) => {
          if ((event.originalEvent.target as HTMLElement | null)?.closest("[data-quest-pin]"))
            return;
          select.current(null);
        });
        instance.once("load", () => {
          if (disposed) return;
          setLoaded(true);
          loadedCallback.current?.();
        });
        lib.current = maplibre;
        map.current = instance;
        setReady(true);
      })
      .catch(() => {
        // The map code didn't arrive (offline, or a deploy mid-visit): fall back instead of waiting forever.
        if (disposed) return;
        setFailed(true);
        unavailable.current?.();
      });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
      markers.clear();
    };
  }, []);

  // Pins. Plain DOM markers, so they move with the map on the GPU frame.
  useEffect(() => {
    const maplibre = lib.current;
    const instance = map.current;
    if (!ready || !maplibre || !instance) return;
    for (const { marker } of pins.current.values()) marker.remove();
    pins.current.clear();
    // The first time, pins drop onto the map one after another (capped so the last lands by ~0.5s).
    const drop = !dropped.current;
    dropped.current = true;
    quests.forEach((quest, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset["questPin"] = quest.id;
      button.title = quest.title;
      button.className = "quest-pin";
      if (drop) {
        button.dataset["drop"] = "";
        button.style.setProperty("--drop-delay", `${Math.min(index * 15, 300)}ms`);
      }
      const dot = document.createElement("span");
      dot.className = "quest-pin-dot";
      button.append(dot);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        select.current(quest.id);
      });
      const marker = new maplibre.Marker({ element: button, anchor: "center" })
        .setLngLat([quest.location.lng, quest.location.lat])
        .addTo(instance);
      const pin = { marker, button, title: quest.title };
      pins.current.set(quest.id, pin);
      dress(quest.id, pin);
    });
  }, [ready, quests]);

  // Saved and done marks follow the store.
  useEffect(() => {
    if (!ready) return;
    for (const [id, pin] of pins.current) dress(id, pin);
  }, [ready, saved, done]);

  // Your approximate area, never a point.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const apply = () =>
      (instance.getSource("area") as import("maplibre-gl").GeoJSONSource | undefined)?.setData(
        areaData(origin.lat, origin.lng),
      );
    if (instance.isStyleLoaded()) apply();
    else instance.once("load", apply);
    return () => {
      instance.off("load", apply);
    };
  }, [ready, origin.lat, origin.lng]);

  // The picked pin grows and, if it's under the card or off screen, glides into view.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    for (const [id, pin] of pins.current) {
      const picked = id === selectedId;
      dress(id, pin);
      if (!picked) continue;
      const at = pin.marker.getLngLat();
      const point = instance.project(at);
      const { clientWidth: width, clientHeight: height } = instance.getContainer();
      const hidden =
        point.x < SAFE.left ||
        point.x > width - SAFE.right ||
        point.y < SAFE.top ||
        point.y > height - SAFE.bottom;
      // An offset, not padding: padding would stick and make later +/- zooms drift off-centre.
      if (hidden)
        instance.easeTo({
          center: at,
          offset: [(SAFE.left - SAFE.right) / 2, (SAFE.top - SAFE.bottom) / 2],
          duration: 250,
        });
    }
  }, [ready, selectedId, quests]);

  if (failed) {
    // The page shows its own list instead when it's told the map can't draw.
    if (onUnavailable) return <div className="h-full w-full bg-background" />;
    return (
      <div className="grid h-full w-full place-items-center bg-background p-6 text-center">
        <div className="max-w-xs">
          <p className="font-medium">This browser can't draw the map.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn on WebGL or try another browser. Every quest is still in Quests.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Inline font so it beats maplibre-gl.css's Helvetica on the controls and attribution. */}
      <div
        ref={element}
        className="wego-map map-under-dock isolate h-full w-full bg-muted"
        style={{ fontFamily: "var(--font-sans)" }}
        aria-label="Map of quests"
      />
      <p
        aria-hidden
        data-done={loaded ? "" : undefined}
        className="map-loading pointer-events-none absolute inset-0 grid place-items-center font-hand text-xl text-muted-foreground"
      >
        unfolding the map…
      </p>
    </div>
  );
}

/** The `count` quests closest to the origin (flat-earth distance is plenty at city scale). */
function nearest(quests: Quest[], origin: SessionContext["origin"], count: number) {
  const k = Math.cos((origin.lat * Math.PI) / 180);
  const d = (q: Quest) =>
    (q.location.lat - origin.lat) ** 2 + ((q.location.lng - origin.lng) * k) ** 2;
  return [...quests].sort((a, b) => d(a) - d(b)).slice(0, count);
}

function boundsOf(
  quests: Quest[],
  origin: SessionContext["origin"],
): [[number, number], [number, number]] {
  const lats = [origin.lat, ...quests.map((q) => q.location.lat)];
  const lngs = [origin.lng, ...quests.map((q) => q.location.lng)];
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
