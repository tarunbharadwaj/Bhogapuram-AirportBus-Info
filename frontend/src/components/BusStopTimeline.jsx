import { ArrowRight, BusFront, LocateFixed } from 'lucide-react';
import { indiaDateValue } from '../../../shared/airportDepartures.mjs';
import { formatDate } from '../lib/format.js';
import { directions, formatReportedDelay } from '../lib/liveTracking.js';

const scheduleTime = new Intl.DateTimeFormat('en-IN', {
	timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

export default function BusStopTimeline({ bus, stopNames, now, following, onToggleFollow }) {
	const hasLiveUpdate = bus.recent && Array.isArray(bus.upcomingStopIds);
	const gpsEstimate = bus.recent && !hasLiveUpdate ? bus.gpsStopProgress : null;
	const passed = new Set(hasLiveUpdate ? bus.passedStopIds : gpsEstimate?.passedStopIds);
	const skipped = new Set(hasLiveUpdate ? bus.skippedStopIds : []);
	const upcoming = hasLiveUpdate ? bus.upcomingStopIds : [];
	const nextStopId = upcoming[0] ?? gpsEstimate?.nextStopId;
	const published = bus.scheduledStops ?? [];
	const predictions = new Map((bus.recent ? bus.stopPredictions ?? [] : []).map((stop) => [stop.placeId, stop]));
	const originName = stopNames.get(published[0]?.placeId);
	const destinationName = stopNames.get(published.at(-1)?.placeId);
	const hasSchedule = published.length > 0;
	const stops = hasSchedule ? published : Array.from(new Set([...passed, ...upcoming]), (placeId) => ({ placeId }));
	const nextIndex = stops.findIndex(({ placeId }) => placeId === nextStopId);
	const hasEstimatedPosition = hasSchedule && nextIndex > 0 && passed.has(stops[nextIndex - 1].placeId);
	const hasVisibleProgress = nextIndex !== -1 || stops.some(({ placeId }) => passed.has(placeId) || skipped.has(placeId));
	const progressMessage = hasVisibleProgress
		? gpsEstimate ? 'Stop progress estimated from GPS and route direction.' : 'Progress is estimated from live stop updates.'
		: 'Live stops are unconfirmed. Check the scheduled times below.';
	const originDate = hasSchedule ? indiaDateValue(bus.scheduledOriginAt) : null;

	return (
		<section aria-label="Bus stop progress" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900 lg:min-h-0 lg:self-stretch lg:overflow-y-auto lg:[contain:size]" tabIndex={0}>
			<header className="border-b border-slate-200 p-4 dark:border-white/10 sm:p-5">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 className="flex items-center gap-2 text-sm font-bold text-ink">
						<BusFront size={18} className="shrink-0 text-brand dark:text-teal-200" aria-hidden="true" />
						{bus.routeCode} AeroExpress
					</h3>
					{bus.recent && <button type="button" onClick={onToggleFollow} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand/35 px-3 text-sm font-bold text-brand hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-teal-200">
						<LocateFixed size={16} aria-hidden="true" /> {following ? 'Stop following' : 'Follow bus'}
					</button>}
				</div>
				{originName && destinationName ? (
					<div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 rounded-xl border border-brand/15 bg-brand-soft px-3 py-3 sm:gap-3 sm:px-4">
						<p className="min-w-0 break-words text-sm font-bold leading-tight text-ink"><span className="mb-1 block text-xs font-medium text-muted">From</span>{originName}</p>
						<ArrowRight size={16} className="self-center text-brand dark:text-teal-200" aria-hidden="true" />
						<p className="min-w-0 break-words text-right text-sm font-bold leading-tight text-ink"><span className="mb-1 block text-xs font-medium text-muted">To</span>{destinationName}</p>
					</div>
				) : <p className="mt-3 text-sm text-muted">{directions[bus.direction]}</p>}
				<dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm sm:grid-cols-3">
					<div className="min-w-0">
						<dt className="text-xs text-muted">Vehicle</dt>
						<dd className="mt-0.5 break-words font-semibold text-ink">{bus.vehicleNumber || 'Unavailable'}</dd>
					</div>
					{bus.serviceNumber && <div>
						<dt className="text-xs text-muted">Service</dt>
						<dd className="mt-0.5 font-semibold text-ink">{bus.serviceNumber}</dd>
					</div>}
					{Number.isFinite(bus.speedKph) && <div>
						<dt className="text-xs text-muted">Reported speed</dt>
						<dd className="mt-0.5 font-semibold tabular-nums text-ink">{bus.speedKph} km/h</dd>
					</div>}
				</dl>
			</header>
			<div className="p-3 sm:p-5">
				<div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2 text-xs text-muted">
					<p>{hasSchedule || hasVisibleProgress ? progressMessage : 'Live stops are unconfirmed for this bus.'}</p>
					{hasEstimatedPosition && (
						<span className="inline-flex items-center gap-2 font-semibold">
							<span aria-hidden="true" className="size-2 rotate-45 rounded-[1px] bg-brand dark:bg-teal-300" />
							Estimated bus position
						</span>
					)}
				</div>
				{stops.length > 0 && (
					<>
						<div className="flex items-baseline justify-between gap-2 border-b border-slate-200 px-2 pb-2 dark:border-white/10">
							<h4 className="text-sm font-bold text-ink">Stops in order · {stops.length}</h4>
							{hasSchedule && <span className="text-right text-xs font-semibold text-muted">{predictions.size ? 'Schedule & estimates · IST' : 'Scheduled · IST'}</span>}
						</div>
						<ol aria-label="Stops in order">
							{stops.map(({ placeId, scheduledAt }, index) => {
								const isNext = placeId === nextStopId;
								const isPassed = passed.has(placeId);
								const prediction = isPassed || skipped.has(placeId) ? null : predictions.get(placeId);
								const estimatedAt = prediction?.estimatedAt;
								const status = isNext ? (gpsEstimate ? 'Estimated next stop' : 'Next stop')
									: isPassed ? (gpsEstimate ? 'Likely passed' : 'Passed') : skipped.has(placeId) ? 'Reported skipped' : null;
								return (
									<li key={placeId} className={`relative flex min-h-12 items-center gap-3 rounded-lg py-2 pr-2 ${isNext ? 'bg-brand-soft py-3' : ''}`}>
										<span aria-hidden="true" className={`absolute left-[15px] w-0.5 ${index === 0 ? 'top-1/2' : 'top-0'} ${index === stops.length - 1 ? 'bottom-1/2' : 'bottom-0'} ${isPassed ? 'bg-brand/65' : 'bg-slate-300 dark:bg-slate-600'}`} />
										{isNext && hasEstimatedPosition && <span className="absolute -top-1.5 left-[10px] z-10 size-3 rotate-45 rounded-[2px] border border-white bg-brand dark:border-slate-900 dark:bg-teal-300"><span className="sr-only">Estimated bus position between the previous stop and this stop</span></span>}
										<span aria-hidden="true" className={`relative ml-2.5 size-3 shrink-0 rounded-full border-2 ${isPassed ? 'border-brand bg-brand dark:border-teal-300 dark:bg-teal-300' : isNext ? 'border-brand bg-white dark:border-teal-300 dark:bg-slate-900' : 'border-slate-400 bg-white dark:border-slate-500 dark:bg-slate-900'}`} />
										<div className="min-w-0 flex-1">
											<p className={`break-words text-sm text-ink ${isNext ? 'font-bold' : 'font-medium'}`}>{stopNames.get(placeId) || placeId}</p>
											{status && <p className={`text-xs ${isNext ? 'font-bold text-brand dark:text-teal-200' : 'text-muted'}`}>{status}</p>}
										</div>
										{scheduledAt && (
										<div className="max-w-[46%] shrink-0 text-right">
											<span className="sr-only">Scheduled </span>
													<time dateTime={scheduledAt} className={`text-sm tabular-nums ${isNext ? 'font-bold text-ink' : 'text-muted'}`}>{scheduleTime.format(new Date(scheduledAt))}</time>
													{indiaDateValue(scheduledAt) !== originDate && <p className="text-xs text-muted">Next day</p>}
												{estimatedAt && (
													<p className="text-xs font-semibold text-brand dark:text-teal-200">{Date.parse(estimatedAt) < now ? 'Last estimate' : 'Est.'} <time dateTime={estimatedAt}>{scheduleTime.format(new Date(estimatedAt))}</time>{indiaDateValue(estimatedAt) !== originDate && <span> · {formatDate(estimatedAt)}</span>}</p>
												)}
												{Number.isFinite(prediction?.delaySeconds) && <p className="text-xs text-muted">{formatReportedDelay(prediction.delaySeconds)}</p>}
												</div>
										)}
									</li>
								);
							})}
						</ol>
					</>
				)}
			</div>
		</section>
	);
}
