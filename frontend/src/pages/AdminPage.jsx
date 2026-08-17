import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, LockKeyhole, Settings2 } from 'lucide-react';
import { useState } from 'react';
import Brand from '../components/Brand.jsx';
import { api } from '../lib/api.js';

const fieldClass = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand/60 focus:ring-3 focus:ring-brand/10';

export default function AdminPage({ service, onSaved }) {
  const [pin, setPin] = useState('');
  const [token, setToken] = useState('');
  const [draft, setDraft] = useState(structuredClone(service));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const login = async (event) => {
    event.preventDefault(); setError('');
    try { const result = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ pin }) }); setToken(result.token); setDraft(result.service); }
    catch (err) { setError(err.message); }
  };
  const updateRoute = (routeIndex, field, value) => setDraft((current) => {
    const next = structuredClone(current);
    if (field === 'enabled') next.routes[routeIndex].enabled = value;
    else next.routes[routeIndex].schedule[field] = value;
    return next;
  });
  const updateFare = (routeIndex, stopIndex, value) => setDraft((current) => {
    const next = structuredClone(current); next.routes[routeIndex].stops[stopIndex].fare = Number(value); return next;
  });
  const save = async () => {
    setSaving(true); setError('');
    try { const result = await api('/api/admin/service', { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(draft) }); setDraft(result); onSaved(result); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-[#f3f6f7]">
      <header className="mx-auto flex h-20 max-w-5xl items-center justify-between px-5"><Brand /><a href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted no-underline hover:bg-white"><ArrowLeft size={17} /> Back to website</a></header>
      {!token ? <main className="mx-auto mt-12 max-w-sm rounded-3xl border border-white bg-white/90 p-8 text-center shadow-[0_22px_60px_rgba(20,43,56,.11)] backdrop-blur-xl">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand"><LockKeyhole size={27} /></span><h1 className="mt-5 text-2xl font-bold tracking-tight">Service admin</h1><p className="mt-2 text-sm leading-relaxed text-muted">Enter the service PIN to update schedules, fares and alerts.</p>
        <form className="mt-6 text-left" onSubmit={login}><label className="text-xs font-bold text-slate-600">Admin PIN<input className={fieldClass} type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="••••" autoFocus /></label>{error && <p className="mt-3 flex items-center gap-2 text-xs text-red-700"><CircleAlert size={15} /> {error}</p>}<button className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-bold text-white transition active:scale-[.98]">Continue <ArrowRight size={18} /></button></form>
        <small className="mt-3 block text-[.62rem] text-slate-400">MVP demo PIN: 2468 · Set ADMIN_PIN in production.</small>
      </main> : <main className="mx-auto max-w-5xl px-5 pb-16">
        <div className="mb-8 flex items-end justify-between"><div><span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.12em] text-brand"><Settings2 size={15} /> Service management</span><h1 className="mt-3 text-4xl font-bold tracking-tight">Public journey data</h1><p className="mt-2 text-sm text-muted">Saved changes are immediately available through the API.</p></div><span className="flex items-center gap-2 rounded-full bg-brand-soft px-3 py-2 text-xs font-bold text-brand"><i className="size-2 rounded-full bg-brand" /> Public</span></div>
        <section className="rounded-3xl border border-white bg-white/80 p-6 shadow-xl shadow-slate-900/5"><div className="grid grid-cols-[12rem_1fr] gap-4 max-md:grid-cols-1"><label className="text-xs font-bold text-muted">Verified date<input className={fieldClass} type="date" value={draft.status.verifiedDate} onChange={(event) => setDraft({ ...draft, status: { ...draft.status, verifiedDate: event.target.value } })} /></label><label className="text-xs font-bold text-muted">Public announcement<textarea className={fieldClass} rows="3" value={draft.status.announcement} onChange={(event) => setDraft({ ...draft, status: { ...draft.status, announcement: event.target.value } })} /></label></div></section>
        {draft.routes.map((route, routeIndex) => <details className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white" key={route.id} open={routeIndex === 0}><summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-3 p-4"><span className="rounded-lg px-3 py-2 text-xs font-extrabold tracking-wide text-white" style={{ background: route.color }}>{route.code}</span><span className="grid"><strong className="text-sm">{route.name}</strong><small className="text-[.65rem] text-slate-400">{route.stops.length} stops</small></span><ChevronDown size={18} /></summary><div className="border-t border-slate-200 p-5">
          <label className="flex items-center justify-between"><span className="grid"><strong className="text-sm">Route operating</strong><small className="mt-1 text-[.65rem] text-slate-400">Turn off during a service suspension</small></span><input className="size-5 accent-brand" type="checkbox" checked={route.enabled} onChange={(event) => updateRoute(routeIndex, 'enabled', event.target.checked)} /></label>
          <div className="mt-5 grid grid-cols-3 gap-3 max-md:grid-cols-1">{[['start', 'First bus', 'time'], ['end', 'Last bus', 'time'], ['frequency', 'Frequency (min)', 'number']].map(([field, label, type]) => <label key={field} className="text-xs font-bold text-muted">{label}<input className={fieldClass} type={type} min={type === 'number' ? 10 : undefined} max={type === 'number' ? 180 : undefined} value={route.schedule[field]} onChange={(event) => updateRoute(routeIndex, field, type === 'number' ? Number(event.target.value) : event.target.value)} /></label>)}</div>
          <div className="mt-6"><h2 className="text-xs font-bold text-muted">Stop fares</h2>{route.stops.map((stop, stopIndex) => <label key={stop.id} className="flex min-h-12 items-center justify-between border-b border-slate-100 text-sm"><span>{stop.name}</span><span className="flex items-center gap-2 text-muted">₹ <input className="w-20 rounded-lg border border-slate-200 p-2 text-right text-sm text-ink" type="number" min="0" step="10" value={stop.fare} onChange={(event) => updateFare(routeIndex, stopIndex, event.target.value)} /></span></label>)}</div>
        </div></details>)}
        {error && <p className="mt-4 flex items-center gap-2 text-sm text-red-700"><CircleAlert size={16} /> {error}</p>}
        <div className="sticky bottom-4 mt-6 flex justify-end"><button className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 font-bold text-white shadow-xl shadow-brand/20 transition active:scale-[.98] disabled:opacity-60" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'} <Check size={18} /></button></div>
      </main>}
    </div>
  );
}
