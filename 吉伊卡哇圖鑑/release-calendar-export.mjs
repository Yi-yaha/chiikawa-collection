const encoder = new TextEncoder();

function textValue(value) {
  return value.replace(/\\/g, '\\\\').replace(/\r\n?|\n/g, '\\n').replace(/[;,]/g, '\\$&');
}

function foldLine(line) {
  let length = 0, folded = '';
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (length + size > 75) {
      folded += '\r\n ';
      length = 1;
    }
    folded += character;
    length += size;
  }
  return folded;
}

function calendarStamp(date) {
  return date.toISOString().replace(/[-:]|\.\d{3}/g, '');
}

export function releaseCalendarEvent(event, date, links, now = new Date()) {
  const timeStamp = time => calendarStamp(new Date(date + 'T' + time + ':00+08:00'));
  const uid = event.id + (event.endDate ? '-' + date : '') + '@yi-yaha.github.io';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chiikawa Collection//Release Calendar//ZH-TW',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + calendarStamp(now),
    'DTSTART:' + timeStamp(event.time),
    'SUMMARY:' + textValue(event.title || '新品開售'),
  ];
  if (event.endTime) lines.push('DTEND:' + timeStamp(event.endTime));
  if (event.location) lines.push('LOCATION:' + textValue(event.location));
  if (links.length) lines.push('DESCRIPTION:' + textValue(links.map(({label, url}) => label + ' ' + url).join('\n')));
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
