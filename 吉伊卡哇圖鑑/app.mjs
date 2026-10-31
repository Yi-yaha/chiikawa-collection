import { STORAGE_KEY, MAX_QUANTITY, normalizeSaved, mergeSaved, progressTotals, scopeItems, filterItems, groupItems, moveCharacter } from './model.mjs?v=place-kind-2-collection-wishes-1';
import { createCatalogImageLoader } from './image-loader.mjs';
import { createCharacterSorter } from './character-sorter.mjs?v=character-order-2';

const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => value.toLocaleString('zh-TW');
const paths = {
  star:'<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.5-4.4 6.3-.9L12 3Z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
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
  sort:'<path d="M8 4v16m-3-3 3 3 3-3M16 20V4m-3 3 3-3 3 3"/>',
  reset:'<path d="M3 10a9 9 0 1 1 2.5 8M3 4v6h6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  box:'<path d="m3 7 9-4 9 4v11l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v11M7.5 5 16 9"/>',
  tag:'<path d="M3 4h8l10 10-7 7L3 10V4Z"/><circle cx="7.5" cy="8" r="1"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5"/>',
  'arrow-right':'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  up:'<path d="m6 15 6-6 6 6"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  grip:'<circle cx="8" cy="5" r="1"/><circle cx="16" cy="5" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="19" r="1"/><circle cx="16" cy="19" r="1"/>',
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
  const [x,y,zoom] = avatarCrops[character] || [50,50,1];
  const crop = '--portrait-size:' + (zoom*100) + '%;--portrait-x:' + (50-x*zoom) + '%;--portrait-y:' + (50-y*zoom) + '%';
  return '<span class="avatar-portrait" style="' + crop + '"><img src="' + escapeHTML(avatars.get(character)) + '" alt="" width="300" height="300"></span>';
}
const typeLabels = {'娃':'玩偶','吊娃':'一般吊娃','鐵牌':'地方限定吊牌'};
const typeLabel = type => typeLabels[type] || type;
const state = { items:[], characters:[], owned:new Set(), quantities:{}, wishlist:new Set(), characterOrder:[], groupBy:'character', includeMetalTags:true, scope:'mine', type:'', region:'', series:'', query:'', ready:false };
let itemMap = new Map();
let itemAliases = {};
let characterTotals = new Map();
let avatars = new Map();
let orderDraft = [];
let toastTimer, undoAction, activeDetail, pendingRemoval;
let storageOK = true;
const lastClearKey = STORAGE_KEY + '-last-clear';
const filterExpansionKey = STORAGE_KEY + '-filters-expanded';
let filtersExpanded = false;
let charactersExpanded = false;
try { filtersExpanded = localStorage.getItem(filterExpansionKey) === 'true'; } catch {}
const catalogImages = createCatalogImageLoader($('catalog-content'));
let sizingSample;
const catalogSizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(([entry]) => {
  if (!entry || entry.contentRect.height <= 0) return;
  // All cards share the same image ratio and two-line name area. Measure one
  // card when its size changes so skipped cards keep their exact scroll space.
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

function savedValue() { return {version:2, owned:[...state.owned], quantities:{...state.quantities}, wishlist:[...state.wishlist], characterOrder:state.characterOrder, groupBy:state.groupBy, includeMetalTags:state.includeMetalTags}; }
function applySaved(saved) {
  state.owned = new Set(saved.owned);
  state.quantities = saved.quantities;
  state.wishlist = new Set(saved.wishlist);
  state.characterOrder = saved.characterOrder;
  state.groupBy = saved.groupBy;
  state.includeMetalTags = saved.includeMetalTags;
}
function quantityOf(id) { return state.quantities[id] || 0; }
function totalQuantity(items = state.items) { return items.reduce((sum, item) => sum + quantityOf(item.id), 0); }
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedValue())); storageOK = true; }
  catch { storageOK = false; toast('目前無法儲存，請到資料管理匯出備份'); }
  return storageOK;
}
function toast(message, undo = null) {
  clearTimeout(toastTimer);
  undoAction = undo;
  $('toast-message').textContent = message;
  $('toast-undo').hidden = !undo;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; undoAction = null; }, undo ? 9000 : 4500);
}
function dismissToast() {
  clearTimeout(toastTimer);
  $('toast').hidden = true;
  undoAction = null;
}
$('toast-undo').addEventListener('click', () => {
  const action = undoAction;
  dismissToast();
  action?.();
});
function baseItems() { return scopeItems(state.items, state.scope, state.owned, state.wishlist); }
function currentItems() { return filterItems(baseItems(), state); }

