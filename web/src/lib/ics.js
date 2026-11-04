// Fichier calendrier (.ics) pour « Ajouter à mon agenda »
const f = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');
export function icsFile(events, name = 'rendez-vous.ics') {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Artis & You//FR', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', 'UID:' + e.id + '@artisandyou', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(e.start), 'DTEND:' + f(e.end), 'SUMMARY:' + esc(e.title));
    if (e.location) lines.push('LOCATION:' + esc(e.location));
    if (e.description) lines.push('DESCRIPTION:' + esc(e.description));
    if (e.rrule) lines.push('RRULE:' + e.rrule);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}
export const rrule = (r) => ({ weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' }[r] || null);
