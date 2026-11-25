import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, ArrowUpDown, BusFront, Flag, LocateFixed, MessageSquareText, Pause, Plane, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { GPS_RECENT_MS, gpsAgeMs, supportsLiveStopUpdates } from '../../../shared/liveTracking.mjs';
import { DEFAULT_SERVICE_DATA } from '../../../shared/serviceData.mjs';
import { useLiveBuses } from '../hooks/useLiveBuses.js';
import { formatTime } from '../lib/format.js';
import { directions, getLiveFeedState, getTrackingRoutes, getTrackingStops, getTrackingView, gpsAgeLabel } from '../lib/liveTracking.js';
import { trackEvent } from '../lib/analytics.js';
import BusStopTimeline from './BusStopTimeline.jsx';

const LiveBusMap = lazy(() => import('./LiveBusMap.jsx'));
const initialSelection = { cityPlaceId: '', direction: 'to-airport', plannedRouteCode: null, scheduledOriginAt: null, showAll: false };
const control = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2';
const feedbackControl = `${control} max-sm:justify-start max-sm:gap-1.5 max-sm:px-2.5 max-sm:text-xs`;
const selectStyle = 'mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-semibold text-ink dark:border-white/15 dark:bg-slate-800 sm:text-sm';
const trackingComplaintHref = '/feedback?source=live-tracking&category=complaint';

function TrackingStopSelect({ id, label, stops, value, onChange }) {
	return (
		<div className="min-w-0 max-sm:col-start-1">
			<label htmlFor={id} className="block text-xs font-bold text-muted">{label}</label>
			<select id={id} value={value} className={selectStyle} disabled={!stops.length} onChange={(event) => onChange(event.target.value)}>
				<option value="">Choose a city stop</option>
				{stops.map((stop) => (
					<option key={stop.placeId} value={stop.placeId}>{stop.name}</option>
				))}
			</select>
		</div>
	);
}

function TrackingAirport({ label, name }) {
	return (
		<div className="min-w-0 max-sm:col-start-1">
			<span className="block text-xs font-bold text-muted">{label}</span>
			<div className={`${selectStyle} flex items-center gap-2`}>
				<Plane size={17} className="shrink-0 text-brand dark:text-teal-200" aria-hidden="true" />
				<span className="min-w-0 truncate">{name}</span>
			</div>
		</div>
	);
}

class MapBoundary extends Component {
	state = { failed: false };
	static getDerivedStateFromError() { return { failed: true }; }
	render() {
		return this.state.failed
			? <p className="rounded-xl bg-brand-soft p-4 text-sm">The map couldn’t load.</p>
			: this.props.children;
	}
}

const feedMessages = {
	offline: 'You’re offline. We’ll check bus positions when you reconnect.',
	'tracking-error': 'The tracker couldn’t load live bus data. We’ll try again.',
	checking: 'Checking for AeroExpress buses…',
	disabled: 'Live bus tracking is temporarily turned off. Check the timetable for scheduled buses.',
	'feed-unavailable': 'The live bus feed is temporarily unavailable. We’ll keep checking.',
	'feed-delayed': 'The live bus feed is delayed. We’ll keep checking for fresh positions.'
};

