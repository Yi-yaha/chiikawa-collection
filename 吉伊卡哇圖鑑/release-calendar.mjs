import { releaseCalendarEvent } from './release-calendar-export.mjs?v=1b95d60331a632ce';

const taipeiDateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone:'Asia/Taipei' });
const dayFormat = new Intl.DateTimeFormat('zh-TW', { timeZone:'UTC', month:'long', day:'numeric', weekday:'long' });

export function taipeiDate() {
  return taipeiDateFormat.format(new Date());
}

export function releaseDayLabel(date) {
  return dayFormat.format(new Date(date + 'T00:00:00Z'));
}

export function releaseDateRange(event) {
  const format = date => date.split('-').map(Number).join('/');
  return event.endDate ? format(event.date) + '～' + format(event.endDate) : format(event.date);
}

function offsetMonth(date, offset) {
  const monthKey = date.slice(0, 7);
  if ((offset < 0 && monthKey === '0001-01') || (offset > 0 && monthKey === '9999-12')) return null;
  const first = new Date(monthKey + '-01T00:00:00Z');
  first.setUTCMonth(first.getUTCMonth() + offset);
  return first.toISOString().slice(0, 10);
}

function releaseTime(date, value) {
  const time = document.createElement('time');
  time.dateTime = date + 'T' + value + '+08:00';
  time.textContent = value;
  return time;
}

function releaseTitle(event) {
  const title = document.createElement('span');
  title.textContent = event.title || '新品開售';
  return title;
}

function webLink(label, href, iconName = 'link') {
  if (!href) return null;
  try {
    const url = new URL(href);
    if (url.protocol === 'https:' || url.protocol === 'http:') return { label, url:url.href, iconName };
  } catch { /* 網址無法使用時仍可查看時程。 */ }
  return null;
}

function agendaRow(event, date, icon) {
  const row = document.createElement('li');
  const hours = document.createElement('span');
  hours.className = 'release-event-hours';
  hours.append(releaseTime(date, event.time));
  if (event.endTime) hours.append('–', releaseTime(date, event.endTime));
  const details = document.createElement('div');
  details.className = 'release-event-details';
  details.append(releaseTitle(event));
  if (event.endDate || event.location) {
    const context = document.createElement('p');
    context.className = 'release-event-context';
    context.textContent = [event.endDate && releaseDateRange(event), event.location].filter(Boolean).join(' · ');
    details.append(context);
  }
  const links = document.createElement('div');
  links.className = 'release-event-links';
  const mapUrl = event.mapUrl || (event.location && 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(event.location));
  const destinations = [
    webLink(event.preorderUrl ? '新品網址' : '販售網址', event.url),
    webLink('預售網址', event.preorderUrl),
    webLink('Google 地圖', mapUrl, null),
  ].filter(Boolean);
  for (const { label, url, iconName } of destinations) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (iconName) link.innerHTML = icon(iconName);
    link.append(label);
    links.append(link);
  }
  const add = document.createElement('a');
  add.className = 'release-event-add';
  add.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(releaseCalendarEvent(event, date, destinations));
  add.download = '吉伊卡哇行事曆-' + date + '-' + event.time.replace(':', '') + '.ics';
  add.setAttribute('aria-label', '加入行事曆');
  add.title = '加入行事曆';
  add.innerHTML = icon('calendar');
  const actions = document.createElement('div');
  actions.className = 'release-event-actions';
  if (links.childElementCount) actions.append(links);
  actions.append(add);
  row.append(hours, details, actions);
  return row;
}

