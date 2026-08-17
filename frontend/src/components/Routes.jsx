import { ArrowRight, ExternalLink, Plane } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDuration, mapsLink } from '../lib/format.js';

export default function Routes({ service }) {
  const [selected, setSelected] = useState(service.routes[0].id);
  const route = service.routes.find((item) => item.id === selected) || service.routes[0];
  const routeMapsUrl = useMemo(() => {
    const origin = `${route.stops[0].lat},${route.stops[0].lng}`;
    const destination = `${service.airport.lat},${service.airport.lng}`;
    const waypoints = route.stops.slice(1).map((stop) => `${stop.lat},${stop.lng}`).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
  }, [route, service.airport]);

  return (
    <section className="mx-auto max-w-7xl scroll-mt-20 px-6 pt-28 max-md:px-4 max-md:pt-20" id="routes">
      <div className="mb-8 flex items-end justify-between gap-8 max-md:block"><div><span className="text-xs font-extrabold uppercase tracking-[.12em] text-brand">Routes & boarding points</span><h2 className="mt-3 text-[clamp(2rem,4vw,3.15rem)] font-bold leading-none tracking-[-.045em]">Two clear ways to the airport.</h2></div><p className="max-w-md text-sm leading-relaxed text-muted max-md:mt-4">Tap any stop for its exact map location and landmark.</p></div>
      <div className="mb-4 grid grid-cols-2 gap-3 max-md:grid-cols-1">{service.routes.map((item) => <button key={item.id} onClick={() => setSelected(item.id)} className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[.99] ${selected === item.id ? 'border-brand/35 bg-white shadow-lg shadow-slate-900/5 dark:bg-white/10' : 'border-slate-200 bg-white/60 dark:border-white/10 dark:bg-white/4'}`}><span className="rounded-lg px-3 py-2 text-xs font-extrabold tracking-wide text-white" style={{ background: item.color }}>{item.code}</span><span className="grid gap-1"><strong className="text-sm">{item.name}</strong><small className="text-[.68rem] text-muted">{item.description}</small></span><ArrowRight size={18} /></button>)}</div>
      <div className="min-h-[36rem] overflow-hidden rounded-3xl border border-white bg-white shadow-[0_18px_55px_rgba(22,44,58,.08)] transition-colors duration-300 dark:border-white/10 dark:bg-slate-900 dark:shadow-[0_20px_55px_rgba(0,0,0,.28)]">
        <div className="p-6 max-md:p-4">
          <div className="flex min-h-14 items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-white/10"><div className="flex items-center gap-3"><span className="rounded-lg px-3 py-2 text-xs font-extrabold tracking-wide text-white" style={{ background: route.color }}>{route.code}</span><h3 className="font-bold">{route.name}</h3></div><a className="flex items-center gap-1 text-xs font-bold text-brand" href={routeMapsUrl} target="_blank" rel="noreferrer">Open route in Maps <ExternalLink size={14} /></a></div>
          <div className="pt-2">{route.stops.map((stop, index) => <a href={mapsLink(stop.lat, stop.lng)} target="_blank" rel="noreferrer" className="relative grid min-h-16 grid-cols-[2rem_1fr_auto_1rem] items-center gap-3 no-underline after:absolute after:top-12 after:bottom-[-1rem] after:left-[.9rem] after:w-px after:bg-slate-200 dark:after:bg-white/10 last:after:hidden" key={stop.id}><span className="relative z-10 flex size-7 items-center justify-center rounded-full border-2 bg-white text-[.62rem] font-extrabold text-muted dark:bg-slate-900" style={{ borderColor: route.color }}>{index + 1}</span><span className="grid gap-1"><strong className="text-sm">{stop.name}</strong><small className="text-[.65rem] text-slate-400">{stop.landmark}</small></span><span className="grid text-right"><strong className="text-sm">₹{stop.fare}</strong><small className="text-[.65rem] text-slate-400">~{formatDuration(stop.journeyMinutes)}</small></span><ExternalLink size={14} className="text-slate-400" /></a>)}
            <div className="grid min-h-16 grid-cols-[2rem_1fr_auto] items-center gap-3"><span className="relative z-10 flex size-7 items-center justify-center rounded-full bg-ink text-white"><Plane size={13} /></span><span className="grid gap-1"><strong className="text-sm">Bhogapuram Airport</strong><small className="text-[.65rem] text-slate-400">Departures terminal</small></span><strong className="text-sm">Arrive</strong></div>
          </div>
        </div>
      </div>
    </section>
  );
}
