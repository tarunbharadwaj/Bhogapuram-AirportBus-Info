const toMinutes = (time) => {
	const [hours, minutes] = time.split(':').map(Number);
	return hours * 60 + minutes;
};

const buildSchedule = (start, end, frequency) => {
	const times = [];
	for (let minute = toMinutes(start); minute <= toMinutes(end); minute += frequency) {
		times.push(
			`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
		);
	}
	return times;
};

const schedule = { start: '04:30', end: '22:30', frequency: 30 };
const times = buildSchedule(schedule.start, schedule.end, schedule.frequency);

export const FALLBACK_SERVICE = {
	status: {
		verifiedDate: '2026-08-17',
		announcement:
			'AeroExpress is a new service. Intermediate timings are reference estimates - please confirm before travel.',
		announcementVisible: true,
		dataQuality: 'reference'
	},
	airport: {
		id: 'bhogapuram-airport',
		name: 'Bhogapuram Airport',
		fullName: 'Alluri Sitarama Raju International Airport',
		lat: 17.9739,
		lng: 83.5056
	},
	locations: [],
	routes: [
		{
			id: 'asr-1',
			code: 'ASR-1',
			name: 'Gajuwaka · NH-16',
			description: 'The inland corridor via NAD, Gurudwara and Madhurawada.',
			color: '#087f78',
			enabled: true,
			schedule: { ...schedule },
			times: [...times],
			stops: [
				{ id: 'gajuwaka-stop', name: 'Gajuwaka', landmark: 'Old Gajuwaka APSRTC bus stop', lat: 17.68605, lng: 83.20421, offset: 0, journeyMinutes: 115, fare: 400 },
				{ id: 'nad-stop', name: 'NAD Junction', landmark: 'NAD Junction (E) — in front of RR Complex, end of flyover', lat: 17.744512, lng: 83.236829, offset: 20, journeyMinutes: 95, fare: 350 },
				{ id: 'gurudwara-stop', name: 'Gurudwara Junction', landmark: 'In front of Royal Enfield showroom, opposite Gurudwara', lat: 17.737138, lng: 83.307269, offset: 38, journeyMinutes: 77, fare: 350 },
				{ id: 'madhurawada-stop', name: 'Madhurawada', landmark: 'Madhurawada highway bus platform', lat: 17.81864, lng: 83.35701, offset: 55, journeyMinutes: 60, fare: 300 },
				{ id: 'kommadi-stop', name: 'Kommadi', landmark: 'Kommadi Junction (N) — in front of Urban Treats', lat: 17.825246, lng: 83.356575, offset: 65, journeyMinutes: 50, fare: 250 },
				{ id: 'anandapuram-stop', name: 'Anandapuram', landmark: 'Anandapuram bus platform — Bhogapuram direction', lat: 17.89482, lng: 83.37695, offset: 82, journeyMinutes: 33, fare: 200 }
			]
		},
		{
			id: 'asr-2',
			code: 'ASR-2',
			name: 'Railway Station · Coast',
			description: 'The coastal corridor via VMRDA Park, Rushikonda and IT SEZ.',
			color: '#3767e8',
			enabled: true,
			schedule: { ...schedule },
			times: [...times],
			stops: [
				{ id: 'scindia-stop', name: 'Scindia', landmark: 'Scindia Junction bus stop', lat: 17.68862, lng: 83.26833, offset: 0, journeyMinutes: 120, fare: 400 },
				{ id: 'railway-stop', name: 'Railway Station', landmark: 'APSRTC bus platform at Visakhapatnam Railway Station', lat: 17.72193, lng: 83.29128, offset: 18, journeyMinutes: 102, fare: 300 },
				{ id: 'vmrda-stop', name: 'VMRDA Park', landmark: 'VUDA / VMRDA Park APSRTC bus stop', lat: 17.72538, lng: 83.33894, offset: 35, journeyMinutes: 85, fare: 300 },
				{ id: 'rushikonda-stop', name: 'Rushikonda', landmark: 'Rushikonda Junction city bus platform', lat: 17.78462, lng: 83.38351, offset: 53, journeyMinutes: 67, fare: 250 },
				{ id: 'it-sez-stop', name: 'IT SEZ', landmark: 'IT SEZ Bus Stop', lat: 17.8103, lng: 83.3893, offset: 65, journeyMinutes: 55, fare: 250 },
				{ id: 'marikavalasa-stop', name: 'Marikavalasa', landmark: 'Marikavalasa APSRTC platform — Bhogapuram direction', lat: 17.83708, lng: 83.35869, offset: 75, journeyMinutes: 45, fare: 200 }
			]
		}
	]
};
