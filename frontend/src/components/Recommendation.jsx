import { BadgeIndianRupee, Check, CircleAlert, Clock3, Luggage, MapPin, Send } from 'lucide-react';
import { formatDate, formatDuration, formatTime, mapsLink } from '../lib/format.js';

export default function Recommendation({ result, verifiedDate }) {
  if (!result.best) return (
    <article id="recommendation" className="col-span-full flex gap-4 rounded-3xl bg-[#463026] p-6 text-white shadow-xl motion-safe:animate-[pulse_.35s_ease-out_1]">
      <CircleAlert size={26} /><div><span className="text-xs font-extrabold uppercase tracking-widest text-amber-200">No safe bus found</span><h2 className="mt-1 text-xl font-bold">Consider an earlier day or another ride.</h2><p className="mt-1 text-sm text-amber-100/80">{result.warning}</p></div>
    </article>
  );

  const share = () => {
    const text = `Bhogapuram Airport Bus\n${result.best.routeCode} from ${result.best.stopName}\nLeave home: ${formatTime(result.leaveHomeTime)}\nBus: ${formatTime(result.best.departureTime)}\nAirport ETA: ${formatTime(result.best.airportArrivalTime)}\nFare: ₹${result.best.fare}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const milestones = [
    ['Leave home', formatTime(result.leaveHomeTime)],
    ['Board bus', formatTime(result.best.departureTime)],
    ['Airport ETA', formatTime(result.best.airportArrivalTime)],
  ];
  const details = [
    [BadgeIndianRupee, 'Estimated fare', `₹${result.best.fare}`],
    [Clock3, 'Be at airport by', formatTime(result.airportBy)],
    [Luggage, 'Flight buffer', formatDuration(result.terminalBuffer + result.extraBuffer)],
  ];

  return (
    <article id="recommendation" className="col-span-full rounded-3xl bg-[#122c2b] p-7 text-white shadow-[0_20px_50px_rgba(15,46,44,.2)] max-md:p-5">
      <div className="flex items-center justify-between text-[.68rem] text-teal-100/65"><span className="flex items-center gap-1 font-extrabold uppercase tracking-widest text-teal-200"><Check size={14} /> Best option</span><span>Reference schedule · {formatDate(verifiedDate)}</span></div>
      <div className="mt-5 flex items-start gap-4"><span className="rounded-lg bg-brand px-3 py-2 text-xs font-extrabold tracking-wide">{result.best.routeCode}</span><div><h2 className="text-xl font-bold tracking-tight">AeroExpress from {result.best.stopName}</h2><p className="mt-1 text-xs text-teal-100/60">{result.nearestStop.distanceKm} km away · {result.best.landmark}</p></div></div>
      <div className="my-6 grid grid-cols-3 items-center gap-3">
        {milestones.map(([label, value], index) => <div key={label} className={index === 1 ? 'text-center' : index === 2 ? 'text-right' : ''}><span className="block text-[.64rem] text-teal-100/55">{label}</span><strong className="mt-1 block text-base">{value}</strong></div>)}
      </div>
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">{details.map(([Icon, label, value]) => <div key={label} className="flex items-center gap-3 rounded-2xl bg-white/6 p-4 text-teal-200"><Icon size={18} /><span className="grid text-[.64rem] text-teal-100/55">{label}<strong className="mt-1 text-xs text-white">{value}</strong></span></div>)}</div>
      {result.next && !result.isNextSafe && <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200"><CircleAlert size={16} /> The {formatTime(result.next.departureTime)} bus may miss your safety window.</p>}
      <div className="mt-4 grid grid-cols-2 gap-3 max-md:grid-cols-1"><a className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-bold text-slate-700 transition active:scale-[.98]" href={mapsLink(result.nearestStop.lat, result.nearestStop.lng)} target="_blank" rel="noreferrer"><MapPin size={17} /> Boarding point</a><button className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 font-bold text-teal-50 transition active:scale-[.98]" onClick={share}><Send size={17} /> Share on WhatsApp</button></div>
      {result.earlier && <p className="mt-3 text-center text-[.68rem] text-teal-100/55">Want more margin? The previous bus leaves at <strong>{formatTime(result.earlier.departureTime)}</strong>.</p>}
    </article>
  );
}
