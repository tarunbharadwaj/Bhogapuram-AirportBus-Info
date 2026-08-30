import { findNearestBoardingPlace } from '../../../shared/serviceRouting.mjs';

export const findNearestBoardingPoint = (service, point) => {
	const nearest = findNearestBoardingPlace(service, point);
	if (!nearest) throw new Error('No active AeroExpress route is available.');
	return {
		...nearest,
		distanceKm: Number(nearest.distanceKm.toFixed(1))
	};
};
