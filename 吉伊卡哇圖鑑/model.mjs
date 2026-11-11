import { seriesHierarchy, normalizeSearchText } from './series-tree.mjs?v=72b4edb3da004c3e';
import { normalizePurchaseRecords, mergePurchaseRecord } from './purchase-records.mjs?v=72b4edb3da004c3e';
import { normalizeSaleRecords } from './sale-records.mjs?v=72b4edb3da004c3e';

export const STORAGE_KEY = 'chiikawa-collection-v1';
export const MAX_QUANTITY = 9999;
export const ITEM_TYPES = ['吊娃', '娃', '扭蛋', '徽章', '立牌', '公仔', '景品', '地方限定吊娃', '地方限定吊牌', '其他', '待分類'];
export const PROGRESS_TYPES = [...ITEM_TYPES];
export const typeLabel = type => ({娃:'玩偶', 吊娃:'吊飾娃', 地方限定吊娃:'地方限定吊飾娃', 鐵牌:'地方限定吊牌', 其他:'其他小物'}[type] || type);
export const UNASSIGNED_SERIES = '__unassigned__';
export const seriesKey = item => (typeof item.series === 'string' ? item.series.trim() : '') || UNASSIGNED_SERIES;
export const seriesLabel = key => key === UNASSIGNED_SERIES ? '未設定系列' : key;

// 只合併圖鑑的商品分區；篩選選單及管理資料繼續使用完整階層。
const MINISO_SERIES_ID = 'series-59a14a35-94a3-4dce-86cb-75fd398a22b0';
const seriesGroupIndexes = new WeakMap();
function seriesGroupIndex(tree) {
  if (!Array.isArray(tree)) return null;
  if (seriesGroupIndexes.has(tree)) return seriesGroupIndexes.get(tree);
  const index = { groups:new Map(), order:new Map(), seriesOrder:new Map(), miniso:null };
  function visit(node, depth = 1, group = node.name) {
    if (depth <= 2) group = node.name;
    if (!index.order.has(group)) index.order.set(group, index.order.size);
    index.groups.set(node.name, group);
    index.seriesOrder.set(node.name, index.seriesOrder.size);
    if (node.id === MINISO_SERIES_ID) index.miniso = node;
    for (const child of node.children) visit(child, depth + 1, group);
  }
  seriesHierarchy(tree, [], { includeEmpty:true }).forEach(node => visit(node));
  seriesGroupIndexes.set(tree, index);
  return index;
}

export function seriesGroupKey(item, tree) {
  const key = seriesKey(item);
  return seriesGroupIndex(tree)?.groups.get(key) ?? key;
}

export function catalogSeriesSections(group, tree) {
  const root = seriesGroupIndex(tree)?.miniso;
  if (!root || group.name !== root.name) return null;
  const itemsBySeries = new Map();
  for (const item of group.items) {
    const name = seriesKey(item);
    if (!itemsBySeries.has(name)) itemsBySeries.set(name, []);
    itemsBySeries.get(name).push(item);
  }
  function section(node) {
    const items = itemsBySeries.get(node.name) || [];
    const children = node.children.map(section).filter(child => child.count > 0);
    const count = children.reduce((total, child) => total + child.count, items.length);
    return { name:node.name, items, children, count };
  }
  return section(root);
}