function TrackingStatus({ feedState, positionCoverage, stopUpdatesStatus, hasRecentFleetGps, visibleCount, trackingStopPair, boardingAtAirport, destinationName, trackedStop, stopTrackingStatus, fleetVehicle, fleetReport }) {
	const showingLastPosition = Boolean(fleetReport && !fleetReport.recent) ||
		(visibleCount > 0 && ['gps-old', 'gps-missing', 'stop-unconfirmed'].includes(stopTrackingStatus));
	const lastPosition = showingLastPosition ? ' Showing the last known position.' : '';
	if (feedState !== 'ready') return feedMessages[feedState] + lastPosition;
	if (!hasRecentFleetGps) {
		if (positionCoverage === 'complete') return `There are no live bus locations to show right now. We’ll keep checking.${lastPosition}`;
		return `Live feed received, but recent AeroExpress positions couldn’t be verified. We’ll keep checking.${lastPosition}`;
	}
	if (positionCoverage === 'partial' && (!visibleCount || showingLastPosition)) {
		return `Live feed received, but some GPS reports couldn’t be verified. We’ll keep checking.${lastPosition}`;
	}
	if (trackingStopPair && !boardingAtAirport && (!stopTrackingStatus || stopTrackingStatus === 'stop-unconfirmed') &&
		['delayed', 'unavailable'].includes(stopUpdatesStatus)) {
		return `Bus GPS is available, but live stop updates are ${stopUpdatesStatus}. We’ll keep checking.${lastPosition}`;
	}
	if (fleetVehicle) {
		const name = fleetVehicle.vehicleNumber;
		return fleetReport?.recent ? `Showing ${name} on the fleet map` :
			`The latest live feed has no recent GPS report for ${name}.${lastPosition}`;
	}
	if (trackedStop && stopTrackingStatus) {
		const busName = trackedStop.bus.vehicleNumber || trackedStop.bus.serviceNumber || trackedStop.bus.routeCode;
		if (stopTrackingStatus === 'live') return `Tracking bus ${busName} to your boarding stop`;
		if (stopTrackingStatus === 'passed') return `Live stop updates show that bus ${busName} has passed your boarding stop.`;
		if (stopTrackingStatus === 'skipped') return `The live feed reports that bus ${busName} is skipping a stop on your trip.`;
		if (stopTrackingStatus === 'vehicle-changed') return `The live feed now lists a different vehicle for bus ${busName}’s scheduled trip.`;
		if (stopTrackingStatus === 'stop-unconfirmed') return `Live stop progress for bus ${busName} is temporarily unconfirmed.${lastPosition}`;
		if (stopTrackingStatus === 'gps-old') return `The latest GPS report for ${busName} is out of date.${lastPosition}`;
		return `The latest live feed has no recent GPS report for ${busName}.${lastPosition}`;
	}
	if (boardingAtAirport) return visibleCount
		? `${visibleCount} outbound ${visibleCount === 1 ? 'bus' : 'buses'} reported at Vizag Airport`
		: `No departing bus${destinationName ? ` to ${destinationName}` : ''} reported at the terminal yet. We’ll keep checking.`;
	if (trackingStopPair) return visibleCount
		? 'Nearest bus approaching your boarding stop'
		: 'Buses have recent GPS, but none is confirmed to be approaching your stop yet. We’ll keep checking.';
	return visibleCount
		? `${visibleCount} ${visibleCount === 1 ? 'bus' : 'buses'} with recent GPS`
		: 'No recent bus GPS positions are available right now. We’ll keep checking.';
}

const nearbyAirportReasons = {
	arriving: 'Reported on a City → Airport trip. Its next departure is unconfirmed.',
	'different-route': 'This route does not serve your selected stop.',
	'skips-destination': 'The feed reports that this trip skips your selected stop.',
	'passed-terminal': 'This trip has already passed the airport boarding stop.',
	unconfirmed: 'Boarding for this trip is unconfirmed.',
	'outside-terminal': 'GPS shows this bus outside the terminal boarding area.'
};

function NearbyAirportBuses({ buses, now }) {
	return (
		<section aria-labelledby="nearby-airport-buses" className="mb-4 rounded-xl border border-slate-200 p-3 dark:border-white/10 sm:p-4">
			<h3 id="nearby-airport-buses" className="text-sm font-bold text-ink">Other buses near Vizag Airport</h3>
			<p className="mt-1 text-xs leading-relaxed text-muted">The map shows their latest GPS positions.</p>
			<ul className="mt-2 divide-y divide-slate-200 dark:divide-white/10">
				{buses.map((bus) => (
					<li key={bus.id} className="py-2 text-sm">
						<div className="flex flex-wrap items-baseline gap-x-2">
							<strong>{bus.vehicleNumber || `Service ${bus.serviceNumber}`}</strong>
							<span className="text-xs font-semibold text-muted">{bus.routeCode} · GPS updated {gpsAgeLabel(bus.position, now).toLowerCase()}</span>
						</div>
						<p className="mt-0.5 text-xs leading-relaxed text-muted">{nearbyAirportReasons[bus.reason]}</p>
					</li>
				))}
			</ul>
		</section>
	);
}

