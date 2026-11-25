import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Info, List, RefreshCw } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { attachLiveBasemap } from '../lib/liveBasemap.js';
import { getMapRouteShape, isGpsAwayFromRoute } from '../lib/liveRouteMap.js';
import { formatTrackingDistance } from '../lib/liveTracking.js';

const fitOptions = { padding: [35, 35], maxZoom: 13, animate: false };
const boardingFitOptions = { ...fitOptions, maxZoom: 16 };
const mapAction = 'min-h-11 rounded-lg px-1.5 text-xs font-bold text-ink hover:bg-brand-soft focus-visible:outline-2 sm:bg-white sm:px-3 sm:text-sm sm:text-slate-900 sm:shadow';

const markerStyles = {
	boarding: { label: 'Boarding stop', fillColor: '#be123c', color: '#fff' },
	destination: { label: 'Destination stop', fillColor: '#6d28d9', color: '#fff' },
	routeStop: { label: 'Scheduled route stop', fillColor: '#fff', color: '#334155' },
	'ASR-1': { label: 'ASR-1 bus', fillColor: '#087f78', color: '#fff' },
	'ASR-2': { label: 'ASR-2 bus', fillColor: '#2563eb', color: '#fff' },
	nearby: { label: 'Other nearby bus', fillColor: '#475569', color: '#fff' },
	lastKnown: { label: 'Last known bus position', fillColor: '#fbbf24', color: '#78350f' }
};

function addMarker(layer, point, { color, fillColor }, radius, label) {
	const marker = L.circleMarker(point, { color, fillColor, radius, fillOpacity: 1, weight: 3 }).addTo(layer);
	const text = document.createElement('span');
	text.textContent = label;
	return marker.bindTooltip(text);
}

function addBusMarker(layer, point, bus, selected, nearby) {
	const style = nearby ? markerStyles.nearby : bus.recent ? (markerStyles[bus.routeCode] || markerStyles['ASR-1']) : markerStyles.lastKnown;
	const size = selected ? 46 : 40;
	const label = document.createElement('span');
	label.className = 'grid h-full w-full place-items-center rounded-full border-2 text-[10px] font-extrabold leading-none shadow-sm';
	label.style.backgroundColor = style.fillColor;
	label.style.borderColor = style.color;
	label.style.color = bus.recent ? '#fff' : '#422006';
	label.textContent = bus.routeCode;
	const marker = L.marker(point, {
		icon: L.divIcon({ className: 'live-bus-marker', html: label, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
		zIndexOffset: selected ? 1000 : 0
	}).addTo(layer);
	const element = marker.getElement();
	const busName = bus.vehicleNumber || `Service ${bus.serviceNumber}`;
	element?.setAttribute('aria-label', nearby ? `Other nearby ${bus.routeCode} bus, ${busName}` : `${bus.routeCode} bus`);
	element?.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			marker.fire('click');
		}
	});
	if (nearby) {
		const name = document.createElement('span');
		name.textContent = busName;
		marker.bindTooltip(name);
	} else if (Number.isFinite(bus.distanceFromBoardingKm)) {
		const distance = document.createElement('span');
		const formatted = formatTrackingDistance(bus.distanceFromBoardingKm);
		const compact = document.createElement('span');
		compact.className = 'whitespace-nowrap text-[11px] sm:hidden';
		compact.textContent = `${formatted} away`;
		const full = document.createElement('span');
		full.className = 'hidden whitespace-nowrap sm:inline';
		full.textContent = `${formatted} away from your stop`;
		distance.append(compact, full);
		marker.bindTooltip(distance, {
			className: 'live-bus-distance font-semibold', permanent: true, direction: 'auto', offset: [size / 2 + 4, 0]
		});
	}
	return marker;
}

