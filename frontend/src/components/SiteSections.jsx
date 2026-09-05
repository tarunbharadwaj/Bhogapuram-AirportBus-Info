import {
	BadgeIndianRupee,
	BusFront,
	Clock3,
	ExternalLink,
	Heart,
	Map,
	MessageSquareText,
	Route,
	Send,
	ShieldCheck
} from 'lucide-react';
import Brand from './Brand.jsx';

export function QuickFacts({ service }) {
	const minFare = Math.min(
		...service.routes.flatMap((route) => route.stops.map((stop) => stop.fare))
	);
	const facts = [
		[Clock3, 'Service window', '4:30 AM – 10:30 PM'],
		[Route, 'AeroExpress routes', 'ASR-1 & ASR-2'],
		[BadgeIndianRupee, 'Reference fare', `From ₹${minFare}`]
	];
	return (
		<section className="adaptive-material mx-auto mt-4 grid max-w-[73rem] grid-cols-3 rounded-2xl border border-white bg-white/70 p-3 shadow-lg shadow-slate-900/5 backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-white/5 max-xl:mx-4 max-md:grid-cols-1">
			{facts.map(([Icon, label, value]) => (
				<div
					key={label}
					className="flex min-h-18 items-center justify-center gap-3 border-r border-slate-200 last:border-0 dark:border-white/10 max-md:justify-start max-md:border-r-0 max-md:border-b max-md:px-4"
				>
					<span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
						<Icon size={20} />
					</span>
					<p className="grid gap-1">
						<small className="text-[.65rem] text-slate-400">{label}</small>
						<strong className="text-sm">{value}</strong>
					</p>
				</div>
			))}
		</section>
	);
}

export function Confidence() {
	const items = [
		[
			ShieldCheck,
			'Plan with a safety margin',
			'Recommendations include flight and traffic buffers.'
		],
		[
			Map,
			'Find the exact stop',
			'Each boarding point has a landmark and Google Maps link.'
		],
		[
			Send,
			'Share the whole plan',
			'Send the route, stop, bus time, ETA and fare on WhatsApp.'
		]
	];
	return (
		<section className="mx-auto my-28 grid max-w-[73rem] grid-cols-3 gap-4 max-xl:mx-4 max-md:my-20 max-md:grid-cols-1">
			{items.map(([Icon, title, copy]) => (
				<div
					key={title}
					className="rounded-2xl border border-white bg-white/65 p-6 transition-colors duration-300 dark:border-white/10 dark:bg-white/5"
				>
					<span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
						<Icon size={20} />
					</span>
					<h3 className="mt-4 text-sm font-bold">{title}</h3>
					<p className="mt-2 text-xs leading-relaxed text-muted">{copy}</p>
				</div>
			))}
		</section>
	);
}

const airportBusGuides = [
	['Vizag airport bus timings', '/vizag-airport-bus-timings/', 'Published ASR-1 and ASR-2 departures in both directions.'],
	['Bhogapuram airport bus routes', '/bhogapuram-airport-bus-routes/', 'Compare routes, stop order and direct map links.'],
	['Airport bus fares', '/bhogapuram-airport-bus-fares/', 'See the fare from every supported boarding point.'],
	['Vizag airport bus stops', '/vizag-airport-bus-stops/', 'Find boarding landmarks and exact or approximate pins.']
];

export function TravelGuides() {
	return (
		<section className="mx-auto max-w-7xl px-6 pt-28 max-md:px-4 max-md:pt-20" aria-labelledby="travel-guides-title">
			<div className="max-w-3xl">
				<span className="text-xs font-extrabold uppercase tracking-[.12em] text-brand">Airport bus guides</span>
				<h2 id="travel-guides-title" className="mt-3 text-[clamp(2rem,4vw,3.15rem)] font-bold leading-none tracking-[-.045em]">Everything you need before boarding.</h2>
				<p className="mt-4 text-sm leading-relaxed text-muted">Browse current AeroExpress information for travel between Visakhapatnam and Bhogapuram Airport without opening the trip planner.</p>
			</div>
			<div className="mt-8 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:grid-cols-1">
				{airportBusGuides.map(([title, href, copy]) => (
					<a key={href} href={href} className="group rounded-2xl border border-white bg-white/65 p-5 transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8">
						<h3 className="text-sm font-bold group-hover:text-brand">{title}</h3>
						<p className="mt-2 text-xs leading-relaxed text-muted">{copy}</p>
						<span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-brand">Open guide <ExternalLink size={12} /></span>
					</a>
				))}
			</div>
		</section>
	);
}

export function Footer() {
	return (
		<footer className="mx-auto mb-8 grid max-w-[73rem] grid-cols-[1fr_auto] gap-8 border-t border-slate-200 py-8 dark:border-white/10 max-xl:mx-4 max-md:grid-cols-1">
			<div className="flex items-center gap-3">
				<Brand compact />
				<div>
					<strong className="text-sm">Vizag Airport Bus Info</strong>
					<p className="mt-1 text-[.68rem] text-muted">
						Making your next trip to Vizag Airport easier.
					</p>
				</div>
			</div>
			<div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-muted">
				<a className="flex items-center gap-1" href="/feedback">
					Feedback <MessageSquareText size={12} />
				</a>
				<a
					className="flex items-center gap-1"
					href="https://www.apsrtc.ap.gov.in/"
					target="_blank"
					rel="noreferrer"
				>
					APSRTC <ExternalLink size={12} />
				</a>
				<a
					className="flex items-center gap-1"
					href="https://gmraero.com/visakhapatnam-airport.aspx"
					target="_blank"
					rel="noreferrer"
				>
					Airport information <ExternalLink size={12} />
				</a>
			</div>
			<nav className="col-span-full flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200 pt-5 text-xs font-semibold text-muted dark:border-white/10" aria-label="Airport bus guides">
				<a href="/bhogapuram-airport-bus/">Bus service guide</a>
				<a href="/vizag-airport-bus-timings/">Timings</a>
				<a href="/bhogapuram-airport-bus-routes/">Routes</a>
				<a href="/bhogapuram-airport-bus-fares/">Fares</a>
				<a href="/vizag-airport-bus-stops/">Stops & maps</a>
			</nav>
			<p className="col-span-full text-[.62rem] leading-relaxed text-slate-400">
				This is an independent information tool, not an official APSRTC booking
				service. Confirm newly launched service timings before leaving.
			</p>
			<p className="col-span-full flex items-center justify-center gap-1.5 text-[.65rem] font-semibold text-slate-400">
				Made with{' '}
				<Heart
					size={12}
					className="fill-rose-400 text-rose-400"
					aria-label="love"
				/>{' '}
				by a
				<a
					className="ml-1 inline-flex items-center gap-1 text-brand transition hover:opacity-75"
					href="https://www.linkedin.com/in/tarun-bharadwaj/"
					target="_blank"
					rel="noreferrer"
					aria-label="Vizagite on LinkedIn"
				>
					{/* <Linkedin size={13} /> LinkedIn */}
					Vizagite
				</a>
			</p>
		</footer>
	);
}

export function LoadingScreen({ error }) {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted">
			<span className="flex size-12 items-center justify-center rounded-2xl bg-brand text-white">
				<BusFront size={23} />
			</span>
			{error ? (
				<>
					<h1 className="text-xl font-bold text-ink">Couldn’t load service data</h1>
					<p className="text-sm">{error}</p>
				</>
			) : (
				<p className="text-sm">Loading AeroExpress data…</p>
			)}
		</main>
	);
}
