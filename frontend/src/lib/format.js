const serviceTimeZone = 'Asia/Kolkata';

export const formatTime = (value) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: serviceTimeZone }).format(new Date(value));
export const formatDate = (value) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: serviceTimeZone }).format(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00+05:30`) : new Date(value));
export const formatShortDate = (value) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: serviceTimeZone }).format(new Date(value));
export const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} hr${rest ? ` ${rest} min` : ''}` : `${rest} min`;
};
export const mapsLink = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export const formatRoundedTime = (value, mode = 'nearest') => {
	const interval = 5 * 60_000;
	const timestamp = new Date(value).getTime();
	const round = mode === 'floor' ? Math.floor : Math.round;
	return formatTime(new Date(round(timestamp / interval) * interval));
};

export const directionsLink = ({ destination, origin }) => {
	const params = new URLSearchParams({
		api: '1',
		destination: `${destination.lat},${destination.lng}`,
		travelmode: 'driving'
	});
	if (origin) params.set('origin', `${origin.lat},${origin.lng}`);
	return `https://www.google.com/maps/dir/?${params.toString()}`;
};
