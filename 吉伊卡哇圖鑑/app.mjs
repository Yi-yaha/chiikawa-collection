import './focus-visibility.mjs?v=5bb656704e336b48';
import { createPurchaseHub } from './purchase-hub.mjs?v=5bb656704e336b48';
import { createViewState, capturePosition, restorePosition } from './view-state.mjs?v=5bb656704e336b48';
import { createDialogController } from './dialog-scroll.mjs?v=5bb656704e336b48';
import { visibleViewport } from './dialog-viewport.mjs?v=5bb656704e336b48';
import { STORAGE_KEY, MAX_QUANTITY, ITEM_TYPES, PROGRESS_TYPES, typeLabel, seriesKey, seriesLabel, seriesGroupKey, groupSeriesOptions, isProgressIncluded, normalizeSaved, mergeSaved, progressTotals, scopeItems, filterItems, collectionStats, groupItems, characterTabName, characterTabOrder, reorderCharacterTabs } from './model.mjs?v=5bb656704e336b48';
import { createCatalogImageLoader } from './image-loader.mjs?v=5bb656704e336b48';
import { createCharacterSorter } from './character-sorter.mjs?v=5bb656704e336b48';
import { watchForSiteUpdates } from './site-updates.mjs?v=5bb656704e336b48';
import { createReportHub } from './report-hub.mjs?v=5bb656704e336b48';
import { PURCHASE_CURRENCIES, purchaseCurrency, normalizePurchaseAmount, normalizePurchaseRate, calculatePurchaseField, normalizePurchaseRecord, formatPurchaseAmount, formatPurchaseExchangeRate, describePurchaseRecord } from './purchase-records.mjs?v=5bb656704e336b48';

const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => value.toLocaleString('zh-TW');
const paths = {
  star:'<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.5-4.4 6.3-.9L12 3Z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  sale:'<path d="M5.8 5.8A8.6 8.6 0 0 1 20.5 12m-3-3 3 3 2.5-3M18.2 18.2A8.6 8.6 0 0 1 3.5 12m3 3-3-3L1 15"/><path d="M14.4 8.5c-.6-.5-1.4-.8-2.4-.8-1.4 0-2.5.8-2.5 2 0 2.9 5 1.5 5 4.5 0 1.2-1.1 2.1-2.5 2.1-1 0-1.9-.4-2.6-1M12 6.4v11.2"/>',
  minus:'<path d="M5 12h14"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".8" fill="currentColor" stroke="none"/>',
  more:'<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
  sparkle:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/><path d="m20 2 .7 1.8L23 4.5l-2.3.7L20 7l-.7-1.8-2.3-.7 2.3-.7L20 2Z"/>',
  search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  chevron:'<path d="m7 9 5 5 5-5"/>',
  sliders:'<path d="M3 6h6m4 0h8M3 12h12m4 0h2M3 18h2m4 0h12M9 3v6m6 0v6M5 15v6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  person:'<circle cx="12" cy="7" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  friends:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/>',
  reset:'<path d="M3 10a9 9 0 1 1 2.5 8M3 4v6h6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none"/>',
  edit:'<path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM14 5l5 5"/>',
  box:'<path d="m3 7 9-4 9 4v11l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v11M7.5 5 16 9"/>',
  tag:'<path d="M3 4h8l10 10-7 7L3 10V4Z"/><circle cx="7.5" cy="8" r="1"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5"/>',
  share:'<path d="M12 15V3m-4 4 4-4 4 4M5 11v10h14V11"/>',
  'arrow-right':'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  external:'<path d="M14 3h7v7m0-7L10 14M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6"/>'
};
const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || paths.sparkle) + '</svg>';
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon)); }
hydrateIcons();
const colors = {
  '吉伊':['#eee8df','#c9bba7'], '小八':['#e4edf2','#99b6c7'], '兔兔':['#f1ebd4','#c8b76e'],
  '小桃':['#e9e7f0','#b6a5c6'], '師傅':['#eae5da','#b6a081'], '栗子':['#e8e3da','#b5a08b'],
  '獅薩':['#eee7d6','#bea46c'], '古本':['#efe2df','#c5a49a'],
  '小甲蟲':['#e6e9df','#a4ad90'], '那孩子':['#ede1dc','#bd998b'],
  '哥布林':['#e5eadc','#9da980'], '奧德':['#e5e7ed','#9ca8bb'],
  '鎧甲人':['#e8e6e1','#a8a299'], '流星':['#f1ebd4','#c8b76e'],
  '綜合角色':['#eae4dc','#b5a08b'], '人魚島':['#e0ebeb','#8eafad']
};
const avatarNames = {'小甲蟲':'基礎','那孩子':'基礎','哥布林':'樂園迷你','奧德':'樂園迷你','鎧甲人':'樂園迷你拉麵','流星':'黃色流星娃','大強':'大強','奇美拉':'哭哭奇美拉','灰孩子':'灰孩子A','睡衣派對':'睡衣派對 白','乳酸菌超人':'樂園迷你乳酸菌超人','綜合角色':'抱抱吉伊小八','人魚島':'賽蓮'};
// 以原圖的臉部中心與放大倍率統一角色縮圖，避免吊繩、身體及留白佔滿圓框。
const avatarCrops = {
  '吉伊':[50,59,1.7], '小八':[50,59,1.65], '兔兔':[50,59,1.7],
  '小桃':[50,58,1.7], '師傅':[50,56,1.85], '栗子':[50,58,1.65],
  '獅薩':[50,58,1.75], '古本':[50,58,1.7], '小甲蟲':[51,60,2.1],
  '那孩子':[50,52,1.6], '哥布林':[50,56,1.75], '奧德':[50,45,2.5],
  '鎧甲人':[50,48,2.6], '流星':[50,54,1.1], '綜合角色':[50,50,1.05],
  '人魚島':[50,49,1.65], '大強':[50,51,2.25], '奇美拉':[50,50,1.7],
  '惡夢大象':[50,50,1.5], '灰孩子':[50,58,2.2], '睡衣派對':[50,57,2.1],
  '乳酸菌超人':[50,39,2.6], '巫婆':[50,48,1.4], '大腳怪':[50,38,2.2],
  '馴鹿':[50,44,2.0], '小惡魔':[50,48,1.7], '粉蟲':[50,50,1.7],
  '黃綠蟲':[50,50,1.7], '河豚':[50,50,1.6], '中止蟲':[50,50,1.5],
  '大鳥':[50,42,1.5], '擬態怪獸':[50,34,2.4], '大樹':[50,50,1.25]
};
function avatarPortrait(character) {
  if (character === '其他角色') character = '奇美拉';
  const [x,y,zoom] = avatarCrops[character] || [50,50,1];
  const crop = '--portrait-size:' + (zoom*100) + '%;--portrait-x:' + (50-x*zoom) + '%;--portrait-y:' + (50-y*zoom) + '%';
  return '<span class="avatar-portrait" style="' + crop + '"><img src="' + escapeHTML(avatars.get(character)) + '" alt="" width="300" height="300" loading="lazy" decoding="async"></span>';
}
const state = { items:[], characters:[], owned:new Set(), quantities:{}, wishlist:new Set(), purchaseRecords:{}, saleRecords:{}, characterOrder:[], groupBy:'character', includedTypes:{}, scope:'mine', ownership:'all', type:'', region:'', series:'', query:'', ready:false };
let itemMap = new Map();
let itemAliases = {};
let characterTotals = new Map();
let avatars = new Map();
let toastTimer, undoAction, activeDetail, pendingRemoval;
let toastCleanup = () => {}, toastVersion = 0;
let storageOK = true;
let accountHub = null;
let accountScopeInitialized = false;
let collectionStorageKey = STORAGE_KEY;
let lastClearKey = STORAGE_KEY + '-last-clear';
const filterExpansionKey = STORAGE_KEY + '-filters-expanded';
let filtersExpanded = false;
let charactersExpanded = false;
let openSeriesCategory = '';
const openSeriesSubcategories = new Set();
try { filtersExpanded = localStorage.getItem(filterExpansionKey) === 'true'; } catch {}
try { history.scrollRestoration = 'manual'; } catch {}
let initialPositionPending = true;
const dialogController = createDialogController($('catalog-content'), {
  getPosition:() => initialPositionPending && browseState.saved?.position || capturePosition($('catalog-content')),
});
for (const event of ['pointerdown','touchstart','wheel','keydown']) window.addEventListener(event, () => { initialPositionPending = false; }, { passive:true, once:true });
const browseState = createViewState({ key:STORAGE_KEY + '-browse', read:() => ({
  scope:state.scope, type:state.type, region:state.region, series:state.series,
  query:$('catalog-search').value, groupBy:state.groupBy, ownership:state.ownership, filtersExpanded, charactersExpanded,
  tabs:{ x:$('character-tabs').scrollLeft, y:$('character-tabs').scrollTop },
  position:dialogController.position || initialPositionPending && browseState.saved?.position || capturePosition($('catalog-content')),
  detail:$('detail-dialog').open ? activeDetail : null,
  dialogs:['guide-dialog','settings-dialog','data-dialog','selling-dialog'].filter(id => $(id).open).map(id => ({ id, y:$(id).scrollTop })),
  social:accountHub?.getViewState() ?? browseState.saved?.social ?? null,
}) });
const catalogImages = createCatalogImageLoader($('catalog-content'));
const sellingImages = createCatalogImageLoader($('selling-content'));
const siteHeader = document.querySelector('.site-header');
function updateCatalogHeadingTop() {
  document.documentElement.style.setProperty('--catalog-heading-top', siteHeader.offsetHeight + 'px');
}
updateCatalogHeadingTop();
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateCatalogHeadingTop).observe(siteHeader);
else window.addEventListener('resize', updateCatalogHeadingTop);
const fitCharacterRow = () => { if (fitCharacterTabs()) revealActiveCharacter(); };
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fitCharacterRow).observe($('character-tabs'));
else window.addEventListener('resize', fitCharacterRow);
let sizingSample;
const catalogSizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(([entry]) => {
  if (!entry || entry.contentRect.height <= 0) return;
  // Estimate skipped cards from a sample; each rendered card remembers its
  // actual height, including names that wrap to a second line.
  const content = $('catalog-content');
  const height = entry.contentRect.height + 'px';
  if (content.style.getPropertyValue('--card-height') !== height) content.style.setProperty('--card-height', height);
  content.classList.add('has-card-size');
});
function observeCatalogSize() {
  const sample = $('catalog-content').querySelector('.product-card');
  if (!catalogSizeObserver || sample === sizingSample) return;
  catalogSizeObserver.disconnect();
  sizingSample = sample;
  if (sample) catalogSizeObserver.observe(sample);
}

