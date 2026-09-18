const SITE_URL = 'https://www.vizagairportbus.com';

const pageMetadata = {
	'/': {
		title: 'Vizag Airport Bus Info',
		description:
			'Find the right AeroExpress bus from Visakhapatnam to Vizag Airport based on where you are and when your flight leaves.',
		openGraphTitle: 'Vizag Airport Bus Planner',
		openGraphDescription:
			'Timings, stops, fares and flight-aware AeroExpress bus recommendations.',
		url: `${SITE_URL}/`,
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
	},
	'/journey': {
		title: 'Onboard Journey Companion | Vizag Airport Bus Info',
		description:
			'Follow AeroExpress stops during your journey to Vizag Airport and continue navigation in Google Maps.',
		openGraphTitle: 'Onboard Journey Companion | Vizag Airport Bus Info',
		openGraphDescription:
			'Follow your AeroExpress route stops on the way to Vizag Airport.',
		url: `${SITE_URL}/journey`,
		robots: 'noindex, follow'
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
