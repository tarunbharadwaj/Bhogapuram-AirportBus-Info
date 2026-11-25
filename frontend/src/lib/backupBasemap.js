import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(workerUrl);

export function createBackupBasemap() {
	const layer = maplibreGL({
		style: 'https://tiles.openfreemap.org/styles/positron',
		attributionControl: {
			customAttribution: '<a href="https://openfreemap.org/">OpenFreeMap</a> · &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> · &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
		}
	});
	const remove = layer.onRemove;
	layer.onRemove = function (map) {
		// A WebGL startup failure can leave the container attached without a renderer.
		if (!this.getMaplibreMap()) this.getContainer()?.remove();
		else remove.call(this, map);
	};
	return layer;
}
