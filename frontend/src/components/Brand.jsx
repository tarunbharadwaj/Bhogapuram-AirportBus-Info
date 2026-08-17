import { BusFront } from 'lucide-react';

export default function Brand({ compact = false }) {
  return (
    <a href="/" className="relative z-10 inline-flex items-center gap-3 no-underline">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0b9189] to-[#07655f] text-white shadow-[inset_0_1px_rgba(255,255,255,.35),0_5px_14px_rgba(8,127,120,.2)]"><BusFront size={20} strokeWidth={2.4} /></span>
      {!compact && <span className="grid leading-none"><strong className="text-[.97rem] tracking-[-.02em]">Bhogapuram</strong><small className="mt-1 text-[.62rem] font-bold uppercase tracking-[.13em] text-muted">Airport Bus</small></span>}
    </a>
  );
}
