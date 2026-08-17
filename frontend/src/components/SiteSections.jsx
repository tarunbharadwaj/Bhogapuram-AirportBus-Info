import { BadgeIndianRupee, BusFront, Clock3, ExternalLink, Map, Route, Send, ShieldCheck } from 'lucide-react';
import Brand from './Brand.jsx';

export function QuickFacts({ service }) {
  const minFare = Math.min(...service.routes.flatMap((route) => route.stops.map((stop) => stop.fare)));
  const facts = [[Clock3, 'Service window', '4:30 AM – 10:30 PM'], [Route, 'AeroExpress routes', 'ASR-1 & ASR-2'], [BadgeIndianRupee, 'Reference fare', `From ₹${minFare}`]];
  return <section className="adaptive-material mx-auto mt-4 grid max-w-[73rem] grid-cols-3 rounded-2xl border border-white bg-white/70 p-3 shadow-lg shadow-slate-900/5 backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-white/5 max-xl:mx-4 max-md:grid-cols-1">{facts.map(([Icon, label, value]) => <div key={label} className="flex min-h-18 items-center justify-center gap-3 border-r border-slate-200 last:border-0 dark:border-white/10 max-md:justify-start max-md:border-r-0 max-md:border-b max-md:px-4"><span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon size={20} /></span><p className="grid gap-1"><small className="text-[.65rem] text-slate-400">{label}</small><strong className="text-sm">{value}</strong></p></div>)}</section>;
}

export function Confidence() {
  const items = [[ShieldCheck, 'Plan with a safety margin', 'Recommendations include flight and traffic buffers.'], [Map, 'Find the exact stop', 'Each boarding point has a landmark and Google Maps link.'], [Send, 'Share the whole plan', 'Send the route, stop, bus time, ETA and fare on WhatsApp.']];
  return <section className="mx-auto my-28 grid max-w-[73rem] grid-cols-3 gap-4 max-xl:mx-4 max-md:my-20 max-md:grid-cols-1">{items.map(([Icon, title, copy]) => <div key={title} className="rounded-2xl border border-white bg-white/65 p-6 transition-colors duration-300 dark:border-white/10 dark:bg-white/5"><span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon size={20} /></span><h3 className="mt-4 text-sm font-bold">{title}</h3><p className="mt-2 text-xs leading-relaxed text-muted">{copy}</p></div>)}</section>;
}

export function Footer() {
  return <footer className="mx-auto mb-8 grid max-w-[73rem] grid-cols-[1fr_auto] gap-8 border-t border-slate-200 py-8 dark:border-white/10 max-xl:mx-4 max-md:grid-cols-1"><div className="flex items-center gap-3"><Brand compact /><div><strong className="text-sm">Bhogapuram Airport Bus Info</strong><p className="mt-1 text-[.68rem] text-muted">Making your next trip to Bhogapuram Airport easier.</p></div></div><div className="flex gap-4 text-xs font-semibold text-muted"><a className="flex items-center gap-1" href="https://www.apsrtc.ap.gov.in/" target="_blank" rel="noreferrer">APSRTC <ExternalLink size={12} /></a><a className="flex items-center gap-1" href="https://gmraero.com/visakhapatnam-airport.aspx" target="_blank" rel="noreferrer">Airport information <ExternalLink size={12} /></a></div><p className="col-span-full text-[.62rem] leading-relaxed text-slate-400">This is an independent information tool, not an official APSRTC booking service. Confirm newly launched service timings before leaving.</p></footer>;
}

export function LoadingScreen({ error }) {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted"><span className="flex size-12 items-center justify-center rounded-2xl bg-brand text-white"><BusFront size={23} /></span>{error ? <><h1 className="text-xl font-bold text-ink">Couldn’t load service data</h1><p className="text-sm">{error}</p></> : <p className="text-sm">Loading AeroExpress data…</p>}</main>;
}
