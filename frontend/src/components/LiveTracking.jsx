import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BusFront, CircleAlert, Clock3, ExternalLink, Radio } from 'lucide-react';
import { getActiveBoardingPlaces } from '../../../shared/serviceRouting.mjs';
import { APSRTC_TRACKING_URL, officialTripUrl, UNMAPPED_STOP_SEGMENTS } from '../../../shared/liveTracking.mjs';
import useLiveTracking from '../hooks/useLiveTracking.js';
import { gpsAgeLabel, visibleTrackingBuses } from '../lib/liveTracking.js';
import { formatTime } from '../lib/format.js';
import { trackEvent } from '../lib/analytics.js';
import BoardingStopPicker from './BoardingStopPicker.jsx';

const LiveBusMap = lazy(() => import('./LiveBusMap.jsx'));
class MapBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p role="status" className="p-6 text-muted">The map could not load. Bus details and location links are still available below.</p> : this.props.children; }
}

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50';
const input = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink dark:border-white/10 dark:bg-slate-800';
const progressText = {
  'at-stop': 'At or near your stop',
  approaching: 'Approaching your stop',
  uncertain: 'Progress near this stop is uncertain',
  'last-known': 'Last known location',
  'gps-unavailable': 'GPS unavailable'
};

function TrackerMap({ buses, selected, onSelect, stop }) {
  return <MapBoundary><Suspense fallback={<p className="p-8 text-muted">Loading map…</p>}>
    <LiveBusMap buses={buses} selected={selected} onSelect={onSelect} stop={stop} />
  </Suspense></MapBoundary>;
}

function BusPositionActions({ bus, onSelect }) {
  return <div className="mt-3 flex flex-wrap gap-2">
    <button type="button" disabled={!bus.position} className={`${button} bg-brand-soft text-brand dark:text-teal-200`}
      onClick={() => onSelect(bus.tripId)}>Locate on map</button>
    <a className={button} href={officialTripUrl(bus.tripId)} target="_blank" rel="noopener noreferrer">APSRTC trip <ExternalLink size={14} /></a>
    {bus.position && <a className={`${button} text-muted`} href={`https://www.google.com/maps/search/?api=1&query=${bus.position.lat},${bus.position.lng}`}
      target="_blank" rel="noopener noreferrer">{bus.quality === 'recent' ? 'Current GPS pin' : 'Last known pin'} <ExternalLink size={14} /></a>}
  </div>;
}

