import { Check, CircleAlert } from 'lucide-react';
import { formatDate } from '../lib/format.js';

export default function StatusNotice({ status }) {
  if (!status || status.announcementVisible === false) return null;

  return (
    <div className="mx-auto mt-3 flex max-w-[73rem] items-center gap-3 rounded-2xl border border-amber-700/15 bg-amber-50 px-4 py-3 text-amber-950 max-xl:mx-4" role="status">
      <CircleAlert size={18} className="shrink-0" />
      <p className="flex flex-1 items-center gap-2 text-xs leading-relaxed max-md:grid"><strong>New service notice</strong><span className="text-amber-800">{status.announcement}</span></p>
      <span className="flex items-center gap-1 text-[.7rem] font-semibold max-md:hidden"><Check size={14} /> Checked {formatDate(status.verifiedDate)}</span>
    </div>
  );
}
