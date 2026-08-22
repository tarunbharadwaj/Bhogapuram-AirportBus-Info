const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
const isAdminPage = () => /^\/service-admin(?:\/|$)/.test(window.location.pathname);

const allowedEvents = new Set([
	'location_requested',
	'location_permission_result',
	'location_captured',
	'plan_generated',
	'no_safe_bus_found',
	'route_viewed',
	'timetable_viewed',
	'boarding_map_opened',
	'whatsapp_shared',
	'feedback_submitted'
]);

const allowedParameters = new Set([
	'permission_result',
	'request_source',
	'accuracy_band',
	'route_code',
	'stop_id',
	'flight_type',
	'direction',
	'map_type',
	'feedback_type'
]);

let initialized = false;

const validMeasurementId = () => /^G-[A-Z0-9]+$/i.test(measurementId || '');

export const initializeAnalytics = () => {
	if (initialized || isAdminPage() || !validMeasurementId()) return false;

	window.dataLayer = window.dataLayer || [];
	window.gtag =
		window.gtag ||
		function gtag() {
			window.dataLayer.push(arguments);
		};
	window.gtag('js', new Date());
	window.gtag('config', measurementId, { send_page_view: true });

	if (!document.querySelector(`script[data-ga4-id="${measurementId}"]`)) {
		const script = document.createElement('script');
		script.async = true;
		script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
		script.dataset.ga4Id = measurementId;
		document.head.append(script);
	}

	initialized = true;
	return true;
};

export const trackEvent = (eventName, parameters = {}) => {
	if (!initialized || isAdminPage() || !allowedEvents.has(eventName)) return;

	const safeParameters = Object.fromEntries(
		Object.entries(parameters)
			.filter(
				([key, value]) =>
					allowedParameters.has(key) &&
					['string', 'number', 'boolean'].includes(typeof value)
			)
			.map(([key, value]) => [
				key,
				typeof value === 'string' ? value.slice(0, 100) : value
			])
	);

	window.gtag?.('event', eventName, safeParameters);
};
