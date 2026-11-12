const encoder = new TextEncoder();

export const releaseReminderOptions = [
  { value:'10', label:'10 分鐘前' },
  { value:'5', label:'5 分鐘前' },
  { value:'30', label:'30 分鐘前' },
  { value:'0', label:'準時' },
  { value:'none', label:'不提醒' },
];

export function releaseCalendarLinks(event) {
  const mapUrl = event.mapUrl || (event.location && 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(event.location));
  return [
    { label:event.preorderUrl ? '新品網址' : '販售網址', url:event.url, iconName:'link' },
    { label:'預售網址', url:event.preorderUrl, iconName:'link' },
    { label:'Google 地圖', url:mapUrl },
  ].flatMap(link => {
    try {
      const url = new URL(link.url);
      return ['https:', 'http:'].includes(url.protocol) ? [{ ...link, url:url.href }] : [];
    } catch { return []; }
  });
}

export function releaseCalendarFile(event, date, reminder) {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(event.id) || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || date < event.date || date > (event.endDate || event.date)
      || !releaseReminderOptions.some(option => option.value === reminder)) throw Error('找不到這筆行事曆活動');
  return 'assets/calendar-events/' + event.id + '-' + date + '-' + reminder + '.ics';
}

export function releaseCalendarRevision(event) {
  // 依活動本身更新連結，即使頁面仍開著，也不沿用舊活動的快取。
  const content = JSON.stringify(['id', 'date', 'endDate', 'time', 'endTime', 'title', 'location', 'url', 'preorderUrl', 'mapUrl'].map(field => event[field] || ''));
  let hash = 2166136261;
  for (const byte of encoder.encode(content)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

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

export function releaseCalendarEvent(event, date, links, now = new Date(), reminder = 'none') {
  releaseCalendarFile(event, date, reminder);
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
  if (links.length) lines.push('URL:' + links[0].url);
  if (reminder !== 'none') lines.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:' + (reminder === '0' ? 'PT0S' : '-PT' + reminder + 'M'),
    'DESCRIPTION:' + textValue(event.title || '新品開售'),
    'END:VALARM',
  );
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// 正式網站使用相同內容產生的靜態活動連結，讓 Safari 直接處理行事曆檔案。
export function releaseCalendarFiles(events, now = new Date()) {
  const files = {};
  for (const event of events) {
    const links = releaseCalendarLinks(event);
    for (let date = event.date; date <= (event.endDate || event.date);) {
      for (const {value} of releaseReminderOptions) {
        files[releaseCalendarFile(event, date, value)] = releaseCalendarEvent(event, date, links, now, value);
      }
      const next = new Date(date + 'T00:00:00Z');
      next.setUTCDate(next.getUTCDate() + 1);
      if (next.getUTCFullYear() > 9999) break;
      date = next.toISOString().slice(0, 10);
    }
  }
  return files;
}
