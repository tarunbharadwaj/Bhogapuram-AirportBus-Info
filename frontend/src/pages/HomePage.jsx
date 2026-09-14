import Header from '../components/Header.jsx';
import Planner from '../components/Planner.jsx';
import Routes from '../components/Routes.jsx';
import {
	Confidence,
	FAQ,
	Footer,
	QuickFacts
} from '../components/SiteSections.jsx';
import StatusNotice from '../components/StatusNotice.jsx';
import Timetable from '../components/Timetable.jsx';
import LiveTracking from '../components/LiveTracking.jsx';
import { useState } from 'react';

export default function HomePage({ service, backendReady }) {
	const [trackingSelection, setTrackingSelection] = useState(null);
	const openTracking = (selection) => {
		setTrackingSelection({ ...selection, requestId: Date.now() });
		requestAnimationFrame(() => document.getElementById('live-tracking')?.scrollIntoView({
			behavior: 'smooth', block: 'start'
		}));
	};
	return (
		<div id="top">
			<Header />
			<main className="overflow-hidden">
				{/* <StatusNotice status={service.status} /> */}
				<Planner service={service} backendReady={backendReady} onTrackBus={openTracking} />
				{/* <QuickFacts service={service} /> */}
				<Timetable service={service} />
				<LiveTracking service={service} requestedSelection={trackingSelection} />
				<Routes service={service} />
				<FAQ ticketing={service.ticketing} />
				<Confidence />
			</main>
			<Footer ticketing={service.ticketing} />
		</div>
	);
}
