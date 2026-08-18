import { BusFront, ChevronDown, CircleAlert, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { formatTime } from '../lib/format.js';

export default function Timetable({ service }) {
	const [routeId, setRouteId] = useState('asr-1');
	const [direction, setDirection] = useState('to-airport');
	const route =
		service.routes.find((item) => item.id === routeId) || service.routes[0];
	const [stopId, setStopId] = useState(route.stops[0].id);
	const [data, setData] = useState(null);

	useEffect(() => {
		if (!route.stops.some((stop) => stop.id === stopId))
			setStopId(route.stops[0].id);
	}, [route, stopId]);
	useEffect(() => {
		api(
			`/api/timetable?routeId=${routeId}&stopId=${stopId}&direction=${direction}`
		)
			.then(setData)
			.catch(() => setData(null));
	}, [routeId, stopId, direction]);

	const upcoming =
		data?.services
			.filter((item) => new Date(item.departure).getTime() >= Date.now())
			.slice(0, 5) || [];
	const visible = upcoming.length ? upcoming : data?.services.slice(0, 5) || [];
	const toggle = (active) =>
		`h-10 rounded-lg text-xs font-bold transition ${active ? 'bg-white text-ink shadow-sm dark:bg-white/12' : 'text-muted'}`;

	return (
		<section
			className="mx-auto max-w-7xl scroll-mt-20 px-6 pt-28 max-md:px-4 max-md:pt-20"
			id="timetables"
		>
			<div className="mb-8 flex items-end justify-between gap-8 max-md:block">
				<div>
					<span className="text-xs font-extrabold uppercase tracking-[.12em] text-brand">
						Today’s schedule
					</span>
					<h2 className="mt-3 text-[clamp(2rem,4vw,3.15rem)] font-bold leading-none tracking-[-.045em]">
						Know your next departure.
					</h2>
				</div>
				<p className="max-w-md text-sm leading-relaxed text-muted max-md:mt-4">
					Choose a route and stop to see the next five reference services.
				</p>
			</div>
			<div className="adaptive-material grid min-h-96 grid-cols-[18rem_1fr] overflow-hidden rounded-3xl border border-white bg-white/80 shadow-[0_18px_55px_rgba(22,44,58,.08)] backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/85 dark:shadow-[0_20px_55px_rgba(0,0,0,.28)] max-md:grid-cols-1">
				<div className="border-r border-slate-200 bg-slate-100 p-5 dark:border-white/10 dark:bg-white/4 max-md:border-r-0 max-md:border-b">
					<div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-white/8">
						{service.routes.map((item) => (
							<button
								key={item.id}
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
							className={toggle(direction === 'to-airport')}
							onClick={() => setDirection('to-airport')}
						>
							City → Airport
						</button>
						<button
							className={toggle(direction === 'from-airport')}
							onClick={() => setDirection('from-airport')}
						>
							Airport → City
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
								? `From ${data?.stop.name || route.stops[0].name}`
								: 'From Bhogapuram Airport'}
						</span>
						<span className="text-right">
							{direction === 'to-airport'
								? 'Airport ETA'
								: `Reach ${data?.stop.name || route.stops[0].name}`}
						</span>
					</div>
					{visible.map((item, index) => (
						<div
							key={item.departure}
							className={`grid min-h-14 grid-cols-[2.2rem_auto_auto_1fr_auto] items-center gap-3 border-t border-slate-200 text-sm dark:border-white/10 ${index === 0 && upcoming.length ? 'rounded-xl border border-brand/20 bg-brand-soft px-3' : ''}`}
						>
							<span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
								<BusFront size={17} />
							</span>
							<strong>{formatTime(item.departure)}</strong>
							{index === 0 && upcoming.length && (
								<em className="rounded-full bg-brand px-2 py-1 text-[.55rem] font-extrabold not-italic uppercase tracking-wider text-white">
									Next
								</em>
							)}
							<span className="h-px bg-gradient-to-r from-slate-200 to-transparent dark:from-white/15" />
							<span>{formatTime(item.arrival)}</span>
						</div>
					))}
					<p className="mt-4 flex items-center gap-2 text-[.68rem] text-slate-400">
						<CircleAlert size={14} /> Intermediate times are estimates. Please arrive
						10 minutes early.
					</p>
				</div>
			</div>
		</section>
	);
}
