import { BusFront } from 'lucide-react';
import { trackEvent } from '../lib/analytics.js';

export default function LiveBusMapLink({ className = '', source, onClick }) {
	return (
		<a
			href="#live-tracking"
			className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
			onClick={(event) => {
				if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
				trackEvent('live_tracking_opened', {
					link_type: 'reclaim_airport_map',
					request_source: source
				});
				onClick?.();
			}}
		>
			<BusFront size={17} aria-hidden="true" className="shrink-0" />
			View live buses
		</a>
	);
}
