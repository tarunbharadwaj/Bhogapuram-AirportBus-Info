const SITE_URL = 'https://www.vizagairportbus.com';

const pageMetadata = {
	'/': {
		title: 'Bhogapuram Airport Bus Info',
		description:
			'Find the right AeroExpress bus from Visakhapatnam to Bhogapuram Airport based on where you are and when your flight leaves.',
		openGraphTitle: 'Bhogapuram Airport Bus Planner',
		openGraphDescription:
			'Timings, stops, fares and flight-aware AeroExpress bus recommendations.',
		url: `${SITE_URL}/`,
		robots: 'index, follow'
	},
	'/feedback': {
		title: 'Feedback | Bhogapuram Airport Bus Info',
		description:
			'Share feedback, suggestions or complaints to help improve the Vizag and Bhogapuram Airport bus planner.',
		openGraphTitle: 'Feedback | Bhogapuram Airport Bus Info',
		openGraphDescription:
			'Share feedback and help improve the Vizag and Bhogapuram Airport bus planner.',
		url: `${SITE_URL}/feedback`,
		robots: 'index, follow'
	},
	'/service-admin': {
		title: 'Service Admin | Bhogapuram Airport Bus Info',
		description: 'Service administration page.',
		openGraphTitle: 'Service Admin | Bhogapuram Airport Bus Info',
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