function savedValue() { return {version:2, owned:[...state.owned], quantities:{...state.quantities}, wishlist:[...state.wishlist], purchaseRecords:structuredClone(state.purchaseRecords), saleRecords:Object.fromEntries(Object.entries(state.saleRecords).map(([id,record]) => [id,{...record}])), characterOrder:state.characterOrder, groupBy:state.groupBy, includedTypes:{...state.includedTypes}, includeMetalTags:state.includedTypes['地方限定吊牌'] !== false}; }
function applySaved(saved) {
  state.owned = new Set(saved.owned);
  state.quantities = {...saved.quantities};
  state.wishlist = new Set(saved.wishlist);
  state.purchaseRecords = structuredClone(saved.purchaseRecords || {});
  state.saleRecords = Object.fromEntries(Object.entries(saved.saleRecords || {}).map(([id,record]) => [id,{...record}]));
  state.characterOrder = [...saved.characterOrder];
  state.groupBy = saved.groupBy;
  state.includedTypes = {...saved.includedTypes};
  purchaseHub.sync();
}
function quantityOf(id) { return state.quantities[id] || 0; }
function totalQuantity(items = state.items) { return items.reduce((sum, item) => sum + quantityOf(item.id), 0); }
function persist() {
  try { localStorage.setItem(collectionStorageKey, JSON.stringify(savedValue())); accountHub?.capture(savedValue()); storageOK = true; }
  catch { storageOK = false; toast('目前無法儲存，請到資料管理匯出備份'); }
  return storageOK;
}
function toastHost() {
  return dialogController.top || document.body;
}
function toast(message, undo = null, { warning = false, duration = undo ? 9000 : 4500 } = {}) {
  clearTimeout(toastTimer);
  toastCleanup(); toastCleanup = () => {};
  const version = ++toastVersion;
  undoAction = undo;
  const host = toastHost();
  const notice = $('toast');
  if (notice.parentElement !== host) host.appendChild(notice);
  notice.classList.toggle('toast-warning', warning);
  if (!warning) notice.classList.remove('is-visible');
  notice.setAttribute('role', warning ? 'alert' : 'status');
  notice.setAttribute('aria-live', warning ? 'assertive' : 'polite');
  notice.querySelector('[data-icon]').innerHTML = icon(warning ? 'alert' : 'check');
  $('toast-message').textContent = message;
  $('toast-undo').hidden = !undo;
  notice.hidden = false;
  if (warning) {
    const viewport = window.visualViewport;
    const position = () => {
      if (version !== toastVersion) return;
      const bounds = host === document.body ? { top:viewport?.offsetTop || 0, left:0, width:innerWidth } : host.getBoundingClientRect();
      notice.style.setProperty('--toast-top', Math.max(bounds.top + 10, (viewport?.offsetTop || 0) + 10) + 'px');
      notice.style.setProperty('--toast-left', bounds.left + bounds.width / 2 + 'px');
      notice.style.setProperty('--toast-width', Math.max(1, Math.min(bounds.width - 88, innerWidth - 32)) + 'px');
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(host);
    window.addEventListener('resize', position);
    viewport?.addEventListener('resize', position);
    viewport?.addEventListener('scroll', position);
    toastCleanup = () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      viewport?.removeEventListener('resize', position);
      viewport?.removeEventListener('scroll', position);
    };
    void notice.offsetWidth;
    notice.classList.add('is-visible');
  }
  toastTimer = setTimeout(() => {
    if (!warning) { dismissToast(); return; }
    notice.classList.remove('is-visible');
    toastTimer = setTimeout(dismissToast, 160);
  }, duration);
  return () => { if (version === toastVersion) dismissToast(); };
}
function dismissToast() {
  clearTimeout(toastTimer);
  toastCleanup(); toastCleanup = () => {};
  $('toast').hidden = true;
  $('toast').classList.remove('is-visible');
  undoAction = null;
}
$('toast-undo').addEventListener('click', () => {
  const action = undoAction;
  dismissToast();
  action?.();
});
document.addEventListener('close', event => {
  if (event.target === $('toast').parentElement) {
    if ($('toast').classList.contains('toast-warning')) dismissToast();
    const host = toastHost();
    host.appendChild($('toast'));
  }
}, true);
function baseItems() { return scopeItems(state.items, state.scope, state.owned, state.wishlist); }
function currentItems() {
  return filterItems(baseItems(), state).filter(item => state.ownership === 'all' || (state.ownership === 'owned' ? state.owned.has(item.id) : !state.owned.has(item.id)));
}
function matchingCatalogItems() {
  const items = state.scope === 'mine' ? state.items : scopeItems(state.items, state.scope, state.owned, state.wishlist);
  return filterItems(items, state);
}
function catalogGrouping() {
  if (state.groupBy === 'series') return 'series';
  return ['mine', 'wishlist', 'all'].includes(state.scope) ? 'character' : 'type';
}

function updateProgressSetting() {
  $('open-settings').disabled = !state.ready;
  $('open-selling').disabled = !state.ready;
  const options = $('progress-type-options');
  if (!options.children.length) {
    const types = PROGRESS_TYPES.filter(type => type !== '待分類' || state.items.some(item => item.type === type));
    options.innerHTML = types.map(type => '<label class="progress-type-option"><span>' + escapeHTML(typeLabel(type)) + '</span><input type="checkbox" data-progress-type="' + escapeHTML(type) + '"></label>').join('');
  }
  options.querySelectorAll('[data-progress-type]').forEach(input => {
    input.checked = state.includedTypes[input.dataset.progressType] !== false;
  });
}