export function createReleaseCalendar(openDialog, icon) {
  const byId = id => document.getElementById(id);
  const month = byId('release-month');
  const returnToToday = byId('release-today');
  const swipe = byId('release-month-swipe');
  const track = byId('release-month-track');
  const before = byId('release-month-before');
  const days = byId('release-days');
  const after = byId('release-month-after');
  const dateLabel = byId('release-date');
  const list = byId('release-events');
  const status = byId('release-status');
  const retry = byId('release-retry');
  let today, selected, request = 0, loading = false, failed = false;
  let byDate = new Map();
  let ranges = [];
  let currentPage = 1, width = 0, settleTimer;
  let pointer = null, ignoreClick = false;

  function eventsOn(date) {
    return [...(byDate.get(date) || []), ...ranges.filter(event => event.date <= date && event.endDate >= date)]
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  function buildDays(activeDate) {
    const monthKey = activeDate.slice(0, 7);
    const first = new Date(monthKey + '-01T00:00:00Z');
    const end = new Date(first);
    end.setUTCMonth(first.getUTCMonth() + 1, 0);
    const grid = document.createDocumentFragment();
    const firstWeekday = first.getUTCDay();
    const lastDay = end.getUTCDate();
    const cellCount = Math.ceil((firstWeekday + lastDay) / 7) * 7;
    for (let cell = 0; cell < cellCount; cell++) {
      const number = cell - firstWeekday + 1;
      if (number < 1 || number > lastDay) {
        const space = document.createElement('span');
        space.setAttribute('aria-hidden', 'true');
        grid.append(space);
        continue;
      }
      const date = monthKey + '-' + String(number).padStart(2, '0');
      const events = eventsOn(date);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.releaseDate = date;
      const visibleEvents = events.slice(0, 2);
      button.classList.toggle('has-multiple-releases', visibleEvents.length > 1);
      const description = visibleEvents.map(event => [event.time + (event.endTime ? ' 至 ' + event.endTime : ''), event.title || '新品開售'].join(' ')).join('、');
      button.setAttribute('aria-label', releaseDayLabel(date) + (events.length ? '，' + events.length + ' 筆開售時程，' + description : ''));
      button.setAttribute('aria-pressed', String(date === activeDate));
      if (date === today) button.setAttribute('aria-current', 'date');
      const dayNumber = document.createElement('span');
      dayNumber.className = 'release-day-number';
      dayNumber.textContent = number;
      if (events.length > visibleEvents.length) {
        const more = document.createElement('span');
        more.className = 'release-day-more';
        more.textContent = '+' + (events.length - visibleEvents.length);
        dayNumber.append(more);
      }
      button.append(dayNumber);
      for (const event of visibleEvents) {
        const summary = document.createElement('span');
        summary.className = 'release-day-summary';
        summary.append(releaseTime(date, event.time), releaseTitle(event));
        button.append(summary);
      }
      grid.append(button);
    }
    return grid;
  }

  function centerMonth() {
    width = swipe.clientWidth;
    swipe.scrollTo({ left:currentPage * width, behavior:'instant' });
  }

  function renderDays() {
    const activeDate = days.contains(document.activeElement) ? document.activeElement.dataset.releaseDate : null;
    const monthKey = selected.slice(0, 7);
    const [year, monthNumber] = monthKey.split('-').map(Number);
    const monthLabel = year + ' 年 ' + monthNumber + ' 月';
    const changed = month.textContent !== monthLabel;
    const previous = offsetMonth(selected, -1), next = offsetMonth(selected, 1);
    returnToToday.disabled = monthKey === today.slice(0, 7);
    days.replaceChildren(buildDays(selected));
    if (changed) {
      currentPage = previous ? 1 : 0;
      track.style.setProperty('--month-page', currentPage);
      track.style.setProperty('--month-pages', 1 + currentPage + Number(Boolean(next)));
      before.hidden = !previous;
      after.hidden = !next;
      month.textContent = monthLabel;
    }
    if (previous) before.replaceChildren(buildDays(previous));
    if (next) after.replaceChildren(buildDays(next));
    if (changed) centerMonth();
    if (activeDate) days.querySelector('[data-release-date="' + activeDate + '"]')?.focus({preventScroll:true});
  }

  function renderAgenda() {
    dateLabel.textContent = releaseDayLabel(selected);
    const rows = eventsOn(selected).map(event => agendaRow(event, selected, icon));
    list.replaceChildren(...rows);
    retry.hidden = !failed;
    status.hidden = rows.length > 0 && !failed && !loading;
    status.textContent = loading ? '正在讀取開售時程…' : failed ? '暫時無法讀取開售時程。' : rows.length ? '' : '這天沒有開售時程。';
  }

  function showDate(date) {
    selected = date;
    renderDays();
    renderAgenda();
  }

  function moveMonth(offset) {
    const date = offsetMonth(selected, offset);
    if (date) showDate(date);
  }

  function settleMonth() {
    if (!width || pointer?.dragging) return;
    const page = Math.round(swipe.scrollLeft / width);
    if (page !== currentPage && Math.abs(swipe.scrollLeft - page * width) <= 1) moveMonth(page - currentPage);
  }

  if ('onscrollend' in swipe) swipe.addEventListener('scrollend', settleMonth);
  else swipe.addEventListener('scroll', () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settleMonth, 140);
  }, { passive:true });
  function updateWidth() {
    if (swipe.clientWidth !== width) centerMonth();
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateWidth).observe(swipe);
  else window.addEventListener('resize', updateWidth);

  swipe.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    moveMonth(event.key === 'ArrowLeft' ? -1 : 1);
    swipe.focus({ preventScroll:true });
  });

  // 觸控和觸控板使用瀏覽器原生滑動。滑鼠按住拖曳時沿用同一個捲動位置。
  swipe.addEventListener('pointerdown', event => {
    ignoreClick = false;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    pointer = { id:event.pointerId, x:event.clientX, y:event.clientY, left:swipe.scrollLeft, dragging:false };
  });
  window.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer?.id) return;
    if (!event.buttons) { finishDrag(event); return; }
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (!pointer.dragging) {
      if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) { pointer = null; return; }
      if (Math.abs(dx) < 8) return;
      pointer.dragging = ignoreClick = true;
      swipe.setPointerCapture(event.pointerId);
      swipe.classList.add('is-dragging');
    }
    swipe.scrollLeft = pointer.left - dx;
  }, { passive:true });

  function finishDrag(event) {
    if (event.pointerId !== pointer?.id) return;
    const { x, dragging } = pointer;
    pointer = null;
    if (!dragging) return;
    const distance = event.clientX - x;
    const offset = event.type === 'pointerup' && Math.abs(distance) >= Math.min(64, width * .16) ? -Math.sign(distance) : 0;
    const page = offset && offsetMonth(selected, offset) ? currentPage + offset : currentPage;
    swipe.classList.remove('is-dragging');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    swipe.scrollTo({ left:page * width, behavior:reducedMotion ? 'instant' : 'smooth' });
  }
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', finishDrag);
  swipe.addEventListener('lostpointercapture', finishDrag);

  async function loadEvents() {
    const load = ++request;
    loading = true;
    failed = false;
    renderAgenda();
    try {
      const url = new URL('./assets/release-calendar.json', import.meta.url);
      const version = document.querySelector('meta[name="chiikawa-site-version"]')?.content;
      if (version) url.searchParams.set('v', version);
      const response = await fetch(url, { cache:'no-store' });
      if (!response.ok) throw Error('開售時程無法讀取');
      const { events } = await response.json();
      if (!Array.isArray(events)) throw Error('開售時程格式不正確');
      if (load !== request) return;
      const dates = new Map();
      const periods = [];
      for (const event of events) {
        if (event.endDate) { periods.push(event); continue; }
        if (!dates.has(event.date)) dates.set(event.date, []);
        dates.get(event.date).push(event);
      }
      byDate = dates;
      ranges = periods;
    } catch {
      if (load === request) failed = true;
    } finally {
      if (load === request) {
        loading = false;
        renderDays();
        renderAgenda();
      }
    }
  }

  returnToToday.addEventListener('click', () => {
    const focused = document.activeElement === returnToToday;
    today = taipeiDate();
    showDate(today);
    centerMonth();
    if (focused) days.querySelector('[aria-current="date"]')?.focus({ preventScroll:true });
  });
  days.addEventListener('click', event => {
    if (ignoreClick && event.detail) return;
    const date = event.target.closest('[data-release-date]')?.dataset.releaseDate;
    if (date) showDate(date);
  });
  retry.addEventListener('click', loadEvents);
  return {
    open() {
      today = taipeiDate();
      selected = today;
      renderDays();
      void loadEvents();
      openDialog();
      centerMonth();
      byId('release-calendar').scrollTop = 0;
    },
  };
}
