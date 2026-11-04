// 以日曆月計算區間；未填日期的紀錄不推定月份。
export function monthNumber(value) {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(value || '');
  if (!match || Number(match[1]) < 1 || Number(match[2]) < 1 || Number(match[2]) > 12) return null;
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

export function monthKey(value) {
  return String(Math.floor(value / 12)).padStart(4, '0') + '-' + String(value % 12 + 1).padStart(2, '0');
}

export function purchasePeriod(records, length = 6, requestedEnd = null, now = new Date()) {
  length = [3, 6, 12].includes(Number(length)) ? Number(length) : 6;
  const current = now.getFullYear() * 12 + now.getMonth();
  const dated = records.filter(record => record.date && monthNumber(record.date) !== null);
  let earliest = current, latest = current;
  for (const record of dated) {
    const month = monthNumber(record.date);
    earliest = Math.min(earliest, month);
    latest = Math.max(latest, month);
  }
  const first = Math.max(12, Math.min(earliest, current - length + 1, (requestedEnd ?? current) - length + 1));
  const end = Math.max(first + length - 1, Math.min(latest, requestedEnd ?? current));
  const start = end - length + 1;
  return {length, current, first, last:latest, start, end, count:latest - first + 1, offset:start - first};
}

export function recordsInPeriod(records, {start, end}) {
  return records.filter(record => {
    const month = record.date ? monthNumber(record.date) : null;
    return month !== null && month >= start && month <= end;
  });
}

export function periodLabel({start, end}) {
  return monthKey(start).replace('-', '/') + '－' + monthKey(end).replace('-', '/');
}

export function periodDates({start, end}) {
  const lastDay = new Date(0);
  lastDay.setUTCFullYear(Math.floor(end / 12), end % 12 + 1, 0);
  return monthKey(start).replace('-', '/') + '/01－' + monthKey(end).replace('-', '/') + '/' + lastDay.getUTCDate();
}
