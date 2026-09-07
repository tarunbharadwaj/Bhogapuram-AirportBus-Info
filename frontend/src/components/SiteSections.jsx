import {
	BadgeIndianRupee,
	BusFront,
	Clock3,
	ExternalLink,
	Heart,
	HelpCircle,
	Map,
	MessageSquareText,
	Route,
	Send,
	ShieldCheck
} from 'lucide-react';
import Brand from './Brand.jsx';
import { trackEvent } from '../lib/analytics.js';
import { DEFAULT_TICKETING } from '../../../shared/serviceData.mjs';

const fallbackTicketing = DEFAULT_TICKETING;

export function QuickFacts({ service }) {
	const minFare = Math.min(
		...service.routes.flatMap((route) => route.stops.map((stop) => stop.fare))
	);
	const facts = [
		[Clock3, 'Service window', '4:30 AM - 10:30 PM'],
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
			'Recommendations include a flight safety buffer.'
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

const faqItems = [
	{
		id: 'location-required',
		question: 'Is location permission required?',
		answer:
			'No. Choose “Choose a bus stop” in the planner to plan from any active stop without sharing your location.'
	},
	{
		id: 'estimated-stop-times',
		question: 'How are intermediate stop times calculated?',
		answer:
			'Route-origin departures are published. Intermediate stop arrivals are estimates derived from route offsets, rounded to the nearest five minutes and marked with ~.'
	},
	{
		id: 'punctuality',
		question: 'Are AeroExpress buses guaranteed to run on time?',
		answer:
			'No. Traffic and operational conditions can change arrival times. Be at the stop 10-15 minutes early.'
	},
	{
		id: 'ticket-availability',
		question: 'Can I book an AeroExpress ticket online?',
		answer:
			'AeroExpress tickets cannot currently be purchased online. Board the bus and buy your ticket directly from the conductor.'
	},
	{
		id: 'tomorrow-buses',
		question: 'How can I see tomorrow’s early buses?',
		answer:
			'Use “Full daily schedule” in the timetable. It shows the complete first-to-last daily schedule, including services that have already departed today.'
	}
];

export function FAQ({ ticketing = fallbackTicketing }) {
	const info = { ...fallbackTicketing, ...ticketing };
	return (
		<section
			className="mx-auto max-w-5xl px-6 pt-28 max-md:px-4 max-md:pt-20"
			id="faq"
			aria-labelledby="faq-title"
		>
			<div className="text-center">
				<span className="text-xs font-extrabold uppercase tracking-[.12em] text-brand">
					Helpful answers
				</span>
				<h2
					className="mt-3 text-[clamp(2rem,4vw,3.15rem)] leading-none font-bold tracking-[-.045em]"
					id="faq-title"
				>
					Before you travel.
				</h2>
			</div>
			<div className="mt-8 space-y-2">
				{faqItems.map((item) => (
					<details
						key={item.id}
						className="group rounded-2xl border border-white bg-white/70 px-5 shadow-sm dark:border-white/10 dark:bg-white/5"
						onToggle={(event) => {
							if (event.currentTarget.open)
								trackEvent('faq_opened', { faq_id: item.id });
						}}
					>
						<summary className="flex min-h-15 cursor-pointer list-none items-center gap-3 py-4 text-sm font-bold marker:hidden">
							<HelpCircle className="shrink-0 text-brand" size={18} />
							<span className="flex-1">{item.question}</span>
							<span
								className="text-lg font-normal text-muted transition-transform group-open:rotate-45"
								aria-hidden="true"
							>
								+
							</span>
						</summary>
						<p className="border-t border-slate-200 py-4 pl-8 text-xs leading-6 text-muted dark:border-white/10">
							{item.id === 'ticket-availability' ? info.message : item.answer}
						</p>
					</details>
				))}
			</div>
		</section>
	);
}

export function Footer({ ticketing = fallbackTicketing }) {
	const info = { ...fallbackTicketing, ...ticketing };
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
					href={info.trackingUrl}
					target="_blank"
					rel="noreferrer"
				>
					Live tracking <ExternalLink size={12} />
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
