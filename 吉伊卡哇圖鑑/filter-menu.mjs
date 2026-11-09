import { visibleViewport } from './dialog-viewport.mjs?v=f41b3fb569f7cb39';

const chevron = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let activeMenu;

export function filterChoice({ key, label, selected, count, all = false, attribute = 'data-filter-choice' }) {
  const amount = count === undefined ? '' : `<small>${Number(count).toLocaleString('zh-TW')} 款</small>`;
  return `<button type="button" class="series-option${all ? ' series-all' : ''}${selected ? ' selected' : ''}" ${attribute}="${escape(key)}" aria-pressed="${selected}"><span>${escape(label)}</span>${amount}</button>`;
}

// 浮動選單沿用所屬畫面的操作層級，鍵盤出現時只調整選單自己的可見範圍。
export function createFilterMenu({ button, panel, onOpen, returnFocus, fixedAnchor = false, align = 'start', maxWidth = 280, flat = false }) {
  const dialog = button.closest('dialog');
  const search = panel.querySelector('input[type="search"]');
  const list = panel.querySelector('.series-options');
  const anchor = button.parentElement;
  const dismiss = panel.querySelector('[data-close-filter-menu]');
  let events, openingOffset = null;
  panel.classList.add('filter-popover');
  if (!search) panel.classList.add('filter-popover-flat');

  function position() {
    const field = button.getBoundingClientRect();
    const frame = dialog?.getBoundingClientRect();
    const viewport = visibleViewport();
    const top = Math.max(frame?.top ?? 0,viewport.top) + 12;
    const bottom = Math.min(frame?.bottom ?? innerHeight,viewport.top + viewport.height) - 12;
    const leftEdge = (frame?.left ?? 0) + 12;
    const rightEdge = (frame?.right ?? document.documentElement.clientWidth) - 12;
    if (!field.height || (openingOffset === null && search !== document.activeElement && (field.bottom < top || field.top > bottom))) {
      close();
      return;
    }

    const width = Math.min(maxWidth,rightEdge - leftEdge);
    const left = align === 'end' ? field.right - width : field.left;
    panel.style.width = width + 'px';
    panel.style.left = Math.max(leftEdge,Math.min(left,rightEdge - width)) + 'px';

    // 系列選單以開啟時的位置為準；背景捲動不改變選單的展開方向。
    const fieldTop = openingOffset === null ? field.top : Math.min(viewport.top + openingOffset,bottom);
    const fieldBottom = openingOffset === null ? field.bottom : Math.min(fieldTop + field.height,bottom);
    const above = fieldTop - top - 6;
    const below = bottom - fieldBottom - 6;
    const placeBelow = below >= Math.min(search ? 235 : 160,above);
    const space = placeBelow ? below : above;
    if (space < (search ? 110 : 66)) {
      panel.style.top = top + 'px';
      panel.style.bottom = 'auto';
      panel.style.height = 'auto';
      panel.style.setProperty('--series-menu-space', Math.max(0,bottom-top) + 'px');
      return;
    }
    panel.style.top = placeBelow ? fieldBottom + 6 + 'px' : 'auto';
    panel.style.bottom = placeBelow ? 'auto' : innerHeight - fieldTop + 6 + 'px';
    // 選單朝上時保持搜尋欄位置，避免縮短結果清單時移動正在輸入的欄位。
    panel.style.height = search && !placeBelow ? Math.min(310,space) + 'px' : 'auto';
    panel.style.setProperty('--series-menu-space', space + 'px');
  }

  function close(restoreFocus = false) {
    if (panel.hidden) return;
    events?.abort();
    panel.hidden = true;
    button.setAttribute('aria-expanded','false');
    if (activeMenu === api) activeMenu = null;
    openingOffset = null;
    if (restoreFocus) (returnFocus?.() || button).focus({preventScroll:true});
  }

  function focusChoice(choice) {
    if (!choice) return;
    choice.focus({preventScroll:true});
    const item = choice.getBoundingClientRect();
    const bounds = list.getBoundingClientRect();
    if (item.bottom > bounds.bottom) list.scrollTop += item.bottom - bounds.bottom;
    if (item.top < bounds.top) list.scrollTop -= bounds.top - item.top;
  }

  function open(keyboard = false) {
    activeMenu?.close();
    activeMenu = api;
    panel.hidden = false;
    button.setAttribute('aria-expanded','true');
    if (fixedAnchor) openingOffset = button.getBoundingClientRect().top - visibleViewport().top;
    onOpen?.();
    position();
    if (panel.hidden) return;

    events = new AbortController();
    const signal = events.signal;
    const closeOutside = event => {
      if (!panel.contains(event.target) && !button.contains(event.target)) close();
    };
    document.addEventListener('pointerdown',closeOutside,{capture:true,signal});
    document.addEventListener('focusin',closeOutside,{signal});
    window.addEventListener('resize',position,{signal});
    (dialog || window).addEventListener('scroll',position,{passive:true,signal});
    window.visualViewport?.addEventListener('resize',position,{signal});
    window.visualViewport?.addEventListener('scroll',position,{signal});
    dialog?.addEventListener('close',() => close(),{signal});
    dialog?.addEventListener('cancel',event => {
      event.preventDefault();
      close(true);
    },{signal});
    if (keyboard && flat) focusChoice(list.querySelector('.selected') || list.querySelector('button'));
    else button.focus({preventScroll:true});
  }

  button.addEventListener('click',event => {
    if (panel.hidden) open(event.detail === 0);
    else close();
  });
  dismiss?.addEventListener('click',() => close(true));
  anchor.addEventListener('keydown',event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (!flat || !['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    if (panel.hidden) {
      if (event.key.startsWith('Arrow')) { event.preventDefault(); open(true); }
      return;
    }
    const choices = [...list.querySelectorAll('button')];
    const index = choices.indexOf(event.target);
    let next = index + (event.key === 'ArrowUp' ? -1 : 1);
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = choices.length - 1;
    event.preventDefault();
    focusChoice(choices[Math.max(0,Math.min(choices.length - 1,next))]);
  });

  const api = { close, get isOpen() { return !panel.hidden; } };
  return api;
}

