import {
	ArrowLeft,
	BusFront,
	Check,
	CircleAlert,
	Clock3,
	ExternalLink,
	LocateFixed,
	MapPin,
	Navigation,
	Play,
	Route,
	ShieldCheck,
	Square,
	Timer
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Brand from '../components/Brand.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { trackEvent } from '../lib/analytics.js';
import { formatDuration, formatTime } from '../lib/format.js';
import {
	JOURNEY_SESSION_KEY,
	accuracyLabel,
	createJourney,
	createJourneySession,
	initialJourneyProgress,
	journeyNavigationLink,
	restoreJourneySession,
	updateJourneyProgress
} from '../lib/journeyTracking.js';

const readStoredJourney = () => {
	try {
		return JSON.parse(sessionStorage.getItem(JOURNEY_SESSION_KEY));
	} catch {
		return null;
	}
};

const writeStoredJourney = (session) => {
	try {
		sessionStorage.setItem(JOURNEY_SESSION_KEY, JSON.stringify(session));
	} catch {
		// Journey tracking still works when browser storage is unavailable.
	}
};

const statusCopy = {
	waiting: ['Waiting for location', 'Keep this page open while we find your position.'],
	tracking: ['Journey progress active', 'Your next stop will update as the bus moves.'],
	approaching: ['Approaching the next stop', 'Your phone is close to the next route stop.'],
	weak: ['Location accuracy is weak', 'Keep the phone near a window or enable Precise Location.'],
	stale: ['Location has not updated', 'We paused progress until your phone sends a fresh reading.'],
	'unavailable': ['Location unavailable', 'Automatic progress is paused, but your route remains visible.'],
	'off-route': ['Location temporarily uncertain', 'We will resume progress after detecting the route again.'],
	denied: ['Location access blocked', 'Allow location in browser settings, or continue in Google Maps.'],
	error: ['Location could not be updated', 'Check Location Services and try again.'],
	arrived: ['You are at Vizag Airport', 'Your onboard journey is complete.']
};

const locationReading = (position) => ({
	lat: position.coords.latitude,
	lng: position.coords.longitude,
	accuracy: position.coords.accuracy,
	timestamp: position.timestamp
});

export default function JourneyPage({ service, initialJourney }) {
	const restored = useMemo(
		() => restoreJourneySession(service, readStoredJourney()),
		[service]
	);
	const activeRoutes = useMemo(
		() => service.routes.filter((route) => route.enabled),
		[service]
	);
	const plannedRoute = activeRoutes.find(
		(route) => route.code === initialJourney?.routeCode
	);
	const initialRoute = restored?.journey
		? activeRoutes.find((route) => route.code === restored.journey.routeCode)
		: plannedRoute || activeRoutes[0];
	const plannedStop = initialRoute?.stops.find(
		(stop) => stop.id === initialJourney?.boardingStopId
	);
	const [routeCode, setRouteCode] = useState(initialRoute?.code || '');
	const [boardingStopId, setBoardingStopId] = useState(
		restored?.journey.boardingStopId || plannedStop?.id || initialRoute?.stops[0]?.id || ''
	);
	const [journey, setJourney] = useState(restored?.journey || null);
	const [active, setActive] = useState(Boolean(restored));
	const [progress, setProgress] = useState(() =>
		initialJourneyProgress(restored?.session.confirmedIndex || 0)
	);
	const [reading, setReading] = useState(null);
	const [locationError, setLocationError] = useState('');
	const [planContext, setPlanContext] = useState(
		plannedRoute && plannedStop ? initialJourney : null
	);
	const lastAnalyticsStatus = useRef('');
	const selectedRoute = activeRoutes.find((route) => route.code === routeCode);
	const currentPoint = journey?.points[progress.confirmedIndex];
	const nextPoint = journey?.points[progress.confirmedIndex + 1];
	const remainingStops = journey
		? Math.max(0, journey.points.length - progress.confirmedIndex - 2)
		: 0;
	const navigationUrl = journeyNavigationLink(service.airport);
	const [statusTitle, statusDescription] =
		statusCopy[progress.status] || statusCopy.waiting;

	useEffect(() => {
		if (!active || !journey) return undefined;
		if (!navigator.geolocation) {
			setProgress((current) => ({ ...current, status: 'unavailable' }));
			setLocationError('This browser does not support location tracking.');
			return undefined;
		}

		let watchId = null;
		const onPosition = (position) => {
				const nextReading = locationReading(position);
				setReading(nextReading);
				setLocationError('');
				setProgress((current) => {
					const next = updateJourneyProgress(
						journey,
						current,
						nextReading,
						Date.now()
					);
					if (next.confirmedIndex !== current.confirmedIndex)
						writeStoredJourney(createJourneySession(journey, next.confirmedIndex));
					return next;
				});
			};
		const onPositionError = (error) => {
				const denied = error.code === 1;
				setProgress((current) => ({
					...current,
					status: denied ? 'denied' : 'error'
				}));
				setLocationError(
					denied
						? 'Location permission is blocked for this website.'
						: error.code === 3
							? 'Location took too long to update.'
							: 'Turn on Location Services and return to this page.'
				);
			};
		const stopWatch = () => {
			if (watchId === null) return;
			navigator.geolocation.clearWatch(watchId);
			watchId = null;
		};
		const startWatch = () => {
			if (watchId !== null || document.visibilityState !== 'visible') return;
			watchId = navigator.geolocation.watchPosition(
				onPosition,
				onPositionError,
				{ enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
			);
		};
		const syncVisibility = () => {
			if (document.visibilityState === 'visible') startWatch();
			else stopWatch();
		};

		startWatch();
		document.addEventListener('visibilitychange', syncVisibility);
		return () => {
			document.removeEventListener('visibilitychange', syncVisibility);
			stopWatch();
		};
	}, [active, journey]);

	useEffect(() => {
		if (!active || !reading) return undefined;
		const timer = window.setInterval(() => {
			if (Date.now() - reading.timestamp <= 60_000) return;
			setProgress((current) => ({
				...current,
				pendingIndex: null,
				pendingCount: 0,
				status: 'stale',
				distanceToNextKm: null
			}));
		}, 15_000);
		return () => window.clearInterval(timer);
	}, [active, reading]);

	useEffect(() => {
		if (!active || !journey || lastAnalyticsStatus.current === progress.status)
			return;
		lastAnalyticsStatus.current = progress.status;
		trackEvent('journey_location_status', {
			route_code: journey.routeCode,
			stop_id: journey.boardingStop.placeId || journey.boardingStop.id,
			location_status: progress.status
		});
	}, [active, journey, progress.status]);

	const chooseRoute = (code) => {
		const route = activeRoutes.find((item) => item.code === code);
		setRouteCode(code);
		setBoardingStopId(route?.stops[0]?.id || '');
		setPlanContext(null);
	};

	const startJourney = () => {
		try {
			const nextJourney = createJourney(service, routeCode, boardingStopId);
			const nextProgress = initialJourneyProgress(0);
			setJourney(nextJourney);
			setProgress(nextProgress);
			setReading(null);
			setLocationError('');
			setActive(true);
			lastAnalyticsStatus.current = '';
			writeStoredJourney(createJourneySession(nextJourney));
			trackEvent('journey_companion_started', {
				route_code: nextJourney.routeCode,
				stop_id: nextJourney.boardingStop.placeId || nextJourney.boardingStop.id,
				entry_source: planContext ? 'recommendation' : 'standalone'
			});
		} catch (error) {
			setLocationError(error.message);
		}
	};

	const endJourney = () => {
		if (journey)
			trackEvent('journey_companion_ended', {
				route_code: journey.routeCode,
				stop_id: journey.boardingStop.placeId || journey.boardingStop.id,
				journey_status:
					progress.confirmedIndex === journey.points.length - 1
						? 'arrived'
						: 'ended'
			});
		try {
			sessionStorage.removeItem(JOURNEY_SESSION_KEY);
		} catch {
			// Nothing else is required when storage is unavailable.
		}
		setActive(false);
		setJourney(null);
		setReading(null);
		setProgress(initialJourneyProgress());
		setPlanContext(null);
		lastAnalyticsStatus.current = '';
	};

	return (
		<div className="min-h-screen w-full min-w-0 overflow-x-hidden">
			<header className="adaptive-material sticky top-0 z-40 flex h-17 w-full min-w-0 items-center justify-between border-b border-white bg-[#f3f6f7]/85 px-6 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1116]/85 max-md:px-4">
				<Brand />
				<div className="flex shrink-0 items-center gap-1">
					<a
						href="/"
						className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-muted hover:bg-white dark:hover:bg-white/8"
					>
						<ArrowLeft size={15} /> <span className="max-sm:sr-only">Home</span>
					</a>
					<ThemeToggle />
				</div>
			</header>

			<main className="mx-auto w-full min-w-0 max-w-5xl px-6 py-10 max-md:px-4 max-md:py-6">
				<div className="max-w-3xl">
					<span className="text-xs font-extrabold uppercase tracking-[.12em] text-brand">
						Onboard journey companion
					</span>
					<h1 className="mt-3 break-words text-[clamp(2.2rem,6vw,4rem)] leading-[1.02] font-bold tracking-[-.05em]">
						Follow your bus stops to Vizag Airport.
					</h1>
					<p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
						Your phone estimates stop progress while this page is open. Google Maps
						provides detailed navigation and traffic information.
					</p>
				</div>

				{!active ? (
					<section className="adaptive-material mt-8 min-w-0 overflow-hidden rounded-3xl border border-white bg-white/80 p-6 shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-white/5 max-md:p-4">
						<div className="flex items-center gap-3">
							<span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
								<BusFront size={20} />
							</span>
							<div>
								<h2 className="font-bold">Tell us where you boarded</h2>
								<p className="mt-1 text-xs text-muted">Location is not requested until you start.</p>
							</div>
						</div>
						<div className="mt-6 grid grid-cols-2 gap-4 max-md:grid-cols-1">
							<label className="grid min-w-0 gap-2 text-xs font-bold">
								Bus route
								<select
									className="min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-ink outline-none focus:border-brand dark:border-white/10 dark:bg-white/5"
									value={routeCode}
									onChange={(event) => chooseRoute(event.target.value)}
								>
									{activeRoutes.map((route) => (
										<option key={route.id} value={route.code}>{route.code} · {route.name}</option>
									))}
								</select>
							</label>
							<label className="grid min-w-0 gap-2 text-xs font-bold">
								Boarding stop
								<select
									className="min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-ink outline-none focus:border-brand dark:border-white/10 dark:bg-white/5"
									value={boardingStopId}
									onChange={(event) => {
										setBoardingStopId(event.target.value);
										setPlanContext(null);
									}}
								>
									{selectedRoute?.stops.map((stop) => (
										<option key={stop.id} value={stop.id}>{stop.name}</option>
									))}
								</select>
							</label>
						</div>
						{planContext && (
							<div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-brand-soft p-4 text-xs max-sm:grid-cols-1">
								<div><span className="text-muted">Published airport arrival</span><strong className="mt-1 block text-sm">{formatTime(planContext.airportArrivalTime)}</strong></div>
								<div><span className="text-muted">Your safety deadline</span><strong className="mt-1 block text-sm">Be at the airport by {formatTime(planContext.airportBy)}</strong></div>
							</div>
						)}
						{locationError && <p role="alert" className="mt-4 flex items-start gap-2 text-xs text-red-700 dark:text-red-300"><CircleAlert size={16} />{locationError}</p>}
						<button
							type="button"
							onClick={startJourney}
							disabled={!routeCode || !boardingStopId}
							className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white shadow-lg shadow-brand/15 transition active:scale-[.98] disabled:opacity-50"
						>
							<Play size={17} fill="currentColor" /> Start journey
						</button>
						<p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-center text-[.65rem] leading-relaxed text-muted">
							<ShieldCheck size={14} /> Your coordinates stay on this device and are never saved.
						</p>
					</section>
				) : (
					<>
						<section aria-live="polite" className={`mt-8 rounded-3xl p-6 text-white shadow-xl max-md:p-5 ${progress.status === 'arrived' ? 'bg-[#126247]' : 'bg-[#122c2b]'}`}>
							<div className="flex flex-wrap items-start justify-between gap-4">
								<div>
									<span className="text-[.65rem] font-extrabold uppercase tracking-[.12em] text-teal-200">{journey.routeCode} · City to airport</span>
									<h2 className="mt-2 text-2xl font-bold">{statusTitle}</h2>
									<p className="mt-1 text-xs leading-relaxed text-teal-100/65">{statusDescription}</p>
								</div>
								<span className="rounded-xl bg-white/8 px-3 py-2 text-xs font-bold text-teal-100">Boarded at {journey.boardingStop.name}</span>
							</div>

							<div className="mt-6 grid grid-cols-3 gap-3 max-md:grid-cols-1">
								<div className="rounded-2xl bg-white/7 p-4"><span className="text-[.65rem] text-teal-100/55">Next stop</span><strong className="mt-1 block">{nextPoint?.name || 'Journey complete'}</strong>{progress.distanceToNextKm !== null && nextPoint && <small className="mt-1 block text-teal-100/55">About {progress.distanceToNextKm} km in a straight line</small>}</div>
								<div className="rounded-2xl bg-white/7 p-4"><span className="text-[.65rem] text-teal-100/55">Stops before airport</span><strong className="mt-1 block">{remainingStops}</strong><small className="mt-1 block text-teal-100/55">Current: {currentPoint?.name}</small></div>
								<div className="rounded-2xl bg-white/7 p-4"><span className="text-[.65rem] text-teal-100/55">Published arrival</span><strong className="mt-1 block">{planContext?.airportArrivalTime ? formatTime(planContext.airportArrivalTime) : 'Varies by service'}</strong><small className="mt-1 block text-teal-100/55">~{formatDuration(journey.estimatedJourneyMinutes)} from boarding stop</small></div>
							</div>

							<div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[.68rem] text-teal-100/60">
								<span className="flex items-center gap-1.5"><LocateFixed size={14} /> Accuracy: {accuracyLabel(reading?.accuracy)}</span>
								<span className="flex items-center gap-1.5"><Clock3 size={14} /> Updated: {reading ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(reading.timestamp)) : 'Waiting'}</span>
								{planContext?.airportBy && <span className="flex items-center gap-1.5"><Timer size={14} /> Be at airport by {formatTime(planContext.airportBy)}</span>}
							</div>
							{locationError && <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-300/10 p-3 text-xs text-amber-100"><CircleAlert className="shrink-0" size={16} />{locationError}</p>}

							<div className="mt-5 grid grid-cols-2 gap-3 max-md:grid-cols-1">
								<a
									href={navigationUrl}
									target="_blank"
									rel="noopener noreferrer"
									onClick={() => trackEvent('journey_maps_opened', { route_code: journey.routeCode, stop_id: journey.boardingStop.placeId || journey.boardingStop.id })}
									className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-bold text-slate-800 transition active:scale-[.98]"
								>
									<Navigation size={18} /> Continue in Google Maps <ExternalLink size={14} />
								</a>
								<button type="button" onClick={endJourney} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/8 font-bold text-white transition active:scale-[.98]"><Square size={15} fill="currentColor" /> End journey</button>
							</div>
						</section>

						<section className="adaptive-material mt-5 rounded-3xl border border-white bg-white/80 p-6 dark:border-white/10 dark:bg-white/5 max-md:p-4" aria-labelledby="route-progress-title">
							<div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><Route size={19} /></span><div><h2 id="route-progress-title" className="font-bold">Route progress</h2><p className="mt-1 text-xs text-muted">Stop detection is approximate and is not a live bus-arrival guarantee.</p></div></div>
							<ol className="mt-6">
								{journey.points.map((point, index) => {
									const completed = index <= progress.confirmedIndex;
									const next = index === progress.confirmedIndex + 1;
									return <li key={point.id} className="relative grid min-h-16 grid-cols-[2.5rem_1fr] gap-3 last:min-h-10">
										{index < journey.points.length - 1 && <span className={`absolute top-8 bottom-0 left-[1.18rem] w-0.5 ${index < progress.confirmedIndex ? 'bg-brand' : 'bg-slate-200 dark:bg-white/10'}`} />}
										<span className={`relative z-10 flex size-9 items-center justify-center rounded-full border-2 ${completed ? 'border-brand bg-brand text-white' : next ? 'border-brand bg-brand-soft text-brand' : 'border-slate-200 bg-white text-slate-400 dark:border-white/10 dark:bg-slate-900'}`}>{completed ? <Check size={16} strokeWidth={3} /> : point.isAirport ? <BusFront size={16} /> : <MapPin size={15} />}</span>
										<div className="pt-1"><strong className={next ? 'text-brand' : ''}>{point.name}</strong><p className="mt-0.5 text-[.68rem] text-muted">{completed ? (index === progress.confirmedIndex ? 'Last confirmed point' : 'Passed') : next ? 'Next stop' : point.isAirport ? 'Destination' : point.landmark}</p></div>
									</li>;
								})}
							</ol>
						</section>
					</>
				)}
			</main>
		</div>
	);
}
