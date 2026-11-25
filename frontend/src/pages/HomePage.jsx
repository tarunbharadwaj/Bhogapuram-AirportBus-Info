import { useState } from 'react';
import Header from '../components/Header.jsx';
import LiveTracking from '../components/LiveTracking.jsx';
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

export default function HomePage({ service, backendReady }) {
	const [trackingSelection, setTrackingSelection] = useState(null);
	return (
		<div id="top">
			<Header />
			<main className="overflow-hidden">
				{/* <StatusNotice status={service.status} /> */}
				<Planner service={service} backendReady={backendReady} onTrack={setTrackingSelection} />
				{/* <QuickFacts service={service} /> */}
				<Timetable service={service} onTrack={setTrackingSelection} />
				<LiveTracking service={service} requestedSelection={trackingSelection} />
				<Routes service={service} />
				<FAQ
					ticketing={service.ticketing}
					monthlyPasses={service.monthlyPasses}
				/>
				<Confidence />
			</main>
			<Footer />
		</div>
	);
}