function collectionRing() {
  return '<svg class="collection-ring" viewBox="0 0 60 60" aria-hidden="true"><circle class="collection-ring-track" cx="30" cy="30" r="28"/><circle class="collection-ring-fill" cx="30" cy="30" r="28" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 30 30)"/></svg>';
}
// 每排放完整入口，讓分隔線前不留下切半的頭貼與文字。
function fitCharacterTabs() {
  if (charactersExpanded) return false;
  const tabs = $('character-tabs');
  const style = getComputedStyle(tabs);
  const gap = parseFloat(style.columnGap) || 0;
  const width = tabs.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  if (width <= 0) return false;
  const minimum = parseFloat(style.getPropertyValue('--character-tab-min')) || 55;
  const count = Math.max(1, Math.floor((width + gap) / (minimum + gap)));
  const size = ((width - gap * (count - 1)) / count).toFixed(4) + 'px';
  if (tabs.style.getPropertyValue('--character-tab-width') === size) return false;
  tabs.style.setProperty('--character-tab-width', size);
  return true;
}
function revealActiveCharacter() {
  if (charactersExpanded) return;
  fitCharacterTabs();
  const tabs = $('character-tabs');
  const active = tabs.querySelector('.character-tab.active');
  if (!active) return;
  const bounds = tabs.getBoundingClientRect();
  const selected = active.getBoundingClientRect();
  const style = getComputedStyle(tabs);
  const step = selected.width + (parseFloat(style.columnGap) || 0);
  const centered = tabs.scrollLeft + selected.left - bounds.left - (tabs.clientWidth - selected.width) / 2;
  tabs.scrollLeft = Math.round(centered / step) * step;
}
function setCharactersExpanded(expanded, { focusToggle = false } = {}) {
  if (!expanded) characterSorter.cancel();
  charactersExpanded = Boolean(expanded);
  $('character-nav').classList.toggle('is-expanded', charactersExpanded);
  $('character-picker-heading').hidden = !charactersExpanded;
  $('character-toggle').setAttribute('aria-expanded', String(charactersExpanded));
  $('character-toggle').setAttribute('aria-label', charactersExpanded ? '收合所有角色' : '展開所有角色');
  if (!charactersExpanded) {
    $('character-tabs').scrollTop = 0;
    revealActiveCharacter();
  }
  if (focusToggle) $('character-toggle').focus({ preventScroll:true });
}
function renderTabs() {
  const tabs = [
    '<button class="character-tab mine-tab ' + (state.scope === 'mine' ? 'active' : '') + '" data-scope="mine" aria-pressed="' + (state.scope === 'mine') + '"><span class="avatar">' + icon('heart') + '</span><span>我的娃</span></button>',
    '<button class="character-tab wish-tab ' + (state.scope === 'wishlist' ? 'active' : '') + '" data-scope="wishlist" aria-pressed="' + (state.scope === 'wishlist') + '"><span class="avatar">' + icon('star') + '</span><span>願望清單</span></button>',
    '<button class="character-tab all-tab ' + (state.scope === 'all' ? 'active' : '') + '" data-scope="all" aria-pressed="' + (state.scope === 'all') + '"><span class="avatar"><span class="all-characters-portrait" aria-hidden="true"></span></span><span>所有角色</span></button>',
    ...characterTabOrder(state.characterOrder).map(character => '<button class="character-tab ' + (state.scope === character ? 'active' : '') + '" data-scope="' + escapeHTML(character) + '" aria-describedby="character-sort-help" aria-pressed="' + (state.scope === character) + '" style="--avatar-bg:' + (colors[character]?.[0] || '#eee8df') + '"><span class="avatar">' + avatarPortrait(character) + collectionRing() + '</span><span>' + escapeHTML(character) + '</span></button>')
  ];
  $('character-tabs').innerHTML = tabs.join('');
  $('character-toggle').disabled = !state.ready;
  updateCollectionTabs();
  revealActiveCharacter();
}
function updateCollectionTabs() {
  const counts = new Map();
  state.owned.forEach(id => {
    const item = itemMap.get(id);
    if (item && isProgressIncluded(item, state.includedTypes)) {
      const character = characterTabName(item.character);
      counts.set(character, (counts.get(character) || 0) + 1);
    }
  });
  $('character-tabs').querySelectorAll('[data-scope]').forEach(tab => {
    const scope = tab.dataset.scope;
    if (scope === 'all') {
      tab.setAttribute('aria-label', '所有角色：收錄 ' + number(state.items.length) + ' 款商品');
      return;
    }
    if (scope === 'wishlist') {
      tab.setAttribute('aria-label', '願望清單：' + number(state.wishlist.size) + ' 款');
      return;
    }
    const mine = scope === 'mine';
    const owned = mine ? state.owned.size : counts.get(scope) || 0;
    if (mine) {
      tab.setAttribute('aria-label', '我的娃：' + number(owned) + ' 款收藏，共 ' + number(totalQuantity()) + ' 個');
      return;
    }
    const total = [...characterTotals].reduce((sum, [character, count]) => sum + (characterTabName(character) === scope ? count : 0), 0);
    const progress = total ? Math.min(owned / total, 1) * 100 : 0;
    const label = scope + (total ? '：收藏目標 ' + number(owned) + '／' + number(total) + ' 款（' + number(Math.round(progress * 10) / 10) + '%）' : '：目前沒有納入收藏目標的商品');
    tab.setAttribute('aria-label', label);
    const ring = tab.querySelector('.collection-ring-fill');
    ring.setAttribute('stroke-dashoffset', String(100 - progress));
    ring.style.opacity = owned ? '1' : '0';
  });
}
function renderHeading() {
  const personal = ['mine', 'wishlist'].includes(state.scope);
  $('catalog-title').textContent = state.scope === 'mine' ? '我的娃' : state.scope === 'wishlist' ? '願望清單' : state.scope === 'all' ? '所有角色' : state.scope + '的圖鑑';
  $('grouping-select').options[0].textContent = ['mine','wishlist','all'].includes(state.scope) ? '依角色' : '依種類';
  $('grouping-select').value = state.groupBy;
  $('ownership-control').hidden = personal;
  document.querySelectorAll('[data-ownership]').forEach(button => {
    const selected = button.dataset.ownership === state.ownership;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function renderFilterDisclosure() {
  const count = Number(Boolean(state.type)) + Number(Boolean(state.region)) + Number(Boolean(state.series));
  $('filter-options').hidden = !filtersExpanded;
  $('filter-toggle').setAttribute('aria-expanded', String(filtersExpanded));
  $('filter-toggle').setAttribute('aria-label', (filtersExpanded ? '收合' : '展開') + '地區、種類與系列篩選' + (count ? '，已套用 ' + count + ' 個條件' : ''));
  $('filter-toggle-label').textContent = filtersExpanded ? '收合' : '篩選';
  $('filter-count').hidden = !count;
  $('filter-count').textContent = String(count);
}
function renderTypeOptions() {
  const counts = new Map();
  filterItems(baseItems(), {region:state.region,series:state.series,query:state.query}).forEach(item => counts.set(item.type, (counts.get(item.type) || 0) + 1));
  const allTypes = [...new Set([...ITEM_TYPES, ...state.items.map(item => item.type)])];
  $('type-filter').innerHTML = '<option value="">全部種類</option>' + allTypes.filter(type => counts.has(type) || state.type === type).map(type => '<option value="' + escapeHTML(type) + '"' + (state.type === type ? ' selected' : '') + '>' + escapeHTML(typeLabel(type)) + '（' + number(counts.get(type) || 0) + ' 款）</option>').join('');
}
function renderRegionOptions() {
  const counts = new Map();
  filterItems(baseItems(), {type:state.type,series:state.series,query:state.query}).forEach(item => {
    const region = item.region || '日本';
    counts.set(region, (counts.get(region) || 0) + 1);
  });
  $('region-filter').innerHTML = '<option value="">全部地區</option>' + ['日本','台灣','韓國','香港','中國'].filter(region => counts.has(region) || state.region === region).map(region => '<option value="' + escapeHTML(region) + '"' + (state.region === region ? ' selected' : '') + '>' + escapeHTML(region) + '（' + number(counts.get(region) || 0) + ' 款）</option>').join('');
}
function renderSeriesOptions() {
  const available = filterItems(baseItems(), {type:state.type,region:state.region,query:state.query});
  const search = $('series-search').value.trim();
  const categories = groupSeriesOptions(available, {query:search, catalog:state.items, seriesTree:state.seriesTree});
  const option = ({key, label, count}) => '<button type="button" class="series-option ' + (state.series === key ? 'selected' : '') + '" data-series="' + escapeHTML(key) + '" aria-pressed="' + (state.series === key) + '"><span>' + escapeHTML(label) + '</span><small>' + number(count) + ' 款</small></button>';
  const hierarchy = (node, depth = 0) => {
    if (!node.hasChildren) return node.ownOptions.map(option).join('');
    const heading = escapeHTML(node.label);
    const body = node.ownOptions.map(option).join('') + node.children.map(child => hierarchy(child, depth + 1)).join('');
    if (search) return '<section class="series-category"><' + (depth ? 'p class="series-subgroup-heading"' : 'h3 class="series-search-heading"') + '>' + heading + '</' + (depth ? 'p' : 'h3') + '>' + body + '</section>';
    const selected = node.options.some(({key}) => key === state.series);
    const expanded = depth ? openSeriesSubcategories.has(node.id) : node.id === openSeriesCategory;
    return '<section class="series-category"><button type="button" class="series-category-toggle' + (selected ? ' has-selection' : '') + '" data-series-' + (depth ? 'subcategory' : 'category') + '="' + escapeHTML(node.id) + '" aria-expanded="' + expanded + '" aria-controls="series-category-' + escapeHTML(node.id) + '"><span class="series-category-name">' + heading + (selected ? icon('check') : '') + '</span><small>' + number(node.options.length) + ' 個系列</small>' + icon('chevron') + '</button><div id="series-category-' + escapeHTML(node.id) + '" class="series-category-options"' + (expanded ? '' : ' hidden') + '>' + body + '</div></section>';
  };
  let html = '<button type="button" class="series-option series-all ' + (!state.series ? 'selected' : '') + '" data-series="" aria-pressed="' + !state.series + '"><span>全部系列</span><small>' + number(available.length) + ' 款</small></button>';
  html += categories.map(category => {
    if (category.id === 'unassigned') return '<div class="series-unassigned">' + category.options.map(option).join('') + '</div>';
    if (category.children) return hierarchy(category);
    const selected = category.options.some(({key}) => key === state.series);
    const heading = escapeHTML(category.label);
    const options = category.sections
      ? category.sections.map(section => '<div class="series-subgroup" role="group" aria-label="' + escapeHTML(section.label) + '"><p class="series-subgroup-heading">' + escapeHTML(section.label) + '</p>' + section.options.map(option).join('') + '</div>').join('')
      : category.options.map(option).join('');
    if (search) return '<section class="series-category"><h3 class="series-search-heading">' + heading + '</h3>' + options + '</section>';
    const expanded = category.id === openSeriesCategory;
    return '<section class="series-category"><button type="button" class="series-category-toggle' + (selected ? ' has-selection' : '') + '" data-series-category="' + category.id + '" aria-expanded="' + expanded + '" aria-controls="series-category-' + category.id + '"><span class="series-category-name">' + heading + (selected ? icon('check') : '') + '</span><small>' + number(category.options.length) + ' 個系列</small>' + icon('chevron') + '</button><div id="series-category-' + category.id + '" class="series-category-options"' + (expanded ? '' : ' hidden') + '>' + options + '</div></section>';
  }).join('');
  if (!categories.length) html += '<p class="series-option-empty">' + (search ? '找不到符合的系列，換個名稱試試看。' : '目前沒有可選的系列，試試切換角色或調整篩選。') + '</p>';
  $('series-options').innerHTML = html;
}
function sizeSeriesPopover() {
  if ($('series-popover').hidden) return;
  const bounds = visibleViewport();
  const anchor = $('series-toggle').getBoundingClientRect();
  const below = Math.max(0,bounds.top + bounds.height - anchor.bottom - 18);
  const above = Math.max(0,anchor.top - bounds.top - 18);
  const side = below >= Math.min(240,above) ? 'below' : 'above';
  $('series-popover').dataset.side = side;
  $('series-popover').style.setProperty('--series-menu-space', (side === 'below' ? below : above) + 'px');
}
function renderFilters() {
  renderFilterDisclosure();
  renderTypeOptions();
  renderRegionOptions();
  $('series-label').textContent = (state.series ? seriesLabel(state.series) : '全部系列');
  $('series-toggle').setAttribute('aria-label', '篩選系列：' + ((state.series ? seriesLabel(state.series) : '全部系列')));
  $('series-toggle').title = (state.series ? seriesLabel(state.series) : '全部系列');
  const chips = [];
  if(state.type) chips.push(['type', '種類：' + typeLabel(state.type)]);
  if(state.region) chips.push(['region', '地區：' + state.region]);
  if(state.series) chips.push(['series', '系列：' + seriesLabel(state.series)]);
  if(state.query) chips.push(['query', '搜尋：' + state.query]);
  $('active-filters').innerHTML = chips.map(([key,label]) => '<button class="filter-chip" data-remove-filter="' + key + '" aria-label="移除' + escapeHTML(label) + '">' + escapeHTML(label) + icon('close') + '</button>').join('');
  $('reset-filters').hidden = !chips.length;
  if (!$('series-popover').hidden) renderSeriesOptions();
}
function productCard(item, { detailOnImage = false } = {}) {
  const owned = state.owned.has(item.id);
  const wished = state.wishlist.has(item.id);
  const selling = state.saleRecords[item.id]?.enabled === true;
  const mine = state.scope === 'mine';
  const name = escapeHTML(item.character + '・' + item.name);
  const detailAction = ' data-detail="' + item.id + '" aria-label="查看' + name + '的詳細資訊" aria-haspopup="dialog" aria-controls="detail-dialog"';
  const collectAction = ' data-collect="' + item.id + '" aria-label="' + (mine ? '移出我的娃' : owned ? '取消收藏' : '收藏') + name + '" aria-pressed="' + owned + '"' + (mine ? ' aria-haspopup="dialog" aria-controls="remove-dialog"' : '');
  const imageInteractive = detailOnImage || state.scope !== 'wishlist';
  const imageTag = imageInteractive ? 'button' : 'div';
  const imageAction = detailOnImage ? detailAction : imageInteractive ? collectAction : '';
  const wishConfirmation = wished && state.scope === 'wishlist' ? ' aria-haspopup="dialog" aria-controls="remove-dialog"' : '';
  return '<article class="product-card ' + (owned ? 'owned' : wished ? 'wished' : '') + (selling ? ' is-selling' : '') + '" data-item="' + item.id + '">' +
    '<div class="product-visual"><' + imageTag + ' class="product-image-button"' + imageAction + '><div class="product-image"><img data-src="' + escapeHTML(item.image) + '" alt="' + name + '" loading="lazy" decoding="async" width="200" height="200"></div></' + imageTag + '>' +
    '<div class="product-sale-ribbon" aria-label="這個商品想要賣"' + (selling ? '' : ' hidden') + '><span lang="en">FOR SALE</span></div>' +
    '<button class="wish-button ' + (wished ? 'wished' : '') + '" data-wish="' + item.id + '" aria-label="' + '將' + name + (wished ? '移出願望清單' : '加入願望清單') + '" aria-pressed="' + wished + '"' + wishConfirmation + (owned ? ' hidden' : '') + '>' + icon('star') + '</button></div>' +
    '<div class="product-meta"><h4 class="product-name" title="' + escapeHTML(item.name) + '">' + escapeHTML(item.name) + '</h4><button class="product-info-button"' + detailAction + '>' + icon('info') + '</button></div>' +
    '<button class="collect-button ' + (owned ? 'owned' : '') + '"' + collectAction + (owned ? '' : ' hidden') + '>' + icon('heart') + '</button></article>';
}
function emptyState() {
  const untouchedMine = state.scope === 'mine' && state.owned.size === 0;
  const untouchedWishes = state.scope === 'wishlist' && state.wishlist.size === 0;
  const title = untouchedMine ? '尚未收藏' : untouchedWishes ? '還沒有想收的娃娃' : '沒有符合條件的商品';
  const description = untouchedMine ? '點選上方角色，再點娃娃圖片加入收藏。' : untouchedWishes ? '逛逛角色圖鑑，點星星記下想收的娃娃。' : '請調整種類、系列或搜尋條件。';
  return '<div class="empty-state"><div class="empty-icon">' + icon(untouchedMine ? 'heart' : untouchedWishes ? 'star' : 'search') + '</div><h3>' + title + '</h3><p>' + description + '</p>' + (untouchedMine || untouchedWishes ? '' : '<button class="primary-button" data-empty-action="reset">重設篩選</button>') + '</div>';
}
function renderResultCount(items) {
  const overviewItems = state.scope === 'mine' ? state.items : baseItems();
  const stats = collectionStats(overviewItems, state.owned, state.quantities);
  $('result-count').innerHTML = state.scope === 'wishlist'
    ? '想收 <strong>' + number(overviewItems.length) + '</strong> 款'
    : '已擁有 <strong>' + number(stats.owned) + '</strong><span class="summary-slash">／</span>' + number(stats.total) + ' 款<span class="summary-dot">·</span>共 <strong>' + number(stats.pieces) + '</strong> 個';
  const filtered = state.type || state.region || state.series || state.query || state.ownership !== 'all';
  $('result-context').hidden = !filtered;
  $('result-context').textContent = '目前顯示 ' + number(items.length) + ' 款';
}

function summaryStat(label, value, unit) {
  return '<span class="summary-stat"><span class="summary-label">' + label + '</span><span class="summary-value"><strong>' + number(value) + '</strong><span>' + unit + '</span></span></span>';
}
function updateGoalBadges() {
  $('catalog-content').querySelectorAll('[data-goal-type]').forEach(badge => {
    badge.hidden = !isProgressIncluded({ type:badge.dataset.goalType }, state.includedTypes);
  });
}
function groupSummary(group) {
  if (state.scope === 'wishlist') return '<span>想收 <strong>' + number(group.items.length) + '</strong> 款</span>';
  const grouping = catalogGrouping();
  const items = matchingCatalogItems().filter(item => (grouping === 'series' ? seriesGroupKey(item, state.seriesTree) : grouping === 'type' ? item.type : item.character) === group.name);
  const stats = collectionStats(items, state.owned, state.quantities);
  return '<span>已擁有 <strong>' + number(stats.owned) + '</strong>／' + number(stats.total) + ' 款</span>';
}

function catalogColumns() { return window.innerWidth >= 1280 ? 6 : window.innerWidth >= 1000 ? 5 : window.innerWidth >= 701 ? 4 : 3; }
function catalogGroup(group) {
  const groupBy = catalogGrouping();
  const titleId = 'group-title-' + groupBy + '-' + group.items[0].id;
  const groupAvatar = groupBy === 'character' ? '<img class="group-avatar" src="' + escapeHTML(avatars.get(group.name)) + '" alt="" width="30" height="30" loading="lazy" decoding="async">' : '';
  const roleCount = groupBy === 'series' && new Set(group.items.map(item => item.character)).size > 1 ? '<span class="group-caption">' + new Set(group.items.map(item => item.character)).size + ' 個角色</span>' : '';
  const name = groupBy === 'type' ? typeLabel(group.name) : groupBy === 'series' ? seriesLabel(group.name) : group.name;
  const target = groupBy === 'type' ? '<span class="group-target" data-goal-type="' + escapeHTML(group.name) + '" aria-label="此種類已納入收藏目標"' + (isProgressIncluded({ type:group.name }, state.includedTypes) ? '' : ' hidden') + '>目標</span>' : '';
  return '<section class="catalog-group" data-count="' + group.items.length + '" style="--group-rows:' + Math.ceil(group.items.length / catalogColumns()) + '" data-group-key="' + escapeHTML(group.name) + '" aria-labelledby="' + titleId + '"><div class="group-heading">' + groupAvatar + '<h3 id="' + titleId + '">' + escapeHTML(name) + '</h3>' + target + roleCount + '<span class="group-line"></span><p class="group-summary">' + groupSummary(group) + '</p></div><div class="product-grid">' + group.items.map(item => productCard(item)).join('') + '</div></section>';
}
function renderCatalog() {
  if (!state.ready) return;
  renderHeading();
  renderFilters();
  const items = currentItems();
  renderResultCount(items);
  $('catalog-content').setAttribute('aria-busy','false');
  if (!items.length) {
    $('catalog-content').innerHTML = emptyState();
    observeCatalogSize();
    catalogImages.refresh();
    return;
  }
  const order = ['mine', 'wishlist', 'all'].includes(state.scope) ? state.characterOrder : state.characters;
  const groups = groupItems(items,catalogGrouping(),order,state.seriesTree);
  $('catalog-content').innerHTML = groups.map(catalogGroup).join('');
  observeCatalogSize();
  catalogImages.refresh();
}
function updateCollectionCard(id) {
  const card = document.querySelector('.product-card[data-item="' + id + '"]');
  if (!card) return;
  const item = itemMap.get(id);
  const owned = state.owned.has(id);
  const wished = state.wishlist.has(id);
  card.classList.toggle('owned', owned);
  card.classList.toggle('wished', wished);
  card.querySelectorAll('[data-collect]').forEach(button => {
    button.classList.toggle('owned', owned);
    button.setAttribute('aria-pressed', String(owned));
    button.setAttribute('aria-label', (state.scope === 'mine' ? '移出我的娃' : owned ? '取消收藏' : '收藏') + item.character + '・' + item.name);
  });
  card.querySelector('.collect-button').hidden = !owned;
  const wish = card.querySelector('[data-wish]');
  wish.hidden = owned;
  wish.classList.toggle('wished', wished);
  wish.setAttribute('aria-pressed', String(wished));
  wish.setAttribute('aria-label', '將' + item.character + '・' + item.name + (wished ? '移出願望清單' : '加入願望清單'));
}
function updateSaleCard(id) {
  if ($('selling-dialog').open) renderSellingList();
  const card = $('catalog-content').querySelector('.product-card[data-item="' + id + '"]');
  if (!card) return;
  const selling = state.saleRecords[id]?.enabled === true;
  card.classList.toggle('is-selling',selling);
  card.querySelector('.product-sale-ribbon').hidden = !selling;
}
function updateCollectionCatalog(id, batch = null) {
  const personal = state.scope === 'mine' || state.scope === 'wishlist';
  const items = batch?.items || currentItems();
  const content = $('catalog-content');
  if (!batch) {
    if (personal) { renderTypeOptions(); renderRegionOptions(); if (!$('series-popover').hidden) renderSeriesOptions(); }
    renderResultCount(items);
  }
  if (!items.length) { if (!content.querySelector('.empty-state')) content.innerHTML = emptyState(); return; }
  const sections = batch?.sections || new Map([...content.querySelectorAll('.catalog-group')].map(section => [section.dataset.groupKey, section]));
  const order = state.scope === 'all' || personal ? state.characterOrder : state.characters;
  const groups = batch?.groups || groupItems(items, catalogGrouping(), order, state.seriesTree);
  const item = itemMap.get(id);
  const key = catalogGrouping() === 'series' ? seriesGroupKey(item, state.seriesTree) : catalogGrouping() === 'type' ? item.type : item.character;
  const section = sections.get(key);
  const index = groups.findIndex(group => group.name === key);
  if (index === -1) { section?.remove(); sections.delete(key); return; }
  const group = groups[index];
  if (section) { section.dataset.count = group.items.length; section.style.setProperty('--group-rows', Math.ceil(group.items.length / catalogColumns())); }
  if (!section) {
    if (!personal && state.ownership === 'all') return;
    content.querySelector('.empty-state')?.remove();
    const nextSection = groups.slice(index + 1).map(group => sections.get(group.name)).find(Boolean);
    if (nextSection) nextSection.insertAdjacentHTML('beforebegin', catalogGroup(group));
    else content.insertAdjacentHTML('beforeend', catalogGroup(group));
    sections.set(key, nextSection ? nextSection.previousElementSibling : content.lastElementChild);
    return;
  }
  section.querySelector('.group-summary').innerHTML = groupSummary(group);
  if (!personal && state.ownership === 'all') { updateCollectionCard(id); return; }
  const caption = section.querySelector('.group-caption');
  if (caption) caption.textContent = new Set(group.items.map(item => item.character)).size + ' 個角色';
  const card = section.querySelector('[data-item="' + id + '"]');
  const itemIndex = group.items.findIndex(item => item.id === id);
  if (itemIndex === -1) { card?.remove(); return; }
  if (card) { updateCollectionCard(id); return; }
  const nextItem = group.items[itemIndex + 1];
  const nextCard = nextItem && section.querySelector('[data-item="' + nextItem.id + '"]');
  if (nextCard) nextCard.insertAdjacentHTML('beforebegin', productCard(item));
  else section.querySelector('.product-grid').insertAdjacentHTML('beforeend', productCard(item));
}

function applySyncedCollection(saved) {
  // 首次顯示前只準備正確帳號的資料，不先繪製訪客收藏再換成帳號收藏。
  if (!state.ready) { applySaved(saved); return; }
  // 比較收藏的識別碼，沒有變更就不重新計算圖鑑或重建卡片。
  const wished = new Set(saved.wishlist);
  const changed = [...new Set([...Object.keys(state.quantities), ...Object.keys(saved.quantities), ...state.wishlist, ...wished])]
    .filter(id => state.quantities[id] !== saved.quantities[id] || state.wishlist.has(id) !== wished.has(id));
  const orderChanged = JSON.stringify(state.characterOrder) !== JSON.stringify(saved.characterOrder);
  const goalsChanged = JSON.stringify(state.includedTypes) !== JSON.stringify(saved.includedTypes);
  const recordsChanged = JSON.stringify(state.purchaseRecords) !== JSON.stringify(saved.purchaseRecords || {});
  const changedSales = [...new Set([...Object.keys(state.saleRecords),...Object.keys(saved.saleRecords || {})])]
    .filter(id => JSON.stringify(state.saleRecords[id]) !== JSON.stringify(saved.saleRecords?.[id]));
  const salesChanged = changedSales.length > 0;
  if (!changed.length && !orderChanged && !goalsChanged && !recordsChanged && !salesChanged) return;
  const position = dialogController.position || capturePosition($('catalog-content'));
  const grouping = state.groupBy;
  applySaved(saved); state.groupBy = grouping;
  if (goalsChanged) { characterTotals = progressTotals(state.items,state.includedTypes); updateProgressSetting(); updateGoalBadges(); }
  if (orderChanged) renderTabs(); else updateCollectionTabs();
  if (changed.length || orderChanged) {
    const items = currentItems();
    const personal = state.scope === 'mine' || state.scope === 'wishlist';
    const groups = groupItems(items, catalogGrouping(), personal || state.scope === 'all' ? state.characterOrder : state.characters, state.seriesTree);
    const sections = new Map([...$('catalog-content').querySelectorAll('.catalog-group')].map(section => [section.dataset.groupKey, section]));
    const batch = { items, groups, sections };
    if (personal) { renderTypeOptions(); renderRegionOptions(); if (!$('series-popover').hidden) renderSeriesOptions(); }
    renderResultCount(items);
    for (const id of changed) if (itemMap.has(id)) updateCollectionCatalog(id, batch);
    if (orderChanged) for (const group of groups) { const section = sections.get(group.name); if (section) $('catalog-content').append(section); }
    observeCatalogSize(); catalogImages.update();
    if (!dialogController.position) restorePosition(position, $('catalog-content'));
  }
  for (const id of changedSales) updateSaleCard(id);
  updateDataSummary();
  if (activeDetail && $('detail-dialog').open && document.activeElement?.id !== 'detail-quantity') updateDetailCollection();
  if (activeDetail && $('detail-dialog').open && recordsChanged) updateDetailRecord();
  if (activeDetail && $('detail-dialog').open && salesChanged) updateDetailSale();
}

function setScope(scope) {
  if (state.scope === scope || (!['mine', 'wishlist', 'all'].includes(scope) && !characterTabOrder(state.characters).includes(scope))) return;
  const enteringPersonal = scope === 'mine' || scope === 'wishlist';
  dismissToast();
  state.scope = scope;
  state.ownership = 'all';
  if (enteringPersonal) {
    clearTimeout(searchTimer);
    state.type = ''; state.region = ''; state.series = ''; state.query = '';
    $('catalog-search').value = '';
  }
  closeSeries();
  renderTabs();
  renderCatalog();
}
function resetFilters() {
  clearTimeout(searchTimer);
  state.type = ''; state.region = ''; state.series = ''; state.query = ''; state.ownership = 'all';
  $('catalog-search').value = '';
  renderCatalog();
}
function refreshCollection(changedId) {
  persist();
  updateCollectionTabs();
  if (changedId) { updateCollectionCatalog(changedId); observeCatalogSize(); catalogImages.update(); } else renderCatalog();
  if (activeDetail && $('detail-dialog').open) updateDetailCollection();
  if ($('selling-dialog').open) renderSellingList();
}
function confirmRemoval(id, kind, origin = document.activeElement) {
  const item = itemMap.get(id);
  const wishlist = kind === 'wishlist';
  pendingRemoval = {id, kind, origin};
  $('remove-title').textContent = wishlist ? '移出願望清單？' : '移出我的娃？';
  $('remove-dialog').querySelector('.warning-icon').innerHTML = icon(wishlist ? 'star' : 'heart');
  $('remove-description').textContent = '要將' + item.character + '的「' + item.name + '」移出' + (wishlist ? '願望清單' : '我的娃') + '嗎？' + (!wishlist && quantityOf(id) > 1 ? '目前記錄的 ' + number(quantityOf(id)) + ' 個會一併移除。' : '');
  openDialog('remove-dialog');
}
function requestCollectionChange(id) {
  const item = itemMap.get(id);
  if (!item) return;
  if (state.owned.has(id) && (state.scope === 'mine' || quantityOf(id) > 1)) {
    confirmRemoval(id, 'collection');
    return;
  }
  toggleOwned(id);
}
function toggleOwned(id, {showUndo = state.scope === 'mine', origin = document.activeElement, confirmed = false} = {}) {
  setQuantity(id, state.owned.has(id) ? 0 : 1, {showUndo, origin, confirmed});
}
function restoreItem(id, quantity, wished) {
  if (quantity > 0) {
    state.owned.add(id);
    state.quantities[id] = quantity;
  } else {
    state.owned.delete(id);
    delete state.quantities[id];
  }
  if (wished && !quantity) state.wishlist.add(id); else state.wishlist.delete(id);
}
function focusAfterRemoval(origin, neighbor) {
  if (!origin || origin.isConnected) return;
  const target = neighbor?.isConnected ? neighbor : $('catalog-title');
  if (target.tagName === 'H1') target.tabIndex = -1;
  target.focus({preventScroll:true});
}
function setQuantity(id, quantity, {showUndo = false, origin = document.activeElement, confirmed = false} = {}) {
  const item = itemMap.get(id);
  if (!item || !Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) return;
  const before = quantityOf(id);
  if (before === quantity) return;
  if (!confirmed && purchaseHub.requestQuantityChange(id,quantity,() => setQuantity(id,quantity,{showUndo:true,origin,confirmed:true}))) {
    if (activeDetail === id && $('detail-dialog').open) updateDetailCollection();
    return;
  }
  const previousHeld = purchaseHub.quantityChanged(id,quantity);
  const wished = state.wishlist.has(id);
  dismissToast();
  const card = origin?.closest('.product-card');
  const neighbor = card?.nextElementSibling?.querySelector('button.product-image-button, .product-info-button') || card?.previousElementSibling?.querySelector('button.product-image-button, .product-info-button');
  restoreItem(id, quantity, false);
  refreshCollection(id);
  focusAfterRemoval(origin, neighbor);
  if (!showUndo) return;
  toast(quantity === 0 ? '已移出我的娃' : '已更新收藏數量', () => {
    purchaseHub.restoreQuantity(id,previousHeld);
    restoreItem(id, before, wished);
    refreshCollection(id);
    toast('已復原收藏變更');
  });
}
function toggleWish(id, origin = document.activeElement, {confirmed = false} = {}) {
  if (!itemMap.has(id) || state.owned.has(id)) return;
  const wished = state.wishlist.has(id);
  if (wished && state.scope === 'wishlist' && !confirmed) {
    confirmRemoval(id, 'wishlist', origin);
    return;
  }
  dismissToast();
  const card = origin?.closest('.product-card');
  const neighbor = card?.nextElementSibling?.querySelector('button.product-image-button, .product-info-button') || card?.previousElementSibling?.querySelector('button.product-image-button, .product-info-button');
  if (wished) state.wishlist.delete(id); else state.wishlist.add(id);
  refreshCollection(id);
  focusAfterRemoval(origin, neighbor);
  if (state.scope === 'wishlist' && wished) {
    toast('已移出願望清單', () => {
      if (!state.owned.has(id)) state.wishlist.add(id);
      refreshCollection(id);
      toast('已復原願望清單');
    });
  }
}
function changeDetailQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) {
    updateDetailCollection();
    toast('請輸入 0～' + number(MAX_QUANTITY) + ' 的整數');
    return;
  }
  setQuantity(activeDetail, quantity, {showUndo:quantity === 0});
}
function safeURL(value) {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''; } catch { return ''; }
}
function openDialog(id) {
  dialogController.open($(id));
}
function updateDetailCollection() {
  const owned = state.owned.has(activeDetail);
  const wished = state.wishlist.has(activeDetail);
  const fromFriend = $('detail-content').classList.contains('from-friend');
  const button = $('detail-collect');
  button.classList.toggle('is-owned', owned);
  button.setAttribute('aria-pressed', String(owned));
  button.innerHTML = icon('heart') + (fromFriend ? (owned ? '取消我的收藏' : '加入我的收藏') : (owned ? '取消收藏' : '加入收藏'));
  button.hidden = owned;
  $('detail-quantity-panel').hidden = !owned;
  $('detail-quantity-panel').querySelector('label').textContent = fromFriend ? '我的收藏數量' : '收藏數量';
  const input = $('detail-quantity');
  if (input.value === '' || Number(input.value) !== quantityOf(activeDetail)) input.value = String(quantityOf(activeDetail));
  $('quantity-plus').disabled = quantityOf(activeDetail) >= MAX_QUANTITY;
  const wish = $('detail-wish');
  wish.hidden = owned;
  wish.classList.toggle('wished', wished);
  wish.setAttribute('aria-pressed', String(wished));
  if (wished && state.scope === 'wishlist') {
    wish.setAttribute('aria-haspopup', 'dialog');
    wish.setAttribute('aria-controls', 'remove-dialog');
  } else {
    wish.removeAttribute('aria-haspopup');
    wish.removeAttribute('aria-controls');
  }
  wish.innerHTML = icon('star') + (fromFriend ? (wished ? '移出我的願望清單' : '加入我的願望清單') : (wished ? '移出願望清單' : '加入願望清單'));
  updateDetailRecord();
}
function detailRecordLabel(label) {
  return ($('detail-content').classList.contains('from-friend') ? '我的' : '') + label;
}
function resizeDetailSalePrice() {
  const units = [...$('detail-sale-price').value].reduce((width,character) => width + (/[.,]/.test(character) ? .5 : 1),0);
  $('detail-sale-price-field').style.setProperty('--sale-price-ch',String(Math.max(3,units)));
}
function updateDetailSale() {
  const record = state.saleRecords[activeDetail];
  const enabled = record?.enabled === true;
  $('detail-sale-toggle').setAttribute('aria-pressed',String(enabled));
  $('detail-sale-toggle').classList.toggle('is-selling',enabled);
  $('detail-sale-toggle').innerHTML = icon('sale') + ($('detail-content').classList.contains('from-friend') ? '我想要賣' : '想要賣');
  $('detail-sale-price-field').hidden = !enabled;
  $('detail-sale-ribbon').hidden = !enabled;
  const input = $('detail-sale-price');
  if (document.activeElement !== input) input.value = record?.price || '';
  resizeDetailSalePrice();
}
function toggleDetailSale() {
  const previous = state.saleRecords[activeDetail];
  const enabled = previous?.enabled !== true;
  state.saleRecords[activeDetail] = {enabled,price:previous?.price || ''};
  persist(); updateDetailSale(); updateSaleCard(activeDetail);
  $('detail-sale-error').hidden = true;
  $('detail-sale-price').setAttribute('aria-invalid','false');
  $('detail-sale-status').textContent = storageOK ? (enabled ? '已標記想要賣' : '已取消販售標記') : '目前無法儲存，請匯出備份';
}
function saveDetailSalePrice() {
  if (!state.saleRecords[activeDetail]?.enabled) return;
  const input = $('detail-sale-price'), text = input.value.trim();
  const price = normalizePurchaseAmount(text);
  const valid = !text || price !== '';
  input.setAttribute('aria-invalid',String(!valid));
  $('detail-sale-error').hidden = valid;
  if (!valid) return;
  if (state.saleRecords[activeDetail].price !== price) {
    state.saleRecords[activeDetail] = {...state.saleRecords[activeDetail],price};
    persist();
  }
  $('detail-sale-status').textContent = storageOK ? '售價已自動儲存' : '目前無法儲存，請匯出備份';
}
function detailRecordMarkup() {
  return '<section id="detail-record" class="collection-record" aria-label="' + detailRecordLabel('收藏紀錄') + '"></section>';
}
function updateDetailRecord() { if (activeDetail && $('detail-dialog').open) purchaseHub.renderDetail(activeDetail); }
function renderDetail(id) {
  const item = itemMap.get(id);
  if (!item) return;
  activeDetail = id;
  const url = safeURL(item.url);
  const fromFriend = Boolean($('friends-dialog')?.open);
  $('detail-content').classList.toggle('from-friend',fromFriend);
  const ownContext = fromFriend ? '<div class="detail-own-context" role="note"><strong>我的收藏與紀錄</strong><p>這裡的操作是更新自己的圖鑑，不會更改好友的資料</p></div>' : '';
  const productFacts = [
    ['系列', seriesLabel(seriesKey(item))],
    ...(item.limitedLocation ? [['限定地點', item.limitedLocation]] : []),
    ...(item.size ? [['尺寸', item.size]] : []),
    ...(item.sku ? [['商品編號', item.sku]] : [])
  ];
  const productInformation = '<dl class="detail-product-facts" aria-label="商品資訊">' + productFacts.map(([label, value], index) => {
    if (url && index === productFacts.length - 1) {
      return '<dt class="detail-final-label">' + escapeHTML(label) + '</dt><dd class="detail-final-value"><span>' + escapeHTML(value) + '</span><a class="detail-link" href="' + escapeHTML(url) + '" target="_blank" rel="noopener noreferrer">商品頁面' + icon('external') + '</a></dd>';
    }
    return '<dt>' + escapeHTML(label) + '</dt><dd>' + escapeHTML(value) + '</dd>';
  }).join('') + '</dl>';
  $('detail-content').innerHTML = '<div class="detail-layout"><button class="icon-button detail-close" data-close="detail-dialog" aria-label="關閉商品詳情">' + icon('close') + '</button><div class="detail-visual"><div id="detail-sale-ribbon" class="detail-sale-ribbon" aria-label="這個商品想要賣" hidden><span lang="en">FOR SALE</span></div><img src="' + escapeHTML(item.image) + '" alt="' + escapeHTML(item.character + '・' + item.name) + '" width="340" height="340"></div><div class="detail-info"><div class="detail-overview"><div class="detail-eyebrow"><span>' + escapeHTML(item.character) + '</span><span>' + escapeHTML(typeLabel(item.type)) + '</span><span>' + escapeHTML(item.region || '日本') + '</span></div><div class="detail-sale"><div id="detail-sale-price-field" hidden><label for="detail-sale-price">' + (fromFriend ? '我的售價（台幣）' : '售價（台幣）') + '</label><div class="detail-sale-money"><span aria-hidden="true">NT$</span><input id="detail-sale-price" type="text" inputmode="decimal" autocomplete="off" maxlength="20" placeholder="售價" aria-describedby="detail-sale-error detail-sale-status"></div><p id="detail-sale-error" class="detail-sale-error" role="alert" hidden>請輸入 0～9,999,999,999.99 的金額</p></div><button type="button" id="detail-sale-toggle" class="detail-sale-toggle" aria-pressed="false" aria-controls="detail-sale-price-field"></button><output id="detail-sale-status" class="visually-hidden" aria-live="polite"></output></div></div><h2 id="detail-title">' + escapeHTML(item.name) + '</h2>' +
    productInformation + ownContext + '<div class="detail-collection"><div id="detail-quantity-panel" class="quantity-panel" hidden><div class="quantity-row"><label for="detail-quantity">收藏數量</label><div class="quantity-stepper"><button id="quantity-minus" data-quantity-step="-1" aria-label="減少收藏數量">' + icon('minus') + '</button><input id="detail-quantity" type="number" inputmode="numeric" min="0" max="' + MAX_QUANTITY + '" step="1" aria-describedby="quantity-help"><button id="quantity-plus" data-quantity-step="1" aria-label="增加收藏數量">' + icon('plus') + '</button></div></div><span id="quantity-help" class="visually-hidden">數量變更會自動儲存，設為 0 會取消收藏</span></div>' +
    '<button class="primary-button" id="detail-collect" data-collect="' + id + '"></button><button class="detail-wish-button" id="detail-wish" data-wish="' + id + '"></button></div>' +
    detailRecordMarkup() + '</div></div>';
  updateDetailCollection();
  updateDetailSale();
  purchaseHub.renderDetail(activeDetail);
  openDialog('detail-dialog');
}
function closeSeries() {
  $('series-popover').hidden = true;
  $('series-toggle').setAttribute('aria-expanded','false');
}
function showData() {
  updateDataSummary();
  $('data-message').textContent = '';
  $('data-message').classList.remove('error');
  const existing = $('restore-cleared');
  if (existing) existing.remove();
  try {
    if (localStorage.getItem(lastClearKey)) {
      const restore = document.createElement('button');
      restore.id = 'restore-cleared';
      restore.className = 'text-button';
      restore.textContent = '復原上次清除的收藏';
      restore.addEventListener('click', restoreCleared);
      $('data-message').after(restore);
    }
  } catch {}
  openDialog('data-dialog');
}
function updateDataSummary() {
  $('data-count').textContent = number(state.owned.size) + ' 款收藏，共 ' + number(totalQuantity()) + ' 個';
  $('data-wish-count').textContent = '願望清單 ' + number(state.wishlist.size) + ' 款';
}
function restoreCleared() {
  try {
    const previous = normalizeSaved(JSON.parse(localStorage.getItem(lastClearKey)),state.characters,new Set(itemMap.keys()),itemAliases);
    const restored = mergeSaved(savedValue(), {...previous, wishlist:[], characterOrder:state.characterOrder, groupBy:state.groupBy, includedTypes:{...state.includedTypes}, includeMetalTags:state.includedTypes['地方限定吊牌'] !== false}, state.characters, new Set(itemMap.keys()), itemAliases);
    applySaved(restored);
    refreshCollection();
    localStorage.removeItem(lastClearKey);
    $('restore-cleared')?.remove();
    updateDataSummary();
    toast('已復原上次清除的收藏');
  } catch { toast('找不到可復原的紀錄，請匯入收藏備份'); }
}

