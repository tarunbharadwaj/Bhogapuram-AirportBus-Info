import {
	ArrowRight,
	BadgeIndianRupee,
	CalendarDays,
	ChevronDown,
	CircleAlert,
	Clock3,
	MapPin,
	ShieldCheck
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
	getAirportDepartureOptions,
	getAirportDestinations,
	indiaDateTimeParts,
	indiaDateValue,
	indiaIsoFromParts
} from '../../../shared/airportDepartures.mjs';
import { trackEvent } from '../lib/analytics.js';
import { api } from '../lib/api.js';
import AirportDepartureOptions from './AirportDepartureOptions.jsx';
import PlannerDirectionSwitch from './PlannerDirectionSwitch.jsx';

const fieldLabel =
	'mb-2 mt-4 block text-xs font-bold text-slate-600 dark:text-slate-300';

const displayDateValue = (value) => {
	const [year, month, day] = value.split('-');
	return year && month && day ? `${day}-${month}-${year}` : 'DD-MM-YYYY';
};

const readyPartsFrom = (date) => {
	const parts = indiaDateTimeParts(date);
	return {
		date: parts.date,
		hour: String(parts.hour % 12 || 12),
		minute: String(parts.minute).padStart(2, '0'),
		period: parts.hour >= 12 ? 'PM' : 'AM'
	};
};

const nextQuarterHour = () => {
	const quarterHour = 15 * 60_000;
	return new Date(Math.ceil((Date.now() + 1) / quarterHour) * quarterHour);
};

