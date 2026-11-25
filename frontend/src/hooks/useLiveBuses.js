import { useEffect, useRef, useState } from 'react';
import { LIVE_REFRESH_MS } from '../../../shared/liveTracking.mjs';
import { api } from '../lib/api.js';
import { isLiveBusesSnapshot } from '../lib/liveTracking.js';

export function useLiveBuses(enabled, refreshKey) {
	const [snapshot, setSnapshot] = useState(null);
	const [networkStatus, setNetworkStatus] = useState('idle');
	const [now, setNow] = useState(Date.now);
	const [lastCheckedAt, setLastCheckedAt] = useState(null);
	const [refreshing, setRefreshing] = useState(false);
	const manualRefresh = useRef(null);

	useEffect(() => {
		if (!enabled) return;
		let stopped = false;
		let timer;
		let request;
		let requestTimeout;

		async function checkForUpdates(manual = false) {
			if (document.hidden || request) return;
			clearTimeout(timer);
			setNow(Date.now());
			if (!navigator.onLine) {
				setRefreshing(false);
				setNetworkStatus('offline');
				return;
			}
			request = new AbortController();
			setRefreshing(true);
			requestTimeout = setTimeout(() => request?.abort(), 18_000);
			try {
				const result = await api(manual ? '/api/live-buses?refresh=1' : '/api/live-buses', { signal: request.signal, cache: 'no-store' });
				if (!isLiveBusesSnapshot(result)) throw new Error('Invalid live tracking response');
				if (stopped) return;
				setSnapshot(result);
				setLastCheckedAt(Date.now());
				setNetworkStatus(navigator.onLine ? 'ready' : 'offline');
			} catch {
				if (!stopped) setNetworkStatus(navigator.onLine ? 'unavailable' : 'offline');
			} finally {
				clearTimeout(requestTimeout);
				request = null;
				if (!stopped) {
					setRefreshing(false);
					setNow(Date.now());
					timer = setTimeout(refresh, LIVE_REFRESH_MS);
				}
			}
		}

		function markOffline() {
			request?.abort();
			setNetworkStatus('offline');
		}

		const refresh = () => checkForUpdates();
		manualRefresh.current = () => checkForUpdates(true);
		refresh();
		const clock = setInterval(() => setNow(Date.now()), 10_000);
		document.addEventListener('visibilitychange', refresh);
		window.addEventListener('online', refresh);
		window.addEventListener('offline', markOffline);
		return () => {
			stopped = true;
			manualRefresh.current = null;
			clearTimeout(timer);
			clearTimeout(requestTimeout);
			clearInterval(clock);
			request?.abort();
			document.removeEventListener('visibilitychange', refresh);
			window.removeEventListener('online', refresh);
			window.removeEventListener('offline', markOffline);
		};
	}, [enabled, refreshKey]);

	return { snapshot, networkStatus, now, lastCheckedAt, refreshing, refresh: () => manualRefresh.current?.() };
}
