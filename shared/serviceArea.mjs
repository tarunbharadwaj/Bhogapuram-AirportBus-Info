export const SERVICE_AREA_RADIUS_KM = 25;

export const isOutsideServiceArea = (distanceKm) =>
	Number(distanceKm) > SERVICE_AREA_RADIUS_KM;