function updateProgressSetting() {
  $('toggle-metal-tags').disabled = !state.ready;
  $('toggle-metal-tags').setAttribute('aria-checked', String(state.includeMetalTags));
  $('metal-tags-status').textContent = state.includeMetalTags ? '已納入角色進度總數' : '未納入角色進度總數';
}

function collectionRing() {
  return '<svg class="collection-ring" viewBox="0 0 60 60" aria-hidden="true"><circle class="collection-ring-track" cx="30" cy="30" r="28"/><circle class="collection-ring-fill" cx="30" cy="30" r="28" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 30 30)"/></svg>';
}
function revealActiveCharacter() {
  if (charactersExpanded) return;
  const tabs = $('character-tabs');
  const active = tabs.querySelector('.character-tab.active');
  if (!active) return;
  const bounds = tabs.getBoundingClientRect();
  const selected = active.getBoundingClientRect();
  tabs.scrollLeft += selected.left - bounds.left - (tabs.clientWidth - selected.width) / 2;
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
    ...state.characterOrder.map(character => '<button class="character-tab ' + (state.scope === character ? 'active' : '') + '" data-scope="' + escapeHTML(character) + '" aria-describedby="character-sort-help" aria-pressed="' + (state.scope === character) + '" style="--avatar-bg:' + (colors[character]?.[0] || '#eee8df') + '"><span class="avatar">' + avatarPortrait(character) + collectionRing() + '</span><span>' + escapeHTML(character) + '</span></button>')
  ];
  $('character-tabs').innerHTML = tabs.join('');
  $('character-toggle').disabled = !state.ready;
  updateCollectionTabs();
  revealActiveCharacter();
}
function updateCollectionTabs() {
  const counts = new Map();
  state.owned.forEach(id => { const item = itemMap.get(id); if (item) counts.set(item.character, (counts.get(item.character) || 0) + 1); });
  $('character-tabs').querySelectorAll('[data-scope]').forEach(tab => {
    const scope = tab.dataset.scope;
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
    const total = characterTotals.get(scope) || 0;
    const progress = total ? Math.min(owned / total, 1) * 100 : 0;
    const label = scope + '：已收藏 ' + number(owned) + '／' + number(total) + ' 款（' + number(Math.round(progress * 10) / 10) + '%）';
    tab.setAttribute('aria-label', label);
    const ring = tab.querySelector('.collection-ring-fill');
    ring.setAttribute('stroke-dashoffset', String(100 - progress));
    ring.style.opacity = owned ? '1' : '0';
  });
}
function renderHeading() {
  const mine = state.scope === 'mine';
  $('catalog-title').textContent = mine ? '我的娃' : state.scope === 'wishlist' ? '願望清單' : state.scope + '的圖鑑';
  $('open-order').hidden = !mine;
  document.querySelectorAll('[data-group]').forEach(button => {
    const active = button.dataset.group === state.groupBy;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
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
  const allTypes = [...new Set(state.items.map(item => item.type))];
  $('type-filter').innerHTML = '<option value="">全部種類</option>' + allTypes.filter(type => counts.has(type) || state.type === type).map(type => '<option value="' + escapeHTML(type) + '"' + (state.type === type ? ' selected' : '') + '>' + escapeHTML(typeLabel(type)) + '（' + number(counts.get(type) || 0) + '）</option>').join('');
}
function renderRegionOptions() {
  const counts = new Map();
  filterItems(baseItems(), {type:state.type,series:state.series,query:state.query}).forEach(item => {
    const region = item.region || '日本';
    counts.set(region, (counts.get(region) || 0) + 1);
  });
  $('region-filter').innerHTML = '<option value="">全部地區</option>' + ['日本','台灣','韓國','香港','中國'].filter(region => counts.has(region) || state.region === region).map(region => '<option value="' + escapeHTML(region) + '"' + (state.region === region ? ' selected' : '') + '>' + escapeHTML(region) + '（' + number(counts.get(region) || 0) + '）</option>').join('');
}
function renderSeriesOptions() {
  const counts = new Map();
  const available = filterItems(baseItems(), {type:state.type,region:state.region,query:state.query});
  available.forEach(item => counts.set(item.name, (counts.get(item.name) || 0) + 1));
  const search = $('series-search').value.trim().toLocaleLowerCase('zh-TW');
  const names = [...counts.keys()].filter(name => name.toLocaleLowerCase('zh-TW').includes(search)).sort((a,b) => a.localeCompare(b,'zh-TW',{numeric:true}));
  let html = '<button class="series-option ' + (!state.series ? 'selected' : '') + '" data-series="" aria-pressed="' + !state.series + '"><span>全部系列</span><small>' + number(available.length) + ' 件</small></button>';
  html += names.map(name => '<button class="series-option ' + (state.series === name ? 'selected' : '') + '" data-series="' + escapeHTML(name) + '" aria-pressed="' + (state.series === name) + '"><span>' + escapeHTML(name) + '</span><small>' + number(counts.get(name)) + ' 件</small></button>').join('');
  if (!names.length) html += '<p class="series-option-empty">找不到符合的系列，換個名稱試試看。</p>';
  $('series-options').innerHTML = html;
}
function renderFilters() {
  renderFilterDisclosure();
  renderTypeOptions();
  renderRegionOptions();
  $('series-label').textContent = state.series || '全部系列';
  $('series-toggle').setAttribute('aria-label', '篩選系列：' + (state.series || '全部系列'));
  $('series-toggle').title = state.series || '全部系列';
  const chips = [];
  if(state.type) chips.push(['type', '種類：' + typeLabel(state.type)]);
  if(state.region) chips.push(['region', '地區：' + state.region]);
  if(state.series) chips.push(['series', '系列：' + state.series]);
  if(state.query) chips.push(['query', '搜尋：' + state.query]);
  $('active-filters').innerHTML = chips.map(([key,label]) => '<button class="filter-chip" data-remove-filter="' + key + '" aria-label="移除' + escapeHTML(label) + '">' + escapeHTML(label) + icon('close') + '</button>').join('');
  $('reset-filters').hidden = !chips.length;
  if (!$('series-popover').hidden) renderSeriesOptions();
}
function productCard(item) {
  const owned = state.owned.has(item.id);
  const wished = state.wishlist.has(item.id);
  const mine = state.scope === 'mine';
  const name = escapeHTML(item.character + '・' + item.name);
  const detailAction = ' data-detail="' + item.id + '" aria-label="查看' + name + '的詳細資訊" aria-haspopup="dialog" aria-controls="detail-dialog"';
  const imageAction = mine ? detailAction : ' data-collect="' + item.id + '" aria-label="' + (owned ? '取消收藏' : '收藏') + name + '" aria-pressed="' + owned + '"';
  return '<article class="product-card ' + (owned ? 'owned' : wished ? 'wished' : '') + '" data-item="' + item.id + '">' +
    '<button class="product-image-button"' + imageAction + '><div class="product-image"><span class="product-type">' + escapeHTML(typeLabel(item.type)) + '</span><img data-src="' + escapeHTML(item.image) + '" alt="' + name + '" loading="lazy" decoding="async" width="200" height="200"></div></button>' +
    '<div class="product-meta"><h4 class="product-name" title="' + escapeHTML(item.name) + '">' + escapeHTML(item.name) + '</h4></div>' +
    '<button class="collect-button ' + (owned ? 'owned' : '') + '" data-collect="' + item.id + '" aria-label="' + (mine ? '移出我的娃' : owned ? '取消收藏' : '收藏') + name + '" aria-pressed="' + owned + '"' + (mine ? ' aria-haspopup="dialog" aria-controls="remove-dialog"' : '') + '>' + icon('heart') + '</button>' +
    '<div class="product-actions"><button class="wish-button ' + (wished ? 'wished' : '') + '" data-wish="' + item.id + '" aria-label="' + '將' + name + (wished ? '移出願望清單' : '加入願望清單') + '" aria-pressed="' + wished + '"' + (owned ? ' hidden' : '') + '>' + icon('star') + '</button>' +
    '<span class="product-quantity"' + (!owned ? ' hidden' : '') + '>收藏 ' + number(quantityOf(item.id)) + ' 個</span>' +
    '<button class="product-info-button"' + detailAction + '>' + icon('info') + '</button></div></article>';
}
function emptyState() {
  const untouchedMine = state.scope === 'mine' && state.owned.size === 0;
  const untouchedWishes = state.scope === 'wishlist' && state.wishlist.size === 0;
  const title = untouchedMine ? '尚未收藏' : untouchedWishes ? '還沒有想收的娃娃' : '沒有符合條件的商品';
  const description = untouchedMine ? '點選上方角色，再點娃娃圖片加入收藏。' : untouchedWishes ? '逛逛角色圖鑑，點星星記下想收的娃娃。' : '請調整種類、系列或搜尋條件。';
  return '<div class="empty-state"><div class="empty-icon">' + icon(untouchedMine ? 'heart' : untouchedWishes ? 'star' : 'search') + '</div><h3>' + title + '</h3><p>' + description + '</p>' + (untouchedMine || untouchedWishes ? '' : '<button class="primary-button" data-empty-action="reset">重設篩選</button>') + '</div>';
}
function renderResultCount(items) {
  if (state.scope === 'wishlist') {
    $('result-count').innerHTML = '想收 <strong>' + number(items.length) + '</strong> 款';
    return;
  }
  const matchingItems = state.scope === 'mine' ? filterItems(state.items, state) : items;
  const owned = matchingItems.filter(item => state.owned.has(item.id)).length;
  $('result-count').innerHTML = '已收藏 <strong>' + number(owned) + '</strong>／' + number(matchingItems.length) + ' 款' + (state.scope === 'mine' ? '<span class="quantity-summary">共 ' + number(totalQuantity(items)) + ' 個</span>' : '');
}
function catalogGroup(group) {
  const titleId = 'group-title-' + state.groupBy + '-' + group.items[0].id;
  const groupAvatar = state.groupBy === 'character' ? '<img class="group-avatar" src="' + escapeHTML(avatars.get(group.name)) + '" alt="" width="30" height="30">' : '';
  const roleCount = state.groupBy === 'series' ? '<span class="group-caption">' + new Set(group.items.map(item => item.character)).size + ' 個角色</span>' : '';
  return '<section class="catalog-group" data-group-key="' + escapeHTML(group.name) + '" aria-labelledby="' + titleId + '"><div class="group-heading">' + groupAvatar + '<h3 id="' + titleId + '">' + escapeHTML(group.name) + '</h3><span class="group-number">' + number(group.items.length) + '</span>' + roleCount + '<span class="group-line"></span></div><div class="product-grid">' + group.items.map(productCard).join('') + '</div></section>';
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
  const order = state.scope === 'mine' || state.scope === 'wishlist' ? state.characterOrder : state.characters;
  const groups = groupItems(items,state.groupBy,order);
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
  const wish = card.querySelector('[data-wish]');
  wish.hidden = owned;
  wish.classList.toggle('wished', wished);
  wish.setAttribute('aria-pressed', String(wished));
  wish.setAttribute('aria-label', '將' + item.character + '・' + item.name + (wished ? '移出願望清單' : '加入願望清單'));
  const quantity = card.querySelector('.product-quantity');
  quantity.hidden = !owned;
  quantity.textContent = '收藏 ' + number(quantityOf(id)) + ' 個';
}
function updateCollectionCatalog(id) {
  if (state.scope !== 'mine' && state.scope !== 'wishlist') { updateCollectionCard(id); renderResultCount(currentItems()); return; }
  renderTypeOptions();
  renderRegionOptions();
  if (!$('series-popover').hidden) renderSeriesOptions();
  const items = currentItems();
  renderResultCount(items);
  const content = $('catalog-content');
  if (!items.length) { content.innerHTML = emptyState(); return; }
  const item = itemMap.get(id);
  const key = state.groupBy === 'character' ? item.character : item.name;
  const sections = new Map([...content.querySelectorAll('.catalog-group')].map(section => [section.dataset.groupKey, section]));
  const section = sections.get(key);
  const groups = groupItems(items, state.groupBy, state.characterOrder);
  const index = groups.findIndex(group => group.name === key);
  if (index === -1) { section?.remove(); return; }
  const group = groups[index];
  if (!section) {
    content.querySelector('.empty-state')?.remove();
    const nextSection = groups.slice(index + 1).map(group => sections.get(group.name)).find(Boolean);
    if (nextSection) nextSection.insertAdjacentHTML('beforebegin', catalogGroup(group));
    else content.insertAdjacentHTML('beforeend', catalogGroup(group));
    return;
  }
  section.querySelector('.group-number').textContent = number(group.items.length);
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
function setScope(scope) {
  if (state.scope === scope || (!['mine', 'wishlist'].includes(scope) && !state.characters.includes(scope))) return;
  const enteringPersonal = scope === 'mine' || scope === 'wishlist';
  dismissToast();
  state.scope = scope;
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
  state.type = ''; state.region = ''; state.series = ''; state.query = '';
  $('catalog-search').value = '';
  renderCatalog();
}
function refreshCollection(changedId) {
  persist();
  updateCollectionTabs();
  if (changedId) { updateCollectionCatalog(changedId); observeCatalogSize(); catalogImages.update(); } else renderCatalog();
  if (activeDetail && $('detail-dialog').open) updateDetailCollection();
}
function requestCollectionChange(id) {
  const item = itemMap.get(id);
  if (!item) return;
  if (state.owned.has(id) && (state.scope === 'mine' || quantityOf(id) > 1)) {
    pendingRemoval = {id, origin:document.activeElement};
    $('remove-description').textContent = '要將' + item.character + '的「' + item.name + '」移出我的娃嗎？' + (quantityOf(id) > 1 ? '目前記錄的 ' + number(quantityOf(id)) + ' 個會一併移除。' : '');
    openDialog('remove-dialog');
    return;
  }
  toggleOwned(id);
}
function toggleOwned(id, {showUndo = state.scope === 'mine', origin = document.activeElement} = {}) {
  setQuantity(id, state.owned.has(id) ? 0 : 1, {showUndo, origin});
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
function setQuantity(id, quantity, {showUndo = false, origin = document.activeElement} = {}) {
  const item = itemMap.get(id);
  if (!item || !Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) return;
  const before = quantityOf(id);
  if (before === quantity) return;
  const wished = state.wishlist.has(id);
  dismissToast();
  const card = origin?.closest('.product-card');
  const neighbor = card?.nextElementSibling?.querySelector('.product-image-button') || card?.previousElementSibling?.querySelector('.product-image-button');
  restoreItem(id, quantity, false);
  refreshCollection(id);
  focusAfterRemoval(origin, neighbor);
  if (!showUndo) return;
  toast(quantity === 0 ? '已移出我的娃' : '已更新收藏數量', () => {
    restoreItem(id, before, wished);
    refreshCollection(id);
    toast('已復原收藏變更');
  });
}
function toggleWish(id, origin = document.activeElement) {
  if (!itemMap.has(id) || state.owned.has(id)) return;
  dismissToast();
  const wished = state.wishlist.has(id);
  const card = origin?.closest('.product-card');
  const neighbor = card?.nextElementSibling?.querySelector('.product-image-button') || card?.previousElementSibling?.querySelector('.product-image-button');
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
  if (quantity === 0 && state.owned.has(activeDetail)) {
    updateDetailCollection();
    requestCollectionChange(activeDetail);
    return;
  }
  setQuantity(activeDetail, quantity);
}
function safeURL(value) {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''; } catch { return ''; }
}
function openDialog(id) { const dialog = $(id); if(!dialog.open) dialog.showModal(); }
function updateDetailCollection() {
  const owned = state.owned.has(activeDetail);
  const wished = state.wishlist.has(activeDetail);
  const button = $('detail-collect');
  button.classList.toggle('is-owned', owned);
  button.setAttribute('aria-pressed', String(owned));
  button.innerHTML = icon('heart') + (owned ? '取消收藏' : '加入收藏');
  $('detail-quantity-panel').hidden = !owned;
  $('detail-quantity').value = String(quantityOf(activeDetail));
  $('quantity-plus').disabled = quantityOf(activeDetail) >= MAX_QUANTITY;
  const wish = $('detail-wish');
  wish.hidden = owned;
  wish.classList.toggle('wished', wished);
  wish.setAttribute('aria-pressed', String(wished));
  wish.innerHTML = icon('star') + (wished ? '移出願望清單' : '加入願望清單');
}
function renderDetail(id) {
  const item = itemMap.get(id);
  if (!item) return;
  activeDetail = id;
  const url = safeURL(item.url);
  $('detail-content').innerHTML = '<div class="detail-layout"><button class="icon-button detail-close" data-close="detail-dialog" aria-label="關閉商品詳情">' + icon('close') + '</button><div class="detail-visual"><img src="' + escapeHTML(item.image) + '" alt="' + escapeHTML(item.character + '・' + item.name) + '" width="340" height="340"></div><div class="detail-info"><div class="detail-eyebrow"><span>' + escapeHTML(item.character) + '</span><span>' + escapeHTML(typeLabel(item.type)) + '</span></div><h2 id="detail-title">' + escapeHTML(item.name) + '</h2>' +
    '<div class="detail-collection"><div id="detail-quantity-panel" class="quantity-panel" hidden><div class="quantity-row"><label for="detail-quantity">收藏數量</label><div class="quantity-stepper"><button id="quantity-minus" data-quantity-step="-1" aria-label="減少收藏數量">' + icon('minus') + '</button><input id="detail-quantity" type="number" inputmode="numeric" min="0" max="' + MAX_QUANTITY + '" step="1" aria-describedby="quantity-help"><button id="quantity-plus" data-quantity-step="1" aria-label="增加收藏數量">' + icon('plus') + '</button></div></div><p id="quantity-help">調整為 0 個會取消收藏</p></div>' +
    '<button class="primary-button" id="detail-collect" data-collect="' + id + '"></button><button class="detail-wish-button" id="detail-wish" data-wish="' + id + '"></button></div>' +
    '<dl><dt>角色</dt><dd>' + escapeHTML(item.character) + '</dd><dt>地區</dt><dd>' + escapeHTML(item.region || '日本') + '</dd>' + (item.limitedLocation ? '<dt>限定地點</dt><dd>' + escapeHTML(item.limitedLocation) + '</dd>' : '') + (item.size ? '<dt>尺寸</dt><dd>' + escapeHTML(item.size) + '</dd>' : '') + (item.sku ? '<dt>商品編號</dt><dd>' + escapeHTML(item.sku) + '</dd>' : '') + '</dl>' + (url ? '<a class="detail-link" href="' + escapeHTML(url) + '" target="_blank" rel="noopener noreferrer">查看商品原始頁面' + icon('external') + '</a>' : '') + '</div></div>';
  updateDetailCollection();
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
    const restored = mergeSaved(savedValue(), {...previous, wishlist:[], characterOrder:state.characterOrder, groupBy:state.groupBy, includeMetalTags:state.includeMetalTags}, state.characters, new Set(itemMap.keys()), itemAliases);
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
  getOrder: () => state.characterOrder,
  onCommit: (order, character) => {
    state.characterOrder = order;
    const stored = persist();
    if (state.scope === 'mine' || state.scope === 'wishlist') renderCatalog();
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
  renderSeriesOptions();
  $('series-toggle').focus({ preventScroll:true });
});
$('series-search').addEventListener('input', renderSeriesOptions);
$('series-options').addEventListener('click', event => {
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
document.querySelectorAll('[data-group]').forEach(button => button.addEventListener('click', () => {
  state.groupBy = button.dataset.group;
  persist(); renderCatalog();
}));
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
});
$('detail-content').addEventListener('change', event => {
  if (event.target.id === 'detail-quantity') changeDetailQuantity(event.target.value.trim() === '' ? NaN : Number(event.target.value));
});
$('detail-content').addEventListener('keydown', event => {
  if (event.target.id === 'detail-quantity' && event.key === 'Enter') event.target.blur();
});
$('remove-dialog').addEventListener('close', () => { pendingRemoval = null; });
$('confirm-remove').addEventListener('click', () => {
  const removal = pendingRemoval;
  if (!removal) return;
  $('remove-dialog').close();
  if (state.owned.has(removal.id)) toggleOwned(removal.id, {showUndo:true, origin:removal.origin});
});
$('more-button').addEventListener('click', () => {
  $('more-menu').hidden = !$('more-menu').hidden;
  $('more-button').setAttribute('aria-expanded',String(!$('more-menu').hidden));
});
$('toggle-metal-tags').addEventListener('click', () => {
  if (!state.ready) return;
  state.includeMetalTags = !state.includeMetalTags;
  characterTotals = progressTotals(state.items, state.includeMetalTags);
  updateProgressSetting();
  updateCollectionTabs();
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
    if(charactersExpanded) setCharactersExpanded(false, { focusToggle:true });
    if(!$('series-popover').hidden) { closeSeries(); $('series-toggle').focus(); }
    if(!$('more-menu').hidden) $('more-button').focus();
    $('more-menu').hidden = true; $('more-button').setAttribute('aria-expanded','false');
  }
});
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => {
    if(event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if(event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
});

function renderOrder() {
  $('order-list').innerHTML = orderDraft.map((character,index) => '<li class="order-row" data-index="' + index + '"><span class="order-handle" title="拖曳調整' + escapeHTML(character) + '的位置" aria-hidden="true">' + icon('grip') + '</span><img src="' + escapeHTML(avatars.get(character)) + '" alt="" width="36" height="36"><strong>' + escapeHTML(character) + '</strong><button class="icon-button" data-move="-1" data-index="' + index + '" aria-label="將' + escapeHTML(character) + '向上移動"' + (index === 0 ? ' disabled' : '') + '>' + icon('up') + '</button><button class="icon-button" data-move="1" data-index="' + index + '" aria-label="將' + escapeHTML(character) + '向下移動"' + (index === orderDraft.length-1 ? ' disabled' : '') + '>' + icon('down') + '</button></li>').join('');
}
$('open-order').addEventListener('click', () => { orderDraft = [...state.characterOrder]; renderOrder(); openDialog('order-dialog'); });
$('order-list').addEventListener('click', event => {
  const button = event.target.closest('[data-move]');
  if(!button) return;
  const from = Number(button.dataset.index), delta = Number(button.dataset.move);
  orderDraft = moveCharacter(orderDraft,from,from+delta);
  renderOrder();
  document.querySelector('#order-list [data-index="' + (from+delta) + '"] button[data-move="' + delta + '"]:not(:disabled)')?.focus({preventScroll:true});
});
let drag = null;
$('order-list').addEventListener('pointerdown', event => {
  if(!event.target.closest('.order-handle')) return;
  event.preventDefault();
  const row = event.target.closest('.order-row');
  drag = {from:Number(row.dataset.index),to:Number(row.dataset.index)};
  row.classList.add('dragging');
});
window.addEventListener('pointermove', event => {
  if(!drag) return;
  const row = document.elementFromPoint(event.clientX,event.clientY)?.closest('.order-row');
  if(row) {
    drag.to = Number(row.dataset.index);
    document.querySelectorAll('.order-row').forEach(r => r.style.borderColor = Number(r.dataset.index) === drag.to ? 'var(--coral)' : '');
  }
});
function finishDrag() { if(!drag) return; orderDraft = moveCharacter(orderDraft,drag.from,drag.to); drag=null; renderOrder(); }
window.addEventListener('pointerup',finishDrag);
window.addEventListener('pointercancel',() => { drag=null; if($('order-dialog').open) renderOrder(); });
$('reset-order').addEventListener('click', () => { orderDraft = [...state.characters]; renderOrder(); });
$('save-order').addEventListener('click', () => {
  state.characterOrder = [...orderDraft]; const stored = persist(); renderTabs(); renderCatalog(); $('order-dialog').close(); if (stored) toast('已記住你喜歡的角色順序');
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
    characterTotals = progressTotals(state.items, state.includeMetalTags);
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
  $('clear-description').textContent = '將清除 ' + number(state.owned.size) + ' 款收藏（共 ' + number(totalQuantity()) + ' 個）。願望清單、商品圖鑑與角色順序會保留。你也可以先匯出備份。';
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
  if(img.closest('.avatar,.hero-art,.group-heading,.order-row')) { img.style.visibility='hidden'; return; }
  const fallback = document.createElement('span');
  fallback.className='image-fallback';
  fallback.innerHTML=icon('box')+'<span>圖片無法載入</span>';
  img.replaceWith(fallback);
},true);

async function init() {
  try {
    const response = await fetch('./assets/catalog.json?v=chiikawa-series-7');
    if(!response.ok) throw new Error('資料載入失敗');
    const catalog = await response.json();
    state.items = catalog.items;
    state.characters = catalog.characters;
    itemAliases = catalog.itemAliases || {};
    itemMap = new Map(state.items.map(item => [item.id,item]));
    avatars = new Map(state.characters.map(character => [character,(state.items.find(item => item.character===character && item.name===(avatarNames[character] || '基礎小腳')) || state.items.find(item => item.character===character))?.image]));
    let stored;
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); } catch { storageOK=false; }
    const saved = normalizeSaved(stored,state.characters,new Set(itemMap.keys()),itemAliases);
    applySaved(saved);
    characterTotals = progressTotals(state.items, state.includeMetalTags);
    state.ready = true;
    updateProgressSetting();
    renderTabs(); renderCatalog();
    if(!storageOK) toast('無法讀取原有收藏，可到資料管理匯入備份');
  } catch {
    $('catalog-content').setAttribute('aria-busy','false');
    $('catalog-content').innerHTML='<div class="empty-state"><div class="empty-icon">'+icon('box')+'</div><h3>圖鑑載入失敗</h3><p>暫時無法載入圖鑑，請確認網路連線後重試。</p><button class="primary-button" id="retry-load">重新載入</button></div>';
    $('result-count').textContent='圖鑑尚未載入';
    $('retry-load').addEventListener('click',init);
  }
}
init();
