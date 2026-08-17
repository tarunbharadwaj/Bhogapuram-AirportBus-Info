import {
	ArrowRight,
	BadgeIndianRupee,
	Check,
	CircleAlert,
	ChevronDown,
	LocateFixed,
	LockKeyhole,
	MapPin,
	Plane,
	ShieldCheck,
	Sparkles
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api.js';
import Recommendation from './Recommendation.jsx';

const inputShell =
	'relative flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500 transition focus-within:border-brand/60 focus-within:bg-white focus-within:ring-3 focus-within:ring-brand/10 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:focus-within:bg-white/8';
const fieldLabel =
	'mb-2 mt-4 block text-xs font-bold text-slate-600 dark:text-slate-300';

export default function Planner({ service }) {
	const [locationId, setLocationId] = useState('mvp-colony');
	const [coordinates, setCoordinates] = useState(null);
	const [flightType, setFlightType] = useState('domestic');
	const [extraBuffer, setExtraBuffer] = useState(30);
	const [locating, setLocating] = useState(false);
	const [nearestMessage, setNearestMessage] = useState('');
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState(null);
	const [error, setError] = useState('');
	const [flightTime, setFlightTime] = useState(() => {
		const date = new Date(Date.now() + 30 * 60 * 60 * 1000);
		date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
	});

	const locate = () => {
		if (!navigator.geolocation)
			return setError('Location detection is not supported in this browser.');
		setLocating(true);
		setError('');
		navigator.geolocation.getCurrentPosition(
			async ({ coords }) => {
				try {
					const point = { lat: coords.latitude, lng: coords.longitude };
					const nearest = await api(
						`/api/nearest?lat=${point.lat}&lng=${point.lng}`
					);
					setCoordinates(point);
					setNearestMessage(
						`${nearest.stop.name} is ${nearest.distanceKm} km away on ${nearest.routeCode}.`
					);
				} catch (err) {
					setError(err.message);
				} finally {
					setLocating(false);
				}
			},
			() => {
				setError('We could not access your location. Choose an area instead.');
				setLocating(false);
			},
			{ enableHighAccuracy: true, timeout: 10_000 }
		);
	};

	const submit = async (event) => {
		event.preventDefault();
		setLoading(true);
		setError('');
		setResult(null);
		try {
			const recommendation = await api('/api/recommendations', {
				method: 'POST',
				body: JSON.stringify({
					locationId: coordinates ? undefined : locationId,
					coordinates,
					flightTime: new Date(flightTime).toISOString(),
					flightType,
					extraBuffer
				})
			});
			setResult(recommendation);
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
				<label className={fieldLabel} htmlFor="location">
					Where are you coming from?
				</label>
				<div className="flex gap-2 max-md:grid">
					<div className={`${inputShell} flex-1`}>
						<MapPin size={19} />
						<select
							id="location"
							className="w-full appearance-none bg-transparent pr-6 text-sm font-semibold text-ink outline-none"
							value={coordinates ? '' : locationId}
							onChange={(event) => {
								setLocationId(event.target.value);
								setCoordinates(null);
								setNearestMessage('');
							}}
						>
							{coordinates && <option value="">Current location</option>}
							{service.locations.map((location) => (
								<option key={location.id} value={location.id}>
									{location.name}
								</option>
							))}
						</select>
						<ChevronDown size={16} className="pointer-events-none absolute right-3" />
					</div>
					<button
						type="button"
						className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand/15 bg-brand-soft px-4 text-xs font-bold text-brand transition active:scale-[.98]"
						onClick={locate}
						disabled={locating}
					>
						<LocateFixed size={18} />
						{locating ? 'Locating…' : 'Use my location'}
					</button>
				</div>
				{nearestMessage && (
					<p className="mt-2 flex items-center gap-1 text-[.7rem] text-brand">
						<Check size={14} /> {nearestMessage}
					</p>
				)}
				<label className={fieldLabel} htmlFor="flight-time">
					When does your flight depart?
				</label>
				<div className={inputShell}>
					<Plane size={19} />
					<input
						id="flight-time"
						className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
						type="datetime-local"
						value={flightTime}
						onChange={(event) => setFlightTime(event.target.value)}
						required
					/>
				</div>
				<div className="grid grid-cols-[1.3fr_.7fr] gap-3 max-md:grid-cols-1">
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
					<label className={fieldLabel}>
						Traffic buffer
						<div className="relative mt-2 flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
							<select
								className="size-full appearance-none bg-transparent px-3 text-xs font-semibold outline-none"
								value={extraBuffer}
								onChange={(event) => setExtraBuffer(Number(event.target.value))}
							>
								<option value="0">Standard</option>
								<option value="30">+30 min</option>
								<option value="60">+60 min</option>
							</select>
							<ChevronDown
								size={15}
								className="pointer-events-none absolute right-3"
							/>
						</div>
					</label>
				</div>
				{error && (
					<p
						className="mt-3 flex items-center gap-2 text-xs text-red-700"
						role="alert"
					>
						<CircleAlert size={16} /> {error}
					</p>
				)}
				<button
					className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#0b8d85] to-[#08756f] text-sm font-bold text-white shadow-lg shadow-brand/15 transition active:scale-[.98] disabled:opacity-60"
					disabled={loading}
				>
					{loading ? 'Finding your bus…' : 'Find my airport bus'}{' '}
					<ArrowRight size={18} />
				</button>
				<p className="mt-2 flex items-center justify-center gap-1 text-[.62rem] text-slate-400">
					<LockKeyhole size={12} /> Your location stays in this planning session.
				</p>
			</form>
			{result && (
				<Recommendation
					result={result}
					verifiedDate={service.status.verifiedDate}
				/>
			)}
		</section>
	);
}
