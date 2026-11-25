import L from 'leaflet';

const PRIMARY_TIMEOUT_MS = 5000;
const BACKUP_TIMEOUT_MS = 12000;
const COVERAGE_CHECK_MS = 150;

function rasterCoversView(map, raster) {
	const view = map.getContainer().getBoundingClientRect();
	if (!view.width || !view.height) return false;
	const images = raster.getContainer()?.querySelectorAll('img.leaflet-tile-loaded') ?? [];
	const tiles = [];
	for (const image of images) {
		if (!image.complete || image.naturalWidth < 256 || image.naturalHeight < 256) continue;
		const { visibility, opacity } = getComputedStyle(image);
		if (visibility === 'visible' && Number(opacity) > 0) tiles.push(image.getBoundingClientRect());
	}
	// Check the centre and edges so offscreen tiles or a single loaded tile cannot mark a blank view as ready.
	const samples = [0.1, 0.5, 0.9];
	return samples.every((column) => samples.every((row) => {
		const x = view.left + view.width * column;
		const y = view.top + view.height * row;
		return tiles.some(({ left, right, top, bottom }) => x >= left && x <= right && y >= top && y <= bottom);
	}));
}

export function attachLiveBasemap(map, onStatus) {
	let layer;
	let timeout = null;
	let attempt = 0;

	function clearLayer() {
		clearTimeout(timeout);
		timeout = null;
		layer?.remove();
		layer = null;
	}

	function unavailable(current) {
		if (current !== attempt) return;
		attempt += 1;
		clearLayer();
		onStatus('unavailable');
	}

	async function useBackup(current) {
		if (current !== attempt) return;
		const backupAttempt = ++attempt;
		clearLayer();
		onStatus('loading');
		timeout = setTimeout(() => unavailable(backupAttempt), BACKUP_TIMEOUT_MS);
		try {
			const { createBackupBasemap } = await import('./backupBasemap.js');
			if (backupAttempt !== attempt) return;
			layer = createBackupBasemap();
			layer.addTo(map);
			layer.getMaplibreMap().once('load', () => {
				if (backupAttempt !== attempt) return;
				clearTimeout(timeout);
				onStatus('ready');
			});
		} catch {
			unavailable(backupAttempt);
		}
	}

	function retry() {
		const current = ++attempt;
		clearLayer();
		onStatus('loading');
		let tileFailed = false;
		const raster = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 18,
			referrerPolicy: 'strict-origin-when-cross-origin',
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
		});
		const watchView = () => {
			if (current !== attempt || timeout !== null) return;
			const deadline = performance.now() + PRIMARY_TIMEOUT_MS;
			function check() {
				timeout = null;
				if (current !== attempt) return;
				if (rasterCoversView(map, raster)) {
					onStatus('ready');
					return;
				}
				if ((tileFailed && !raster.isLoading()) || performance.now() >= deadline) {
					useBackup(current);
					return;
				}
				onStatus('loading');
				timeout = setTimeout(check, COVERAGE_CHECK_MS);
			}
			timeout = setTimeout(check, 0);
		};
		raster.on('loading', () => {
			tileFailed = false;
			watchView();
		}).on('tileerror', () => {
			tileFailed = true;
			watchView();
		}).on('load', watchView).once('remove', () => {
			map.off('moveend resize', watchView);
		});
		map.on('moveend resize', watchView);
		layer = raster.addTo(map);
		watchView();
	}

	retry();
	return {
		retry,
		remove() {
			attempt += 1;
			clearLayer();
		}
	};
}
