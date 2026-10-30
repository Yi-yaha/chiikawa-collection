import { STORAGE_KEY, normalizeSaved, scopeItems, filterItems, groupItems, moveCharacter } from './model.mjs';

const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => value.toLocaleString('zh-TW');
const paths = {
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".8" fill="currentColor" stroke="none"/>',
  more:'<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
  sparkle:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/><path d="m20 2 .7 1.8L23 4.5l-2.3.7L20 7l-.7-1.8-2.3-.7 2.3-.7L20 2Z"/>',
  search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  chevron:'<path d="m7 9 5 5 5-5"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  person:'<circle cx="12" cy="7" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  sort:'<path d="M8 4v16m-3-3 3 3 3-3M16 20V4m-3 3 3-3 3 3"/>',
  reset:'<path d="M3 10a9 9 0 1 1 2.5 8M3 4v6h6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  box:'<path d="m3 7 9-4 9 4v11l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v11M7.5 5 16 9"/>',
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
const avatarNames = {'小甲蟲':'基礎','那孩子':'基礎','哥布林':'樂園迷你','奧德':'樂園迷你','鎧甲人':'樂園迷你拉麵','流星':'黃色流星娃','綜合角色':'大強','人魚島':'賽蓮'};
// 以原圖的臉部中心與放大倍率統一角色縮圖，避免吊繩、身體及留白佔滿圓框。
const avatarCrops = {
  '吉伊':[50,59,1.7], '小八':[50,59,1.65], '兔兔':[50,59,1.7],
  '小桃':[50,58,1.7], '師傅':[50,56,1.85], '栗子':[50,58,1.65],
  '獅薩':[50,58,1.75], '古本':[50,58,1.7], '小甲蟲':[51,60,2.1],
  '那孩子':[50,52,1.6], '哥布林':[50,56,1.75], '奧德':[50,45,2.5],
  '鎧甲人':[50,48,2.6], '流星':[50,54,1.1], '綜合角色':[50,51,2.25],
  '人魚島':[50,49,1.65]
};
function avatarPortrait(character) {
  const [x,y,zoom] = avatarCrops[character] || [50,50,1];
  const crop = '--portrait-size:' + (zoom*100) + '%;--portrait-x:' + (50-x*zoom) + '%;--portrait-y:' + (50-y*zoom) + '%';
  return '<span class="avatar-portrait" style="' + crop + '"><img src="' + escapeHTML(avatars.get(character)) + '" alt="" width="300" height="300"></span>';
}
const typeLabels = {'娃':'娃娃','台':'台灣限定','韓':'韓國限定','港':'香港限定','中':'中國限定'};
const typeLabel = type => typeLabels[type] || type;
const state = { items:[], characters:[], owned:new Set(), characterOrder:[], groupBy:'character', scope:'mine', type:'', series:'', query:'', ready:false };
let itemMap = new Map();
let characterTotals = new Map();
let avatars = new Map();
let orderDraft = [];
let toastTimer, undoAction, activeDetail;
let storageOK = true;
const lastClearKey = STORAGE_KEY + '-last-clear';
let sizingSample;
const catalogSizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(([entry]) => {
  if (!entry || entry.contentRect.height <= 0) return;
  // All cards share the same image ratio and single-line metadata. Measure one
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

function savedValue() { return {version:1, owned:[...state.owned], characterOrder:state.characterOrder, groupBy:state.groupBy}; }
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
$('toast-undo').addEventListener('click', () => {
  const action = undoAction;
  $('toast').hidden = true;
  clearTimeout(toastTimer);
  undoAction = null;
  action?.();
});
function baseItems() { return scopeItems(state.items, state.scope, state.owned); }
function currentItems() { return filterItems(baseItems(), state); }

function collectionRing() {
  return '<svg class="collection-ring" viewBox="0 0 60 60" aria-hidden="true"><circle class="collection-ring-track" cx="30" cy="30" r="28"/><circle class="collection-ring-fill" cx="30" cy="30" r="28" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 30 30)"/></svg>';
}
function renderTabs() {
  const tabs = [
    '<button class="character-tab mine-tab ' + (state.scope === 'mine' ? 'active' : '') + '" data-scope="mine" aria-pressed="' + (state.scope === 'mine') + '"><span class="avatar">' + icon('heart') + collectionRing() + '</span><span>我的娃</span></button>',
    ...state.characters.map(character => '<button class="character-tab ' + (state.scope === character ? 'active' : '') + '" data-scope="' + escapeHTML(character) + '" aria-pressed="' + (state.scope === character) + '" style="--avatar-bg:' + (colors[character]?.[0] || '#eee8df') + '"><span class="avatar">' + avatarPortrait(character) + collectionRing() + '</span><span>' + escapeHTML(character) + '</span></button>')
  ];
  $('character-tabs').innerHTML = tabs.join('');
  updateCollectionTabs();
}
function updateCollectionTabs() {
  const counts = new Map();
  state.owned.forEach(id => { const item = itemMap.get(id); if (item) counts.set(item.character, (counts.get(item.character) || 0) + 1); });
  $('character-tabs').querySelectorAll('[data-scope]').forEach(tab => {
    const scope = tab.dataset.scope;
    const mine = scope === 'mine';
    const owned = mine ? state.owned.size : counts.get(scope) || 0;
    const total = mine ? state.items.length : characterTotals.get(scope) || 0;
    const progress = total ? Math.min(owned / total, 1) * 100 : 0;
    const label = (mine ? '我的娃' : scope) + '：已收藏 ' + number(owned) + '／' + number(total) + ' 件（' + number(Math.round(progress * 10) / 10) + '%）';
    tab.setAttribute('aria-label', label);
    const ring = tab.querySelector('.collection-ring-fill');
    ring.setAttribute('stroke-dashoffset', String(100 - progress));
    ring.style.opacity = owned ? '1' : '0';
  });
}
function renderHeading() {
  const mine = state.scope === 'mine';
  $('catalog-title').textContent = mine ? '我的娃' : state.scope + '的圖鑑';
  $('open-order').hidden = !mine;
  document.querySelectorAll('[data-group]').forEach(button => {
    const active = button.dataset.group === state.groupBy;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function renderTypeOptions() {
  const counts = new Map();
  filterItems(baseItems(), {series:state.series,query:state.query}).forEach(item => counts.set(item.type, (counts.get(item.type) || 0) + 1));
  const allTypes = [...new Set(state.items.map(item => item.type))];
  $('type-filter').innerHTML = '<option value="">全部種類</option>' + allTypes.filter(type => counts.has(type) || state.type === type).map(type => '<option value="' + escapeHTML(type) + '"' + (state.type === type ? ' selected' : '') + '>' + escapeHTML(typeLabel(type)) + '（' + number(counts.get(type) || 0) + '）</option>').join('');
}
function renderSeriesOptions() {
  const counts = new Map();
  const available = filterItems(baseItems(), {type:state.type,query:state.query});
  available.forEach(item => counts.set(item.name, (counts.get(item.name) || 0) + 1));
  const search = $('series-search').value.trim().toLocaleLowerCase('zh-TW');
  const names = [...counts.keys()].filter(name => name.toLocaleLowerCase('zh-TW').includes(search)).sort((a,b) => a.localeCompare(b,'zh-TW',{numeric:true}));
  let html = '<button class="series-option ' + (!state.series ? 'selected' : '') + '" data-series="" aria-pressed="' + !state.series + '"><span>全部系列</span><small>' + number(available.length) + ' 件</small></button>';
  html += names.map(name => '<button class="series-option ' + (state.series === name ? 'selected' : '') + '" data-series="' + escapeHTML(name) + '" aria-pressed="' + (state.series === name) + '"><span>' + escapeHTML(name) + '</span><small>' + number(counts.get(name)) + ' 件</small></button>').join('');
  if (!names.length) html += '<p class="series-option-empty">找不到符合的系列，換個名稱試試看。</p>';
  $('series-options').innerHTML = html;
}
function renderFilters() {
  renderTypeOptions();
  $('series-label').textContent = state.series || '全部系列';
  $('series-toggle').setAttribute('aria-label', '篩選系列：' + (state.series || '全部系列'));
  $('series-toggle').title = state.series || '全部系列';
  const chips = [];
  if(state.type) chips.push(['type', '種類：' + typeLabel(state.type)]);
  if(state.series) chips.push(['series', '系列：' + state.series]);
  if(state.query) chips.push(['query', '搜尋：' + state.query]);
  $('active-filters').innerHTML = chips.map(([key,label]) => '<button class="filter-chip" data-remove-filter="' + key + '" aria-label="移除' + escapeHTML(label) + '">' + escapeHTML(label) + icon('close') + '</button>').join('');
  $('reset-filters').hidden = !chips.length;
  if (!$('series-popover').hidden) renderSeriesOptions();
}
function productCard(item) {
  const owned = state.owned.has(item.id);
  return '<article class="product-card ' + (owned ? 'owned' : '') + '" data-item="' + item.id + '">' +
    '<button class="product-image-button" data-collect="' + item.id + '" aria-label="' + (owned ? '取消收藏' : '收藏') + escapeHTML(item.character + '・' + item.name) + '" aria-pressed="' + owned + '"><div class="product-image"><span class="product-type">' + escapeHTML(typeLabel(item.type)) + '</span><img src="' + escapeHTML(item.image) + '" alt="' + escapeHTML(item.character + '・' + item.name) + '" loading="lazy" decoding="async" width="200" height="200"></div><div class="product-meta"><h4 class="product-name" title="' + escapeHTML(item.name) + '">' + escapeHTML(item.name) + '</h4><div class="product-character"><span class="character-dot" style="--dot:' + (colors[item.character]?.[1] || '#bba98e') + '"></span>' + escapeHTML(item.character) + '</div></div></button>' +
    '<button class="product-info-button" data-detail="' + item.id + '" aria-label="查看' + escapeHTML(item.character + '・' + item.name) + '的詳細資訊" aria-haspopup="dialog" aria-controls="detail-dialog">' + icon('info') + '</button></article>';
}
function emptyState() {
  const untouchedMine = state.scope === 'mine' && state.owned.size === 0;
  return '<div class="empty-state"><div class="empty-icon">' + icon(untouchedMine ? 'heart' : 'search') + '</div><h3>' + (untouchedMine ? '尚未收藏' : '沒有符合條件的商品') + '</h3><p>' + (untouchedMine ? '點選上方角色，再點娃娃圖片加入收藏。' : '請調整種類、系列或搜尋條件。') + '</p>' + (untouchedMine ? '' : '<button class="primary-button" data-empty-action="reset">重設篩選</button>') + '</div>';
}
function renderResultCount(items) {
  const total = baseItems().length;
  const hasFilter = Boolean(state.type || state.series || state.query);
  $('result-count').innerHTML = (hasFilter ? '顯示 <strong>' + number(items.length) + '</strong>／共 ' + number(total) + ' 件' : '共 <strong>' + number(items.length) + '</strong> ' + (state.scope === 'mine' ? '件收藏' : '件商品'));
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
    return;
  }
  const order = state.scope === 'mine' ? state.characterOrder : state.characters;
  const groups = groupItems(items,state.groupBy,order);
  $('catalog-content').innerHTML = groups.map(catalogGroup).join('');
  observeCatalogSize();
}
function updateCollectionCard(id) {
  const card = document.querySelector('.product-card[data-item="' + id + '"]');
  if (!card) return;
  const item = itemMap.get(id);
  const owned = state.owned.has(id);
  card.classList.toggle('owned', owned);
  const button = card.querySelector('[data-collect]');
  button.setAttribute('aria-pressed', String(owned));
  button.setAttribute('aria-label', (owned ? '取消收藏' : '收藏') + item.character + '・' + item.name);
}
function updateCollectionCatalog(id) {
  if (state.scope !== 'mine') { updateCollectionCard(id); return; }
  renderTypeOptions();
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
  if (state.scope === scope || (scope !== 'mine' && !state.characters.includes(scope))) return;
  const enteringMine = scope === 'mine';
  state.scope = scope;
  if (enteringMine) {
    clearTimeout(searchTimer);
    state.type = ''; state.series = ''; state.query = '';
    $('catalog-search').value = '';
  }
  closeSeries();
  renderTabs();
  renderCatalog();
}
function resetFilters() {
  clearTimeout(searchTimer);
  state.type = ''; state.series = ''; state.query = '';
  $('catalog-search').value = '';
  renderCatalog();
}
function refreshCollection(changedId) {
  persist();
  updateCollectionTabs();
  if (changedId) { updateCollectionCatalog(changedId); observeCatalogSize(); } else renderCatalog();
  if (activeDetail && $('detail-dialog').open) updateDetailCollection();
}
function toggleOwned(id) {
  const item = itemMap.get(id);
  if (!item) return;
  const wasOwned = state.owned.has(id);
  if (wasOwned) state.owned.delete(id); else state.owned.add(id);
  const focused = document.activeElement?.matches('[data-collect]') ? document.activeElement : null;
  const card = focused?.closest('.product-card');
  const neighbor = card?.nextElementSibling?.querySelector('[data-collect]') || card?.previousElementSibling?.querySelector('[data-collect]');
  refreshCollection(id);
  if (focused && !focused.isConnected) {
    const target = neighbor?.isConnected ? neighbor : $('catalog-title');
    if (target.tagName === 'H1') target.tabIndex = -1;
    target.focus({preventScroll:true});
  }
  toast(wasOwned ? '已將' + item.character + '的「' + item.name + '」移出我的娃' : '已將' + item.character + '的「' + item.name + '」加入我的娃', () => {
    if(wasOwned) state.owned.add(id); else state.owned.delete(id);
    refreshCollection(id);
    toast('已復原收藏變更');
  });
}
function safeURL(value) {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''; } catch { return ''; }
}
function openDialog(id) { const dialog = $(id); if(!dialog.open) dialog.showModal(); }
function updateDetailCollection() {
  const owned = state.owned.has(activeDetail);
  const button = $('detail-collect');
  button.classList.toggle('is-owned', owned);
  button.setAttribute('aria-pressed', String(owned));
  button.innerHTML = icon('heart') + (owned ? '已收藏 · 點一下移除' : '加入我的娃');
}
function renderDetail(id) {
  const item = itemMap.get(id);
  if (!item) return;
  activeDetail = id;
  const owned = state.owned.has(id);
  const url = safeURL(item.url);
  $('detail-content').innerHTML = '<div class="detail-layout"><button class="icon-button detail-close" data-close="detail-dialog" aria-label="關閉商品詳情">' + icon('close') + '</button><div class="detail-visual"><img src="' + escapeHTML(item.image) + '" alt="' + escapeHTML(item.character + '・' + item.name) + '" width="340" height="340"></div><div class="detail-info"><div class="detail-eyebrow"><span>' + escapeHTML(item.character) + '</span><span>' + escapeHTML(typeLabel(item.type)) + '</span></div><h2 id="detail-title">' + escapeHTML(item.name) + '</h2><dl><dt>角色</dt><dd>' + escapeHTML(item.character) + '</dd><dt>系列</dt><dd>' + escapeHTML(item.name) + '</dd>' + (item.size ? '<dt>尺寸</dt><dd>' + escapeHTML(item.size) + '</dd>' : '') + (item.sku ? '<dt>商品編號</dt><dd>' + escapeHTML(item.sku) + '</dd>' : '') + '</dl><button class="primary-button ' + (owned ? 'is-owned' : '') + '" id="detail-collect" data-collect="' + id + '" aria-pressed="' + owned + '">' + icon('heart') + (owned ? '已收藏 · 點一下移除' : '加入我的娃') + '</button>' + (url ? '<a class="detail-link" href="' + escapeHTML(url) + '" target="_blank" rel="noopener noreferrer">查看商品原始頁面' + icon('external') + '</a>' : '') + '</div></div>';
  openDialog('detail-dialog');
}
function closeSeries() {
  $('series-popover').hidden = true;
  $('series-toggle').setAttribute('aria-expanded','false');
}
function showData() {
  $('data-count').textContent = number(state.owned.size) + ' 隻收藏';
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
function restoreCleared() {
  try {
    const previous = normalizeSaved(JSON.parse(localStorage.getItem(lastClearKey)),state.characters,new Set(itemMap.keys()));
    state.owned = new Set([...state.owned,...previous.owned]);
    refreshCollection();
    localStorage.removeItem(lastClearKey);
    $('restore-cleared')?.remove();
    $('data-count').textContent = number(state.owned.size) + ' 隻收藏';
    toast('已復原上次清除的收藏');
  } catch { toast('找不到可復原的紀錄，請匯入收藏備份'); }
}

$('character-tabs').addEventListener('click', event => { const target = event.target.closest('[data-scope]'); if(target) setScope(target.dataset.scope); });
$('type-filter').addEventListener('change', event => { state.type = event.target.value; renderCatalog(); });
$('series-toggle').addEventListener('click', () => {
  const opening = $('series-popover').hidden;
  if (!opening) { closeSeries(); return; }
  $('series-popover').hidden = false;
  $('series-toggle').setAttribute('aria-expanded','true');
  $('series-search').value = '';
  renderSeriesOptions();
  $('series-search').focus();
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
  const detail = event.target.closest('[data-detail]');
  const empty = event.target.closest('[data-empty-action]');
  if(collect) toggleOwned(collect.dataset.collect);
  else if(detail) renderDetail(detail.dataset.detail);
  else if(empty) resetFilters();
});
$('detail-content').addEventListener('click', event => { const collect = event.target.closest('[data-collect]'); if(collect) toggleOwned(collect.dataset.collect); });
$('more-button').addEventListener('click', () => {
  $('more-menu').hidden = !$('more-menu').hidden;
  $('more-button').setAttribute('aria-expanded',String(!$('more-menu').hidden));
});
$('open-data').addEventListener('click', () => { $('more-menu').hidden = true; $('more-button').setAttribute('aria-expanded','false'); showData(); });
document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]');
  if(close) $(close.dataset.close).close();
  if(!event.target.closest('.series-anchor')) closeSeries();
  if(!event.target.closest('.menu-anchor')) { $('more-menu').hidden = true; $('more-button').setAttribute('aria-expanded','false'); }
});
document.addEventListener('keydown', event => {
  if(event.key === 'Escape') {
    if(!$('series-popover').hidden) { closeSeries(); $('series-toggle').focus(); }
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
  state.characterOrder = [...orderDraft]; persist(); renderCatalog(); $('order-dialog').close(); toast('已記住你喜歡的角色順序');
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
    if(!data || typeof data !== 'object' || data.version !== 1 || !Array.isArray(data.owned) || !Array.isArray(data.characterOrder)) throw new Error('這不是有效的收藏備份，請選擇本圖鑑匯出的 JSON 檔案。');
    const normalized = normalizeSaved(data,state.characters,new Set(itemMap.keys()));
    if(data.owned.length && !normalized.owned.length) throw new Error('備份中的商品與目前圖鑑不相符，原本收藏已保留。');
    const previousSize = state.owned.size;
    state.owned = new Set([...state.owned,...normalized.owned]);
    state.characterOrder = normalized.characterOrder;
    state.groupBy = normalized.groupBy;
    refreshCollection();
    $('data-message').classList.remove('error');
    $('data-message').textContent = '匯入完成，新增 ' + (state.owned.size-previousSize) + ' 件收藏。原本的收藏已保留。';
    $('data-count').textContent = number(state.owned.size) + ' 隻收藏';
  } catch(error) { $('data-message').classList.add('error'); $('data-message').textContent = error instanceof SyntaxError ? '無法讀取這份檔案，請選擇有效的收藏備份。' : error.message; }
  event.target.value = '';
});
$('ask-clear').addEventListener('click', () => {
  if(!state.owned.size) { $('data-message').textContent = '目前沒有收藏紀錄可以清除。'; return; }
  $('clear-description').textContent = '將清除 ' + number(state.owned.size) + ' 件收藏，商品圖鑑與角色順序會保留。你也可以先匯出備份。';
  $('data-dialog').close();
  openDialog('clear-dialog');
});
$('clear-dialog').addEventListener('close', () => { if(!$('data-dialog').open) showData(); });
$('confirm-clear').addEventListener('click', () => {
  try { localStorage.setItem(lastClearKey,JSON.stringify(savedValue())); }
  catch { toast('無法建立復原紀錄，請先匯出備份後再試'); return; }
  state.owned.clear(); refreshCollection(); $('clear-dialog').close();
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
    const response = await fetch('./assets/catalog.json');
    if(!response.ok) throw new Error('資料載入失敗');
    const catalog = await response.json();
    state.items = catalog.items;
    state.characters = catalog.characters;
    itemMap = new Map(state.items.map(item => [item.id,item]));
    characterTotals = new Map();
    state.items.forEach(item => characterTotals.set(item.character, (characterTotals.get(item.character) || 0) + 1));
    avatars = new Map(state.characters.map(character => [character,(state.items.find(item => item.character===character && item.name===(avatarNames[character] || '基礎小腳')) || state.items.find(item => item.character===character))?.image]));
    let stored;
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); } catch { storageOK=false; }
    const saved = normalizeSaved(stored,state.characters,new Set(itemMap.keys()));
    state.owned = new Set(saved.owned);
    state.characterOrder = saved.characterOrder;
    state.groupBy = saved.groupBy;
    state.ready = true;
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