function RefreshControl({ lastCheckedAt, refreshing, refresh }) {
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);
	const seconds = lastCheckedAt === null ? null : Math.max(0, Math.floor((now - lastCheckedAt) / 1000));
	return (
		<div className="flex items-center gap-2">
			<button type="button" aria-label="Refresh bus locations" title="Refresh bus locations" disabled={refreshing}
				className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-brand/25 text-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 dark:text-teal-200"
				onClick={refresh}>
				<RefreshCw size={17} aria-hidden="true" className={refreshing ? 'motion-safe:animate-spin' : ''} />
			</button>
			<span className="whitespace-nowrap text-xs tabular-nums text-muted">
				{refreshing ? 'Checking…' : seconds === null ? 'No check yet' : `Checked ${seconds}s ago`}
			</span>
		</div>
	);
}

export default function LiveTracking({ service, requestedSelection }) {
	const [selection, setSelection] = useState(initialSelection);
	const [paused, setPaused] = useState(false);
	const [selectedId, setSelectedId] = useState(null);
	const [followId, setFollowId] = useState(null);
	const [trackedStop, setTrackedStop] = useState(null);
	const [fleetVehicle, setFleetVehicle] = useState(null);
	const [liked, setLiked] = useState(false);
	const [focusRequest, setFocusRequest] = useState(0);
	const [refreshKey, setRefreshKey] = useState(0);
	const mapArea = useRef(null);
	const statusArea = useRef(null);
	const { cityPlaceId, direction, plannedRouteCode, scheduledOriginAt, showAll } = selection;
	const airportId = service.airport.id;
	const fromAirport = direction === 'from-airport';
	const boardingAtAirport = fromAirport && !showAll;
	const boardingPlaceId = fromAirport ? airportId : cityPlaceId;
	const destinationPlaceId = fromAirport ? cityPlaceId : airportId;
	const places = useMemo(() => getTrackingStops(service), [service]);
	const cityStops = useMemo(() => places.filter((place) => place.placeId !== airportId), [places, airportId]);
	const cityStop = cityStops.find((stop) => stop.placeId === cityPlaceId);
	const boardingStop = places.find((place) => place.placeId === boardingPlaceId);
	const destinationStop = places.find((place) => place.placeId === destinationPlaceId);
	const routes = useMemo(
		() => getTrackingRoutes(service, { boardingPlaceId, destinationPlaceId, showAll }),
		[service, boardingPlaceId, destinationPlaceId, showAll]
	);
	const activeRouteCodes = useMemo(() => service.routes.filter((route) => route.enabled).map((route) => route.code), [service.routes]);
	const unsupportedStops = !showAll && !boardingAtAirport && routes.length > 0
		? [boardingStop, destinationStop].filter((stop) => stop && !supportsLiveStopUpdates(stop.placeId))
		: [];
	const readyToTrack = routes.length > 0 && unsupportedStops.length === 0;
	const enabled = readyToTrack && !paused;
	const exactDeparture = showAll ? null : scheduledOriginAt;
	const distanceStop = showAll ? null : boardingStop;
	const { snapshot, networkStatus, now, lastCheckedAt, refreshing, refresh } = useLiveBuses(enabled, refreshKey);
	const feedState = getLiveFeedState(snapshot, networkStatus, now);
	const hasRecentFleetGps = feedState === 'ready' && snapshot.buses.some((bus) => gpsAgeMs(bus.position, now) < GPS_RECENT_MS);
	const { buses, matchedId, nearbyBuses, stopTrackingStatus, stopTrackingEndReason, nextBus } = useMemo(
		() => getTrackingView(snapshot, { routes, plannedRouteCode, scheduledOriginAt: exactDeparture, boardingStop: distanceStop, destinationPlaceId, boardingAtAirport, activeRouteCodes, freshOnly: showAll, trackedStop, fleetVehicle }, now, feedState === 'ready'),
		[snapshot, routes, plannedRouteCode, exactDeparture, distanceStop, destinationPlaceId, now, feedState, boardingAtAirport, activeRouteCodes, showAll, trackedStop, fleetVehicle]
	);
	const airportMapBuses = boardingAtAirport && buses.length === 0 ? nearbyBuses : undefined;
	const stopBus = distanceStop && !boardingAtAirport ? buses[0] : null;
	const fleetReport = fleetVehicle ? buses[0] : null;
	const selectedBus = buses.find((bus) => bus.id === selectedId);
	const progressBus = stopBus ?? fleetReport ?? selectedBus ?? (boardingAtAirport && buses.length === 1 ? buses[0] : null);
	const showBusList = buses.length > 0 && ((showAll && !fleetVehicle) || (boardingAtAirport && !progressBus));
	const focusedId = progressBus?.id ?? null;
	const following = Boolean(progressBus?.recent && followId === focusedId);
	const fleetVehicleNumber = fleetVehicle?.vehicleNumber;
	const canOpenBusInFleet = stopTrackingStatus && stopTrackingStatus !== 'live' && trackedStop?.bus.vehicleNumber;
	const stopFollowing = useCallback(() => setFollowId(null), []);
	const selectBus = useCallback((id) => {
		setSelectedId(id);
		setFollowId((current) => current === id ? current : null);
	}, []);
	const stopNames = useMemo(() => new Map([
		[DEFAULT_SERVICE_DATA.airport.id, DEFAULT_SERVICE_DATA.airport.name],
		[service.airport.id, service.airport.name],
		...[...DEFAULT_SERVICE_DATA.routes, ...service.routes].flatMap((route) =>
			route.stops.map((stop) => [stop.placeId || stop.id, stop.name])
		)
	]), [service]);

	useEffect(() => {
		if (fleetVehicleNumber) statusArea.current?.focus({ preventScroll: true });
	}, [fleetVehicleNumber]);

	useEffect(() => {
		if (!fleetReport) return;
		setFleetVehicle((vehicle) => vehicle && vehicle.vehicleNumber === fleetReport.vehicleNumber &&
			Date.parse(fleetReport.position.updatedAt) > Date.parse(vehicle.position.updatedAt) ? fleetReport : vehicle);
	}, [fleetReport]);

	useEffect(() => {
		if (!enabled) return;
		if (stopTrackingEndReason) {
			setTrackedStop((tracked) => tracked && !tracked.endReason ? { ...tracked, endReason: stopTrackingEndReason } : tracked);
		} else if (stopTrackingStatus === 'live' && stopBus) {
			setTrackedStop((tracked) =>
				tracked?.bus.id === stopBus.id && tracked.bus.vehicleNumber === stopBus.vehicleNumber &&
				tracked.bus.position.updatedAt === stopBus.position.updatedAt &&
				tracked.bus.position.lat === stopBus.position.lat && tracked.bus.position.lng === stopBus.position.lng
					? tracked : { bus: stopBus }
			);
		}
	}, [enabled, stopBus, stopTrackingStatus, stopTrackingEndReason]);

	useEffect(() => {
		if (!requestedSelection) return;
		const { stop, direction, routeCode, scheduledOriginAt } = requestedSelection;
		const requestedPlaceId = stop?.placeId || stop?.id || '';
		setSelection({
			...initialSelection,
			cityPlaceId: requestedPlaceId === airportId ? '' : requestedPlaceId,
			direction: direction === 'from-airport' ? 'from-airport' : 'to-airport',
			plannedRouteCode: routeCode,
			scheduledOriginAt
		});
		setSelectedId(null);
		setFollowId(null);
		setTrackedStop(null);
		setFleetVehicle(null);
		setPaused(false);
		setRefreshKey((key) => key + 1);
	}, [requestedSelection, airportId]);

	function selectTrip(nextCityPlaceId, nextDirection) {
		setSelection({ ...initialSelection, cityPlaceId: nextCityPlaceId, direction: nextDirection });
		setSelectedId(null);
		setFollowId(null);
		setTrackedStop(null);
		setFleetVehicle(null);
		setPaused(false);
		if (nextCityPlaceId) recordTrackingStart('stop_pair');
	}

	function toggleShowAll() {
		setSelection({ ...selection, showAll: !showAll });
		setSelectedId(null);
		setFollowId(null);
		setFleetVehicle(null);
		setPaused(false);
		if (!showAll) recordTrackingStart('all_buses');
	}

	function openBusInFleet() {
		setFleetVehicle(trackedStop.bus);
		setSelection({ ...selection, showAll: true });
		setSelectedId(null);
		setFollowId(null);
		setRefreshKey((key) => key + 1);
		recordTrackingStart('stop_vehicle_fleet');
	}

	function showFullFleet() {
		setFleetVehicle(null);
		selectBus(null);
	}

	function recordTrackingStart(source) {
		trackEvent('live_tracking_opened', { link_type: 'reclaim_airport_map', request_source: source });
	}

	return (
		<section id="live-tracking" aria-labelledby="live-tracking-title" className="mx-auto max-w-7xl scroll-mt-20 px-6 pt-28 max-md:px-4 max-md:pt-20">
			<h2 id="live-tracking-title" className="mb-3 text-[clamp(2rem,4vw,3.15rem)] font-bold leading-none tracking-[-.045em]">Track live airport buses</h2>
			<p className="mb-5 text-sm leading-relaxed text-muted">See where AeroExpress buses last reported their location.</p>
			<div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/85 sm:p-6">
				<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end sm:gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]" role="group" aria-label="How to track buses">
					{fromAirport ? (
						<TrackingAirport label="Boarding Stop" name={service.airport.name} />
					) : (
						<TrackingStopSelect id="live-boarding-stop" label="Boarding Stop" stops={cityStops}
							value={cityStop?.placeId || ''} onChange={(value) => selectTrip(value, direction)} />
					)}
					<button type="button" title="Swap boarding and destination" aria-label="Swap boarding and destination"
						className={`${control} size-11 justify-self-center border border-brand/25 bg-brand-soft text-brand max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1 max-sm:self-center dark:text-teal-200`}
						onClick={() => selectTrip(cityStop?.placeId || '', fromAirport ? 'to-airport' : 'from-airport')}>
						<ArrowLeftRight size={18} className="hidden shrink-0 sm:block" aria-hidden="true" />
						<ArrowUpDown size={18} className="shrink-0 sm:hidden" aria-hidden="true" />
					</button>
					{fromAirport ? (
						<TrackingStopSelect id="live-destination-stop" label="Destination Stop" stops={cityStops}
							value={cityStop?.placeId || ''} onChange={(value) => selectTrip(value, direction)} />
					) : (
						<TrackingAirport label="Destination Stop" name={service.airport.name} />
					)}
					<button type="button" disabled={!showAll && !cityStops.length}
						className={`${control} col-span-2 border py-2 disabled:opacity-50 sm:col-span-3 sm:justify-self-end lg:col-span-1 ${showAll ? 'border-brand bg-brand-soft text-ink' : 'border-slate-200 text-ink hover:bg-brand-soft dark:border-white/15'}`}
						onClick={toggleShowAll}>
						{showAll ? (
							<><ArrowLeft size={18} className="shrink-0 text-brand dark:text-teal-200" aria-hidden="true" /> Track buses for your trip</>
						) : (
							<><BusFront size={18} className="shrink-0 text-brand dark:text-teal-200" aria-hidden="true" /> Live track all the buses</>
						)}
					</button>
				</div>
				{showAll && <p className="mt-3 text-xs font-bold text-muted">All buses mode</p>}
				{cityStops.length === 0 && <p className="mt-4 text-sm text-muted">Live tracking is available when an AeroExpress route is active.</p>}
				{cityStops.length > 0 && !showAll && !cityStop && (
					<p className="mt-3 text-xs text-muted">{fromAirport ? 'Choose a city stop to filter airport departures.' : 'Choose a city stop to see buses to Vizag Airport.'}</p>
				)}
				{unsupportedStops.length > 0 && (
					<p role="status" className="mt-4 rounded-xl bg-brand-soft p-3 text-sm text-ink">
						Live stop updates are unavailable for {unsupportedStops.map((stop) => stop.name).join(' and ')}. Check the <a href="#timetables" className="font-semibold underline">timetable</a> for scheduled departures.
					</p>
				)}
				{readyToTrack && !enabled && (
					<button type="button" className={`${control} mt-3 text-brand dark:text-teal-200`} onClick={() => setPaused(false)}>Resume live updates</button>
				)}
				{enabled && (
					<>
						<div className="my-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-soft px-3 py-2 max-sm:flex-col max-sm:items-stretch max-sm:py-2.5">
							<p ref={statusArea} tabIndex={-1} role="status" className="text-sm font-semibold text-ink">
								<TrackingStatus feedState={feedState} positionCoverage={snapshot?.positionCoverage} stopUpdatesStatus={snapshot?.stopUpdatesStatus}
									hasRecentFleetGps={hasRecentFleetGps} visibleCount={buses.length} trackingStopPair={!showAll}
									boardingAtAirport={boardingAtAirport} destinationName={destinationStop?.name}
									trackedStop={trackedStop} stopTrackingStatus={stopTrackingStatus} fleetVehicle={fleetVehicle} fleetReport={fleetReport} />
							</p>
							<div className="flex items-center gap-2 max-sm:justify-between max-sm:gap-1 max-sm:border-t max-sm:border-brand/15 max-sm:pt-2">
								<RefreshControl lastCheckedAt={lastCheckedAt} refreshing={refreshing} refresh={refresh} />
								<button type="button" aria-label="Pause live updates" className={`${control} shrink-0 text-muted hover:bg-brand/10 max-sm:gap-1.5 max-sm:px-2`} onClick={() => {
									stopFollowing();
									setPaused(true);
								}}>
									<Pause size={15} className="sm:hidden" aria-hidden="true" />
									<span>Pause<span className="max-sm:hidden"> live updates</span></span>
								</button>
							</div>
						</div>
						{(canOpenBusInFleet || nextBus || (fleetVehicle && !fleetReport)) && (
							<div className="mb-3 flex flex-wrap gap-2">
								{canOpenBusInFleet && (
									<button type="button" className={`${control} border border-brand/25 bg-brand-soft text-brand hover:underline dark:text-teal-200`} onClick={openBusInFleet}>
										<LocateFixed size={16} aria-hidden="true" /> View {trackedStop.bus.vehicleNumber} in fleet map
									</button>
								)}
								{fleetVehicle && !fleetReport && (
									<button type="button" className={`${control} border border-brand/25 bg-brand-soft text-brand dark:text-teal-200`} onClick={showFullFleet}>Show all buses</button>
								)}
								{nextBus && (
									<button type="button" className={`${control} border border-slate-200 text-ink dark:border-white/15`}
										onClick={() => {
											setFollowId(null);
											setTrackedStop({ bus: nextBus });
											setFocusRequest((request) => request + 1);
											mapArea.current?.focus({ preventScroll: true });
										}}>Track next bus</button>
								)}
							</div>
						)}
						{!showAll && <p className="mb-2 text-xs text-muted">{routes.map(({ routeCode, direction }) => `${routeCode} · ${directions[direction]}`).join(' / ')}</p>}
						{feedState === 'ready' && hasRecentFleetGps && exactDeparture && !matchedId && (
							<p className="mb-3 text-sm text-muted">No GPS match for the {formatTime(exactDeparture)} departure from {boardingAtAirport ? service.airport.name : 'Old Gajuwaka'}.</p>
						)}
						{boardingAtAirport && feedState === 'ready' && matchedId && !buses.some((bus) => bus.id === matchedId) && (
							<p className="mb-3 text-sm text-muted">The {formatTime(exactDeparture)} departure isn’t currently shown for boarding at Vizag Airport.</p>
						)}
						{matchedId && stopBus?.recent && stopBus.id !== matchedId && (
							<p className="mb-3 text-sm text-muted">The bus shown is a different departure from your plan.</p>
						)}
						{!showBusList && matchedId && progressBus?.id === matchedId && (
							<p className="mb-3 text-xs font-bold text-brand dark:text-teal-200">Matches your scheduled departure</p>
						)}
						{airportMapBuses?.length > 0 && (
							<NearbyAirportBuses buses={airportMapBuses} now={now} />
						)}
						{(buses.length > 0 || !showAll) && (
							<div className={`grid items-start gap-3 ${progressBus ? 'lg:min-h-[33rem] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]' : ''}`}>
								<div ref={mapArea} tabIndex={-1} className="min-w-0 scroll-mt-20">
									<MapBoundary>
										<Suspense fallback={<p className="p-4 text-sm text-muted">Loading map…</p>}>
											<LiveBusMap
												key={showAll ? 'all' : `${boardingPlaceId}:${destinationPlaceId}`}
												buses={buses}
												nearbyBuses={airportMapBuses}
												selectedId={focusedId}
												focusRequest={focusRequest}
												onSelect={selectBus}
												onShowAll={showAll ? showFullFleet : boardingAtAirport && buses.length > 1 ? () => selectBus(null) : undefined}
												boardingStop={distanceStop}
												boardingAtAirport={boardingAtAirport}
												destinationStop={showAll ? null : destinationStop}
												places={places}
												stopNames={stopNames}
												following={following}
												onStopFollowing={stopFollowing}
											/>
										</Suspense>
									</MapBoundary>
								</div>
								{progressBus && <BusStopTimeline key={progressBus.id} bus={progressBus} stopNames={stopNames} now={now} following={following}
									onToggleFollow={() => {
										setFollowId(following ? null : progressBus.id);
											if (!following) mapArea.current?.scrollIntoView({ block: 'nearest' });
										}} />}
							</div>
						)}
						{showBusList && !progressBus && (
							<p className="mt-4 text-xs text-muted">Select a bus on the map or choose Locate bus to see its stops.</p>
						)}
						{showBusList && (
							<ul aria-label="Tracked AeroExpress buses" className="mt-4 grid gap-2 lg:grid-cols-2">
								{buses.map((bus) => (
									<li key={bus.id} className={`grid gap-2 rounded-xl border p-3 ${bus.id === focusedId ? 'border-brand bg-brand-soft' : 'border-slate-200 dark:border-white/10'}`}>
										{bus.id === matchedId && <p className="text-xs font-bold text-brand dark:text-teal-200">Matches your scheduled departure</p>}
										<div className="flex flex-wrap items-baseline justify-between gap-x-2">
											<strong className="text-sm">{bus.vehicleNumber || `Service ${bus.serviceNumber}`}</strong>
											<span className="text-xs font-bold text-muted">{bus.routeCode} · {directions[bus.direction]}</span>
										</div>
										<p className="text-xs text-muted">{bus.recent ? 'GPS updated' : 'Last known location'} · {gpsAgeLabel(bus.position, now)}</p>
										<p className="text-xs text-muted">Scheduled from {bus.direction === 'to-airport' ? 'Old Gajuwaka' : 'Vizag Airport'} at {formatTime(bus.scheduledOriginAt)}</p>
										<button type="button" aria-pressed={bus.id === focusedId} className={`${control} justify-self-start text-brand dark:text-teal-200`} onClick={() => {
											selectBus(bus.id);
											setFocusRequest((request) => request + 1);
											mapArea.current?.scrollIntoView({ block: 'nearest' });
											if (!showAll) mapArea.current?.focus({ preventScroll: true });
										}}><LocateFixed size={14} aria-hidden="true" /> Locate bus</button>
									</li>
								))}
							</ul>
						)}
						<p className="mt-4 text-xs leading-relaxed text-muted">{showAll ? 'GPS positions can lag.' : boardingAtAirport ? 'Airport buses are shown by recent GPS. Confirm boarding with the driver or conductor.' : 'Live stop progress is estimated. Some stops have limited live data.'} Check the <a href="#timetables" className="font-semibold underline">timetable</a> for scheduled departures.</p>
					</>
				)}
				<div className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-200 pt-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 dark:border-white/10">
					<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Rate live tracking">
						<button type="button" aria-pressed={liked}
							className={`${feedbackControl} border ${liked ? 'border-brand/40 bg-brand-soft text-brand dark:text-teal-200' : 'border-slate-200 text-ink hover:bg-brand-soft dark:border-white/15'}`}
							onClick={() => {
								if (liked) return;
								setLiked(true);
								trackEvent('live_tracking_rating', { feedback_rating: 'yes' });
							}}>
							<ThumbsUp size={16} className="shrink-0" aria-hidden="true" /> Like
						</button>
						<a href={trackingComplaintHref} aria-label="Dislike and open the complaint form"
							className={`${feedbackControl} border border-slate-200 text-ink hover:bg-brand-soft dark:border-white/15`}
							onClick={() => trackEvent('live_tracking_rating', { feedback_rating: 'no' })}>
							<ThumbsDown size={16} className="shrink-0" aria-hidden="true" /> Dislike
						</a>
					</div>
					<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
						<a href={trackingComplaintHref} aria-label="Report a tracking issue"
							className={`${feedbackControl} border border-slate-200 text-ink hover:bg-brand-soft dark:border-white/15`}>
							<Flag size={16} className="shrink-0" aria-hidden="true" />
							<span className="sm:hidden">Report issue</span>
							<span className="hidden sm:inline">Report a tracking issue</span>
						</a>
						<a href="/feedback?source=live-tracking&category=feedback"
							className={`${feedbackControl} text-brand hover:bg-brand-soft max-sm:border max-sm:border-slate-200 dark:text-teal-200 dark:max-sm:border-white/15`}>
							<MessageSquareText size={16} className="shrink-0" aria-hidden="true" /> Give feedback
						</a>
					</div>
					<p role="status" className="basis-full text-xs text-muted empty:absolute">{liked ? 'Thanks for rating live tracking.' : ''}</p>
				</div>
			</div>
		</section>
	);
}
