import { ArrowRight, Navigation, Route } from 'lucide-react';

export default function JourneyPromo() {
	return (
		<section className="mx-auto max-w-7xl px-6 pb-6 max-md:px-4">
			<div className="adaptive-material grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-3xl border border-white bg-white/75 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 max-md:grid-cols-[auto_1fr]">
				<span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
					<Route size={22} aria-hidden="true" />
				</span>
				<div>
					<p className="text-[.65rem] font-extrabold uppercase tracking-[.12em] text-brand">
						Already on the bus?
					</p>
					<h2 className="mt-1 text-lg font-bold">Follow your stops to Vizag Airport</h2>
					<p className="mt-1 text-xs leading-relaxed text-muted">
						Choose your route and boarding stop. No trip plan is required.
					</p>
				</div>
				<a
					href="/journey"
					className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white transition active:scale-[.98] max-md:col-span-2"
				>
					<Navigation size={17} /> Start journey <ArrowRight size={16} />
				</a>
			</div>
		</section>
	);
}
