// Airport corridor trip IDs and first-stop departures from Reclaim's APSRTC GTFS.
// Direction comes from the ordered termini; ASR-1 serves NAD, ASR-2 serves Scindia.
// Source (ODbL 1.0): https://github.com/reclaimchennai/apsrtc/blob/main/data/apsrtc-gtfs.zip
export const AIRPORT_CORRIDOR = 'am10-old-gajuwaka-visakhapatnam-asr-international-airport';

// Verified stop_times.txt sequence in all 80 trips. The return patterns reverse these IDs.
const cityToAirportStops = {
	'ASR-1': ['10821', '9851', '243843', '223318', '1457005959824', '226027', '1375188927965', '1782812721498', '1782812590671'],
	'ASR-2': ['10821', '1641462090785', '240931', '1436352534894', '1782984302304', '1782984212336', '1457005959824', '226027', '1375188927965', '1782812721498', '1782812590671']
};
const airportToCityStops = Object.fromEntries(
	Object.entries(cityToAirportStops).map(([routeCode, stops]) => [routeCode, [...stops].reverse()])
);

// Published minutes from origin departure to each scheduled arrival, in stop order.
const arrivalOffsets = {
	'to-airport': {
		'ASR-1': [0, 15, 30, 45, 60, 70, 85, 95, 105],
		'ASR-2': [0, 10, 25, 35, 45, 55, 70, 80, 95, 110, 120]
	},
	'from-airport': {
		'ASR-1': [0, 10, 20, 30, 45, 60, 75, 90, 105],
		'ASR-2': [0, 10, 25, 35, 50, 60, 70, 80, 95, 110, 120]
	}
};

// Each row lists trips 1 through 4 for that duty in the verified snapshot.
const duties = {
	AM01: ['04:15', '10:20', '13:00', '18:15'],
	AM02: ['04:50', '09:45', '13:30', '19:00'],
	AM03: ['05:45', '11:00', '15:00', '19:20'],
	AM04: ['06:35', '12:50', '15:30', '20:40'],
	AM05: ['08:45', '14:15', '16:45', '22:30'],
	AM06: ['09:05', '15:00', '17:30', '23:00'],
	AM07: ['10:15', '15:20', '18:00', '23:45'],
	AM08: ['11:10', '16:15', '18:45', '07:30'],
	AM09: ['11:45', '16:40', '19:10', '07:45'],
	AM10: ['12:30', '17:20', '19:45', '08:15'],
	AW01: ['04:20', '09:30', '13:00', '18:30'],
	AW02: ['05:00', '10:30', '14:30', '20:00'],
	AW03: ['05:20', '10:45', '14:00', '19:15'],
	AW04: ['07:00', '13:00', '15:40', '21:15'],
	AW05: ['07:35', '14:15', '16:20', '21:30'],
	AW06: ['09:00', '14:20', '17:00', '22:40'],
	AW07: ['09:30', '15:00', '17:40', '23:35'],
	AW08: ['10:45', '15:40', '18:30', '07:15'],
	AW09: ['11:15', '16:30', '18:40', '07:45'],
	AW10: ['12:00', '17:00', '19:15', '08:00']
};

const patterns = {
	AM: [
		['ASR-1', 'to-airport'], ['ASR-2', 'from-airport'],
		['ASR-1', 'to-airport'], ['ASR-2', 'from-airport']
	],
	AW: [
		['ASR-2', 'to-airport'], ['ASR-1', 'from-airport'],
		['ASR-2', 'to-airport'], ['ASR-1', 'from-airport']
	]
};

export const RECLAIM_TRIPS = new Map(Object.entries(duties).flatMap(([duty, times]) =>
	times.map((time, index) => {
		const [routeCode, direction] = patterns[duty.slice(0, 2)][index];
		const stopIds = (direction === 'to-airport' ? cityToAirportStops : airportToCityStops)[routeCode];
		return [`${duty}_${index + 1}_GAJUWAKA2`, { routeCode, direction, time, stopIds, arrivalOffsets: arrivalOffsets[direction][routeCode] }];
	})
));
