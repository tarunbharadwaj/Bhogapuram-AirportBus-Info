import { BusFront, ChevronDown, CircleAlert, MapPin } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { indiaDateValue } from '../../../shared/airportDepartures.mjs';
import { trackEvent } from '../lib/analytics.js';
import { formatRoundedTime, formatTime } from '../lib/format.js';
import {
	buildTimetable,
	getVisibleTimetableServices
} from '../lib/timetable.js';

export default function Timetable({ service }) {
	const sectionRef = useRef(null);
	const [sectionVisible, setSectionVisible] = useState(false);
	const activeRoutes = useMemo(
		() => service.routes.filter((item) => item.enabled),
		[service.routes]
	);
	const [routeId, setRouteId] = useState(activeRoutes[0]?.id || '');
	const [direction, setDirection] = useState('to-airport');
	const [viewMode, setViewMode] = useState('upcoming');
	const route =
		activeRoutes.find((item) => item.id === routeId) || activeRoutes[0];
	const [stopId, setStopId] = useState(route?.stops[0]?.id || '');
	const now = new Date();
	const data = useMemo(
		() =>
			route ? buildTimetable(service, routeId, stopId, direction, now) : null,
		[service, routeId, stopId, direction]
	);

	useEffect(() => {
		if (!activeRoutes.some((item) => item.id === routeId))
			setRouteId(activeRoutes[0]?.id || '');
	}, [activeRoutes, routeId]);
	useEffect(() => {
		if (!route) return;
		if (!route.stops.some((stop) => stop.id === stopId))
			setStopId(route.stops[0].id);
	}, [route, stopId]);
	useEffect(() => {
		const section = sectionRef.current;
		if (!section || !('IntersectionObserver' in window)) return;
		const observer = new IntersectionObserver(
			([entry]) => setSectionVisible(entry.isIntersecting),
			{ threshold: 0.25 }
		);
		observer.observe(section);
		return () => observer.disconnect();
	}, []);
	useEffect(() => {
		if (!sectionVisible || !data) return;
		trackEvent('timetable_viewed', {
			route_code: data.route.code,
			stop_id: data.stop.id,
			direction: data.direction,
			schedule_view: viewMode
		});
	}, [data, sectionVisible, viewMode]);

	const changeViewMode = (nextMode) => {
		setViewMode(nextMode);
		trackEvent('timetable_mode_changed', {
			schedule_view: nextMode,
			route_code: data.route.code,
			stop_id: data.stop.id,
			direction: data.direction
		});
	};
	const visible = data ? getVisibleTimetableServices(data, viewMode, now) : [];
	const nextBusIsTomorrow = Boolean(
		visible[0] && indiaDateValue(visible[0].departure) !== indiaDateValue(now)
	);
	const toggle = (active) =>
		`min-h-10 rounded-lg px-2 text-xs font-bold transition active:scale-[.98] ${active ? 'bg-white text-ink shadow-sm dark:bg-white/12' : 'text-muted'}`;
	if (!route || !data)
		return (
			<section
				className="mx-auto max-w-7xl px-6 pt-28 max-md:px-4 max-md:pt-20"
				id="timetables"
			>
				<div className="rounded-3xl border border-white bg-white/70 p-8 text-center text-sm text-muted dark:border-white/10 dark:bg-white/5">
					No active AeroExpress timetable is available right now.
				</div>
			</section>
		);

	return (
		<section
			ref={sectionRef}
			className="mx-auto max-w-7xl scroll-mt-20 px-6 pt-28 max-md:px-4 max-md:pt-20"
			id="timetables"
		>
			<div className="mb-8 flex items-end justify-between gap-8 max-md:block">
				<div>
					<span className="text-xs font-extrabold uppercase tracking-[.12em] text-brand">
						Daily schedule
					</span>
					<h2 className="mt-3 text-[clamp(2rem,4vw,3.15rem)] leading-none font-bold tracking-[-.045em]">
						Know every departure.
					</h2>
				</div>
				<p className="max-w-md text-sm leading-relaxed text-muted max-md:mt-4">
					See the next five buses or switch to the full daily schedule to plan ahead.
				</p>
			</div>
			<div className="adaptive-material grid min-h-96 grid-cols-[18rem_1fr] overflow-hidden rounded-3xl border border-white bg-white/80 shadow-[0_18px_55px_rgba(22,44,58,.08)] backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/85 dark:shadow-[0_20px_55px_rgba(0,0,0,.28)] max-md:grid-cols-1">
				<div className="border-r border-slate-200 bg-slate-100 p-5 dark:border-white/10 dark:bg-white/4 max-md:border-r-0 max-md:border-b">
					<div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-white/8">
						{activeRoutes.map((item) => (
							<button
								key={item.id}
								type="button"
								aria-pressed={routeId === item.id}
								className={toggle(routeId === item.id)}
								onClick={() => setRouteId(item.id)}
							>
								<span
									className="mr-2 inline-block size-2 rounded-full"
									style={{ background: item.color }}
								/>
								{item.code}
							</button>
						))}
					</div>
					<div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-white/8">
						<button
							type="button"
							aria-pressed={direction === 'to-airport'}
							className={toggle(direction === 'to-airport')}
							onClick={() => setDirection('to-airport')}
						>
							City → Airport
						</button>
						<button
							type="button"
							aria-pressed={direction === 'from-airport'}
							className={toggle(direction === 'from-airport')}
							onClick={() => setDirection('from-airport')}
						>
							Airport → City
						</button>
					</div>
					<div
						className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-white/8"
						role="group"
						aria-label="Schedule view"
					>
						<button
							type="button"
							aria-pressed={viewMode === 'upcoming'}
							className={toggle(viewMode === 'upcoming')}
							onClick={() => changeViewMode('upcoming')}
						>
							Upcoming
						</button>
						<button
							type="button"
							aria-pressed={viewMode === 'full-day'}
							className={toggle(viewMode === 'full-day')}
							onClick={() => changeViewMode('full-day')}
						>
							Full daily schedule
						</button>
					</div>
					<label className="mt-6 block text-xs font-bold text-muted">
						{direction === 'to-airport' ? 'Boarding point' : 'Destination'}
						<div className="relative mt-2 flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-white/6">
							<MapPin size={18} className="text-muted" />
							<select
								className="w-full appearance-none bg-transparent pr-6 text-sm font-semibold outline-none"
								value={stopId}
								onChange={(event) => setStopId(event.target.value)}
							>
								{route.stops.map((stop) => (
									<option key={stop.id} value={stop.id}>
										{stop.name}
									</option>
								))}
							</select>
							<ChevronDown
								size={16}
								className="pointer-events-none absolute right-3"
							/>
						</div>
					</label>
				</div>
				<div className="p-6 max-md:p-4">
					<div className="grid grid-cols-2 pb-3 pl-12 text-[.68rem] font-bold text-slate-400">
						<span>
							{direction === 'to-airport'
								? `At ${data.stop.name}`
								: 'From Vizag Airport'}
						</span>
						<span className="text-right">
							{direction === 'to-airport' ? 'Airport ETA' : `Reach ${data.stop.name}`}
						</span>
					</div>
					{visible.map((item, index) => {
						const estimated = item.timeQuality === 'estimated';
						const isNextBus = viewMode === 'upcoming' && index === 0;
						return (
							<div
								key={`${item.departure}-${index}`}
								className={`grid min-h-16 grid-cols-[2.2rem_auto_auto_1fr_auto] items-center gap-3 border-t border-slate-200 text-sm dark:border-white/10 max-sm:grid-cols-[2.2rem_minmax(0,1fr)_auto] ${isNextBus ? 'rounded-xl border border-brand/20 bg-brand-soft px-3 max-sm:py-3' : ''}`}
							>
								<span
									className={`flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand ${isNextBus ? 'max-sm:row-span-2' : ''}`}
								>
									<BusFront size={17} />
								</span>
								<span className="grid min-w-0 gap-0.5">
									<strong className="whitespace-nowrap">
										{estimated ? '~' : ''}
										{estimated
											? formatRoundedTime(item.departure)
											: formatTime(item.departure)}
									</strong>
									{estimated && (
										<small className="text-[.58rem] text-slate-400">
											Origin {formatTime(item.routeOriginDeparture)}
										</small>
									)}
								</span>
								{isNextBus && (
									<em className="whitespace-nowrap rounded-full bg-brand px-2 py-1 text-[.55rem] font-extrabold not-italic uppercase tracking-wider text-white max-sm:col-span-2 max-sm:col-start-2 max-sm:row-start-2 max-sm:justify-self-start">
										{nextBusIsTomorrow ? 'Next bus · Tomorrow' : 'Next bus'}
									</em>
								)}
								<span className="h-px bg-gradient-to-r from-slate-200 to-transparent dark:from-white/15 max-sm:hidden" />
								<span className="whitespace-nowrap text-right max-sm:col-start-3 max-sm:row-start-1">
									{formatTime(item.arrival)}
								</span>
							</div>
						);
					})}
					<p className="mt-4 flex items-start gap-2 text-[.68rem] leading-relaxed text-slate-400">
						<CircleAlert size={14} className="mt-0.5 shrink-0" />
						<span>
							Route-origin departures are published; times prefixed with ~ are
							estimates rounded to five minutes. Arrive 10-15 minutes early. Schedules
							repeat daily and are subject to change.
						</span>
					</p>
				</div>
			</div>
		</section>
	);
}
