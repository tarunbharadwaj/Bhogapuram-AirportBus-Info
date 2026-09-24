import {
	BadgeIndianRupee,
	BusFront,
	Check,
	Clock3,
	ExternalLink,
	MapPin,
	Send
} from 'lucide-react';
import { indiaDateValue } from '../../../shared/airportDepartures.mjs';
import { trackEvent } from '../lib/analytics.js';
import { formatShortDate, formatTime, mapsLink } from '../lib/format.js';
import QuickFeedback from './QuickFeedback.jsx';

export default function AirportDepartureOptions({ result }) {
	if (!result?.options?.length)
		return (
			<div id="airport-departure-results" className="col-span-full grid gap-4">
				<article
					className="rounded-3xl border border-amber-300/25 bg-amber-50 p-6 text-amber-950 dark:bg-amber-300/8 dark:text-amber-100"
					role="status"
				>
					<h2 className="text-lg font-bold">No airport bus is available</h2>
					<p className="mt-1 text-sm opacity-75">
						{result?.warning ||
							'No published departure is available for this destination.'}
					</p>
				</article>
				<QuickFeedback
					key="from_airport_unavailable"
					feedbackContext="from_airport_unavailable"
					resultStatus="unavailable"
					direction="from-airport"
					stopId={result?.destination?.placeId}
				/>
			</div>
		);
	const readyDate = indiaDateValue(result.readyAt);
	const destinationMap = mapsLink(result.destination.lat, result.destination.lng);

	const openMap = (option) => {
		trackEvent('destination_map_opened', {
			direction: 'from-airport',
			route_code: option.routeCode,
			stop_id: option.stopId
		});
	};

	const share = (option) => {
		trackEvent('whatsapp_shared', {
			direction: 'from-airport',
			route_code: option.routeCode,
			stop_id: option.stopId
		});
		const text = `Vizag Airport Bus Details\n\n🚌 Bus Route: ${option.routeCode}\n✈️ Depart Airport At: ${formatTime(option.airportDepartureTime).toUpperCase()}\n📍 Destination: ${option.stopName}\n🕐 Estimated Arrival: ${formatTime(option.destinationArrivalTime).toUpperCase()}\n💰 Estimated Fare: ₹${option.fare}\n🗺️ Drop-off Point Map: ${destinationMap}`;
		window.open(
			`https://wa.me/?text=${encodeURIComponent(text)}`,
			'_blank',
			'noopener,noreferrer'
		);
	};

	return (
		<div id="airport-departure-results" className="col-span-full grid gap-4">
			<article
				className="rounded-3xl bg-[#122c2b] p-7 text-white shadow-[0_20px_50px_rgba(15,46,44,.2)] max-md:p-5"
				aria-labelledby="airport-departure-results-title"
			>
			<div className="flex items-center gap-2 text-[.68rem] font-extrabold uppercase tracking-widest text-teal-200">
				<Check size={14} /> Airport to city
			</div>
			<h2
				className="mt-3 text-2xl font-bold tracking-tight"
				id="airport-departure-results-title"
			>
				Next buses to {result.destination.name}
			</h2>
			<p className="mt-1 text-xs leading-relaxed text-teal-100/60">
				Compared across every active AeroExpress route serving this destination.
			</p>

			<div className="mt-6 grid gap-4">
				{result.options.map((option, index) => {
					const departureDate = indiaDateValue(option.airportDepartureTime);
					const isFollowingDay = departureDate !== readyDate;
					return (
						<section
							key={`${option.routeId}-${option.airportDepartureTime}`}
							className={`rounded-2xl border p-4 ${index === 0 ? 'border-teal-300/35 bg-white/10' : 'border-white/10 bg-white/5'}`}
						>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="flex items-start gap-3">
									<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
										<BusFront size={20} />
									</span>
									<div>
										<div className="flex flex-wrap items-center gap-2">
											<strong className="text-sm">Bus Route: {option.routeCode}</strong>
											{index === 0 && (
												<span className="rounded-full bg-teal-200 px-2 py-1 text-[.55rem] font-extrabold uppercase tracking-wider text-teal-950">
													{isFollowingDay ? 'Next bus · Tomorrow' : 'Next bus'}
												</span>
											)}
										</div>
										<p className="mt-1 text-[.68rem] text-teal-100/55">
											{option.routeName}
										</p>
									</div>
								</div>
								{isFollowingDay && (
									<span className="rounded-lg bg-white/8 px-2.5 py-1.5 text-[.62rem] font-bold text-teal-100/75">
										{formatShortDate(option.airportDepartureTime)}
									</span>
								)}
							</div>

							<div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
								<div>
									<span className="block text-[.62rem] text-teal-100/55">Depart airport</span>
									<strong className="mt-1 block text-base">
										{formatTime(option.airportDepartureTime)}
									</strong>
								</div>
								<span className="h-px w-10 bg-white/15 max-sm:w-5" />
								<div className="text-right">
									<span className="block text-[.62rem] text-teal-100/55">Estimated arrival</span>
									<strong className="mt-1 block text-base">
										{formatTime(option.destinationArrivalTime)}
									</strong>
								</div>
							</div>

							<div className="mt-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
								<div className="flex items-center gap-3 rounded-xl bg-white/6 p-3">
									<BadgeIndianRupee className="text-teal-200" size={18} />
									<span className="grid text-[.62rem] text-teal-100/55">
										Estimated fare
										<strong className="mt-0.5 text-xs text-white">₹{option.fare}</strong>
									</span>
								</div>
								<div className="flex items-center gap-3 rounded-xl bg-white/6 p-3">
									<Clock3 className="text-teal-200" size={18} />
									<span className="grid text-[.62rem] text-teal-100/55">
										Drop-off point
										<strong className="mt-0.5 text-xs text-white">{option.stopName}</strong>
										<span className="mt-0.5 leading-relaxed">{option.landmark}</span>
									</span>
								</div>
							</div>

							<div className="mt-3 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
								<a
									className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white font-bold text-slate-700 transition active:scale-[.98]"
									href={destinationMap}
									target="_blank"
									rel="noreferrer"
									onClick={() => openMap(option)}
								>
									<MapPin size={16} /> Drop-off map <ExternalLink size={13} />
								</a>
								<button
									type="button"
									className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 font-bold text-teal-50 transition active:scale-[.98]"
									onClick={() => share(option)}
								>
									<Send size={16} /> Share on WhatsApp
								</button>
							</div>
						</section>
					);
				})}
			</div>
			<p className="mt-4 text-center text-[.68rem] leading-relaxed text-teal-100/55">
				Airport departures are published times; city arrival times are estimates.
			</p>
			</article>
			<QuickFeedback
				key="from_airport_success"
				feedbackContext="from_airport_success"
				resultStatus="success"
				direction="from-airport"
				routeCode={result.options[0]?.routeCode}
				stopId={result.options[0]?.stopId || result.destination?.placeId}
			/>
		</div>
	);
}
