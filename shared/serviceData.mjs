import { haversineKm } from './serviceRouting.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));

export const SERVICE_DATA_SCHEMA_VERSION = 6;

export const DEFAULT_TICKETING = {
	onlineBookingStatus: 'unavailable',
	title: 'Tickets are available onboard only',
	message:
		'AeroExpress tickets cannot currently be purchased online. Board the bus and buy your ticket directly from the conductor.',
	bookingUrl: 'https://www.apsrtconline.in/oprs-web/',
	trackingUrl: 'https://apsrtclivetrack.com/',
	checkedDate: '2026-09-07'
};

export const AIRPORT = {
	id: 'bhogapuram-airport',
	name: 'Vizag Airport',
	fullName: 'Alluri Sitarama Raju International Airport',
	lat: 17.9972,
	lng: 83.4799
};

const ASR_1_TO_AIRPORT = [
	'04:15',
	'04:50',
	'05:45',
	'06:35',
	'08:45',
	'09:05',
	'10:15',
	'11:00',
	'11:45',
	'12:30',
	'13:00',
	'13:30',
	'15:00',
	'15:30',
	'16:45',
	'17:30',
	'18:00',
	'18:45',
	'19:10',
	'19:45'
];

const ASR_1_FROM_AIRPORT = [
	'08:15',
	'08:45',
	'09:00',
	'09:30',
	'10:30',
	'10:45',
	'13:00',
	'14:15',
	'14:20',
	'15:00',
	'15:40',
	'16:30',
	'17:00',
	'18:30',
	'19:15',
	'20:00',
	'21:15',
	'21:30',
	'22:40',
	'23:35'
];

const ASR_2_TO_AIRPORT = [
	'04:20',
	'05:00',
	'05:20',
	'07:00',
	'07:35',
	'09:00',
	'09:30',
	'10:45',
	'11:15',
	'12:00',
	'13:00',
	'14:00',
	'14:30',
	'15:40',
	'16:20',
	'17:00',
	'17:40',
	'18:30',
	'18:40',
	'19:15'
];

const ASR_2_FROM_AIRPORT = [
	'08:30',
	'08:45',
	'09:15',
	'09:45',
	'10:20',
	'11:00',
	'12:50',
	'14:15',
	'15:00',
	'15:20',
	'16:15',
	'16:45',
	'17:20',
	'18:15',
	'19:00',
	'19:20',
	'20:40',
	'22:30',
	'23:00',
	'23:45'
];

const estimateStopTimes = (stops, totalMinutes) => {
	const points = [...stops, AIRPORT];
	const segments = points
		.slice(1)
		.map((point, index) => haversineKm(points[index], point));
	const totalDistance = segments.reduce((sum, distance) => sum + distance, 0);
	let cumulativeDistance = 0;

	return stops.map((stop, index) => {
		if (index > 0) cumulativeDistance += segments[index - 1];
		const offset = Math.round(
			(cumulativeDistance / totalDistance) * totalMinutes
		);
		return {
			...stop,
			offset,
			journeyMinutes: Math.max(1, totalMinutes - offset)
		};
	});
};

const route = ({ timetables, estimatedJourneyMinutes, stops, ...details }) => ({
	...details,
	estimatedJourneyMinutes,
	timetables: clone(timetables),
	// Temporary compatibility alias for clients deployed before directional timetables.
	times: [...timetables.toAirport],
	schedule: {
		start: timetables.toAirport[0],
		end: timetables.toAirport.at(-1),
		frequency: null,
		irregular: true
	},
	stops: estimateStopTimes(stops, estimatedJourneyMinutes)
});

