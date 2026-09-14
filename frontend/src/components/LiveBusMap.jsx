import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function LiveBusMap({ buses, selected, onSelect, stop = null }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const boundsRef = useRef([]);
  const initialFit = useRef(false);
  const previousSelection = useRef(null);
  const previousStop = useRef(null);
  const [tileError, setTileError] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let map;
    let observer;
    try {
      map = L.map(container.current, { scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false,
        markerZoomAnimation: false }).setView([17.84, 83.35], 11);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      // Direct browser requests preserve Referer and standard HTTP tile caching.
      const tiles = L.tileLayer(import.meta.env.VITE_TRACKING_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, minZoom: 8,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      tiles.on('tileerror', () => setTileError(true));
      if ('ResizeObserver' in window) {
        observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
        observer.observe(container.current);
      }
    } catch { setMapError(true); }
    return () => { observer?.disconnect(); map?.remove(); mapRef.current = null; initialFit.current = false; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layerRef.current) return;
    layerRef.current.clearLayers();
    const points = [];
    if (stop && Number.isFinite(stop.lat) && Number.isFinite(stop.lng)) {
      const point = [stop.lat, stop.lng];
      points.push(point);
      const marker = L.circleMarker(point, { radius: 12, color: '#ffffff', weight: 4,
        fillOpacity: 1, fillColor: '#dc2626' }).addTo(layerRef.current);
      const label = document.createElement('span');
      label.textContent = `Your selected stop: ${stop.name}`;
      marker.bindTooltip(label);
    }
    for (const bus of buses) {
      if (!bus.position) continue;
      const point = [bus.position.lat, bus.position.lng];
      points.push(point);
      const recent = bus.quality === 'recent';
      const marker = L.circleMarker(point, { radius: selected === bus.tripId ? 13 : 9,
        color: recent ? '#ffffff' : '#78350f', weight: 3, fillOpacity: 1,
        fillColor: recent ? bus.routeCode === 'ASR-2' ? '#2563eb' : '#087f78' : '#fbbf24',
        dashArray: recent ? undefined : '3 3',
      }).addTo(layerRef.current);
      const label = document.createElement('span');
      label.textContent = `${bus.vehicleNumber} · ${bus.routeCode || 'Route unconfirmed'} · ${recent ? 'Recent GPS' : 'Last known location (stale)'}`;
      marker.bindTooltip(label);
      marker.on('click', () => onSelect(bus.tripId));
      if (selected === bus.tripId) marker.openTooltip();
      if (selected === bus.tripId && previousSelection.current !== selected) map.setView(point, 14, { animate: false });
    }
    boundsRef.current = points;
    previousSelection.current = selected;
    const stopChanged = (stop?.placeId || null) !== previousStop.current;
    previousStop.current = stop?.placeId || null;
    if ((!initialFit.current || stopChanged) && points.length) {
      map.fitBounds(points, { padding: [35, 35], maxZoom: 13, animate: false });
      initialFit.current = true;
    }
  }, [buses, selected, onSelect, stop]);

  return <div className="relative isolate overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
    <div ref={container} className="h-80 w-full bg-slate-100 sm:h-[28rem]" role="region" aria-label="Bus GPS map. Use the bus list below as a keyboard-accessible alternative." />
    <button type="button" className="absolute right-3 top-3 z-[1000] min-h-11 rounded-xl bg-white px-4 text-sm font-bold text-slate-900 shadow-lg"
      onClick={() => boundsRef.current.length && mapRef.current?.fitBounds(boundsRef.current, { padding: [35, 35], maxZoom: 13, animate: false })}>{stop ? 'Show stop and buses' : 'Show all buses'}</button>
    {(tileError || mapError) && <p role="status" className="absolute bottom-8 left-3 right-3 z-[1000] rounded-xl bg-white p-3 text-sm text-slate-900 shadow-lg">
      Map background unavailable. Use the bus list and location links below.
    </p>}
  </div>;
}
