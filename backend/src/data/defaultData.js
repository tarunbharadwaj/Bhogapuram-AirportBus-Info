const toMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const buildSchedule = (start, end, frequency) => {
  const times = [];
  for (let minute = toMinutes(start); minute <= toMinutes(end); minute += frequency) {
    times.push(`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);
  }
  return times;
};

export const AIRPORT = {
  id: 'bhogapuram-airport',
  name: 'Bhogapuram Airport',
  fullName: 'Alluri Sitarama Raju International Airport',
  lat: 17.9739,
  lng: 83.5056,
};

export const DEFAULT_DATA = {
  status: {
    verifiedDate: '2026-08-17',
    announcement: 'AeroExpress is a new service. Intermediate timings are reference estimates—please confirm before travel.',
    announcementVisible: true,
    dataQuality: 'reference',
  },
  airport: AIRPORT,
  locations: [
    { id: 'mvp-colony', name: 'MVP Colony', lat: 17.7424, lng: 83.3360 },
    { id: 'siripuram', name: 'Siripuram', lat: 17.7206, lng: 83.3154 },
    { id: 'rtc-complex', name: 'RTC Complex', lat: 17.7251, lng: 83.3019 },
    { id: 'railway-station', name: 'Visakhapatnam Railway Station', lat: 17.7215, lng: 83.2897 },
    { id: 'nad', name: 'NAD Junction', lat: 17.7431, lng: 83.2316 },
    { id: 'gajuwaka', name: 'Gajuwaka', lat: 17.6908, lng: 83.2159 },
    { id: 'kurmannapalem', name: 'Kurmannapalem', lat: 17.6862, lng: 83.1718 },
    { id: 'madhurawada', name: 'Madhurawada', lat: 17.8077, lng: 83.3511 },
    { id: 'rushikonda', name: 'Rushikonda', lat: 17.7834, lng: 83.3858 },
    { id: 'anandapuram', name: 'Anandapuram', lat: 17.8910, lng: 83.3941 },
  ],
  routes: [
    {
      id: 'asr-1',
      code: 'ASR-1',
      name: 'Gajuwaka · NH-16',
      description: 'The inland corridor via NAD, Gurudwara and Madhurawada.',
      color: '#087f78',
      enabled: true,
      schedule: { start: '04:30', end: '22:30', frequency: 30 },
      times: buildSchedule('04:30', '22:30', 30),
      stops: [
        { id: 'gajuwaka-stop', name: 'Gajuwaka', landmark: 'Gajuwaka bus station', lat: 17.6908, lng: 83.2159, offset: 0, journeyMinutes: 115, fare: 400 },
        { id: 'nad-stop', name: 'NAD Junction', landmark: 'Near NAD flyover city bus stop', lat: 17.7431, lng: 83.2316, offset: 20, journeyMinutes: 95, fare: 350 },
        { id: 'gurudwara-stop', name: 'Gurudwara Junction', landmark: 'NH-16 city bus bay', lat: 17.7355, lng: 83.3092, offset: 38, journeyMinutes: 77, fare: 350 },
        { id: 'madhurawada-stop', name: 'Madhurawada', landmark: 'Madhurawada highway bus stop', lat: 17.8077, lng: 83.3511, offset: 55, journeyMinutes: 60, fare: 300 },
        { id: 'kommadi-stop', name: 'Kommadi', landmark: 'Kommadi Junction', lat: 17.8298, lng: 83.3447, offset: 65, journeyMinutes: 50, fare: 250 },
        { id: 'anandapuram-stop', name: 'Anandapuram', landmark: 'Anandapuram highway junction', lat: 17.8910, lng: 83.3941, offset: 82, journeyMinutes: 33, fare: 200 }
      ]
    },
    {
      id: 'asr-2',
      code: 'ASR-2',
      name: 'Railway Station · Coast',
      description: 'The coastal corridor via VMRDA Park, Rushikonda and IT SEZ.',
      color: '#3767e8',
      enabled: true,
      schedule: { start: '04:30', end: '22:30', frequency: 30 },
      times: buildSchedule('04:30', '22:30', 30),
      stops: [
        { id: 'scindia-stop', name: 'Scindia', landmark: 'Scindia Junction bus stop', lat: 17.6840, lng: 83.2788, offset: 0, journeyMinutes: 120, fare: 400 },
        { id: 'railway-stop', name: 'Railway Station', landmark: 'Visakhapatnam railway station main entrance', lat: 17.7215, lng: 83.2897, offset: 18, journeyMinutes: 102, fare: 300 },
        { id: 'vmrda-stop', name: 'VMRDA Park', landmark: 'Beach Road, opposite VMRDA Park', lat: 17.7371, lng: 83.3426, offset: 35, journeyMinutes: 85, fare: 300 },
        { id: 'rushikonda-stop', name: 'Rushikonda', landmark: 'Rushikonda beach road junction', lat: 17.7834, lng: 83.3858, offset: 53, journeyMinutes: 67, fare: 250 },
        { id: 'it-sez-stop', name: 'IT SEZ', landmark: 'Hill No. 3 approach road', lat: 17.8264, lng: 83.3864, offset: 65, journeyMinutes: 55, fare: 250 },
        { id: 'marikavalasa-stop', name: 'Marikavalasa', landmark: 'Marikavalasa highway junction', lat: 17.8585, lng: 83.3775, offset: 75, journeyMinutes: 45, fare: 200 }
      ]
    }
  ]
};

export { buildSchedule };
