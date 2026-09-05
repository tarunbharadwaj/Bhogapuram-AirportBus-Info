import { ArrowRight, BusFront, ExternalLink, MapPin } from 'lucide-react';
import Brand from '../components/Brand.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { Footer } from '../components/SiteSections.jsx';
import { mapsLink } from '../lib/format.js';

const PAGE_CONFIG = {
	'/bhogapuram-airport-bus': {
		type: 'overview',
		eyebrow: 'AeroExpress service guide',
		title: 'Vizag to Bhogapuram Airport Bus',
		intro:
			'Plan an AeroExpress bus journey between Visakhapatnam and Bhogapuram Airport. Compare current ASR-1 and ASR-2 timings, boarding stops, fares and airport-to-city departures.'
	},
	'/vizag-airport-bus-timings': {
		type: 'timings',
		eyebrow: 'Daily AeroExpress schedule',
		title: 'Vizag Airport Bus Timings',
		intro:
			'Check published AeroExpress departure times from Vizag to Bhogapuram Airport and from the airport back to the city. Select the trip planner for a recommendation based on your flight or airport-ready time.'
	},
	'/bhogapuram-airport-bus-routes': {
		type: 'routes',
		eyebrow: 'ASR-1 and ASR-2',
		title: 'Bhogapuram Airport Bus Routes',
		intro:
			'Compare the two AeroExpress routes connecting Vizag with Bhogapuram Airport. See every published stop in travel order and open the stop locations in Google Maps.'
	},
	'/bhogapuram-airport-bus-fares': {
		type: 'fares',
		eyebrow: 'Stop-by-stop prices',
		title: 'Bhogapuram Airport Bus Fares',
		intro:
			'Find the published AeroExpress fare from each supported Vizag boarding point to Bhogapuram Airport. Fares differ by route and boarding stop.'
	},
	'/vizag-airport-bus-stops': {
		type: 'stops',
		eyebrow: 'Boarding and drop-off points',
		title: 'Vizag Airport Bus Stops',
		intro:
			'Find AeroExpress boarding points in Vizag for Bhogapuram Airport, including landmarks, routes, fares and direct Google Maps links.'
	},
	'/routes/asr-1': {
		type: 'route',
		routeId: 'asr-1',
		eyebrow: 'AeroExpress route guide',
		title: 'ASR-1 Vizag Airport Bus Route',
		intro:
			'ASR-1 connects Old Gajuwaka with Bhogapuram Airport via NAD Junction, Gurudwara, Zoo Park, Marikavalasa and Tagarapuvalasa.'
	},
	'/routes/asr-2': {
		type: 'route',
		routeId: 'asr-2',
		eyebrow: 'AeroExpress route guide',
		title: 'ASR-2 Vizag Airport Bus Route',
		intro:
			'ASR-2 connects Old Gajuwaka with Bhogapuram Airport via Scindia, Kancharapalem, Siripuram, ISKCON Temple, IT Hills and Anandapuram.'
	}
};

export const SEO_PATHS = Object.keys(PAGE_CONFIG);

const normalizePath = (pathname) => pathname.replace(/\/+$/, '') || '/';

