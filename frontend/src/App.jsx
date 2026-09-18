import { useEffect, useState } from 'react';
import { api } from './lib/api.js';
import AdminPage from './pages/AdminPage.jsx';
import FeedbackPage from './pages/FeedbackPage.jsx';
import HomePage from './pages/HomePage.jsx';
import { LoadingScreen } from './components/SiteSections.jsx';
import { FALLBACK_SERVICE } from './data/fallbackService.js';

const SERVICE_CACHE_KEY = 'bhogapuram-service-cache-v6';
const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
const isAdminPage = currentPath === '/service-admin';
const isFeedbackPage = currentPath === '/feedback';

const isServiceData = (value) =>
	Boolean(
		Number(value?.schemaVersion) >= 2 &&
			value?.status &&
			value?.airport &&
			Array.isArray(value.routes) &&
			value.routes.length &&
			Array.isArray(value.locations)
	);

const withServiceDefaults = (value) => ({
	...value,
	ticketing: {
		...FALLBACK_SERVICE.ticketing,
		...(value?.ticketing || {})
	}
});

const initialPublicService = () => {
	try {
		const cached = JSON.parse(localStorage.getItem(SERVICE_CACHE_KEY));
		if (isServiceData(cached)) return withServiceDefaults(cached);
	} catch {
		// A bad or unavailable cache should never delay the public page.
	}
	return FALLBACK_SERVICE;
};

export default function App() {
	const [service, setService] = useState(() =>
		isAdminPage || isFeedbackPage ? null : initialPublicService()
	);
	const [backendReady, setBackendReady] = useState(false);
	const [error, setError] = useState('');
	useEffect(() => {
		if (isFeedbackPage) return undefined;

		let cancelled = false;
		const retryDelays = [0, 3000, 7000, 15000, 30000];
		const wait = (milliseconds) =>
			new Promise((resolve) => window.setTimeout(resolve, milliseconds));

		const loadLiveService = async () => {
			let lastError;
			for (const delay of retryDelays) {
				if (delay) await wait(delay);
				if (cancelled) return;
				try {
					const result = await api('/api/service');
					if (!isServiceData(result)) {
						throw new Error(
							'The backend returned incomplete service data. Check the deployed API and its storage configuration.'
						);
					}
					if (cancelled) return;
					const hydratedResult = withServiceDefaults(result);
					setService(hydratedResult);
					setBackendReady(true);
					try {
						localStorage.setItem(SERVICE_CACHE_KEY, JSON.stringify(hydratedResult));
					} catch {
						// Rendering live data is more important than cache availability.
					}
					return;
				} catch (requestError) {
					lastError = requestError;
				}
			}
			if (!cancelled && isAdminPage) setError(lastError?.message || 'Could not reach the backend.');
		};

		loadLiveService();
		return () => {
			cancelled = true;
		};
	}, []);
	if (isFeedbackPage) return <FeedbackPage />;
	if (error) return <LoadingScreen error={error} />;
	if (!service) return <LoadingScreen />;
	return isAdminPage ? (
		<AdminPage service={service} onSaved={setService} />
	) : (
		<HomePage service={service} backendReady={backendReady} />
	);
}