// 用同款選單顯示既有選項，保留原本的篩選值、變更事件及瀏覽還原流程。
export function upgradeFilterSelect(select, {getCounts} = {}) {
  const label = select.getAttribute('aria-label');
  const previous = select.parentElement;
  const anchor = document.createElement('div');
  anchor.className = 'filter-menu-anchor';
  const panelId = select.id + '-menu';
  anchor.innerHTML = `<button type="button" id="${escape(select.id)}-toggle" class="select-control series-toggle" aria-haspopup="dialog" aria-expanded="false" aria-controls="${escape(panelId)}"><span class="filter-menu-label"></span><span>${chevron}</span></button>
    <div class="series-popover" id="${escape(panelId)}" role="dialog" aria-label="${escape(label)}" hidden><div class="series-options"></div></div>`;
  previous.replaceWith(anchor);
  select.hidden = true;
  anchor.prepend(select);
  const button = anchor.querySelector('button');
  const panel = anchor.querySelector('.series-popover');
  const list = panel.querySelector('.series-options');
  const menu = createFilterMenu({button,panel,flat:true,onOpen:render});
  function render() {
    const counts = getCounts?.();
    list.innerHTML = [...select.options].map(option => filterChoice({
      key:option.value,
      label:option.textContent,
      count:counts ? counts.get(option.value) || 0 : option.dataset.count,
      selected:option.selected,
      all:option.value === '',
    })).join('');
  }
  function sync() {
    const text = select.selectedOptions[0]?.textContent || select.options[0]?.textContent || label;
    button.firstElementChild.textContent = text;
    button.setAttribute('aria-label',label + '：' + text);
    if (menu.isOpen) render();
  }
  list.addEventListener('click',event => {
    const choice = event.target.closest('[data-filter-choice]');
    if (!choice) return;
    select.value = choice.dataset.filterChoice;
    menu.close(true);
    sync();
    select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  sync();
  return { close:menu.close, sync };
}