const displayTime = (value) => {
	const [hours, minutes] = value.split(':').map(Number);
	const suffix = hours >= 12 ? 'PM' : 'AM';
	const hour = hours % 12 || 12;
	return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

const displayDate = (value) =>
	new Intl.DateTimeFormat('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	}).format(new Date(`${value}T12:00:00+05:30`));

const guideLinks = [
	['Bus overview', '/bhogapuram-airport-bus/'],
	['Current timings', '/vizag-airport-bus-timings/'],
	['Routes', '/bhogapuram-airport-bus-routes/'],
	['Fares', '/bhogapuram-airport-bus-fares/'],
	['Stops & maps', '/vizag-airport-bus-stops/']
];

function GuideHeader() {
	return (
		<header className="adaptive-material sticky top-0 z-50 border-b border-white/70 bg-[#f3f6f7]/88 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1116]/88">
			<div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-4 px-6 max-md:px-4">
				<Brand />
				<nav className="flex items-center gap-1 max-lg:hidden" aria-label="Bus guides">
					{guideLinks.map(([label, href]) => (
						<a key={href} href={href} className="rounded-xl px-3 py-2 text-xs font-bold text-muted transition hover:bg-white hover:text-ink dark:hover:bg-white/8">
							{label}
						</a>
					))}
				</nav>
				<div className="flex items-center gap-2">
					<a href="/#planner" className="rounded-xl bg-brand px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-brand-dark">
						Plan a trip
					</a>
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
}

function Schedule({ route }) {
	return (
		<section className="rounded-3xl border border-white bg-white/75 p-6 shadow-[0_18px_55px_rgba(22,44,58,.06)] dark:border-white/10 dark:bg-white/5 max-md:p-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<span className="text-xs font-extrabold text-brand">{route.code}</span>
					<h2 className="mt-1 text-xl font-bold">{route.name}</h2>
				</div>
				<a href={`/routes/${route.id}/`} className="inline-flex items-center gap-1 text-xs font-bold text-brand">
					Full route details <ArrowRight size={14} />
				</a>
			</div>
			<div className="mt-6 grid grid-cols-2 gap-6 max-md:grid-cols-1">
				{[
					['Vizag to airport', route.timetables.toAirport],
					['Airport to Vizag', route.timetables.fromAirport]
				].map(([label, times]) => (
					<div key={label}>
						<h3 className="text-sm font-bold">{label}</h3>
						<p className="mt-1 text-xs text-muted">Published at the route origin</p>
						<div className="mt-3 flex flex-wrap gap-2">
							{times.map((time) => (
								<time key={time} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold dark:border-white/10 dark:bg-white/6">
									{displayTime(time)}
								</time>
							))}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

function RouteStops({ route, showFare = true }) {
	return (
		<section className="rounded-3xl border border-white bg-white/75 p-6 shadow-[0_18px_55px_rgba(22,44,58,.06)] dark:border-white/10 dark:bg-white/5 max-md:p-4">
			<div className="flex items-start justify-between gap-4">
				<div>
					<span className="inline-flex rounded-lg px-3 py-2 text-xs font-extrabold text-white" style={{ backgroundColor: route.color }}>{route.code}</span>
					<h2 className="mt-3 text-xl font-bold">{route.name}</h2>
					<p className="mt-1 text-sm text-muted">{route.description}</p>
				</div>
				<a href={`/routes/${route.id}/`} className="shrink-0 text-xs font-bold text-brand">Route page</a>
			</div>
			<ol className="mt-6 divide-y divide-slate-200 dark:divide-white/10">
				{route.stops.map((stop, index) => (
					<li key={stop.id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3">
						<span className="flex size-7 items-center justify-center rounded-full border-2 text-[.65rem] font-extrabold" style={{ borderColor: route.color }}>{index + 1}</span>
						<span>
							<strong className="block text-sm">{stop.name}</strong>
							<small className="text-muted">{stop.landmark}</small>
						</span>
						<span className="text-right">
							{showFare && <strong className="block text-sm">₹{stop.fare}</strong>}
							<a className="inline-flex items-center gap-1 text-xs font-bold text-brand" href={mapsLink(stop.lat, stop.lng)} target="_blank" rel="noreferrer">
								Map <ExternalLink size={12} />
							</a>
						</span>
					</li>
				))}
				<li className="grid grid-cols-[2rem_1fr] items-center gap-3 py-3">
					<span className="flex size-7 items-center justify-center rounded-full bg-ink text-white"><BusFront size={13} /></span>
					<strong className="text-sm">Bhogapuram Airport terminal</strong>
				</li>
			</ol>
		</section>
	);
}

function FareTable({ routes }) {
	return (
		<div className="overflow-hidden rounded-3xl border border-white bg-white/75 shadow-[0_18px_55px_rgba(22,44,58,.06)] dark:border-white/10 dark:bg-white/5">
			<div className="overflow-x-auto">
				<table className="w-full min-w-[36rem] border-collapse text-left text-sm">
					<thead className="bg-slate-100 text-xs text-muted dark:bg-white/6">
						<tr><th className="px-5 py-4">Route</th><th className="px-5 py-4">Boarding point</th><th className="px-5 py-4">Landmark</th><th className="px-5 py-4 text-right">Fare to airport</th></tr>
					</thead>
					<tbody className="divide-y divide-slate-200 dark:divide-white/10">
						{routes.flatMap((route) => route.stops.map((stop) => (
							<tr key={`${route.id}-${stop.id}`}>
								<td className="px-5 py-4 font-extrabold">{route.code}</td>
								<td className="px-5 py-4 font-bold">{stop.name}</td>
								<td className="px-5 py-4 text-muted">{stop.landmark}</td>
								<td className="px-5 py-4 text-right font-extrabold">₹{stop.fare}</td>
							</tr>
						)))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function Overview({ routes }) {
	return (
		<>
			<section className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
				{routes.map((route) => (
					<a key={route.id} href={`/routes/${route.id}/`} className="rounded-3xl border border-white bg-white/75 p-6 shadow-[0_18px_55px_rgba(22,44,58,.06)] transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/5">
						<span className="text-xs font-extrabold text-brand">{route.code}</span>
						<h2 className="mt-2 text-xl font-bold">{route.name}</h2>
						<p className="mt-2 text-sm leading-relaxed text-muted">{route.description}</p>
						<span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-brand">View timings, stops and fares <ArrowRight size={14} /></span>
					</a>
				))}
			</section>
			<section className="rounded-3xl border border-white bg-white/75 p-6 dark:border-white/10 dark:bg-white/5">
				<h2 className="text-xl font-bold">What this airport bus guide provides</h2>
				<div className="mt-5 grid grid-cols-3 gap-4 max-md:grid-cols-1">
					{[
						['Timings in both directions', 'See services from Vizag to the airport and from Bhogapuram Airport back to the city.'],
						['Exact boarding information', 'Use stop landmarks and map pins instead of guessing where the AeroExpress stops.'],
						['Flight-aware planning', 'Enter your flight time to find a safer bus with the appropriate airport buffer.']
					].map(([title, copy]) => <div key={title}><h3 className="text-sm font-bold">{title}</h3><p className="mt-2 text-xs leading-relaxed text-muted">{copy}</p></div>)}
				</div>
			</section>
			<section className="rounded-3xl border border-white bg-white/75 p-6 dark:border-white/10 dark:bg-white/5">
				<h2 className="text-xl font-bold">Frequently asked questions</h2>
				<div className="mt-5 grid gap-5">
					<div><h3 className="text-sm font-bold">Does this website sell or book AeroExpress tickets?</h3><p className="mt-1 text-sm text-muted">No. This is an independent planning and information tool, not an APSRTC booking service.</p></div>
					<div><h3 className="text-sm font-bold">Can I plan a bus from Bhogapuram Airport to Vizag?</h3><p className="mt-1 text-sm text-muted">Yes. Choose “From Airport” in the planner, select your destination and enter when you will be ready at the airport boarding point.</p></div>
					<div><h3 className="text-sm font-bold">Are times at intermediate stops exact?</h3><p className="mt-1 text-sm text-muted">No. Route-origin departures are published, while intermediate stop and arrival times are estimates. Arrive early and confirm before travelling.</p></div>
				</div>
			</section>
		</>
	);
}

export default function SeoLandingPage({ pathname, service }) {
	const path = normalizePath(pathname);
	const page = PAGE_CONFIG[path] || PAGE_CONFIG['/bhogapuram-airport-bus'];
	const routes = service.routes.filter((route) => route.enabled);
	const selectedRoute = page.routeId
		? routes.find((route) => route.id === page.routeId)
		: null;

	return (
		<div>
			<GuideHeader />
			<main className="mx-auto max-w-7xl px-6 pb-24 pt-14 max-md:px-4 max-md:pt-10">
				<nav aria-label="Breadcrumb" className="text-xs font-semibold text-muted">
					<a href="/" className="hover:text-brand">Home</a><span aria-hidden="true"> / </span><span>{page.title}</span>
				</nav>
				<header className="max-w-4xl py-12 max-md:py-9">
					<span className="text-xs font-extrabold uppercase tracking-[.13em] text-brand">{page.eyebrow}</span>
					<h1 className="mt-4 text-[clamp(2.5rem,6vw,5.2rem)] font-bold leading-[.95] tracking-[-.055em]">{page.title}</h1>
					<p className="mt-6 max-w-3xl text-[clamp(1rem,2vw,1.2rem)] leading-relaxed text-muted">{page.intro}</p>
					<div className="mt-7 flex flex-wrap gap-3">
						<a href="/#planner" className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-brand-dark">Plan my airport bus <ArrowRight size={17} /></a>
						<a href="/vizag-airport-bus-timings/" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold dark:border-white/10 dark:bg-white/6">View all timings</a>
					</div>
				</header>

				<div className="grid gap-6">
					{page.type === 'overview' && <Overview routes={routes} />}
					{page.type === 'timings' && routes.map((route) => <Schedule key={route.id} route={route} />)}
					{page.type === 'routes' && routes.map((route) => <RouteStops key={route.id} route={route} />)}
					{page.type === 'fares' && <FareTable routes={routes} />}
					{page.type === 'stops' && routes.map((route) => <RouteStops key={route.id} route={route} />)}
					{page.type === 'route' && selectedRoute && <><RouteStops route={selectedRoute} /><Schedule route={selectedRoute} /></>}
				</div>

				<aside className="mt-8 flex items-start gap-3 rounded-2xl border border-brand/15 bg-brand-soft p-5 text-sm text-muted">
					<MapPin size={18} className="mt-0.5 shrink-0 text-brand" />
					<p><strong className="text-ink">Information last verified {displayDate(service.status.verifiedDate)}.</strong> This community-built guide is not an official APSRTC booking service. Route-origin times are published; intermediate times are estimates, so confirm changes before travel.</p>
				</aside>
			</main>
			<Footer />
		</div>
	);
}
