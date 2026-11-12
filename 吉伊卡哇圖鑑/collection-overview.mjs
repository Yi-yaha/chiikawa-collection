import { createFilterMenu, filterChoice } from './filter-menu.mjs?v=a81b8e1c6b961f81';
import { ITEM_TYPES, typeLabel, seriesKey, seriesLabel, filterItems, groupSeriesOptions } from './model.mjs?v=a81b8e1c6b961f81';
import { normalizeSearchText } from './series-tree.mjs?v=a81b8e1c6b961f81';
import { collectionOverview, collectionQuantity, overviewSeries, overviewScope } from './collection-overview-model.mjs?v=a81b8e1c6b961f81';
import { catalogPreviewCard } from './catalog-preview-card.mjs?v=a81b8e1c6b961f81';

const h = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const n = value => Number(value || 0).toLocaleString('zh-TW');
const percentFormat = new Intl.NumberFormat('zh-TW',{style:'percent',maximumFractionDigits:1});
const percent = value => percentFormat.format(value || 0);
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
const menuChevron = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>';
let nextId = 0;

// 自己與好友共用同一個畫面；資料來源由外層提供，不讀取私人記帳內容。
export function createCollectionOverview({ container, items, characters = [], seriesTree = [], getQuantities, owner = '', initialView, onOpenDetail, getScrollRoot = () => container.closest('dialog') }) {
  const id = 'collection-overview-' + ++nextId;
  const { options } = overviewSeries(items,seriesTree);
  const initial = initialView || {};
  const filters = Object.fromEntries(['region','type','series'].map(key => [key,typeof initial.filters?.[key] === 'string' ? initial.filters[key] : '']));
  let tab = ['characters','types','series'].includes(initial.tab) ? initial.tab : 'characters';
  let expanded = Boolean(initial.expanded), seriesMode = initial.seriesMode === 'tree' ? 'tree' : 'complete';
  let branches = new Set(Array.isArray(initial.branches) ? initial.branches : []), detail = initial.detail && ['characters','types','series'].includes(initial.detail.kind) && typeof initial.detail.key === 'string' && typeof initial.detail.label === 'string' ? {...initial.detail} : null, detailOwnership = initial.detailOwnership === 'unowned' ? 'unowned' : 'owned';
  let query = typeof initial.query === 'string' ? initial.query : '', limit = Math.max(40,Math.min(items.length,Number(initial.limit) || 40)), mainScroll = Number(initial.mainScroll) || 0, scroll = Number(initial.scroll) || 0;
  let stats, quantities, detailItems = [], rowMap = new Map();
  container.classList.add('collection-overview');
  const regionValues = [...new Set(items.map(item => item.region || '日本'))];
  const presentTypes = new Set(items.map(item => item.type).filter(Boolean));
  const menuLabels = {region:'地區',type:'種類',series:'系列',order:'系列排列方式'};
  const flatChoices = {
    region:[['','全部地區'],...regionValues.map(region => [region,region])],
    type:[['','全部種類'],...[...new Set([...ITEM_TYPES,...presentTypes])]
      .filter(type => presentTypes.has(type)).map(type => [type,typeLabel(type)])],
    order:[['complete','依完整度'],['tree','依系列分類']],
  };
  const choiceLabel = (key,value) => flatChoices[key].find(([choice]) => choice === value)?.[1];
  const menuMarkup = key => {
    const label = menuLabels[key];
    const search = key === 'series' ? `<label class="series-search-wrap">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
      <input type="search" data-overview-series-search placeholder="搜尋系列或分類" aria-label="搜尋系列或分類" autocomplete="off">
    </label>` : '';
    return `<div class="series-anchor overview-menu-anchor" data-overview-menu-anchor="${key}">
      <button type="button" class="select-control series-toggle" data-overview-menu-button="${key}" aria-haspopup="dialog" aria-expanded="false" aria-controls="${id}-${key}-menu"><span data-overview-menu-label></span><span>${menuChevron}</span></button>
      <div id="${id}-${key}-menu" class="series-popover overview-menu" role="dialog" aria-label="${label}" hidden>
        ${search}
        <div class="series-options" data-overview-menu-options></div>
      </div>
    </div>`;
  };
  container.innerHTML = `${owner ? `<p class="overview-owner">${h(owner)}的收藏</p>` : ''}
    <div data-overview-main>
      <section class="overview-summary" aria-label="收藏總覽">
        <div class="overview-scope"><strong data-overview-scope>全部收藏</strong><button type="button" class="overview-filter-toggle" aria-expanded="${expanded}" aria-controls="${id}-filters" data-overview-toggle><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h6m4 0h8M3 12h12m4 0h2M3 18h2m4 0h12M9 3v6m6 0v6M5 15v6"/></svg>篩選<span data-overview-filter-count hidden></span></button></div>
        <div class="overview-numbers" aria-live="polite" aria-atomic="true"><div><span>已收藏</span><span><strong data-overview-styles>0</strong><small>款</small></span></div><div><span>持有</span><span><strong data-overview-pieces>0</strong><small>個</small></span></div></div>
      </section>
      <div id="${id}-filters" class="overview-filters"${expanded ? '' : ' hidden'}>
        ${menuMarkup('region')}
        ${menuMarkup('type')}
        ${menuMarkup('series')}
        <button type="button" class="overview-reset" data-overview-reset hidden>清除篩選</button>
      </div>
      <div class="overview-tabs" role="tablist" aria-label="收藏分類">${[['characters','角色'],['types','種類'],['series','系列']].map(([key,label]) => `<button type="button" role="tab" id="${id}-${key}" aria-controls="${id}-results" aria-selected="${tab === key}" tabindex="${tab === key ? 0 : -1}" data-overview-tab="${key}">${label}</button>`).join('')}</div>
      <div class="overview-series-controls" data-overview-series-controls hidden>${menuMarkup('order')}</div>
      <div id="${id}-results" role="tabpanel" data-overview-results></div>
    </div>
    <section class="overview-detail" data-overview-detail hidden>
      <div class="overview-detail-heading">
        <button type="button" class="icon-button" data-overview-back aria-label="返回收藏概況"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button>
        <div class="overview-detail-label">
          <h3 data-overview-detail-title tabindex="-1"></h3>
          <div class="overview-detail-stats" data-overview-detail-stats></div>
        </div>
        <div class="overview-completeness" data-overview-completeness role="img" hidden>
          <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21"/><circle class="overview-ring-fill" cx="24" cy="24" r="21" pathLength="100" stroke-dasharray="100" transform="rotate(-90 24 24)"/></svg>
          <strong aria-hidden="true"></strong>
        </div>
      </div>
      <div class="overview-owned-tabs" role="group" aria-label="收藏狀態" data-overview-owned-tabs hidden><button type="button" data-overview-ownership="owned">已收藏</button><button type="button" data-overview-ownership="unowned">未收藏</button></div>
      <label class="overview-detail-search"><span class="visually-hidden">搜尋商品</span><input type="search" data-overview-search placeholder="搜尋商品" aria-label="搜尋商品" autocomplete="off"></label>
      <div data-overview-products></div><button type="button" class="overview-more" data-overview-more hidden>載入更多</button>
    </section>`;
  const $ = query => container.querySelector(query);
  for (const key of ['region','type']) {
    if (!choiceLabel(key,filters[key])) filters[key] = '';
  }
  const seriesOptionByKey = new Map(options.map(option => [option.key,option]));
  const seriesNames = new Set(items.map(seriesKey));
  const isKnownSeries = key => seriesOptionByKey.has(key) ||
    (key.startsWith('series:') && seriesNames.has(key.slice(7)));
  if (!isKnownSeries(filters.series)) filters.series = '';

  const seriesSearch = $('[data-overview-series-search]');
  const menus = new Map(Object.keys(menuLabels).map(key => {
    const anchor = $('[data-overview-menu-anchor="' + key + '"]');
    const button = anchor.querySelector('[data-overview-menu-button]');
    const panel = anchor.querySelector('.overview-menu');
    const list = anchor.querySelector('[data-overview-menu-options]');
    const popup = createFilterMenu({
      button,panel,flat:key !== 'series',align:key === 'series' || key === 'order' ? 'end' : 'start',
      onOpen:() => prepareMenu(key,list),
    });
    return [key,{key,button,panel,list,popup}];
  }));
  const seriesList = menus.get('series').list;
  const openSeriesBranches = new Set();
  const selectedSeriesLabel = () => seriesOptionByKey.get(filters.series)?.label ||
    (filters.series ? seriesLabel(filters.series.slice(7)) : '全部系列');
  const menuValue = key => key === 'order' ? seriesMode : filters[key];
  const menuLabel = key => key === 'series' ? selectedSeriesLabel() : choiceLabel(key,menuValue(key));

  function renderMenuChoice(key, label, selected, { count, all = false } = {}) {
    return filterChoice({key,label,selected,count,all,attribute:'data-overview-menu-choice'});
  }
  function prepareMenu(key,list) {
    if (key === 'series') {
      seriesSearch.value = '';
      openSeriesBranches.clear();
      const selected = seriesOptionByKey.get(filters.series) ||
        options.find(row => row.label === selectedSeriesLabel());
      for (let option = selected; option; option = seriesOptionByKey.get(option.parentKey)) {
        if (option.key.startsWith('node:')) openSeriesBranches.add(option.key.slice(5));
      }
      renderSeriesMenu();
    } else {
      const counts = new Map();
      if (key !== 'order') {
        const available = overviewScope(items,{...filters,[key]:''},options)
          .filter(item => collectionQuantity(quantities,item.id));
        counts.set('',available.length);
        for (const item of available) {
          const value = key === 'region' ? item.region || '日本' : item.type;
          counts.set(value,(counts.get(value) || 0) + 1);
        }
      }
      list.innerHTML = flatChoices[key].map(([value,label]) => renderMenuChoice(value,label,value === menuValue(key),{
        all:value === '',count:key === 'order' ? undefined : counts.get(value) || 0,
      })).join('');
    }
    list.scrollTop = 0;
  }
  function updateMenuButtons() {
    for (const {key,button} of menus.values()) {
      const label = menuLabel(key);
      button.querySelector('[data-overview-menu-label]').textContent = label;
      const prefix = key === 'order' ? menuLabels[key] : '篩選' + menuLabels[key];
      button.setAttribute('aria-label',prefix + '：' + label);
    }
  }
  function renderSeriesMenu() {
    const available = filterItems(items,{region:filters.region,type:filters.type})
      .filter(item => collectionQuantity(quantities,item.id));
    const search = seriesSearch.value.trim();
    const groups = groupSeriesOptions(available,{query:search,seriesTree});
    const selectedNames = seriesOptionByKey.get(filters.series)?.names ||
      (filters.series ? [filters.series.slice(7)] : []);
    const namedChoice = ({key,label,count}) => {
      const selected = filters.series === 'series:' + key ||
        (filters.series.startsWith('node:') && selectedNames.length === 1 && selectedNames[0] === key);
      return renderMenuChoice('series:' + key,label,selected,{count});
    };
    function branch(node, depth = 0) {
      const key = 'node:' + node.id;
      const own = (node.ownOptions || node.options).map(namedChoice).join('');
      if (node.id === 'unassigned') return `<div class="series-unassigned">${own}</div>`;
      if (node.children && !node.hasChildren) return own;
      const children = (node.children || []).map(child => branch(child,depth+1)).join('');
      if (search) return `<section class="series-category"><p class="${depth ? 'series-subgroup-heading' : 'series-search-heading'}">${h(node.label)}</p>${own}${children}</section>`;
      const expanded = openSeriesBranches.has(node.id);
      const selected = filters.series === key || node.options.some(option => selectedNames.includes(option.key));
      const branchId = id + '-series-' + node.id;
      const categoryChoice = node.hasChildren
        ? renderMenuChoice(key,'全部' + node.label,filters.series === key,{count:node.count})
        : '';
      return `<section class="series-category"><button type="button" class="series-category-toggle${selected ? ' has-selection' : ''}" data-overview-series-branch="${h(node.id)}" aria-expanded="${expanded}" aria-controls="${h(branchId)}"><span class="series-category-name">${h(node.label)}</span><small>${n(node.options.length)} 個系列</small>${menuChevron}</button><div id="${h(branchId)}" class="series-category-options"${expanded ? '' : ' hidden'}>${categoryChoice}${own}${children}</div></section>`;
    }
    seriesList.innerHTML = renderMenuChoice('','全部系列',!filters.series,{count:available.length,all:true}) +
      (groups.length ? groups.map(node => branch(node)).join('') :
        `<p class="series-option-empty">${search ? '找不到符合的系列' : '這個範圍沒有可選的系列'}</p>`);
  }

  function closeMenus() {
    for (const {popup} of menus.values()) popup.close();
  }
  $('[data-overview-search]').value = query;
  const isVisible = () => container.isConnected && container.getClientRects().length && !container.closest('[hidden]');
  const remember = () => { if (isVisible()) scroll = getScrollRoot()?.scrollTop || 0; };
  function setScroll(value) { const root = getScrollRoot(); if (root) root.scrollTop = value; }
  function rowMarkup(row, kind, depth = 0, hasChildren = false) {
    const key = kind + ':' + row.key;
    rowMap.set(key,{...row,kind});
    const series = kind === 'series';
    return `<div class="overview-row${series ? ' overview-series-row' : ''}" style="--overview-depth:${depth}">${hasChildren ? `<button type="button" class="overview-branch" data-overview-branch="${h(row.key)}" aria-label="${branches.has(row.key) ? '收合' : '展開'}${h(row.label)}" aria-expanded="${branches.has(row.key)}">${arrow}</button>` : series && seriesMode === 'tree' ? '<span class="overview-branch-space"></span>' : ''}<button type="button" class="overview-row-button" data-overview-row="${h(key)}"><span class="overview-row-name">${h(row.label)}</span><span class="overview-row-count">${series ? `<strong>${n(row.styles)}<small>／${n(row.total)} 款</small></strong><span class="overview-percent">${percent(row.completeness)}</span>` : `<strong>${n(row.styles)} 款</strong><small>・${n(row.pieces)} 個</small>`}${arrow}</span>${series ? `<span class="overview-progress" aria-hidden="true"><span style="width:${row.completeness*100}%"></span></span>` : ''}</button></div>`;
  }
  function renderRows() {
    rowMap = new Map();
    $('[data-overview-series-controls]').hidden = tab !== 'series';
    const panel = $('[data-overview-results]');
    panel.setAttribute('aria-labelledby',id + '-' + tab);
    for (const button of container.querySelectorAll('[data-overview-tab]')) {
      const active = button.dataset.overviewTab === tab;
      button.setAttribute('aria-selected',String(active)); button.tabIndex = active ? 0 : -1;
    }
    let html = '';
    if (tab === 'series' && seriesMode === 'tree') {
      function tree(nodes, depth = 0) { return nodes.map(row => rowMarkup(row,'series',depth,Boolean(row.children.length)) + (branches.has(row.key) ? tree(row.children,depth+1) : '')).join(''); }
      html = tree(stats.tree);
    } else html = (tab === 'series' ? stats.ranking : stats[tab]).map(row => rowMarkup(row,tab === 'series' ? 'series' : tab)).join('');
    panel.innerHTML = html || `<p class="overview-empty">${!stats.styles ? (Object.values(filters).some(Boolean) ? '這個範圍還沒有收藏' : '還沒有收藏') : '目前沒有可分析完整度的系列'}</p>`;
  }
  function detailScope() {
    if (!detail) return [];
    if (detail.kind === 'characters') return stats.scope.filter(item => item.character === detail.key);
    if (detail.kind === 'types') return stats.scope.filter(item => item.type === detail.key);
    const option = options.find(row => row.key === detail.key);
    const names = option?.names || (detail.key.startsWith('series:') ? [detail.key.slice(7)] : []);
    return stats.scope.filter(item => names.includes(seriesKey(item)));
  }
  function renderProducts() {
    const needle = normalizeSearchText(query);
    const rows = detailItems.filter(item => (collectionQuantity(quantities,item.id) > 0) === (detailOwnership === 'owned') &&
      (!needle || normalizeSearchText(`${item.name} ${item.character} ${typeLabel(item.type)} ${item.series || ''}`).includes(needle)));
    const products = rows.length
      ? '<div class="product-grid overview-product-grid">' + rows.slice(0,limit).map(item =>
        catalogPreviewCard(item,{quantity:collectionQuantity(quantities,item.id)})).join('') + '</div>'
      : `<p class="overview-empty">${query ? '找不到符合的商品' : '這個範圍還沒有收藏'}</p>`;
    $('[data-overview-products]').innerHTML = products;
    $('[data-overview-more]').hidden = rows.length <= limit;
    for (const button of container.querySelectorAll('[data-overview-ownership]')) button.setAttribute('aria-pressed',String(button.dataset.overviewOwnership === detailOwnership));
  }
  function renderDetail() {
    $('[data-overview-main]').hidden = Boolean(detail);
    $('[data-overview-detail]').hidden = !detail;
    if (!detail) return;
    detailItems = detailScope();
    const owned = detailItems.filter(item => collectionQuantity(quantities,item.id)), pieces = owned.reduce((sum,item) => sum+collectionQuantity(quantities,item.id),0);
    const showComplete = detail.kind !== 'characters';
    const completeness = detailItems.length ? owned.length / detailItems.length : 0;
    const showOwnership = detail.kind === 'series' && owned.length < detailItems.length;
    const ownershipTabs = $('[data-overview-owned-tabs]');
    if (!showOwnership) {
      detailOwnership = 'owned';
      if (ownershipTabs.contains(document.activeElement)) $('[data-overview-detail-title]').focus({preventScroll:true});
    }
    ownershipTabs.hidden = !showOwnership;
    $('[data-overview-detail-title]').textContent = detail.label;
    $('[data-overview-detail-stats]').innerHTML = `<span>已收藏 <strong>${n(owned.length)}${showComplete ? '／' + n(detailItems.length) : ''}</strong> 款</span><span>・持有 ${n(pieces)} 個</span>${detail.kind !== 'series' ? `<small>佔本次收藏 ${percent(stats.styles ? owned.length/stats.styles : 0)}</small>` : ''}`;
    const complete = $('[data-overview-completeness]');
    complete.hidden = !showComplete;
    if (showComplete) {
      const label = percent(completeness);
      complete.setAttribute('aria-label','完整度 ' + label);
      complete.querySelector('strong').textContent = label;
      complete.querySelector('.overview-ring-fill').setAttribute('stroke-dashoffset',100 - completeness * 100);
    }
    renderProducts();
  }
  function refresh() {
    quantities = getQuantities() || {};
    stats = collectionOverview(items,quantities,{filters,characters,seriesTree,seriesOptions:options});
    $('[data-overview-styles]').textContent = n(stats.styles); $('[data-overview-pieces]').textContent = n(stats.pieces);
    updateMenuButtons();
    const values = Object.keys(filters).filter(key => filters[key]).map(menuLabel);
    if (menus.get('series').popup.isOpen) renderSeriesMenu();
    const scope = $('[data-overview-scope]');
    scope.textContent = values.length ? values.join('・') : '全部收藏';
    scope.title = scope.textContent;
    $('[data-overview-filter-count]').hidden = !values.length; $('[data-overview-filter-count]').textContent = values.length;
    $('[data-overview-reset]').hidden = !values.length;
    renderRows(); renderDetail();
  }
  function handleClick(event) {
    const button = event.target.closest('button'); if (!button || !container.contains(button)) return;
    if (button.hasAttribute('data-overview-toggle')) {
      expanded = !expanded; button.setAttribute('aria-expanded',String(expanded)); $('#' + id + '-filters').hidden = !expanded;
      if (!expanded) closeMenus();
    } else if (button.hasAttribute('data-overview-menu-choice')) {
      const key = button.closest('[data-overview-menu-anchor]').dataset.overviewMenuAnchor;
      const value = button.dataset.overviewMenuChoice;
      menus.get(key).popup.close(true);
      if (key === 'order') {
        seriesMode = value;
        updateMenuButtons();
        renderRows();
      } else {
        filters[key] = value;
        refresh();
      }
    } else if (button.dataset.overviewSeriesBranch) {
      const branchId = button.dataset.overviewSeriesBranch;
      if (openSeriesBranches.has(branchId)) openSeriesBranches.delete(branchId); else openSeriesBranches.add(branchId);
      renderSeriesMenu();
      seriesList.querySelector(`[data-overview-series-branch="${CSS.escape(branchId)}"]`)?.focus({preventScroll:true});
    } else if (button.hasAttribute('data-overview-reset')) {
      closeMenus();
      for (const key of Object.keys(filters)) filters[key] = '';
      refresh(); $('[data-overview-toggle]').focus({preventScroll:true});
    } else if (button.dataset.overviewTab) { tab = button.dataset.overviewTab; renderRows(); }
    else if (button.dataset.overviewBranch) { const key = button.dataset.overviewBranch; if (branches.has(key)) branches.delete(key); else branches.add(key); renderRows(); container.querySelector(`[data-overview-branch="${CSS.escape(key)}"]`)?.focus({preventScroll:true}); }
    else if (button.dataset.overviewRow) {
      const row = rowMap.get(button.dataset.overviewRow); if (!row) return;
      mainScroll = getScrollRoot()?.scrollTop || 0;
      detail = {kind:row.kind,key:row.key,label:row.label}; query = ''; limit = 40; detailOwnership = 'owned'; $('[data-overview-search]').value = '';
      renderDetail(); setScroll(0); $('[data-overview-detail-title]').focus({preventScroll:true});
    } else if (button.hasAttribute('data-overview-back')) {
      const key = detail.kind + ':' + detail.key; detail = null; renderDetail(); setScroll(mainScroll);
      container.querySelector(`[data-overview-row="${CSS.escape(key)}"]`)?.focus({preventScroll:true});
    } else if (button.dataset.overviewOwnership) { detailOwnership = button.dataset.overviewOwnership; limit = 40; renderProducts(); }
    else if (button.hasAttribute('data-overview-more')) { limit += 40; renderProducts(); }
    else if (button.dataset.overviewProduct) {
      const itemId = button.dataset.overviewProduct;
      const previousQuantity = collectionQuantity(quantities,itemId);
      const targetClass = button.matches('.product-image-button') ? 'product-image-button' : 'product-info-button';
      onOpenDetail?.(itemId);
      document.getElementById('detail-dialog')?.addEventListener('close',() => {
        if (isVisible() && !$('[data-overview-detail]').hidden) {
          if (collectionQuantity(getQuantities(),itemId) !== previousQuantity) refresh();
          const target = $(`.${targetClass}[data-overview-product="${CSS.escape(itemId)}"]`) || $('[data-overview-detail-title]');
          target.focus({preventScroll:true});
        }
      },{once:true});
    }
  }
  function handleInput(event) {
    if (event.target === seriesSearch) {
      renderSeriesMenu();
      seriesList.scrollTop = 0;
    } else if (event.target.hasAttribute('data-overview-search')) {
      query = event.target.value;
      limit = 40;
      renderProducts();
    }
  }
  function handleKey(event) {
    const button = event.target.closest('[data-overview-tab]');
    if (!button || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); const keys = ['characters','types','series'], index = keys.indexOf(tab);
    tab = keys[event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3];
    renderRows(); $(`[data-overview-tab="${tab}"]`).focus({preventScroll:true});
  }
  container.addEventListener('click',handleClick); container.addEventListener('input',handleInput); container.addEventListener('keydown',handleKey);
  refresh();
  return {
    refresh, remember, restoreScroll() {setScroll(scroll);},
    getViewState() { remember(); return {tab,filters:{...filters},expanded,seriesMode,branches:[...branches],detail,detailOwnership,query,limit,mainScroll,scroll}; },
    destroy() { closeMenus(); remember(); container.removeEventListener('click',handleClick); container.removeEventListener('input',handleInput); container.removeEventListener('keydown',handleKey); },
  };
}
