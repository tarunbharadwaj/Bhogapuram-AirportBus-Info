import {
	ArrowRight,
	BadgeIndianRupee,
	Check,
	CircleAlert,
	Clock3,
	LocateFixed,
	LockKeyhole,
	MapPin,
	Settings2,
	ShieldCheck,
	Sparkles
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { findNearestBoardingPoint } from '../lib/nearestStop.js';
import { recommendTrip } from '../lib/recommendTrip.js';
import Recommendation from './Recommendation.jsx';

const inputShell =
	'relative flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500 transition focus-within:border-brand/60 focus-within:bg-white focus-within:ring-3 focus-within:ring-brand/10 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:focus-within:bg-white/8';
const fieldLabel =
	'mb-2 mt-4 block text-xs font-bold text-slate-600 dark:text-slate-300';

const localDateValue = (date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const departurePartsFrom = (date) => ({
	date: localDateValue(date),
	hour: String(date.getHours() % 12 || 12),
	minute: String(date.getMinutes()).padStart(2, '0'),
	period: date.getHours() >= 12 ? 'PM' : 'AM'
});

const departureDateFrom = ({ date, hour, minute, period }) => {
	const hour24 = (Number(hour) % 12) + (period === 'PM' ? 12 : 0);
	const departure = new Date(`${date}T00:00:00`);
	departure.setHours(hour24, Number(minute), 0, 0);
	return departure;
};

const currentMinute = () => {
	const now = new Date();
	now.setSeconds(0, 0);
	return now;
};

export default function Planner({ service, backendReady }) {
	const autoLocateAttempted = useRef(false);
	const [coordinates, setCoordinates] = useState(null);
	const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
	const [flightType, setFlightType] = useState('domestic');
	const [locating, setLocating] = useState(false);
	const [nearestMessage, setNearestMessage] = useState('');
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState(null);
	const [error, setError] = useState('');
	const [flightDeparture, setFlightDeparture] = useState(() => {
		const date = new Date(Date.now() + 30 * 60 * 60 * 1000);
		date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
		return departurePartsFrom(date);
	});

	const changeDeparture = (part, value) => {
		let next = { ...flightDeparture, [part]: value };
		if (part === 'date' && value === localDateValue(new Date())) {
			const selectedTime = departureDateFrom(next);
			if (selectedTime < currentMinute()) {
				const soonest = new Date(Date.now() + 60_000);
				soonest.setSeconds(0, 0);
				next = departurePartsFrom(soonest);
			}
		}

		if (departureDateFrom(next) < currentMinute()) {
			setError('Choose the current time or a future flight time.');
			return;
		}

		setFlightDeparture(next);
		setError('');
	};

	const locate = useCallback(async () => {
		if (!navigator.geolocation)
			return setError('Location detection is not supported in this browser.');
		setLocating(true);
		setError('');

		if (navigator.permissions?.query) {
			try {
				const permission = await navigator.permissions.query({ name: 'geolocation' });
				if (permission.state === 'denied') {
					setLocationPermissionDenied(true);
					setLocating(false);
					return;
				}
			} catch {
				// Some mobile browsers expose geolocation without supporting this query.
			}
		}

		navigator.geolocation.getCurrentPosition(
			({ coords }) => {
				try {
					const point = { lat: coords.latitude, lng: coords.longitude };
					const nearest = findNearestBoardingPoint(service, point);
					setCoordinates(point);
					setLocationPermissionDenied(false);
					const accuracyNote =
						coords.accuracy > 1000
							? ' Your phone shared an approximate location; enable Precise Location for a better match.'
							: '';
					setNearestMessage(
						`${nearest.stop.name} is ${nearest.distanceKm} km away on ${nearest.routeCode}.${accuracyNote}`
					);
				} catch (err) {
					setError(err.message);
				} finally {
					setLocating(false);
				}
			},
			(locationError) => {
				if (locationError.code === 1) {
					setLocationPermissionDenied(true);
					setError('');
					setLocating(false);
					return;
				}
				const messages = {
					2: 'Turn on Location Services on your phone, then try again.',
					3: 'Location took too long. Turn on Location Services and try again.'
				};
				setError(
					messages[locationError.code] ||
						'We could not access your location. Try again.'
				);
				setLocating(false);
			},
			{ enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
		);
	}, [service]);

	useEffect(() => {
		if (
			autoLocateAttempted.current ||
			!navigator.geolocation ||
			!navigator.permissions?.query
		)
			return;

		let cancelled = false;
		let permissionStatus;
		const syncPermission = () => {
			if (cancelled || !permissionStatus) return;
			if (permissionStatus.state === 'denied') {
				autoLocateAttempted.current = false;
				setLocationPermissionDenied(true);
				return;
			}
			setLocationPermissionDenied(false);
			if (
				permissionStatus.state === 'granted' &&
				!autoLocateAttempted.current
			) {
				autoLocateAttempted.current = true;
				locate();
			}
		};
		navigator.permissions
			.query({ name: 'geolocation' })
			.then((permission) => {
				permissionStatus = permission;
				syncPermission();
				permissionStatus.addEventListener?.('change', syncPermission);
			})
			.catch(() => {});

		return () => {
			cancelled = true;
			permissionStatus?.removeEventListener?.('change', syncPermission);
		};
	}, [locate]);

	const submit = async (event) => {
		event.preventDefault();
		if (!coordinates) {
			setError('Use your location before finding an airport bus.');
			return;
		}
		const selectedDeparture = departureDateFrom(flightDeparture);
		if (selectedDeparture < currentMinute()) {
			setError('Choose the current time or a future flight time.');
			return;
		}
		setLoading(true);
		setError('');
		setResult(null);
		try {
			const request = {
				coordinates,
				flightTime: selectedDeparture.toISOString(),
				flightType
			};
			const recommendation = recommendTrip(service, request);
			setResult(recommendation);
			if (backendReady) {
				api('/api/recommendations', {
					method: 'POST',
					body: JSON.stringify(request)
				})
					.then(setResult)
					.catch(() => {});
			}
			requestAnimationFrame(() =>
				document
					.getElementById('recommendation')
					?.scrollIntoView({ behavior: 'smooth', block: 'center' })
			);
		} catch (err) {
			setError(err.message);
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
				{/* <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.12em] text-brand">
					<Sparkles size={15} /> Flight-aware bus planning
				</span> */}
				<h1 className="my-4 text-[clamp(2.75rem,5vw,4.7rem)] font-bold leading-[.99] tracking-[-.055em]">
					Get to Bhogapuram Airport on time,
					<br />
					<em className="not-italic text-brand">every time.</em>
				</h1>
				<p className="max-w-xl text-lg leading-relaxed text-muted max-lg:mx-auto max-md:text-base">
					{/* Tell us where you are and when you fly. We’ll find the closest stop and
					work backwards to the safest AeroExpress. */}
					Tell us where you're starting from and when your flight departs. We'll find
					the nearest Aero Express stop and recommend the safest bus to get you to
					Bhogapuram Airport on time.
				</p>
				<div className="mt-7 flex gap-5 text-xs font-semibold text-slate-600 dark:text-slate-300 max-lg:justify-center max-md:flex-wrap">
					<span className="flex items-center gap-2">
						<ShieldCheck size={17} /> Safety buffer included
					</span>
					<span className="flex items-center gap-2">
						<BadgeIndianRupee size={17} /> Estimated Fare before you leave
					</span>
				</div>
			</div>

			<form
				className="adaptive-material relative z-10 rounded-3xl border border-white bg-white/90 p-6 shadow-[0_22px_60px_rgba(20,43,56,.11),0_2px_8px_rgba(20,43,56,.05)] backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/88 dark:shadow-[0_24px_70px_rgba(0,0,0,.35)] max-lg:mx-auto max-lg:w-full max-lg:max-w-xl max-md:p-4"
				onSubmit={submit}
			>
				<div className="mb-6 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-xs font-extrabold text-brand">
							1
						</span>
						<h2 className="text-lg font-bold tracking-tight">Plan to Bhogapuram</h2>
					</div>
					<span className="text-[.68rem] font-semibold text-slate-400">
						No login needed
					</span>
				</div>
				<label className={fieldLabel}>Where are you starting from?</label>
				<button
					type="button"
					className={`flex min-h-18 w-full items-center gap-4 rounded-2xl border px-4 text-left transition-[transform,background-color,border-color] active:scale-[.99] disabled:cursor-wait ${coordinates ? 'border-brand/30 bg-brand-soft' : 'border-slate-200 bg-slate-50 hover:border-brand/30 hover:bg-brand-soft dark:border-white/10 dark:bg-white/5'}`}
					onClick={locate}
					disabled={locating}
				>
					<span
						className={`relative flex size-11 shrink-0 items-center justify-center rounded-xl ${coordinates ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'bg-brand-soft text-brand'}`}
					>
						{coordinates ? (
							<MapPin size={22} fill="currentColor" />
						) : (
							<LocateFixed size={21} />
						)}
						{coordinates && (
							<span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-2 border-brand-soft bg-white text-brand dark:bg-slate-900">
								<Check size={11} strokeWidth={3} />
							</span>
						)}
					</span>
					<span className="grid flex-1 gap-1">
						<strong className="text-sm">
							{locating
								? 'Capturing your location…'
								: coordinates
									? 'Location captured'
									: locationPermissionDenied
										? 'Location access blocked'
										: 'Use my location'}
						</strong>
						<small className="text-[.68rem] leading-relaxed text-muted">
							{locating
								? 'Waiting for browser permission'
								: coordinates
									? nearestMessage
									: locationPermissionDenied
										? 'Allow location in your browser settings, then try again'
										: 'Turn on phone location and allow access to find your nearest Aero Express stop'}
						</small>
					</span>
					{coordinates && !locating && (
						<span className="rounded-full bg-white/70 px-3 py-1 text-[.62rem] font-bold text-brand dark:bg-white/10">
							Update
						</span>
					)}
				</button>
				{locationPermissionDenied && !coordinates && (
					<div
						className="mt-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-left text-amber-950 dark:border-amber-300/15 dark:bg-amber-300/8 dark:text-amber-100"
						role="alert"
					>
						<div className="flex items-start gap-3">
							<span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-200/60 text-amber-800 dark:bg-amber-200/10 dark:text-amber-200">
								<Settings2 size={18} aria-hidden="true" />
							</span>
							<div>
								<strong className="text-sm">Allow location for this website</strong>
								<ol className="mt-2 list-decimal space-y-1 pl-4 text-[.7rem] leading-relaxed text-amber-900/75 dark:text-amber-100/70">
									<li>Tap the site-controls icon beside your browser address bar.</li>
									<li>Open Permissions or Website Settings, then set Location to Allow.</li>
									<li>Make sure Location Services are turned on for your phone.</li>
								</ol>
							</div>
						</div>
						<button
							type="button"
							className="mt-3 flex min-h-10 w-full items-center justify-center rounded-xl bg-amber-900 px-4 text-xs font-bold text-white transition active:scale-[.98] dark:bg-amber-200 dark:text-amber-950"
							onClick={locate}
							disabled={locating}
						>
							{locating ? 'Checking permission…' : 'I allowed it — try again'}
						</button>
					</div>
				)}
				<label className={fieldLabel} htmlFor="flight-date">
					When does your flight depart?
				</label>
				<div className="grid grid-cols-[.92fr_1.08fr] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition-[border-color,box-shadow,background-color] duration-200 focus-within:border-brand/60 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(11,141,133,.1)] dark:border-white/10 dark:bg-white/5 dark:focus-within:bg-white/8 max-md:grid-cols-1">
					<label
						className="group grid min-h-18 content-center px-4 py-3 transition-colors focus-within:bg-white/70 dark:focus-within:bg-white/5"
						htmlFor="flight-date"
					>
						<span className="text-[.62rem] font-bold tracking-wide text-muted">
							Travel date
						</span>
						<input
							id="flight-date"
							className="mt-1 w-full bg-transparent text-[.95rem] font-bold tracking-[-.01em] text-ink outline-none"
							type="date"
							min={localDateValue(new Date())}
							value={flightDeparture.date}
							onChange={(event) => changeDeparture('date', event.target.value)}
							required
						/>
					</label>
					<fieldset className="grid min-h-18 content-center border-l border-slate-200 px-4 py-3 transition-colors focus-within:bg-white/70 dark:border-white/10 dark:focus-within:bg-white/5 max-md:border-l-0 max-md:border-t">
						<legend className="sr-only">Departure time</legend>
						<span className="text-[.62rem] font-bold tracking-wide text-muted">
							Departure time
						</span>
						<div className="mt-1 flex items-center gap-2">
							<Clock3
								size={17}
								className="shrink-0 text-slate-400"
								aria-hidden="true"
							/>
							<div className="flex items-baseline font-bold tabular-nums tracking-[-.02em] text-ink">
								<select
									aria-label="Flight departure hour"
									className="w-7 appearance-none bg-transparent text-right text-[.95rem] font-bold outline-none"
									value={flightDeparture.hour}
									onChange={(event) => changeDeparture('hour', event.target.value)}
								>
									{Array.from({ length: 12 }, (_, index) => String(index + 1)).map(
										(hour) => (
											<option key={hour} value={hour}>
												{hour.padStart(2, '0')}
											</option>
										)
									)}
								</select>
								<span aria-hidden="true" className="px-0.5 text-slate-400">
									:
								</span>
								<select
									aria-label="Flight departure minute"
									className="w-7 appearance-none bg-transparent text-[.95rem] font-bold outline-none"
									value={flightDeparture.minute}
									onChange={(event) => changeDeparture('minute', event.target.value)}
								>
									{Array.from({ length: 60 }, (_, minute) =>
										String(minute).padStart(2, '0')
									).map((minute) => (
										<option key={minute} value={minute}>
											{minute}
										</option>
									))}
								</select>
							</div>
							<div className="ml-auto grid grid-cols-2 rounded-lg bg-slate-200/65 p-0.5 dark:bg-black/20">
								{['AM', 'PM'].map((period) => (
									<button
										key={period}
										type="button"
										aria-pressed={flightDeparture.period === period}
										className={`min-w-10 rounded-md px-2 py-1.5 text-[.65rem] font-extrabold transition-[transform,color,background-color,box-shadow] duration-150 active:scale-[.96] ${flightDeparture.period === period ? 'bg-white text-brand shadow-sm dark:bg-white/15 dark:text-teal-300' : 'text-muted hover:text-ink'}`}
										onClick={() => changeDeparture('period', period)}
									>
										{period}
									</button>
								))}
							</div>
						</div>
					</fieldset>
				</div>
				<fieldset>
					<legend className={fieldLabel}>Flight type</legend>
					<div className="grid h-11 grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/8">
						{['domestic', 'international'].map((type) => (
							<button
								key={type}
								type="button"
								className={`rounded-lg text-xs font-bold capitalize transition ${flightType === type ? 'bg-white text-ink shadow-sm dark:bg-white/12' : 'text-muted'}`}
								onClick={() => setFlightType(type)}
							>
								{type}
							</button>
						))}
					</div>
				</fieldset>
				{error && (
					<p
						className="mt-3 flex items-center gap-2 text-xs text-red-700"
						role="alert"
					>
						<CircleAlert size={16} /> {error}
					</p>
				)}
				<button
					className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#0b8d85] to-[#08756f] text-sm font-bold text-white shadow-lg shadow-brand/15 transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45"
					disabled={loading || !coordinates}
				>
					{loading ? 'Finding your bus…' : 'Find my airport bus'}{' '}
					<ArrowRight size={18} />
				</button>
				<p className="mt-2 flex items-center justify-center gap-1 text-[.62rem] text-slate-400">
					<LockKeyhole size={12} /> Your location stays in this planning session.
				</p>
			</form>
			{result && <Recommendation result={result} />}
		</section>
	);
}
