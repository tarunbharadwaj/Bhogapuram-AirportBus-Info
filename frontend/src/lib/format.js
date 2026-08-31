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
