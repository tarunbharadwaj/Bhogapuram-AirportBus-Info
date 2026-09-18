import {
	BadgeIndianRupee,
	Check,
	CircleAlert,
	Clock3,
	Luggage,
	MapPin,
	Navigation,
	Send
} from 'lucide-react';
import { trackEvent } from '../lib/analytics.js';
import {
	directionsLink,
	formatDuration,
	formatRoundedTime,
	formatTime,
	mapsLink,
	airportNavigationLink
} from '../lib/format.js';

export default function Recommendation({ result, directionsOrigin }) {
	if (!result.best)
		return (
			<article
				id="recommendation"
				className="col-span-full flex gap-4 rounded-3xl bg-[#463026] p-6 text-white shadow-xl motion-safe:animate-[pulse_.35s_ease-out_1]"
			>
				<CircleAlert size={26} />
				<div>
					<span className="text-xs font-extrabold uppercase tracking-widest text-amber-200">
						No safe bus found
					</span>
					<h2 className="mt-1 text-xl font-bold">
						Consider an earlier day or another ride.
					</h2>
					<p className="mt-1 text-sm text-amber-100/80">{result.warning}</p>
				</div>
			</article>
		);

	const isEstimatedStopTime = result.best.stopTimeQuality === 'estimated';
	const displayedStopTime = isEstimatedStopTime
		? `~${formatRoundedTime(result.best.departureTime)}`
		: formatTime(result.best.departureTime);
	const manualSelection = result.boardingSelection?.mode === 'manual-stop';
	const stopDirections = directionsLink({
		destination: result.nearestStop,
		origin: directionsOrigin || undefined
	});
	const airportNavigation = airportNavigationLink();

	const share = () => {
		trackEvent('whatsapp_shared', {
			route_code: result.best.routeCode,
			stop_id: result.best.stopId
		});
		const boardingPointMap = mapsLink(
			result.nearestStop.lat,
			result.nearestStop.lng
		);
		const timeLabel = isEstimatedStopTime
			? 'Estimated Bus Arrival'
			: 'Published Departure';
		const text = `Vizag Airport Bus Details\n\n🚌 Bus Number: ${result.best.routeCode}\n📍 Boarding Point: ${result.best.stopName}\n🕐 ${timeLabel}: ${displayedStopTime.toUpperCase()}\n⏰ Be At Stop By: ${formatRoundedTime(result.best.arriveAtStopBy, 'floor').toUpperCase()}\n💰 Estimated Fare: ₹${result.best.fare}\n🗺️ Boarding Point Map: ${boardingPointMap}`;
		window.open(
			`https://wa.me/?text=${encodeURIComponent(text)}`,
			'_blank',
			'noopener,noreferrer'
		);
	};

	const milestones = [
		[
			`Published departure from ${result.best.routeOriginName}`,
			formatTime(result.best.routeOriginDepartureTime)
		],
		[
			isEstimatedStopTime
				? 'Estimated bus arrival at your stop'
				: 'Published departure at your stop',
			displayedStopTime
		],
		['Airport ETA', formatTime(result.best.airportArrivalTime)]
	];
	const details = [
		[BadgeIndianRupee, 'Estimated fare', `₹${result.best.fare}`],
		[
			MapPin,
			manualSelection ? 'Selected bus stop' : 'Nearest bus stop',
			result.nearestStop.name
		],
		[Clock3, 'Be at airport by', formatTime(result.airportBy)],
		[Luggage, 'Flight buffer', formatDuration(result.terminalBuffer)]
	];

	return (
		<article
			id="recommendation"
			className="col-span-full rounded-3xl bg-[#122c2b] p-7 text-white shadow-[0_20px_50px_rgba(15,46,44,.2)] max-md:p-5"
		>
			<div className="flex items-center text-[.68rem] text-teal-100/65">
				<span className="flex items-center gap-1 font-extrabold uppercase tracking-widest text-teal-200">
					<Check size={14} /> Best option
				</span>
			</div>
			<div className="mt-5 flex items-start gap-4">
				<span className="rounded-lg bg-brand px-3 py-2 text-xs font-extrabold tracking-wide">
					Bus Route: {result.best.routeCode}
				</span>
				<div>
					<h2 className="text-xl font-bold tracking-tight">
						{manualSelection ? 'Selected Boarding Stop' : 'Nearest Bus Stop'} is{' '}
						{result.best.stopName}
					</h2>
					<p className="mt-1 text-xs text-teal-100/60">
						{manualSelection
							? result.best.landmark
							: `You are currently ${result.nearestStop.distanceKm} km away from ${result.best.landmark}`}
					</p>
				</div>
			</div>

			<div className="my-6 grid grid-cols-3 items-stretch gap-3 max-md:grid-cols-1">
				{milestones.map(([label, value], index) => (
					<div
						key={label}
						className={`rounded-2xl bg-white/6 p-4 ${index === 1 ? 'ring-1 ring-teal-300/20' : ''}`}
					>
						<span className="block text-[.64rem] text-teal-100/55">{label}</span>
						<strong className="mt-1 block text-base">{value}</strong>
						{index === 1 && (
							<small className="mt-1 block text-[.62rem] text-teal-100/55">
								Be at the stop by{' '}
								{formatRoundedTime(result.best.arriveAtStopBy, 'floor')}
							</small>
						)}
					</div>
				))}
			</div>

			{isEstimatedStopTime && (
				<p className="mb-4 flex items-start gap-2 rounded-xl bg-white/6 p-3 text-xs leading-relaxed text-teal-100/70">
					<CircleAlert className="mt-0.5 shrink-0" size={15} /> Intermediate stop
					times are calculated estimates, not live arrivals. Arrive 10-15 minutes
					early and use APSRTC Live Track when available.
				</p>
			)}

			<div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
				{details.map(([Icon, label, value]) => (
					<div
						key={label}
						className="flex items-center gap-3 rounded-2xl bg-white/6 p-4 text-teal-200"
					>
						<Icon size={18} />
						<span className="grid text-[.64rem] text-teal-100/55">
							{label}
							<strong className="mt-1 text-xs text-white">{value}</strong>
						</span>
					</div>
				))}
			</div>

			{result.next && !result.isNextSafe && (
				<p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">
					<CircleAlert size={16} /> The {formatTime(result.next.departureTime)} bus
					may miss your safety window.
				</p>
			)}
			{result.outsideServiceArea && (
				<p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
					<CircleAlert className="mt-0.5 shrink-0" size={16} /> Travel time to{' '}
					{result.nearestStop.name} is not included. Reach the stop before{' '}
					{formatRoundedTime(result.best.arriveAtStopBy, 'floor')}.
				</p>
			)}

			<div className="mt-4 grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
				<a
					className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-bold text-slate-700 transition active:scale-[.98]"
					href={stopDirections}
					target="_blank"
					rel="noreferrer"
					onClick={() =>
						trackEvent('maps_directions_opened', {
							input_mode: result.boardingSelection?.mode || 'location',
							route_code: result.best.routeCode,
							stop_id: result.best.stopId
						})
					}
				>
					<Navigation size={17} /> Directions to this stop
				</a>
				<button
					className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 font-bold text-teal-50 transition active:scale-[.98]"
					onClick={share}
				>
					<Send size={17} /> Share on WhatsApp
				</button>
				<a
					href={airportNavigation}
					target="_blank"
					rel="noopener noreferrer"
					className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-teal-300/30 bg-teal-300/10 font-bold text-teal-50 transition active:scale-[.98] max-lg:col-span-2 max-md:col-span-1"
					onClick={() =>
						trackEvent('journey_maps_opened', {
							route_code: result.best.routeCode,
							stop_id: result.best.stopId
						})
					}
				>
					<Navigation size={17} /> Start journey to airport
				</a>
			</div>
			{result.earlier && (
				<p className="mt-3 text-center text-[.68rem] text-teal-100/55">
					Want more margin? The previous bus reaches this stop at{' '}
					<strong>
						{result.earlier.stopTimeQuality === 'estimated'
							? `~${formatRoundedTime(result.earlier.departureTime)}`
							: formatTime(result.earlier.departureTime)}
					</strong>
					.
				</p>
			)}
		</article>
	);
}
