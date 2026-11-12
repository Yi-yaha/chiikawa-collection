import { releaseCalendarFile, releaseCalendarRevision, releaseReminderOptions } from './release-calendar-export.mjs?v=c7616e142084296f';

const dateFormat = new Intl.DateTimeFormat('zh-TW', { timeZone:'UTC', year:'numeric', month:'numeric', day:'numeric', weekday:'short' });

export function createReleaseCalendarAdd(openDialog) {
  const byId = id => document.getElementById(id);
  const dialog = byId('release-calendar-add');
  const reminder = byId('release-add-reminder');
  const proceed = byId('release-add-proceed');
  const status = byId('release-add-status');
  let active = null, origin = null, lastReminder = '10';

  for (const {value, label} of releaseReminderOptions) reminder.add(new Option(label, value));

  function updateLink() {
    if (!active) return;
    lastReminder = reminder.value;
    const url = new URL('./' + releaseCalendarFile(active.event, active.date, lastReminder), import.meta.url);
    const version = document.querySelector('meta[name="chiikawa-site-version"]')?.content;
    url.searchParams.set('v', (version ? version + '-' : '') + releaseCalendarRevision(active.event));
    proceed.href = url.href;
    status.textContent = '';
  }

  reminder.addEventListener('change', updateLink);
  proceed.addEventListener('click', () => {
    // 開啟活動檔案不等於已儲存，最後由使用者在行事曆確認。
    status.textContent = '請在 Apple 行事曆確認加入及提醒時間。';
  });
  dialog.addEventListener('close', () => {
    active = null;
    proceed.removeAttribute('href');
    if (origin?.isConnected && byId('release-calendar').open) origin.focus({preventScroll:true});
    origin = null;
  });

  return function open(event, date, button) {
    active = {event, date};
    origin = button;
    byId('release-add-title').textContent = event.title || '新品開售';
    byId('release-add-date').textContent = dateFormat.format(new Date(date + 'T00:00:00Z'));
    byId('release-add-time').textContent = event.time + (event.endTime ? '–' + event.endTime : '');
    const location = byId('release-add-location');
    location.textContent = event.location || '';
    location.hidden = !event.location;
    byId('release-add-single-day').hidden = !event.endDate;
    reminder.value = lastReminder;
    byId('release-add-help').open = false;
    updateLink();
    openDialog('release-calendar-add');
  };
}
