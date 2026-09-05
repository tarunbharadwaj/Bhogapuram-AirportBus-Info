const SITE_URL = 'https://www.vizagairportbus.com';

const pageMetadata = {
	'/': {
		title: 'Vizag Airport Bus Timings, Routes & Fares | Bhogapuram',
		description:
			'Check AeroExpress bus timings to and from Bhogapuram Airport, ASR-1 and ASR-2 routes, stops, fares, map links and flight-aware planning from Vizag.',
		openGraphTitle: 'Vizag to Bhogapuram Airport Bus Planner',
		openGraphDescription:
			'AeroExpress timings, routes, stops, fares and flight-aware bus recommendations for Bhogapuram Airport.',
		url: `${SITE_URL}/`,
		robots: 'index, follow'
	},
	'/bhogapuram-airport-bus': {
		title: 'Vizag to Bhogapuram Airport Bus | AeroExpress Guide',
		description: 'Plan a Vizag to Bhogapuram Airport AeroExpress bus trip. Compare ASR-1 and ASR-2 timings, stops, fares, maps and airport-to-city departures.',
		openGraphTitle: 'Vizag to Bhogapuram Airport Bus',
		openGraphDescription: 'Current AeroExpress routes, timings, stops and fares between Visakhapatnam and Bhogapuram Airport.',
		url: `${SITE_URL}/bhogapuram-airport-bus/`,
		robots: 'index, follow'
	},
	'/vizag-airport-bus-timings': {
		title: 'Vizag Airport Bus Timings | Bhogapuram AeroExpress',
		description: 'See current Vizag and Bhogapuram Airport bus timings in both directions for the ASR-1 and ASR-2 AeroExpress routes.',
		openGraphTitle: 'Vizag Airport Bus Timings',
		openGraphDescription: 'Published AeroExpress departures from Vizag to Bhogapuram Airport and from the airport to the city.',
		url: `${SITE_URL}/vizag-airport-bus-timings/`,
		robots: 'index, follow'
	},
	'/bhogapuram-airport-bus-routes': {
		title: 'Bhogapuram Airport Bus Routes | ASR-1 & ASR-2',
		description: 'Compare ASR-1 and ASR-2 AeroExpress routes from Vizag to Bhogapuram Airport, including every boarding stop and Google Maps link.',
		openGraphTitle: 'Bhogapuram Airport Bus Routes',
		openGraphDescription: 'ASR-1 and ASR-2 route details, boarding points and maps.',
		url: `${SITE_URL}/bhogapuram-airport-bus-routes/`,
		robots: 'index, follow'
	},
	'/bhogapuram-airport-bus-fares': {
		title: 'Bhogapuram Airport Bus Fares | AeroExpress Prices',
		description: 'Check AeroExpress fares from Vizag boarding points to Bhogapuram Airport for the ASR-1 and ASR-2 routes.',
		openGraphTitle: 'Bhogapuram Airport Bus Fares',
		openGraphDescription: 'Stop-by-stop AeroExpress fares for travel to Bhogapuram Airport.',
		url: `${SITE_URL}/bhogapuram-airport-bus-fares/`,
		robots: 'index, follow'
	},
	'/vizag-airport-bus-stops': {
		title: 'Vizag Airport Bus Stops & Boarding Points | Maps',
		description: 'Find Vizag AeroExpress boarding stops for Bhogapuram Airport with landmarks, route numbers, fares and direct Google Maps links.',
		openGraphTitle: 'Vizag Airport Bus Stops',
		openGraphDescription: 'AeroExpress boarding points, landmarks, routes, fares and map links.',
		url: `${SITE_URL}/vizag-airport-bus-stops/`,
		robots: 'index, follow'
	},
	'/routes/asr-1': {
		title: 'ASR-1 Bus Timings, Stops & Fares | Vizag Airport',
		description: 'Check ASR-1 AeroExpress bus timings, stops, fares and map links from Old Gajuwaka via NAD and Zoo Park to Bhogapuram Airport.',
		openGraphTitle: 'ASR-1 Vizag Airport Bus Route',
		openGraphDescription: 'ASR-1 AeroExpress timings, stops and fares to and from Bhogapuram Airport.',
		url: `${SITE_URL}/routes/asr-1/`,
		robots: 'index, follow'
	},
	'/routes/asr-2': {
		title: 'ASR-2 Bus Timings, Stops & Fares | Vizag Airport',
		description: 'Check ASR-2 AeroExpress bus timings, stops, fares and maps from Old Gajuwaka via Scindia, Siripuram and IT Hills to Bhogapuram Airport.',
		openGraphTitle: 'ASR-2 Vizag Airport Bus Route',
		openGraphDescription: 'ASR-2 AeroExpress timings, stops and fares to and from Bhogapuram Airport.',
		url: `${SITE_URL}/routes/asr-2/`,
		robots: 'index, follow'
	},
	'/feedback': {
		title: 'Feedback | Vizag Airport Bus Info',
		description:
			'Share feedback, suggestions or complaints to help improve the Vizag Airport bus planner.',
		openGraphTitle: 'Feedback | Vizag Airport Bus Info',
		openGraphDescription:
			'Share feedback and help improve the Vizag Airport bus planner.',
		url: `${SITE_URL}/feedback`,
		robots: 'index, follow'
	},
	'/service-admin': {
		title: 'Service Admin | Vizag Airport Bus Info',
		description: 'Service administration page.',
		openGraphTitle: 'Service Admin | Vizag Airport Bus Info',
		openGraphDescription: 'Service administration page.',
		url: `${SITE_URL}/service-admin`,
		robots: 'noindex, nofollow, noarchive'
	}
};

const normalizedPath = (pathname) => pathname.replace(/\/+$/, '') || '/';

export const getPageMetadata = (pathname) =>
	pageMetadata[normalizedPath(pathname)] || pageMetadata['/'];

const setMeta = (selector, attribute, value) => {
	const element = document.head.querySelector(selector);
	if (element) element.setAttribute(attribute, value);
};

export const applyPageMetadata = (pathname = window.location.pathname) => {
	const metadata = getPageMetadata(pathname);
	document.title = metadata.title;
	setMeta('meta[name="description"]', 'content', metadata.description);
	setMeta('meta[name="robots"]', 'content', metadata.robots);
	setMeta('meta[property="og:title"]', 'content', metadata.openGraphTitle);
	setMeta(
		'meta[property="og:description"]',
		'content',
		metadata.openGraphDescription
	);
	setMeta('meta[property="og:url"]', 'content', metadata.url);
	setMeta('link[rel="canonical"]', 'href', metadata.url);
};