export default function FromAirportPlanner({
	service,
	backendReady,
	onDirectionChange
}) {
	const destinations = useMemo(() => getAirportDestinations(service), [service]);
	const dateInputRef = useRef(null);
	const [destinationPlaceId, setDestinationPlaceId] = useState('');
	const [readyAt, setReadyAt] = useState(() => readyPartsFrom(nextQuarterHour()));
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);

	const updateReadyAt = (part, value) => {
		const next = { ...readyAt, [part]: value };
		try {
			if (new Date(indiaIsoFromParts(next)).getTime() < Date.now() - 60_000) {
				setError('Choose the current time or a future time.');
				return;
			}
			setReadyAt(next);
			setResult(null);
			setError('');
		} catch (nextError) {
			setError(nextError.message);
		}
	};

	const chooseDestination = (value) => {
		setDestinationPlaceId(value);
		setResult(null);
		setError('');
	};

	const openDatePicker = () => {
		const input = dateInputRef.current;
		if (!input) return;
		try {
			if (typeof input.showPicker === 'function') input.showPicker();
			else {
				input.focus();
				input.click();
			}
		} catch {
			input.focus();
			input.click();
		}
	};

	const submit = async (event) => {
		event.preventDefault();
		if (!destinationPlaceId) {
			setError('Choose where you are travelling in the city.');
			return;
		}
		setLoading(true);
		setError('');
		setResult(null);
		try {
			const request = {
				destinationPlaceId,
				readyAt: indiaIsoFromParts(readyAt)
			};
			const localResult = getAirportDepartureOptions(service, request);
			setResult(localResult);
			const firstOption = localResult.options[0];
			trackEvent(
				firstOption
					? 'airport_to_city_plan_generated'
					: 'airport_to_city_plan_unavailable',
				{
					direction: 'from-airport',
					route_code: firstOption?.routeCode || 'none',
					stop_id: firstOption?.stopId || destinationPlaceId,
					option_count: localResult.options.length
				}
			);
			if (backendReady) {
				api('/api/airport-departures', {
					method: 'POST',
					body: JSON.stringify(request)
				})
					.then(setResult)
					.catch(() => {});
			}
			requestAnimationFrame(() =>
				document
					.getElementById('airport-departure-results')
					?.scrollIntoView({ behavior: 'smooth', block: 'center' })
			);
		} catch (submitError) {
			setError(submitError.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<section
			id="planner"
			className="relative mx-auto grid min-h-[39rem] max-w-7xl grid-cols-[.9fr_1fr] items-center gap-18 px-6 py-16 max-lg:grid-cols-1 max-lg:gap-10 max-md:px-4 max-md:py-11"
		>
			<div className="relative z-10 pl-4 max-lg:mx-auto max-lg:max-w-2xl max-lg:pl-0 max-lg:text-center">
				<h1 className="my-4 text-[clamp(2.75rem,5vw,4.7rem)] font-bold leading-[.99] tracking-[-.055em]">
					Find your bus from Vizag Airport,
					<br />
					<em className="not-italic text-brand">right when you need it.</em>
				</h1>
				<p className="max-w-xl text-lg leading-relaxed text-muted max-lg:mx-auto max-md:text-base">
					Tell us where you're going and when you'll be ready at the airport. We'll
					compare every active route and show your next three buses.
				</p>
				<div className="mt-7 flex gap-5 text-xs font-semibold text-slate-600 dark:text-slate-300 max-lg:justify-center max-md:flex-wrap">
					<span className="flex items-center gap-2">
						<ShieldCheck size={17} /> All active routes compared
					</span>
					<span className="flex items-center gap-2">
						<BadgeIndianRupee size={17} /> Fare and arrival estimate included
					</span>
				</div>
			</div>

			<form
				className="adaptive-material relative z-10 rounded-3xl border border-white bg-white/90 p-6 shadow-[0_22px_60px_rgba(20,43,56,.11),0_2px_8px_rgba(20,43,56,.05)] backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/88 dark:shadow-[0_24px_70px_rgba(0,0,0,.35)] max-lg:mx-auto max-lg:w-full max-lg:max-w-xl max-md:p-4"
				onSubmit={submit}
			>
				<PlannerDirectionSwitch
					value="from-airport"
					onChange={onDirectionChange}
				/>
				<div className="mt-6 mb-5 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-xs font-extrabold text-brand">
							1
						</span>
						<h2 className="text-lg font-bold tracking-tight">Plan from Vizag Airport</h2>
					</div>
					<span className="text-[.68rem] font-semibold text-slate-400">
						No login needed
					</span>
				</div>

				<label className={fieldLabel} htmlFor="return-destination">
					Where are you going?
				</label>
				<div className="relative flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-brand/60 focus-within:bg-white focus-within:ring-3 focus-within:ring-brand/10 dark:border-white/10 dark:bg-white/5 dark:focus-within:bg-white/8">
					<MapPin className="shrink-0 text-brand" size={20} />
					<select
						id="return-destination"
						className="w-full appearance-none bg-transparent pr-7 text-sm font-semibold text-ink outline-none"
						value={destinationPlaceId}
						onChange={(event) => chooseDestination(event.target.value)}
						required
					>
						<option value="" disabled>
							Choose your city destination
						</option>
						{destinations.map((destination) => (
							<option key={destination.placeId} value={destination.placeId}>
								{destination.name} · {destination.routeCodes.join(' / ')}
							</option>
						))}
					</select>
					<ChevronDown className="pointer-events-none absolute right-4" size={16} />
				</div>

				<label className={fieldLabel} htmlFor="return-date">
					When will you be ready at the airport bus boarding point?
				</label>
				<div className="grid grid-cols-[.92fr_1.08fr] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition-[border-color,box-shadow,background-color] duration-200 focus-within:border-brand/60 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(11,141,133,.1)] dark:border-white/10 dark:bg-white/5 dark:focus-within:bg-white/8 max-md:grid-cols-1">
					<div className="group relative grid min-h-18 content-center px-4 py-3 transition-colors focus-within:bg-white/70 dark:focus-within:bg-white/5">
						<span className="text-[.62rem] font-bold tracking-wide text-muted">
							Travel date
						</span>
						<button
							type="button"
							className="relative z-10 mt-1 flex min-h-7 items-center gap-2 text-left text-[.95rem] font-bold tracking-[-.01em] text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand/45"
							aria-label={`Choose travel date. Selected date ${displayDateValue(readyAt.date)}`}
							onClick={openDatePicker}
						>
							<CalendarDays size={17} className="shrink-0 text-slate-400" />
							<span>{displayDateValue(readyAt.date)}</span>
						</button>
						<input
							ref={dateInputRef}
							id="return-date"
							className="pointer-events-none absolute inset-0 size-full opacity-0"
							type="date"
							tabIndex={-1}
							aria-label="Airport departure travel date"
							min={indiaDateValue(new Date())}
							value={readyAt.date}
							onChange={(event) => updateReadyAt('date', event.target.value)}
							required
						/>
					</div>
					<fieldset className="grid min-h-18 content-center border-l border-slate-200 px-4 py-3 transition-colors focus-within:bg-white/70 dark:border-white/10 dark:focus-within:bg-white/5 max-md:border-l-0 max-md:border-t">
						<legend className="sr-only">Ready time</legend>
						<span className="text-[.62rem] font-bold tracking-wide text-muted">
							Ready time
						</span>
						<div className="mt-1 flex items-center gap-2">
							<Clock3 size={17} className="shrink-0 text-slate-400" />
							<div className="flex items-baseline font-bold tabular-nums tracking-[-.02em] text-ink">
								<select
									aria-label="Ready time hour"
									className="w-7 appearance-none bg-transparent text-right text-[.95rem] font-bold outline-none"
									value={readyAt.hour}
									onChange={(event) => updateReadyAt('hour', event.target.value)}
								>
									{Array.from({ length: 12 }, (_, index) => String(index + 1)).map(
										(hour) => (
											<option key={hour} value={hour}>
												{hour.padStart(2, '0')}
											</option>
										)
									)}
								</select>
								<span aria-hidden="true" className="px-0.5 text-slate-400">:</span>
								<select
									aria-label="Ready time minute"
									className="w-7 appearance-none bg-transparent text-[.95rem] font-bold outline-none"
									value={readyAt.minute}
									onChange={(event) => updateReadyAt('minute', event.target.value)}
								>
									{Array.from({ length: 60 }, (_, minute) =>
										String(minute).padStart(2, '0')
									).map((minute) => (
										<option key={minute} value={minute}>{minute}</option>
									))}
								</select>
							</div>
							<div className="ml-auto grid grid-cols-2 rounded-lg bg-slate-200/65 p-0.5 dark:bg-black/20">
								{['AM', 'PM'].map((period) => (
									<button
										key={period}
										type="button"
										aria-pressed={readyAt.period === period}
										className={`min-w-10 rounded-md px-2 py-1.5 text-[.65rem] font-extrabold transition-[transform,color,background-color,box-shadow] duration-150 active:scale-[.96] ${readyAt.period === period ? 'bg-white text-brand shadow-sm dark:bg-white/15 dark:text-teal-300' : 'text-muted hover:text-ink'}`}
										onClick={() => updateReadyAt('period', period)}
									>
										{period}
									</button>
								))}
							</div>
						</div>
					</fieldset>
				</div>

				{error && (
					<p className="mt-3 flex items-center gap-2 text-xs text-red-700 dark:text-red-300" role="alert">
						<CircleAlert size={16} /> {error}
					</p>
				)}
				<button
					className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#0b8d85] to-[#08756f] text-sm font-bold text-white shadow-lg shadow-brand/15 transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45"
					disabled={loading || !destinationPlaceId}
				>
					{loading ? 'Comparing airport buses…' : 'Show buses from airport'}
					<ArrowRight size={18} />
				</button>
				<p className="mt-2 text-center text-[.62rem] leading-relaxed text-slate-400">
					Times use India Standard Time. Be ready at the airport boarding point by
					the selected time.
				</p>
			</form>

			{result && <AirportDepartureOptions result={result} />}
		</section>
	);
}
