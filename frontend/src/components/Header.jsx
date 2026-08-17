import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import Brand from './Brand.jsx';

export default function Header() {
  const [open, setOpen] = useState(false);
  const navigate = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setOpen(false); };
  const navClass = `max-md:absolute max-md:top-16 max-md:left-4 max-md:right-4 max-md:grid max-md:rounded-2xl max-md:border max-md:border-white max-md:bg-white/95 max-md:p-2 max-md:shadow-2xl max-md:backdrop-blur-xl ${open ? 'max-md:opacity-100' : 'max-md:pointer-events-none max-md:-translate-y-2 max-md:opacity-0'} flex items-center gap-1 transition`;
  return (
    <header className="sticky top-0 z-50 mx-auto flex h-19 max-w-7xl items-center justify-between bg-[#f3f6f7]/80 px-6 backdrop-blur-xl max-md:h-16 max-md:px-4">
      <Brand />
      <button className="hidden size-10 items-center justify-center rounded-xl border border-slate-200 bg-white max-md:flex" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X size={20} /> : <Menu size={20} />}</button>
      <nav className={navClass} aria-label="Main navigation">
        {['Plan a trip', 'Timetables', 'Routes & stops'].map((label, index) => <button key={label} className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-white max-md:text-left" onClick={() => navigate(['planner', 'timetables', 'routes'][index])}>{label}</button>)}
      </nav>
    </header>
  );
}