export default function LiveBusMap({ buses, nearbyBuses, selectedId, focusRequest, onSelect, onShowAll, boardingStop, boardingAtAirport, destinationStop, places, stopNames, following, onStopFollowing }) {
	const container = useRef(null);
	const credits = useRef(null);
	const map = useRef(null);
	const layer = useRef(null);
	const basemap = useRef(null);
	const points = useRef([]);
	const fitted = useRef(false);
	const previousSelection = useRef(null);
	const previouslyFollowing = useRef(false);
	const previousFocus = useRef(focusRequest);
	const previousStops = useRef([]);
	const previousNearest = useRef(null);
	const previousAirportView = useRef(null);
	const [basemapStatus, setBasemapStatus] = useState('loading');
	const selectedBus = buses.find((bus) => bus.id === selectedId);
	const showingNearby = Boolean(!buses.length && nearbyBuses?.length);
	const visibleBuses = useMemo(() => selectedBus ? [selectedBus] : showingNearby ? nearbyBuses : buses, [selectedBus, showingNearby, nearbyBuses, buses]);
	const routeCode = selectedBus?.routeCode;
	const direction = selectedBus?.direction;
	const routeShape = useMemo(() => getMapRouteShape(routeCode, direction, places), [routeCode, direction, places]);
	const hasRoutePath = Boolean(routeShape?.paths.length);
	const routeColor = markerStyles[routeCode]?.fillColor;
	const gpsAwayFromRoute = selectedBus?.recent && isGpsAwayFromRoute(selectedBus.position, routeShape);
	const overviewLabel = showingNearby ? 'Nearby buses' : boardingAtAirport && selectedBus && onShowAll
		? 'Airport buses' : boardingStop || destinationStop ? 'Buses and stops' : 'All buses';
	const reloadLabel = basemapStatus === 'ready' ? 'Reload map' : 'Retry loading map';
	const legendKeys = new Set(visibleBuses.map((bus) => showingNearby ? 'nearby' : bus.recent ? bus.routeCode : 'lastKnown'));
	if (boardingStop) legendKeys.add('boarding');
	if (destinationStop) legendKeys.add('destination');
	if (routeShape?.stops.length) legendKeys.add('routeStop');

	useEffect(() => {
		const instance = L.map(container.current, {
			scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false,
			markerZoomAnimation: false, inertia: false, minZoom: 1, maxZoom: 18
		}).setView([17.84, 83.35], 10);
		map.current = instance;
		const attribution = instance.attributionControl.setPrefix(false);
		attribution.addAttribution('<a href="https://github.com/reclaimchennai/apsrtc#licence">Bus data credits</a>');
		credits.current.appendChild(attribution.getContainer());
		instance.on('dragstart', onStopFollowing);
		layer.current = L.layerGroup().addTo(instance);
		basemap.current = attachLiveBasemap(instance, setBasemapStatus);
		const observer = typeof ResizeObserver === 'function'
			? new ResizeObserver(() => {
				if (map.current === instance) instance.invalidateSize({ animate: false });
			})
			: null;
		observer?.observe(container.current);
		return () => {
			observer?.disconnect();
			map.current = null;
			basemap.current.remove();
			basemap.current = null;
			instance.stop().remove();
			fitted.current = false;
			previousSelection.current = null;
			previouslyFollowing.current = false;
			previousStops.current = [];
			previousNearest.current = null;
			previousAirportView.current = null;
		};
	}, [onStopFollowing]);

	useEffect(() => {
		const instance = map.current;
		const markers = layer.current;
		if (!instance || !markers) return;
		const fleetRestored = !selectedId && previousSelection.current !== null;
		if (Boolean(selectedId) !== Boolean(previousSelection.current)) instance.invalidateSize({ animate: false });
		markers.clearLayers();
		const nextPoints = [];
		if (hasRoutePath) {
			L.polyline(routeShape.paths, { color: '#fff', weight: 7, opacity: 0.85, interactive: false }).addTo(markers);
			L.polyline(routeShape.paths, {
				className: 'selected-bus-route', color: routeColor, weight: 4,
				opacity: 0.9, interactive: false
			}).addTo(markers);
		}
		for (const { placeId, point } of routeShape?.stops || []) {
			if (placeId === boardingStop?.placeId || placeId === destinationStop?.placeId) continue;
			addMarker(markers, point, markerStyles.routeStop, 4, stopNames.get(placeId) || placeId);
		}
		const nearest = visibleBuses.find((bus) => bus.distanceFromBoardingKm !== undefined);
		const boardingViewPoints = boardingAtAirport && boardingStop
			? [[boardingStop.lat, boardingStop.lng], ...visibleBuses.map(({ position }) => [position.lat, position.lng])]
			: nearest && boardingStop
				? [[boardingStop.lat, boardingStop.lng], [nearest.position.lat, nearest.position.lng]]
				: null;
		for (const [stop, style] of [
			[boardingStop, markerStyles.boarding],
			[destinationStop, markerStyles.destination]
		]) {
			if (!Number.isFinite(stop?.lat) || !Number.isFinite(stop?.lng)) continue;
			const point = [stop.lat, stop.lng];
			nextPoints.push(point);
			addMarker(markers, point, style, 10, `${style.label}: ${stop.name}`);
		}
		let selectedMarker;
		for (const bus of visibleBuses) {
			const point = [bus.position.lat, bus.position.lng];
			nextPoints.push(point);
			const marker = addBusMarker(markers, point, bus, selectedId === bus.id, showingNearby);
			if (!showingNearby) marker.on('click', () => onSelect(bus.id));
			if (selectedId === bus.id) selectedMarker = marker;
		}
		points.current = showingNearby && boardingViewPoints ? boardingViewPoints : nextPoints;
		const stopsChanged = boardingStop !== previousStops.current[0] || destinationStop !== previousStops.current[1];
		const nearestChanged = nearest && nearest.id !== previousNearest.current;
		const airportView = boardingAtAirport
			? [showingNearby ? 'nearby' : 'boarding', ...visibleBuses.map((bus) => bus.id).sort()].join('|')
			: null;
		if ((!fitted.current || stopsChanged || nearestChanged || airportView !== previousAirportView.current || fleetRestored) && nextPoints.length) {
			instance.fitBounds(boardingViewPoints || nextPoints, boardingViewPoints ? boardingFitOptions : fitOptions);
			fitted.current = true;
		}
		if (selectedMarker) {
			if (following) {
				const target = selectedMarker.getLatLng();
				const zoom = previouslyFollowing.current ? instance.getZoom() : Math.max(instance.getZoom(), 13);
				if (instance.getZoom() !== zoom || !instance.getCenter().equals(target)) instance.setView(target, zoom, { animate: false });
			} else if (boardingViewPoints && (focusRequest !== previousFocus.current || (boardingAtAirport && selectedId !== previousSelection.current))) {
				instance.fitBounds(boardingViewPoints, boardingFitOptions);
			} else if (!boardingViewPoints && (selectedId !== previousSelection.current || focusRequest !== previousFocus.current)) {
				instance.setView(selectedMarker.getLatLng(), 13, { animate: false });
			}
		}
		previousSelection.current = selectedId;
		previouslyFollowing.current = following;
		previousFocus.current = focusRequest;
		previousStops.current = [boardingStop, destinationStop];
		previousNearest.current = nearest?.id ?? null;
		previousAirportView.current = airportView;
	}, [visibleBuses, showingNearby, selectedId, routeShape, hasRoutePath, routeColor, focusRequest, onSelect, boardingStop, boardingAtAirport, destinationStop, stopNames, following]);

	return (
		<div className="relative isolate overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
			{hasRoutePath && (
				<div className="border-b border-slate-200 bg-slate-50 p-2 text-[11px] sm:px-3 sm:py-2.5 sm:text-xs dark:border-white/10 dark:bg-slate-900">
					<ul aria-label="Route and bus position" className="flex flex-wrap gap-x-2.5 gap-y-1 font-semibold text-ink sm:gap-x-4">
						<li className="flex items-center gap-1.5 sm:gap-2">
							<span aria-hidden="true" className="h-1 w-3 rounded-full sm:w-5" style={{ backgroundColor: routeColor }} />
							Approximate route
						</li>
						<li className="flex items-center gap-1.5 sm:gap-2">
							<span aria-hidden="true" className="size-2.5 rounded-full sm:size-3" style={{ backgroundColor: selectedBus.recent ? routeColor : markerStyles.lastKnown.fillColor }} />
							{selectedBus.recent ? 'Reported GPS position' : 'Last known GPS position'}
						</li>
					</ul>
					<div role="status">
						{gpsAwayFromRoute && (
							<p className="mt-1.5 flex items-start gap-1.5 leading-relaxed text-muted sm:mt-2 sm:gap-2">
								<Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
								<span className="sm:hidden">GPS is away from the mapped route.</span>
								<span className="hidden sm:inline">The bus’s latest GPS position is away from the route line. This can happen when GPS drifts or the bus takes a different road.</span>
							</p>
						)}
					</div>
				</div>
			)}
			<div className="relative isolate overflow-hidden">
				<div ref={container} className={`h-[19rem] w-full bg-slate-100 sm:h-96 ${selectedBus ? 'lg:h-[33rem]' : ''}`} role="region" aria-label="Bus GPS map. Bus positions are also listed below." />
				<div className="relative flex flex-wrap items-center justify-between gap-x-1 bg-slate-50 px-2 dark:bg-slate-900 sm:contents">
					<div className="flex min-w-0 flex-wrap sm:absolute sm:right-3 sm:top-3 sm:z-[1000] sm:max-w-[calc(100%_-_4.5rem)] sm:justify-end sm:gap-1.5">
						{hasRoutePath && (
							<button type="button" className={mapAction} onClick={() => {
								onStopFollowing();
								map.current?.fitBounds(routeShape.paths.flat(), fitOptions);
							}}>Fit route</button>
						)}
						<button type="button" aria-label={`Show ${overviewLabel.toLowerCase()}`} className={mapAction} onClick={() => {
							onStopFollowing();
							if (selectedBus && onShowAll) onShowAll();
							else if (points.current.length) map.current?.fitBounds(points.current, showingNearby ? boardingFitOptions : fitOptions);
						}}>
							<span className="sm:hidden">{overviewLabel === 'Buses and stops' ? 'Buses & stops' : overviewLabel}</span>
							<span className="hidden sm:inline">Show {overviewLabel.toLowerCase()}</span>
						</button>
					</div>
					<details className="group sm:absolute sm:bottom-3 sm:left-3 sm:z-[900] sm:max-w-[calc(100%_-_1.5rem)] sm:rounded-xl sm:border sm:border-slate-200 sm:bg-white sm:text-slate-900 sm:shadow-md">
						<summary aria-label="Map legend" className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl px-2 text-xs font-bold sm:gap-2 sm:px-3 sm:text-sm [&::-webkit-details-marker]:hidden">
							<List size={16} className="hidden sm:block" aria-hidden="true" />
							<span className="sm:hidden">Legend</span>
							<span className="hidden sm:inline">Map legend</span>
							<ChevronDown size={14} className="ml-auto group-open:rotate-180" aria-hidden="true" />
						</summary>
						<ul className="grid gap-2 border-slate-200 px-3 py-2.5 text-xs max-sm:absolute max-sm:inset-x-2 max-sm:bottom-full max-sm:z-[1000] max-sm:rounded-xl max-sm:border max-sm:bg-white max-sm:text-slate-900 max-sm:shadow-md sm:border-t">
							{Object.entries(markerStyles).filter(([key]) => legendKeys.has(key)).map(([, { label, fillColor, color }]) => (
								<li key={label} className="flex items-center gap-2">
									<span aria-hidden="true" className="size-3.5 shrink-0 rounded-full border-2 shadow-[0_0_0_1px_#cbd5e1]" style={{ backgroundColor: fillColor, borderColor: color }} />
									{label}
								</li>
							))}
						</ul>
					</details>
				</div>
			</div>
			<div className="flex items-center justify-between gap-x-2 border-t border-slate-200 bg-slate-50 px-2 py-1 sm:flex-wrap sm:gap-x-3 sm:gap-y-1 sm:px-3 sm:py-1.5 dark:border-white/10 dark:bg-slate-900">
				<div className="min-w-0 max-sm:flex-1">
					{basemapStatus !== 'ready' && (
						<p role="status" className="text-xs text-muted">
							{basemapStatus === 'unavailable' ? 'Map background unavailable.' : 'Loading map background…'}
						</p>
					)}
					<div ref={credits} className="live-map-credits text-[11px] leading-relaxed text-muted" />
				</div>
				<button type="button" aria-label={reloadLabel} title={reloadLabel}
					className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-xs font-bold text-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 sm:gap-2 sm:px-3 dark:border-white/15" onClick={() => basemap.current?.retry()}>
					<RefreshCw size={14} aria-hidden="true" />
					<span className="sm:hidden">{basemapStatus === 'ready' ? 'Reload' : 'Retry'}</span>
					<span className="hidden sm:inline">{reloadLabel}</span>
				</button>
			</div>
		</div>
	);
}