function StopResults({ snapshot, now, selected, onSelect, stop }) {
  const options = snapshot?.options || [];
  const future = snapshot?.status === 'not-yet-available' || snapshot?.plannedTripMatch === 'future';
  const showSchedule = snapshot && (!snapshot.reliableLiveResult || future);
  return <>
    {future && <p className="my-4 rounded-2xl bg-brand-soft p-4 text-sm leading-relaxed">
      Live tracking becomes available on the journey date. The published buses below can still help you plan.
    </p>}
    {snapshot?.matchedBusPassed && <p role="status" className="my-4 flex items-start gap-2 rounded-2xl bg-amber-100 p-4 text-sm text-amber-950 dark:bg-amber-300/10 dark:text-amber-100">
      <CircleAlert className="mt-0.5 shrink-0" size={17} /> The bus from your plan has already passed {stop.name}. Later tracking candidates are shown where available.
    </p>}
    {snapshot?.partial && <p className="my-4 text-sm text-amber-800 dark:text-amber-200">Some APSRTC records could not be checked. This is not a complete list of operating buses.</p>}
    {snapshot && !future && !options.length && <p className="my-4 rounded-2xl bg-brand-soft p-4 text-sm leading-relaxed">
      No reliable live bus is visible for this stop right now. Tracking may not have started or may be temporarily unavailable; this does not mean no bus is operating.
    </p>}
    {options.length > 0 && <>
      <TrackerMap buses={options} selected={selected} onSelect={onSelect} stop={stop} />
      <p className="my-3 text-xs leading-relaxed text-muted">The red marker is your selected stop. Distances are straight-line only—not road distance or arrival time. Positions older than 30 minutes are hidden.</p>
      <ol className="mt-5 grid gap-3 lg:grid-cols-3" aria-label={`Buses approaching ${stop.name}`}>
        {options.map((bus, index) => {
          const strongCandidate = index === 0 && snapshot.reliableLiveResult && bus.quality === 'recent' && bus.progressQuality === 'provider-waypoint' && ['at-stop', 'approaching'].includes(bus.stopProgress);
          return <li key={bus.tripId} className={`rounded-2xl border p-4 ${selected === bus.tripId ? 'border-brand ring-2 ring-brand/10' : 'border-slate-200 dark:border-white/10'}`}>
            <div className="flex items-start justify-between gap-3">
              <div><span className="text-[.62rem] font-extrabold uppercase tracking-wider text-brand">{strongCandidate ? 'Most likely next bus' : index ? 'Alternative' : 'Tracking candidate'}</span>
                <p className="mt-1 flex items-center gap-2 font-bold"><BusFront size={18} className="text-brand" />{bus.vehicleNumber}</p>
                <p className="mt-1 text-sm text-muted">{bus.routeCode} · City → Airport</p></div>
              <span className={`rounded-lg px-2 py-1 text-right text-[.65rem] font-bold ${['at-stop', 'approaching'].includes(bus.stopProgress) && bus.quality === 'recent' ? 'bg-brand-soft text-brand dark:text-teal-200' : 'bg-amber-100 text-amber-950 dark:bg-amber-300/10 dark:text-amber-100'}`}>{progressText[bus.stopProgress]}</span>
            </div>
            <dl className="mt-4 grid gap-2 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-muted">Last reached stop</dt><dd className="text-right font-semibold">{bus.currentStopName || 'Not reported'}</dd></div>
              {bus.stopsAway !== null && <div className="flex justify-between gap-3"><dt className="text-muted">Stops remaining</dt><dd className="font-semibold">{bus.stopsAway}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-muted">Position</dt><dd className="text-right font-semibold">{bus.position ? `${bus.distanceKm} km away in a straight line` : 'Not available'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">GPS</dt><dd className="text-right font-semibold">{bus.position ? `${gpsAgeLabel(bus.position, now)} · ${bus.quality === 'recent' ? 'recent' : 'last known'}` : 'Unavailable'}</dd></div>
              {bus.selectedStopScheduledAt && <div className="flex justify-between gap-3"><dt className="text-muted">Scheduled at stop</dt><dd className="font-semibold">{formatTime(bus.selectedStopScheduledAt)}</dd></div>}
            </dl>
            {bus.progressQuality === 'surrounding-waypoints' && <p className="mt-3 rounded-xl bg-amber-100/70 p-3 text-xs leading-relaxed text-amber-950 dark:bg-amber-300/10 dark:text-amber-100">APSRTC omits this stop from its waypoint feed. Progress is based only on the confirmed stops around it, so a precise approach status is unavailable.</p>}
            <BusPositionActions bus={bus} onSelect={onSelect} />
          </li>;
        })}
      </ol>
    </>}
    {showSchedule && <div className="mt-5 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
      <div className="flex items-center gap-2"><Clock3 size={17} className="text-brand" /><h3 className="font-bold">Next published schedule</h3></div>
      <p className="mt-1 text-xs leading-relaxed text-muted">Schedule information is separate from live tracking and does not confirm that a bus is currently operating.</p>
      <ul className="mt-3 divide-y divide-slate-200 dark:divide-white/10">
        {snapshot.nextPublishedServices.map((item) => <li key={`${item.routeCode}-${item.routeOriginDepartureAt}`} className="flex items-center justify-between gap-3 py-3 text-sm">
          <span><strong>{item.routeCode}</strong><small className="ml-2 text-muted">{item.timeQuality === 'estimated' ? 'Estimated at stop' : 'Published at stop'}</small></span>
          <strong>{item.timeQuality === 'estimated' ? '~' : ''}{formatTime(item.stopArrivalAt)}</strong>
        </li>)}
      </ul>
    </div>}
  </>;
}

export default function LiveTracking({ service, requestedSelection }) {
  const section = useRef(null);
  const [view, setView] = useState('find');
  const [enabled, setEnabled] = useState(false);
  const [draftPlaceId, setDraftPlaceId] = useState('');
  const [stopRequest, setStopRequest] = useState(null);
  const [route, setRoute] = useState('all');
  const [direction, setDirection] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const trackedResultRequest = useRef('');
  const places = useMemo(() => getActiveBoardingPlaces(service), [service]);
  const selectedStop = places.find((place) => place.placeId === stopRequest?.placeId) || null;
  const feedRequest = view === 'find' ? stopRequest : null;
  const { snapshot, now, loading, error, online, active } = useLiveTracking(section, enabled, feedRequest);
  const activeCodes = service.routes.filter((item) => item.enabled).map((item) => item.code);
  const fleetBuses = view === 'browse' ? visibleTrackingBuses(snapshot, now, { route, direction, search, paused: !active, failed: error })
    .filter((bus) => bus.routeCode ? activeCodes.includes(bus.routeCode) : activeCodes.includes('ASR-1') && activeCodes.includes('ASR-2')) : [];

  const onSelect = useCallback((id) => {
    setSelected(id);
    trackEvent('live_tracking_opened', { link_type: 'bus_selected' });
  }, []);

  useEffect(() => {
    if (!requestedSelection?.placeId) return;
    const next = { placeId: requestedSelection.placeId,
      routeCode: requestedSelection.routeCode || '', scheduledOriginAt: requestedSelection.scheduledOriginAt || '' };
    setView('find');
    setDraftPlaceId(next.placeId);
    setStopRequest(next);
    setEnabled(true);
    setSelected(null);
  }, [requestedSelection]);

  useEffect(() => {
    if (!snapshot || view !== 'find') return;
    const requestKey = `${stopRequest?.placeId || ''}|${stopRequest?.routeCode || ''}|${stopRequest?.scheduledOriginAt || ''}`;
    if (trackedResultRequest.current === requestKey) return;
    trackedResultRequest.current = requestKey;
    trackEvent('stop_tracking_result', { stop_id: stopRequest?.placeId,
      route_code: stopRequest?.routeCode || 'all', match_type: snapshot.plannedTripMatch,
      tracking_status: snapshot.reliableLiveResult ? 'reliable' : snapshot.status });
  }, [snapshot, view, stopRequest]);

  const find = (event) => {
    event.preventDefault();
    if (!draftPlaceId) return;
    setStopRequest({ placeId: draftPlaceId });
    setEnabled(true);
    setSelected(null);
    trackEvent('stop_tracking_started', { stop_id: draftPlaceId, direction: 'to-airport' });
  };
  const switchView = (next) => { setView(next); setEnabled(false); setSelected(null); };
  const browseStatus = !online ? 'You’re offline. Showing last known information where available.' : !enabled ? 'Tracking is paused.'
    : !active ? 'Updates pause while this section or browser tab is out of view.' : snapshot?.status === 'disabled' ? 'Live tracking is temporarily disabled. Please use APSRTC.'
    : error ? 'Tracking could not be refreshed. Last known positions may be shown.'
    : loading && !snapshot ? 'Connecting to live tracking. The server may need up to a minute to wake up; you can keep using the planner.'
    : `${fleetBuses.filter((bus) => bus.quality === 'recent').length} buses have recent GPS in this view. Updates approximately every 30 seconds.`;
  const findStatus = !online ? 'You’re offline. Reconnect to check buses for this stop.' : !enabled ? 'Choose a boarding stop to check buses travelling toward it.'
    : !active ? 'Updates pause while this section or browser tab is out of view.' : error ? 'Live tracking could not be refreshed. Published timings are shown when available.'
    : loading && !snapshot ? 'Checking APSRTC live data. A sleeping server can take up to a minute to wake; the rest of the site remains usable.'
    : snapshot?.reliableLiveResult ? 'Live waypoint and recent GPS evidence found. Updates approximately every 30 seconds.'
    : snapshot ? 'No reliable live match was found. Review the cautious tracking candidates and published schedule below.' : 'Checking live buses…';

  return <section id="live-tracking" ref={section} className="mx-auto max-w-7xl scroll-mt-20 px-6 pt-24 max-md:px-4">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><span className="text-xs font-extrabold uppercase tracking-[.12em] text-brand">Live tracking · Experimental</span>
        <h2 className="mt-3 text-[clamp(2rem,4vw,3.15rem)] font-bold leading-tight tracking-[-.045em]">Find the bus coming to your stop.</h2></div>
      <a href={APSRTC_TRACKING_URL} target="_blank" rel="noopener noreferrer" className={`${button} border border-slate-200 dark:border-white/10`}>Open APSRTC <ExternalLink size={16} /></a>
    </div>
    <div className="adaptive-material rounded-3xl border border-white bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/85 sm:p-7">
      <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 dark:bg-white/8" role="group" aria-label="Live tracking view">
        {[["find", "Find my bus"], ["browse", "Browse all buses"]].map(([value, label]) => <button key={value} type="button" aria-pressed={view === value}
          className={`min-h-11 rounded-xl px-3 text-sm font-bold transition active:scale-[.98] ${view === value ? 'bg-white text-ink shadow-sm dark:bg-white/12' : 'text-muted'}`}
          onClick={() => switchView(value)}>{label}</button>)}
      </div>

      {view === 'find' ? <>
        <div className="mt-5"><h3 className="text-lg font-bold">Where will you board?</h3><p className="mt-1 text-sm leading-relaxed text-muted">Choose a city stop. Your location is not requested, and only buses travelling to Vizag Airport are considered.</p></div>
        <form onSubmit={find}>
          <BoardingStopPicker places={places} value={draftPlaceId} onChange={(value) => { setDraftPlaceId(value); setStopRequest(null); setEnabled(false); setSelected(null); trackedResultRequest.current = ''; }} />
          <button type="submit" disabled={!draftPlaceId || loading} className={`${button} mt-3 w-full bg-brand text-white`}><Radio size={18} />{loading ? 'Checking live buses…' : 'Find buses for this stop'}</button>
        </form>
        <p role="status" aria-live="polite" className="my-4 rounded-xl bg-brand-soft p-3 text-sm leading-relaxed">{findStatus}</p>
        {selectedStop && UNMAPPED_STOP_SEGMENTS[selectedStop.placeId] && <p className="mb-4 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200"><CircleAlert className="mt-0.5 shrink-0" size={17} />APSRTC does not publish this stop as a waypoint. Results use only the confirmed stops on either side and may show uncertain progress.</p>}
        {snapshot && selectedStop && <StopResults snapshot={snapshot} now={now} selected={selected} onSelect={onSelect} stop={selectedStop} />}
      </> : <>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-sm leading-relaxed text-muted">Browse actual APSRTC GPS readings in either direction. No movement is predicted or simulated.</p>
          <button type="button" onClick={() => { if (!enabled) trackEvent('live_tracking_opened', { link_type: 'fleet_map' }); setEnabled(!enabled); }} aria-pressed={enabled} className={`${button} bg-brand text-white`}><Radio size={18} />{enabled ? 'Pause tracking' : snapshot ? 'Resume tracking' : 'Start live tracking'}</button>
        </div>
        {(enabled || snapshot) && <>
          <div className="my-5 grid gap-3 sm:grid-cols-3">
            <div className="space-y-2 text-xs font-bold"><label htmlFor="tracking-route">Bus route</label><select id="tracking-route" className={input} value={route} onChange={(event) => setRoute(event.target.value)}><option value="all">All routes</option>{activeCodes.map((code) => <option key={code}>{code}</option>)}</select></div>
            <div className="space-y-2 text-xs font-bold"><label htmlFor="tracking-direction">Direction</label><select id="tracking-direction" className={input} value={direction} onChange={(event) => setDirection(event.target.value)}><option value="all">Both directions</option><option value="to-airport">City → Airport</option><option value="from-airport">Airport → City</option></select></div>
            <div className="space-y-2 text-xs font-bold"><label htmlFor="tracking-vehicle">Vehicle number (optional)</label><input id="tracking-vehicle" className={input} maxLength={20} placeholder="e.g. AP39WU3983" value={search} onChange={(event) => setSearch(event.target.value)} autoComplete="off" spellCheck={false} /></div>
          </div>
          <p role="status" aria-live="polite" className="my-4 rounded-xl bg-brand-soft p-3 text-sm leading-relaxed">{browseStatus}</p>
          <TrackerMap buses={fleetBuses} selected={selected} onSelect={onSelect} />
          <p className="my-3 text-xs leading-relaxed text-muted">Teal: ASR-1 or unconfirmed route · Blue: ASR-2 · Amber: stale position. “Recent” means updated within 2 minutes, not guaranteed movement.</p>
          {snapshot && !fleetBuses.length && <p className="rounded-xl bg-brand-soft p-5 text-sm">No buses are available in this view. This does not mean no buses are running.</p>}
          <ul className="mt-5 grid gap-3 md:grid-cols-2" aria-label="Tracked AeroExpress buses">
            {fleetBuses.map((bus) => <li key={bus.tripId} className={`rounded-2xl border p-4 ${selected === bus.tripId ? 'border-brand' : 'border-slate-200 dark:border-white/10'}`}>
              <div className="flex items-start justify-between gap-2"><div><p className="flex items-center gap-2 font-bold"><BusFront size={18} className="text-brand" />{bus.vehicleNumber}</p><p className="mt-1 text-sm text-muted">{bus.routeCode || 'Route unconfirmed'} · {bus.direction === 'to-airport' ? 'City → Airport' : 'Airport → City'}</p></div>
                <span className={`rounded-lg px-2 py-1 text-xs font-bold ${bus.quality === 'recent' ? 'bg-brand-soft text-brand dark:text-teal-200' : 'bg-amber-100 text-amber-900'}`}>{bus.quality === 'recent' ? 'Recent GPS' : bus.quality === 'stale' ? 'Stale GPS' : 'No GPS'}</span></div>
              <p className="mt-3 text-xs text-muted">{bus.position ? `GPS updated ${gpsAgeLabel(bus.position, now)}` : 'No usable GPS position for this trip.'}</p>
              <BusPositionActions bus={bus} onSelect={onSelect} />
            </li>)}
          </ul>
        </>}
      </>}
      <p className="mt-5 text-xs leading-relaxed text-muted">Experimental, unofficial integration; not an APSRTC partnership. The undocumented feed can change or stop working. No ETA or arrival guarantee is generated—please reach your stop early.</p>
    </div>
  </section>;
}