const characterSorter = createCharacterSorter($('character-tabs'), {
  enabled: () => charactersExpanded,
  getOrder: () => characterTabOrder(state.characterOrder),
  onCommit: (order, character) => {
    state.characterOrder = reorderCharacterTabs(state.characterOrder, order);
    const stored = persist();
    if (['mine', 'wishlist', 'all'].includes(state.scope)) renderCatalog();
    $('character-sort-status').textContent = character + '已移到第 ' + (order.indexOf(character) + 1) + ' 位' + (stored ? '，順序已儲存' : '，目前無法儲存');
  }
});
$('character-tabs').addEventListener('click', event => {
  const target = event.target.closest('[data-scope]');
  if (!target) return;
  setCharactersExpanded(false);
  setScope(target.dataset.scope);
  $('character-tabs').querySelector('.character-tab.active')?.focus({ preventScroll:true });
});
$('character-toggle').addEventListener('click', () => {
  if (state.ready) setCharactersExpanded(!charactersExpanded);
});
$('filter-toggle').addEventListener('click', () => {
  filtersExpanded = !filtersExpanded;
  if (!filtersExpanded) closeSeries();
  renderFilterDisclosure();
  try { localStorage.setItem(filterExpansionKey, String(filtersExpanded)); } catch {}
});
renderFilterDisclosure();
$('type-filter').addEventListener('change', event => { state.type = event.target.value; renderCatalog(); });
$('region-filter').addEventListener('change', event => { state.region = event.target.value; renderCatalog(); });
$('series-toggle').addEventListener('click', () => {
  const opening = $('series-popover').hidden;
  if (!opening) { closeSeries(); return; }
  $('series-popover').hidden = false;
  $('series-toggle').setAttribute('aria-expanded','true');
  $('series-search').value = '';
  const selectedCategory = groupSeriesOptions(state.items, {seriesTree:state.seriesTree}).find(category => category.options.some(({key}) => key === state.series));
  openSeriesCategory = selectedCategory?.id || '';
  openSeriesSubcategories.clear();
  const expandSelected = node => {
    if (node.options.some(({key}) => key === state.series)) {
      openSeriesSubcategories.add(node.id);
      for (const child of node.children || []) expandSelected(child);
    }
  };
  if (selectedCategory) expandSelected(selectedCategory);
  renderSeriesOptions();
  sizeSeriesPopover();
  const options = $('series-options');
  options.scrollTop = 0;
  const selected = options.querySelector('.series-option.selected');
  if (selected) {
    const bounds = options.getBoundingClientRect();
    const position = selected.getBoundingClientRect();
    options.scrollTop = position.top - bounds.top - (options.clientHeight - position.height) / 2;
  }
  $('series-toggle').focus({ preventScroll:true });
});
$('series-search').addEventListener('input', () => { renderSeriesOptions(); $('series-options').scrollTop = 0; });
window.addEventListener('resize', sizeSeriesPopover);
window.visualViewport?.addEventListener('resize', sizeSeriesPopover);
window.visualViewport?.addEventListener('scroll', sizeSeriesPopover);
let groupResizeFrame;
window.addEventListener('resize', () => {
  cancelAnimationFrame(groupResizeFrame);
  groupResizeFrame = requestAnimationFrame(() => {
    $('catalog-content').querySelectorAll('.catalog-group').forEach(group => group.style.setProperty('--group-rows', Math.ceil(Number(group.dataset.count) / catalogColumns())));
  });
}, { passive:true });
$('series-options').addEventListener('click', event => {
  const subcategory = event.target.closest('[data-series-subcategory]');
  if (subcategory) {
    const id = subcategory.dataset.seriesSubcategory;
    const expanded = !openSeriesSubcategories.has(id);
    if (expanded) openSeriesSubcategories.add(id); else openSeriesSubcategories.delete(id);
    subcategory.setAttribute('aria-expanded', String(expanded));
    $(subcategory.getAttribute('aria-controls')).hidden = !expanded;
    if (expanded) $('series-options').scrollTop += subcategory.getBoundingClientRect().top - $('series-options').getBoundingClientRect().top;
    return;
  }
  const category = event.target.closest('[data-series-category]');
  if (category) {
    openSeriesCategory = openSeriesCategory === category.dataset.seriesCategory ? '' : category.dataset.seriesCategory;
    $('series-options').querySelectorAll('[data-series-category]').forEach(button => {
      const expanded = button.dataset.seriesCategory === openSeriesCategory;
      button.setAttribute('aria-expanded', String(expanded));
      $(button.getAttribute('aria-controls')).hidden = !expanded;
    });
    if (openSeriesCategory) $('series-options').scrollTop += category.getBoundingClientRect().top - $('series-options').getBoundingClientRect().top;
    return;
  }
  const target = event.target.closest('[data-series]');
  if (target) {
    state.series = target.dataset.series;
    if(state.series) { state.groupBy = 'series'; persist(); }
    closeSeries();
    renderCatalog(); $('series-toggle').focus();
  }
});
let searchTimer;
$('catalog-search').addEventListener('input', event => {
  clearTimeout(searchTimer);
  const value = event.target.value;
  searchTimer = setTimeout(() => { state.query = value; renderCatalog(); },150);
});
$('grouping-select').addEventListener('change', event => {
  state.groupBy = event.target.value;
  persist(); renderCatalog();
});
$('ownership-control').addEventListener('click', event => {
  const button = event.target.closest('[data-ownership]');
  if (!button || state.ownership === button.dataset.ownership) return;
  state.ownership = button.dataset.ownership;
  renderCatalog();
});
$('reset-filters').addEventListener('click', resetFilters);
$('active-filters').addEventListener('click', event => {
  const key = event.target.closest('[data-remove-filter]')?.dataset.removeFilter;
  if(!key) return;
  state[key] = '';
  if(key === 'query') $('catalog-search').value = '';
  renderCatalog();
});
$('catalog-content').addEventListener('click', event => {
  const collect = event.target.closest('[data-collect]');
  const wish = event.target.closest('[data-wish]');
  const detail = event.target.closest('[data-detail]');
  const empty = event.target.closest('[data-empty-action]');
  if(collect) requestCollectionChange(collect.dataset.collect);
  else if(wish) toggleWish(wish.dataset.wish, wish);
  else if(detail) renderDetail(detail.dataset.detail);
  else if(empty) resetFilters();
});
$('detail-content').addEventListener('click', event => {
  const collect = event.target.closest('[data-collect]');
  const wish = event.target.closest('[data-wish]');
  const step = event.target.closest('[data-quantity-step]');
  if (collect) requestCollectionChange(collect.dataset.collect);
  else if (wish) toggleWish(wish.dataset.wish, wish);
  else if (step) changeDetailQuantity(quantityOf(activeDetail) + Number(step.dataset.quantityStep));
  else if (event.target.closest('#detail-sale-toggle')) toggleDetailSale();
});
$('detail-content').addEventListener('input', event => {
  const input = event.target;
  if (input.id === 'detail-quantity' && input.value.trim() !== '' && input.validity.valid) changeDetailQuantity(Number(input.value));
  if (input.id === 'detail-sale-price') { resizeDetailSalePrice(); saveDetailSalePrice(); }
});
$('detail-content').addEventListener('change', event => {
  if (event.target.id === 'detail-quantity') changeDetailQuantity(event.target.value.trim() === '' ? NaN : Number(event.target.value));
});
$('detail-content').addEventListener('keydown', event => {
  if (['detail-quantity','detail-sale-price'].includes(event.target.id) && event.key === 'Enter') event.target.blur();
});
$('remove-dialog').addEventListener('close', () => { pendingRemoval = null; });
$('confirm-remove').addEventListener('click', () => {
  const removal = pendingRemoval;
  if (!removal) return;
  $('remove-dialog').close();
  if (removal.kind === 'wishlist') {
    if (state.wishlist.has(removal.id)) toggleWish(removal.id, removal.origin, {confirmed:true});
  } else if (state.owned.has(removal.id)) toggleOwned(removal.id, {showUndo:true, origin:removal.origin, confirmed:true});
});
$('more-button').addEventListener('click', () => {
  $('more-menu').hidden = !$('more-menu').hidden;
  $('more-button').setAttribute('aria-expanded',String(!$('more-menu').hidden));
});
function showCollectionSettings() {
  $('more-menu').hidden = true;
  $('more-button').setAttribute('aria-expanded', 'false');
  openDialog('settings-dialog');
}
$('open-settings').addEventListener('click', showCollectionSettings);
function renderSellingList() {
  const items = state.items.filter(item => state.saleRecords[item.id]?.enabled === true && state.owned.has(item.id));
  const scrollTop = $('selling-dialog').scrollTop;
  $('selling-count').textContent = '共 ' + number(items.length) + ' 款';
  $('selling-content').innerHTML = items.length
    ? '<div class="product-grid selling-grid">' + items.map(item => productCard(item, {detailOnImage:true})).join('') + '</div>'
    : '<div class="empty-state"><div class="empty-icon">' + icon('sale') + '</div><h3>目前沒有待出售的娃娃</h3><p>有收藏數量的娃娃，開啟「想要賣」就會出現在這裡。</p></div>';
  $('selling-dialog').scrollTop = scrollTop;
  sellingImages.refresh();
}
function showSellingList() {
  $('more-menu').hidden = true;
  $('more-button').setAttribute('aria-expanded', 'false');
  renderSellingList();
  openDialog('selling-dialog');
  sellingImages.refresh();
}
$('open-selling').addEventListener('click', showSellingList);
$('selling-content').addEventListener('click', event => {
  const detail = event.target.closest('[data-detail]');
  if (detail) renderDetail(detail.dataset.detail);
});
$('selling-info').addEventListener('click', () => {
  $('selling-info').setAttribute('aria-expanded', 'true');
  openDialog('selling-help');
});
$('selling-help').addEventListener('close', () => {
  $('selling-info').setAttribute('aria-expanded', 'false');
  if ($('selling-dialog').open) $('selling-info').focus({preventScroll:true});
});
$('selling-dialog').addEventListener('close', () => $('more-button').focus({preventScroll:true}));
$('detail-dialog').addEventListener('close', () => {
  if ($('selling-dialog').open && !$('selling-dialog').contains(document.activeElement)) {
    $('selling-dialog').querySelector('[data-close]').focus({preventScroll:true});
  }
});
$('settings-dialog').addEventListener('close', () => $('more-button').focus({preventScroll:true}));
function showGuide({ progress = false } = {}) {
  $('more-menu').hidden = true;
  $('more-button').setAttribute('aria-expanded', 'false');
  if (progress) {
    $('guide-progress').open = true;
  }
  openDialog('guide-dialog');
  if (progress) $('guide-progress').scrollIntoView({ block:'nearest' });
  else $('guide-dialog').scrollTop = 0;
}
$('open-guide').addEventListener('click', () => showGuide());
$('share-catalog').addEventListener('click', async () => {
  const url = 'https://yi-yaha.github.io/chiikawa-collection/';
  $('more-menu').hidden = true;
  $('more-button').setAttribute('aria-expanded', 'false');
  $('more-button').focus({ preventScroll:true });
  try {
    await navigator.clipboard.writeText(url);
    toast('已複製圖鑑網址');
  } catch {
    window.prompt('無法自動複製，請複製下方的圖鑑網址：', url);
  }
});
$('settings-guide').addEventListener('click', () => showGuide({ progress:true }));
$('guide-dialog').addEventListener('close', () => ($('settings-dialog').open ? $('settings-guide') : $('more-button')).focus({preventScroll:true}));
$('progress-type-options').addEventListener('change', event => {
  const input = event.target.closest('[data-progress-type]');
  if (!input || !PROGRESS_TYPES.includes(input.dataset.progressType)) return;
  if (!state.ready) return;
  state.includedTypes[input.dataset.progressType] = input.checked;
  characterTotals = progressTotals(state.items, state.includedTypes);
  updateCollectionTabs();
  updateGoalBadges();
  persist();
});
$('open-data').addEventListener('click', () => { $('more-menu').hidden = true; $('more-button').setAttribute('aria-expanded','false'); showData(); });
document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]');
  if(close) $(close.dataset.close).close();
  if(!event.target.closest('.series-anchor')) closeSeries();
  if(!event.target.closest('.menu-anchor')) { $('more-menu').hidden = true; $('more-button').setAttribute('aria-expanded','false'); }
  if(charactersExpanded && !event.target.closest('.character-nav')) setCharactersExpanded(false);
});
document.addEventListener('keydown', event => {
  if(event.key === 'Escape') {
    if (dialogController.top) return;
    if(charactersExpanded) setCharactersExpanded(false, { focusToggle:true });
    if(!$('series-popover').hidden) { closeSeries(); $('series-toggle').focus(); }
    if(!$('more-menu').hidden) $('more-button').focus();
    $('more-menu').hidden = true; $('more-button').setAttribute('aria-expanded','false');
  }
});
$('export-data').addEventListener('click', () => {
  const content = {...savedValue(),app:'chiikawa-collection',exportedAt:new Date().toISOString()};
  const blob = new Blob([JSON.stringify(content,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '吉伊卡哇收藏備份-' + new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date()) + '.json';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  $('data-message').textContent = '已準備好收藏備份，請保管下載的檔案。';
});
$('import-data').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if(!file) return;
  try {
    if(file.size > 5*1024*1024) throw new Error('檔案過大，請選擇由本圖鑑匯出的收藏備份。');
    const data = JSON.parse(await file.text());
    if(!data || typeof data !== 'object' || ![1,2].includes(data.version) || !Array.isArray(data.owned) || !Array.isArray(data.characterOrder) || (data.version === 2 && (!Array.isArray(data.wishlist) || !data.quantities || typeof data.quantities !== 'object' || Array.isArray(data.quantities)))) throw new Error('這不是有效的收藏備份，請選擇本圖鑑匯出的 JSON 檔案。');
    const normalized = normalizeSaved(data,state.characters,new Set(itemMap.keys()),itemAliases);
    if((data.owned.length || Object.keys(data.quantities || {}).length || data.wishlist?.length) && !normalized.owned.length && !normalized.wishlist.length) throw new Error('備份中的商品與目前圖鑑不相符，原本紀錄已保留。');
    const previousSize = state.owned.size;
    applySaved(mergeSaved(savedValue(), data, state.characters, new Set(itemMap.keys()), itemAliases));
    characterTotals = progressTotals(state.items, state.includedTypes);
    updateProgressSetting();
    refreshCollection();
    $('data-message').classList.remove('error');
    $('data-message').textContent = '匯入完成，新增 ' + (state.owned.size-previousSize) + ' 款收藏。數量採較大的紀錄，不重複累加；願望清單已合併。';
    updateDataSummary();
  } catch(error) { $('data-message').classList.add('error'); $('data-message').textContent = error instanceof SyntaxError ? '無法讀取這份檔案，請選擇有效的收藏備份。' : error.message; }
  event.target.value = '';
});
$('ask-clear').addEventListener('click', () => {
  if(!state.owned.size) { $('data-message').textContent = '目前沒有收藏紀錄可以清除。'; return; }
  $('clear-description').textContent = '將清除 ' + number(state.owned.size) + ' 款收藏（共 ' + number(totalQuantity()) + ' 個）。購買金額與備註、願望清單、商品圖鑑與角色順序會保留。你也可以先匯出備份。';
  $('data-dialog').close();
  openDialog('clear-dialog');
});
$('clear-dialog').addEventListener('close', () => { if(!$('data-dialog').open) showData(); });
$('confirm-clear').addEventListener('click', () => {
  try { localStorage.setItem(lastClearKey,JSON.stringify(savedValue())); }
  catch { toast('無法建立復原紀錄，請先匯出備份後再試'); return; }
  state.owned.clear(); state.quantities = {}; refreshCollection(); $('clear-dialog').close();
  toast('已清除收藏紀錄，商品圖鑑已保留',restoreCleared);
});
document.addEventListener('error', event => {
  if(!(event.target instanceof HTMLImageElement)) return;
  const img = event.target;
  if(img.closest('.avatar,.hero-art,.group-heading')) { img.style.visibility='hidden'; return; }
  const fallback = document.createElement('span');
  fallback.className='image-fallback';
  fallback.innerHTML=icon('box')+'<span>圖片無法載入</span>';
  img.replaceWith(fallback);
},true);

