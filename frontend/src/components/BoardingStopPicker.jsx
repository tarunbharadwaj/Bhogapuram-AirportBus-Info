import { Check, MapPin, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

export default function BoardingStopPicker({ places, value, onChange }) {
	const [query, setQuery] = useState('');
	const filteredPlaces = useMemo(() => {
		const search = query.trim().toLocaleLowerCase('en-IN');
		if (!search) return places;
		return places.filter((place) =>
			[place.name, place.landmark, ...place.routeCodes]
				.join(' ')
				.toLocaleLowerCase('en-IN')
				.includes(search)
		);
	}, [places, query]);

	return (
		<div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
			<label className="relative block">
				<Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={17} />
				<span className="sr-only">Search supported bus stops</span>
				<input
					type="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search Gajuwaka, IT Hills, NAD…"
					className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-sm text-ink outline-none transition focus:border-brand/60 focus:ring-3 focus:ring-brand/10 dark:border-white/10 dark:bg-slate-900"
				/>
			</label>
			<div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1" role="listbox" aria-label="AeroExpress boarding stops">
				{filteredPlaces.map((place) => {
					const selected = value === place.placeId;
					return (
						<button
							key={place.placeId}
							type="button"
							role="option"
							aria-selected={selected}
							onClick={() => onChange(place.placeId)}
							className={`grid min-h-14 w-full grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-[transform,background-color,color] active:scale-[.99] ${selected ? 'bg-brand text-white shadow-sm' : 'hover:bg-white dark:hover:bg-white/8'}`}
						>
							<span className={`flex size-8 items-center justify-center rounded-lg ${selected ? 'bg-white/15' : 'bg-brand-soft text-brand'}`}>
								<MapPin size={16} />
							</span>
							<span className="min-w-0">
								<strong className="block truncate text-sm">{place.name}</strong>
								<small className={`block truncate text-[.64rem] ${selected ? 'text-white/70' : 'text-muted'}`}>{place.landmark}</small>
							</span>
							<span className={`flex items-center gap-1 text-[.6rem] font-extrabold ${selected ? 'text-white' : 'text-brand'}`}>
								{place.routeCodes.join(' / ')} {selected && <Check size={13} strokeWidth={3} />}
							</span>
						</button>
					);
				})}
				{!filteredPlaces.length && (
					<p className="px-3 py-5 text-center text-xs text-muted">No supported bus stop matches “{query}”.</p>
				)}
			</div>
		</div>
	);
}
