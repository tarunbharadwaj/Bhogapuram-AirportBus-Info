import Header from '../components/Header.jsx';
import Planner from '../components/Planner.jsx';
import Routes from '../components/Routes.jsx';
import { Confidence, Footer, QuickFacts } from '../components/SiteSections.jsx';
import StatusNotice from '../components/StatusNotice.jsx';
import Timetable from '../components/Timetable.jsx';

export default function HomePage({ service }) {
  return <div id="top"><Header /><main className="overflow-hidden"><StatusNotice status={service.status} /><Planner service={service} /><QuickFacts service={service} /><Timetable service={service} /><Routes service={service} /><Confidence /></main><Footer /></div>;
}