// 只整理選單的瀏覽分區；商品原本的系列名稱與歸屬保持獨立。
const SERIES_CATEGORIES = [
  { id:'theme', label:'主題系列', keywords:'企劃' },
  { id:'venue', label:'店舖與景點', keywords:'店鋪 場館 本舖' },
  { id:'season', label:'節慶與季節', keywords:'節日' },
  { id:'lottery', label:'抽賞', keywords:'抽獎 一番賞' },
  { id:'collaboration', label:'聯名', keywords:'品牌聯名' },
  { id:'game', label:'手遊', keywords:'遊戲' },
  { id:'local', label:'地方限定', keywords:'旅遊 地區' },
  { id:'daily', label:'日常造型與小物', keywords:'配件 基礎' },
  { id:'unassigned', label:'未設定系列', keywords:'' }
];
const themeSeries = new Set(['魔法吉伊卡哇','天使與惡魔','平行時空','吉伊卡哇電影','Chiikawa Baby（一般商品）','開心遊樂園','花仙子','幽靈森林','5週年','上海特展','奇幻馬戲團','東京吉伊卡哇','東京伴手禮','吉伊卡哇觀光']);
const venueSeries = new Set(['吉伊卡哇樂園（PARK）','吉伊卡哇專賣店','吉伊卡哇飯店','吉伊卡哇餐廳','吉伊卡哇拉麵豚','吉伊卡哇烘焙坊','吉伊卡哇壽司','吉伊卡哇水族館','吉伊卡哇咖啡廳','吉伊卡哇聖誕市集','獅薩祭典與伴手禮店']);
const seasonalSeries = new Set(['新年','正月','鏡餅','馬年','羊年','蛇年','龍年','兔年','虎年','生日','節分','復活節','情人節','七夕','中秋燈會','鯉魚旗','打西瓜','秋的味道']);
const collaborationSeries = new Set(['MLB 東京系列','日本代表隊','泰迪熊搪膠']);
const seriesCollator = new Intl.Collator('zh-TW', { numeric:true });
const lotteryCharacterOrder = new Map(['吉伊','小八','兔兔','小桃','師傅','栗子','獅薩','古本'].map((character, index) => [character, index]));
const lotterySectionLabels = { character:'角色抽賞', theme:'主題抽賞' };

function lotterySection(key, characters) {
  return key.endsWith('抽賞') && characters.has(key.slice(0, -2)) ? 'character' : 'theme';
}

function groupLotteryOptions(options, characters) {
  const sections = ['character', 'theme'].map(id => ({ id, label:lotterySectionLabels[id], options:[] }));
  for (const option of options) sections[lotterySection(option.key, characters) === 'character' ? 0 : 1].options.push(option);
  sections[0].options.sort((a, b) =>
    (lotteryCharacterOrder.get(a.key.slice(0, -2)) ?? lotteryCharacterOrder.size) -
    (lotteryCharacterOrder.get(b.key.slice(0, -2)) ?? lotteryCharacterOrder.size) || compareSeries(a.key, b.key));
  // 同主題的年份放在一起，再依年份由舊到新排列。
  const theme = key => key.replace(/^\d{4}\s*/, '');
  sections[1].options.sort((a, b) => compareSeries(theme(a.key), theme(b.key)) || compareSeries(a.key, b.key));
  return sections.filter(section => section.options.length);
}

function seriesCategory(key, items) {
  if (key === UNASSIGNED_SERIES) return 'unassigned';
  if (/抽賞|一番賞/.test(key)) return 'lottery';
  if (/聯名/.test(key) || collaborationSeries.has(key)) return 'collaboration';
  if (/^手遊(?:\s|$)/.test(key)) return 'game';
  if (venueSeries.has(key) || /^MOGUMOGU本舖(?:\s|$)/.test(key)) return 'venue';
  if (themeSeries.has(key)) return 'theme';
  if (items.length && items.every(item => ['地方限定吊娃','地方限定吊牌','鐵牌'].includes(item.type))) return 'local';
  if (seasonalSeries.has(key) || /萬聖|聖誕|冬季|冬日|秋季|夏日|櫻花|浴衣|納涼|楓葉/.test(key)) return 'season';
  return 'daily';
}

function compareSeries(a, b) {
  // 中文代數依實際代數排，讓三麗鷗初代至四代連續出現。
  const generations = { 初:1, 一:1, 二:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9, 十:10 };
  const sortable = key => seriesLabel(key).replace(/(初|[一二三四五六七八九十])代/g, (_, value) => generations[value] + '代');
  return seriesCollator.compare(sortable(a), sortable(b));
}