export const DEFAULT_SERVICE_DATA = {
	schemaVersion: SERVICE_DATA_SCHEMA_VERSION,
	ticketing: clone(DEFAULT_TICKETING),
	status: {
		verifiedDate: '2026-08-17',
		announcement:
			'AeroExpress is a new service. Intermediate timings are reference estimates - please confirm before travel.',
		announcementVisible: true,
		dataQuality: 'reference'
	},
	airport: AIRPORT,
	locations: [
		{ id: 'mvp-colony', name: 'MVP Colony', lat: 17.7424, lng: 83.336 },
		{ id: 'siripuram', name: 'Siripuram', lat: 17.72054, lng: 83.32041 },
		{
			id: 'vuda-park',
			name: 'Opposite VUDA Park',
			lat: 17.723734,
			lng: 83.337496
		},
		{
			id: 'rtc-complex',
			name: 'RTC Complex',
			lat: 17.723881,
			lng: 83.305552
		},
		{
			id: 'railway-station',
			name: 'Visakhapatnam Railway Station',
			lat: 17.722783,
			lng: 83.290794
		},
		{ id: 'nad', name: 'NAD Junction', lat: 17.744512, lng: 83.236829 },
		{ id: 'gajuwaka', name: 'Old Gajuwaka', lat: 17.68605, lng: 83.20421 },
		{ id: 'kurmannapalem', name: 'Kurmannapalem', lat: 17.6862, lng: 83.1718 },
		{ id: 'madhurawada', name: 'Madhurawada', lat: 17.81864, lng: 83.35701 },
		{ id: 'rushikonda', name: 'Rushikonda', lat: 17.78462, lng: 83.38351 },
		{ id: 'anandapuram', name: 'Anandapuram', lat: 17.89482, lng: 83.37695 }
	],
	routes: [
		route({
			id: 'asr-1',
			code: 'ASR-1',
			name: 'Old Gajuwaka · NAD · Zoo Park',
			description: 'Via NAD, Maddilapalem, Gurudwara and Zoo Park.',
			color: '#087f78',
			enabled: true,
			estimatedJourneyMinutes: 120,
			timetables: { toAirport: ASR_1_TO_AIRPORT, fromAirport: ASR_1_FROM_AIRPORT },
			stops: [
				{
					id: 'gajuwaka-stop',
					placeId: 'old-gajuwaka',
					name: 'Old Gajuwaka',
					landmark: 'Old Gajuwaka APSRTC bus stop',
					coordinateQuality: 'mapped-stop',
					lat: 17.68605,
					lng: 83.20421,
					fare: 400
				},
				{
					id: 'nad-stop',
					placeId: 'nad-junction',
					name: 'NAD Junction',
					landmark: 'NAD Junction (E) - in front of RR Complex, end of flyover',
					coordinateQuality: 'directional-mapped-stop',
					lat: 17.744512,
					lng: 83.236829,
					fare: 350
				},
				{
					id: 'gurudwara-stop',
					placeId: 'gurudwara',
					name: 'Gurudwara',
					landmark: 'In front of Royal Enfield showroom, opposite Gurudwara',
					coordinateQuality: 'directional-best-match',
					lat: 17.737138,
					lng: 83.307269,
					fare: 300
				},
				{
					id: 'zoo-park-stop',
					placeId: 'zoo-park',
					name: 'Zoo Park',
					landmark: 'Indira Zoo Park bus stand',
					coordinateQuality: 'user-provided-mapped-stop',
					lat: 17.7689933,
					lng: 83.3439567,
					fare: 250
				},
				{
					id: 'marikavalasa-stop',
					placeId: 'marikavalasa',
					name: 'Marikavalasa',
					landmark: 'Marikavalasa bus stop - Vizag direction',
					coordinateQuality: 'user-provided-mapped-stop',
					lat: 17.8371327,
					lng: 83.358547,
					fare: 150
				},
				{
					id: 'tagarapuvalasa-stop',
					placeId: 'tagarapuvalasa',
					name: 'Tagarapuvalasa',
					landmark: 'Tagarapuvalasa bus stop',
					coordinateQuality: 'user-provided-mapped-stop',
					lat: 17.9287702,
					lng: 83.4236959,
					fare: 100
				},
				{
					id: 'airport-junction-stop',
					placeId: 'airport-junction',
					name: 'Airport Junction',
					landmark: 'ASR Airport NH16 highway junction',
					coordinateQuality: 'approximate-best-match',
					lat: 17.9787,
					lng: 83.4583,
					fare: 50
				}
			]
		}),
		route({
			id: 'asr-2',
			code: 'ASR-2',
			name: 'Old Gajuwaka · Railway Station · IT Hills',
			description:
				'Via Scindia, Kancharapalem, Railway Station, RTC Complex, Siripuram, VUDA Park and IT Hills.',
			color: '#3767e8',
			enabled: true,
			estimatedJourneyMinutes: 150,
			timetables: { toAirport: ASR_2_TO_AIRPORT, fromAirport: ASR_2_FROM_AIRPORT },
			stops: [
				{
					id: 'gajuwaka-stop',
					placeId: 'old-gajuwaka',
					name: 'Old Gajuwaka',
					landmark: 'Old Gajuwaka APSRTC bus stop',
					coordinateQuality: 'mapped-stop',
					lat: 17.68605,
					lng: 83.20421,
					fare: 400
				},
				{
					id: 'scindia-stop',
					placeId: 'scindia',
					name: 'Scindia',
					landmark: 'Scindia Junction bus stop',
					coordinateQuality: 'mapped-stop',
					lat: 17.68862,
					lng: 83.26833,
					fare: 400
				},
				{
					id: 'kancharapalem-stop',
					placeId: 'kancharapalem',
					name: 'Kancharapalem',
					landmark: 'Gavara Kancharapalem bus stop',
					coordinateQuality: 'approximate-best-match',
					lat: 17.7322554,
					lng: 83.2778582,
					fare: 400
				},
				{
					id: 'railway-stop',
					placeId: 'railway-station',
					name: 'Railway Station',
					landmark: 'APSRTC bus platform at Visakhapatnam Railway Station',
					coordinateQuality: 'user-provided-mapped-stop',
					lat: 17.722783,
					lng: 83.290794,
					fare: 300
				},
				{
					id: 'rtc-complex-stop',
					placeId: 'rtc-complex',
					name: 'RTC Complex',
					landmark: 'RTC Complex APSRTC bus stop',
					coordinateQuality: 'user-provided-mapped-stop',
					lat: 17.723881,
					lng: 83.305552,
					fare: 350
				},
				{
					id: 'siripuram-stop',
					placeId: 'siripuram',
					name: 'Siripuram',
					landmark: 'Siripuram bus stop',
					coordinateQuality: 'approximate-best-match',
					lat: 17.7209182,
					lng: 83.3218202,
					fare: 350
				},
				{
					id: 'vuda-park-stop',
					placeId: 'vuda-park',
					name: 'Opposite VUDA Park',
					landmark: 'Opposite VUDA Park APSRTC bus stop',
					coordinateQuality: 'user-provided-mapped-stop',
					lat: 17.723734,
					lng: 83.337496,
					fare: 300
				},
				{
					id: 'iskcon-temple-stop',
					placeId: 'iskcon-temple',
					name: 'ISKCON Temple',
					landmark: 'ISKCON Temple stop, Sagar Nagar Beach Road',
					coordinateQuality: 'approximate-best-match',
					lat: 17.7677556,
					lng: 83.3666993,
					fare: 300
				},
				{
					id: 'it-hills-stop',
					placeId: 'it-hills',
					name: 'IT Hills',
					landmark: 'Rushikonda IT Hills bus stop',
					coordinateQuality: 'approximate-best-match',
					lat: 17.8103056,
					lng: 83.3893056,
					fare: 250
				},
				{
					id: 'marikavalasa-stop',
					placeId: 'marikavalasa',
					name: 'Marikavalasa',
					landmark: 'Marikavalasa bus stop - Vizag direction',
					coordinateQuality: 'user-provided-mapped-stop',
					lat: 17.8371327,
					lng: 83.358547,
					fare: 200
				},
				{
					id: 'anandapuram-stop',
					placeId: 'anandapuram',
					name: 'Anandapuram',
					landmark: 'Anandapuram bus platform - Vizag direction',
					coordinateQuality: 'directional-best-match',
					lat: 17.89482,
					lng: 83.37695,
					fare: 150
				},
				{
					id: 'tagarapuvalasa-stop',
					placeId: 'tagarapuvalasa',
					name: 'Tagarapuvalasa',
					landmark: 'Tagarapuvalasa bus stop',
					coordinateQuality: 'user-provided-mapped-stop',
					lat: 17.9287702,
					lng: 83.4236959,
					fare: 100
				},
				{
					id: 'airport-junction-stop',
					placeId: 'airport-junction',
					name: 'Airport Junction',
					landmark: 'ASR Airport NH16 highway junction',
					coordinateQuality: 'approximate-best-match',
					lat: 17.9787,
					lng: 83.4583,
					fare: 50
				}
			]
		})
	]
};

export const createDefaultServiceData = () => clone(DEFAULT_SERVICE_DATA);