async function init() {
  try {
    const response = await fetch('./assets/catalog.json', { cache:'no-cache' });
    if(!response.ok) throw new Error('資料載入失敗');
    const catalog = await response.json();
    state.items = catalog.items;
    state.seriesTree = catalog.seriesTree;
    state.characters = catalog.characters;
    itemAliases = catalog.itemAliases || {};
    itemMap = new Map(state.items.map(item => [item.id,item]));
    avatars = new Map(state.characters.map(character => [character,(state.items.find(item => item.character===character && item.name===(avatarNames[character] || '基礎小腳')) || state.items.find(item => item.character===character))?.image]));
    let stored;
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); } catch { storageOK=false; }
    const saved = normalizeSaved(stored,state.characters,new Set(itemMap.keys()),itemAliases);
    applySaved(saved);
    characterTotals = progressTotals(state.items, state.includedTypes);
    const browse = browseState.saved;
    if (browse) {
      if (['mine','wishlist','all',...characterTabOrder(state.characters)].includes(browse.scope)) state.scope = browse.scope;
      for (const key of ['type','region','series','query']) if (typeof browse[key] === 'string') state[key] = browse[key];
      if (['character','series'].includes(browse.groupBy)) state.groupBy = browse.groupBy;
      if (!['mine','wishlist'].includes(state.scope) && ['all','owned','unowned'].includes(browse.ownership)) state.ownership = browse.ownership;
      filtersExpanded = Boolean(browse.filtersExpanded);
      $('catalog-search').value = state.query;
    }
    if(state.series && state.series !== '__unassigned__' && !state.items.some(item => seriesKey(item) === state.series)) state.series = '';
    if (!accountHub) {
      try {
        const { createAccountHub } = await import('./account-hub.mjs?v=5bb656704e336b48');
        const normalize = value => normalizeSaved(value,state.characters,new Set(itemMap.keys()),itemAliases);
        accountHub = createAccountHub({
          initialView:browse?.social, items:state.items, characters:state.characters, getAvatar:character => avatars.get(character),
          getSaved:savedValue, normalize,
          merge:(current,incoming) => mergeSaved(current,incoming,state.characters,new Set(itemMap.keys()),itemAliases),
          applySaved:applySyncedCollection,
          onOpenDetail:renderDetail, openDialog,
          onScope:userId => {
            collectionStorageKey = userId ? STORAGE_KEY + '-account-' + userId : STORAGE_KEY;
            lastClearKey = collectionStorageKey + '-last-clear';
            if (!accountScopeInitialized) { accountScopeInitialized = true; return; }
            dismissToast(); pendingRemoval = null; activeDetail = null;
            ['selling-help','detail-dialog','selling-dialog','remove-dialog','clear-dialog','data-dialog'].forEach(id => { if ($(id).open) $(id).close(); });
          },
          toast,
        });
      } catch {
        $('account-menu-name').textContent = '帳號暫時無法載入';
        $('account-menu-status').textContent = '重新整理頁面後再試';
        $('open-account').addEventListener('click',() => toast('帳號暫時無法載入，請重新整理頁面後再試'));
        $('open-friends').addEventListener('click',() => toast('好友暫時無法載入，請重新整理頁面後再試'));
      }
    }
    // 一般瀏覽只等帳號確認與本機收藏；好友／個人資料則等原本的視窗準備好。
    if (accountHub) await (['friends','account'].includes(browse?.social?.open) ? accountHub.ready : accountHub.collectionReady);
    if (['character','series'].includes(browse?.groupBy)) state.groupBy = browse.groupBy;
    characterTotals = progressTotals(state.items, state.includedTypes);
    state.ready = true;
    updateProgressSetting();
    renderTabs(); renderCatalog();
    if (browse) {
      setCharactersExpanded(Boolean(browse.charactersExpanded));
      if (browse.tabs) { $('character-tabs').scrollLeft = browse.tabs.x || 0; $('character-tabs').scrollTop = browse.tabs.y || 0; }
      if (initialPositionPending) await restorePosition(browse.position, $('catalog-content'));
      const sellingView = browse.dialogs?.find(dialog => dialog.id === 'selling-dialog');
      if (sellingView) { showSellingList(); $('selling-dialog').scrollTop = sellingView.y || 0; }
      if (browse.detail && itemMap.has(browse.detail)) renderDetail(browse.detail);
      for (const dialog of Array.isArray(browse.dialogs) ? browse.dialogs : []) if (['guide-dialog','settings-dialog','data-dialog'].includes(dialog.id)) {
        if (dialog.id === 'data-dialog') showData(); else openDialog(dialog.id);
        $(dialog.id).scrollTop = dialog.y || 0;
      }
    }
    initialPositionPending = false;
    browseState.enable();
    if (!document.getElementById('open-report')) {
      const reports = createReportHub({items:state.items,client:accountHub?.client,getUserId:() => accountHub?.userId || null,toast,openDialog});
      if (accountHub) void accountHub.ready.then(() => reports.showIntro());else reports.showIntro();
    }
    if(!storageOK) toast('無法讀取原有收藏，可到資料管理匯入備份');
  } catch {
    $('catalog-content').setAttribute('aria-busy','false');
    $('catalog-content').innerHTML='<div class="empty-state"><div class="empty-icon">'+icon('box')+'</div><h3>圖鑑載入失敗</h3><p>暫時無法載入圖鑑，請確認網路連線後重試。</p><button class="primary-button" id="retry-load">重新載入</button></div>';
    $('result-count').textContent='圖鑑尚未載入';
    $('retry-load').addEventListener('click',init);
  }
}
const purchaseHub = createPurchaseHub({state,getItem:id => itemMap.get(id),icon,persist,openDialog,getScope:() => collectionStorageKey,
  updateCollection:() => {if (activeDetail && $('detail-dialog').open) updateDetailCollection();},toast});
init().then(() => purchaseHub.onReady()).finally(() => watchForSiteUpdates());