function groupSeriesTreeOptions(items, tree, query) {
  const counts = new Map();
  for (const item of items) {
    const key = seriesKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const needle = normalizeSearchText(query);
  const groups = seriesHierarchy(tree, items, { query });
  // 新系列尚未加入階層時仍可選取；未設定系列固定放在最後。
  const knownNames = new Set(tree.map(node => node.name));
  const remaining = [...counts].filter(([key]) => key !== UNASSIGNED_SERIES && !knownNames.has(key))
    .filter(([key]) => !needle || normalizeSearchText('其他系列 ' + key).includes(needle))
    .map(([key, count]) => ({ key, label:seriesLabel(key), count }));
  if (remaining.length) groups.push({ id:'other-series', label:'其他系列', options:remaining.sort((a, b) => compareSeries(a.key, b.key)) });
  if (counts.has(UNASSIGNED_SERIES) && (!needle || normalizeSearchText('未設定系列').includes(needle))) {
    groups.push({ id:'unassigned', label:'未設定系列', options:[{ key:UNASSIGNED_SERIES, label:'未設定系列', count:counts.get(UNASSIGNED_SERIES) }] });
  }
  return groups;
}

export function groupSeriesOptions(items, { query = '', catalog = items, seriesTree } = {}) {
  if (Array.isArray(seriesTree)) return groupSeriesTreeOptions(items, seriesTree, query);
  const catalogSeries = new Map();
  const characters = new Set(catalog.map(item => item.character).filter(Boolean));
  for (const item of catalog) {
    const key = seriesKey(item);
    if (!catalogSeries.has(key)) catalogSeries.set(key, []);
    catalogSeries.get(key).push(item);
  }
  const counts = new Map();
  for (const item of items) {
    const key = seriesKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const categories = SERIES_CATEGORIES.map(category => ({ ...category, options:[] }));
  const byId = new Map(categories.map(category => [category.id, category]));
  const needle = normalizeSearchText(query);
  for (const [key, count] of counts) {
    // 用完整圖鑑決定分區，避免改變角色、地區或種類後，同系列突然搬家。
    const category = byId.get(seriesCategory(key, catalogSeries.get(key) || items.filter(item => seriesKey(item) === key)));
    const sectionLabel = category.id === 'lottery' ? lotterySectionLabels[lotterySection(key, characters)] : '';
    if (needle && !normalizeSearchText(`${category.label} ${category.keywords} ${sectionLabel}`).includes(needle) && !normalizeSearchText(seriesLabel(key)).includes(needle)) continue;
    category.options.push({ key, label:seriesLabel(key), count });
  }
  return categories.filter(category => category.options.length).map(category => {
    if (category.id === 'lottery') {
      const sections = groupLotteryOptions(category.options, characters);
      return { id:category.id, label:category.label, options:sections.flatMap(section => section.options), sections };
    }
    return { id:category.id, label:category.label, options:category.options.sort((a, b) => compareSeries(a.key, b.key)) };
  });
}

function normalizeIncludedTypes(value, includeMetalTags = true) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(PROGRESS_TYPES.map(type => [type,
    typeof input[type] === 'boolean' ? input[type] : type === '地方限定吊牌' ? includeMetalTags !== false : true
  ]));
}

export function isProgressIncluded(item, includedTypes = {}) {
  const type = item.type === '鐵牌' ? '地方限定吊牌' : item.type;
  // Keep the former boolean argument usable by older callers and backups.
  if (typeof includedTypes === 'boolean') return includedTypes || type !== '地方限定吊牌';
  return !PROGRESS_TYPES.includes(type) || includedTypes?.[type] !== false;
}
const splitOtherCharacters = ['小甲蟲','那孩子','哥布林','奧德','鎧甲人','流星','綜合角色','人魚島'];
export const independentCharacters = ['大強','奇美拉','惡夢大象','灰孩子','睡衣派對','乳酸菌超人','巫婆','大腳怪','馴鹿','小惡魔','粉蟲','黃綠蟲','河豚','中止蟲','大鳥','擬態怪獸','大樹'];
export const otherCharacters = ['奇美拉','惡夢大象','灰孩子','睡衣派對','乳酸菌超人','巫婆','大腳怪','馴鹿','小惡魔','粉蟲','黃綠蟲','河豚','中止蟲','大鳥','擬態怪獸','大樹'];
export const characterTabName = character => otherCharacters.includes(character) ? '其他角色' : character;

export function characterTabOrder(order) {
  return [...new Set(order.map(characterTabName))];
}

// 頭貼合併顯示，儲存時仍保留原角色與群組內的順序，延續舊收藏與備份。
export function reorderCharacterTabs(order, tabOrder) {
  return tabOrder.flatMap(tab => order.filter(character => characterTabName(character) === tab));
}

export function normalizeSaved(value, characters, validIds, itemAliases = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const resolveId = id => {
    const visited = new Set();
    while (!validIds.has(id) && typeof itemAliases[id] === 'string' && !visited.has(id)) {
      visited.add(id);
      id = itemAliases[id];
    }
    return id;
  };
  const legacyOwned = Array.isArray(input.owned)
    ? [...new Set(input.owned.filter(id => typeof id === 'string').map(resolveId).filter(id => validIds.has(id)))]
    : [];
  const quantities = new Map(legacyOwned.map(id => [id, 1]));
  const explicitQuantities = new Map();
  if (input.quantities && typeof input.quantities === 'object' && !Array.isArray(input.quantities)) {
    for (const [rawId, quantity] of Object.entries(input.quantities)) {
      const id = resolveId(rawId);
      if (!validIds.has(id) || !Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) continue;
      explicitQuantities.set(id, Math.max(explicitQuantities.get(id) || 0, quantity));
    }
  }
  for (const [id, quantity] of explicitQuantities) {
    if (quantity > 0) quantities.set(id, quantity);
    else quantities.delete(id);
  }
  const owned = [...quantities.keys()];
  const wishlist = Array.isArray(input.wishlist)
    ? [...new Set(input.wishlist.filter(id => typeof id === 'string').map(resolveId).filter(id => validIds.has(id) && !quantities.has(id)))]
    : [];
  const hasIndependentOrder = Array.isArray(input.characterOrder) && input.characterOrder.some(c => independentCharacters.includes(c));
  const givenOrder = Array.isArray(input.characterOrder)
    ? input.characterOrder
      .flatMap(c => c === '其他角色' ? splitOtherCharacters : [c])
      .flatMap(c => c === '綜合角色' && !hasIndependentOrder ? [...independentCharacters, c] : [c])
      .filter(c => characters.includes(c))
    : [];
  const characterOrder = [...new Set([...givenOrder, ...characters])];
  const includedTypes = normalizeIncludedTypes(input.includedTypes, input.includeMetalTags);
  const purchaseRecords = normalizePurchaseRecords(input.purchaseRecords, validIds, resolveId);
  const saleRecords = normalizeSaleRecords(input.saleRecords, validIds, resolveId);
  const groupBy = ['type','series'].includes(input.groupBy) ? input.groupBy : 'character';
  return { version: 2, owned, quantities: Object.fromEntries(quantities), wishlist, purchaseRecords, saleRecords, characterOrder, groupBy, includedTypes, includeMetalTags: includedTypes['地方限定吊牌'] };
}

// A backup is a snapshot: repeated imports keep the larger quantity instead of
// adding it again. An owned item always takes priority over a wish.
export function mergeSaved(current, incoming, characters, validIds, itemAliases = {}) {
  const before = normalizeSaved(current, characters, validIds, itemAliases);
  const added = normalizeSaved(incoming, characters, validIds, itemAliases);
  const quantities = new Map(Object.entries(before.quantities));
  for (const [id, quantity] of Object.entries(added.quantities)) {
    quantities.set(id, Math.max(quantities.get(id) || 0, quantity));
  }
  const includedTypes = { ...before.includedTypes };
  const purchaseRecords = { ...before.purchaseRecords };
  for (const [id, record] of Object.entries(added.purchaseRecords)) purchaseRecords[id] = mergePurchaseRecord(purchaseRecords[id], record, id);
  if (typeof incoming?.includeMetalTags === 'boolean') includedTypes['地方限定吊牌'] = incoming.includeMetalTags;
  for (const type of PROGRESS_TYPES) {
    if (typeof incoming?.includedTypes?.[type] === 'boolean') includedTypes[type] = incoming.includedTypes[type];
  }
  return normalizeSaved({
    ...added,
    owned: [...quantities.keys()],
    quantities: Object.fromEntries(quantities),
    wishlist: [...before.wishlist, ...added.wishlist],
    purchaseRecords,
    saleRecords: { ...added.saleRecords, ...before.saleRecords },
    includedTypes
  }, characters, validIds, itemAliases);
}

export function progressTotals(items, includedTypes = {}) {
  const totals = new Map();
  for (const item of items) {
    if (!isProgressIncluded(item, includedTypes)) continue;
    totals.set(item.character, (totals.get(item.character) || 0) + 1);
  }
  return totals;
}

export function scopeItems(items, scope, owned, wishlist = new Set()) {
  if (scope === 'all') return items;
  if (scope === 'mine') return items.filter(item => owned.has(item.id));
  if (scope === 'wishlist') return items.filter(item => wishlist.has(item.id) && !owned.has(item.id));
  if (scope === '其他角色') return items.filter(item => otherCharacters.includes(item.character));
  return items.filter(item => item.character === scope);
}

export function filterItems(items, { type = '', region = '', series = '', seriesKeys, query = '' } = {}) {
  const needle = normalizeSearchText(query);
  return items.filter(item => (!type || item.type === type) && (!region || (item.region || '日本') === region) && (seriesKeys ? seriesKeys.has(seriesKey(item)) : !series || seriesKey(item) === series) && (!needle || normalizeSearchText(`${item.name} ${item.series || ''} ${item.character} ${item.japaneseName || ''} ${item.sku || ''}`).includes(needle)));
}

export function collectionStats(items, owned, quantities = {}, includedTypes = {}) {
  const stats = { total:items.length, owned:0, pieces:0, goalTotal:0, goalOwned:0 };
  for (const item of items) {
    const collected = owned.has(item.id);
    const included = isProgressIncluded(item, includedTypes);
    if (collected) {
      stats.owned++;
      stats.pieces += quantities[item.id] || 1;
    }
    if (included) {
      stats.goalTotal++;
      if (collected) stats.goalOwned++;
    }
  }
  return stats;
}

export function groupItems(items, groupBy, characterOrder, seriesTree) {
  const groups = new Map();
  // 「其他角色」共用一個頭貼，旗下各區塊跟著該頭貼的位置排列。
  const orderedCharacters = groupBy === 'character' ? reorderCharacterTabs(characterOrder, characterTabOrder(characterOrder)) : characterOrder;
  const order = new Map(orderedCharacters.map((name, index) => [name, index]));
  const seriesIndex = groupBy === 'series' ? seriesGroupIndex(seriesTree) : null;
  for (const item of items) {
    const key = groupBy === 'series' ? seriesGroupKey(item, seriesTree) : groupBy === 'type' ? item.type : item.character;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  let result = [...groups].map(([name, items]) => ({ name, items }));
  if (groupBy === 'character') result.sort((a, b) => (order.get(a.name) ?? 999) - (order.get(b.name) ?? 999));
  else if (groupBy === 'type') result.sort((a, b) => {
    const index = type => ITEM_TYPES.includes(type) ? ITEM_TYPES.indexOf(type) : ITEM_TYPES.length;
    return index(a.name) - index(b.name);
  });
  else {
    if (seriesIndex) result.sort((a, b) => {
      if (a.name === UNASSIGNED_SERIES) return 1;
      if (b.name === UNASSIGNED_SERIES) return -1;
      return (seriesIndex.order.get(a.name) ?? Infinity) - (seriesIndex.order.get(b.name) ?? Infinity);
    });
    result = result.map(group => ({ ...group, items: [...group.items].sort((a, b) =>
      (seriesIndex ? (seriesIndex.seriesOrder.get(seriesKey(a)) ?? 999) - (seriesIndex.seriesOrder.get(seriesKey(b)) ?? 999) : 0)
      || (order.get(a.character) ?? 999) - (order.get(b.character) ?? 999)) }));
  }
  return result;
}

export function moveCharacter(order, from, to) {
  if (from < 0 || from >= order.length || to < 0 || to >= order.length) return [...order];
  const next = [...order];
  const [character] = next.splice(from, 1);
  next.splice(to, 0, character);
  return next;
}
