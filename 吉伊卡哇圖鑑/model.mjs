export const STORAGE_KEY = 'chiikawa-collection-v1';
export const MAX_QUANTITY = 9999;
export const ITEM_TYPES = ['吊娃', '娃', '扭蛋', '徽章', '立牌', '公仔', '景品', '地方限定吊娃', '地方限定吊牌', '其他', '待分類'];
export const PROGRESS_TYPES = [...ITEM_TYPES];
export const typeLabel = type => ({娃:'玩偶', 吊娃:'吊飾娃', 地方限定吊娃:'地方限定吊飾娃', 鐵牌:'地方限定吊牌', 其他:'其他小物'}[type] || type);
export const UNASSIGNED_SERIES = '__unassigned__';
export const seriesKey = item => (typeof item.series === 'string' ? item.series.trim() : '') || UNASSIGNED_SERIES;
export const seriesLabel = key => key === UNASSIGNED_SERIES ? '未設定系列' : key;

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
  return { version: 2, owned, quantities: Object.fromEntries(quantities), wishlist, characterOrder, groupBy: input.groupBy === 'series' ? 'series' : 'character', includedTypes, includeMetalTags: includedTypes['地方限定吊牌'] };
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
  if (typeof incoming?.includeMetalTags === 'boolean') includedTypes['地方限定吊牌'] = incoming.includeMetalTags;
  for (const type of PROGRESS_TYPES) {
    if (typeof incoming?.includedTypes?.[type] === 'boolean') includedTypes[type] = incoming.includedTypes[type];
  }
  return normalizeSaved({
    ...added,
    owned: [...quantities.keys()],
    quantities: Object.fromEntries(quantities),
    wishlist: [...before.wishlist, ...added.wishlist],
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
  return items.filter(item => item.character === scope);
}

export function filterItems(items, { type = '', region = '', series = '', query = '' } = {}) {
  const needle = query.trim().toLocaleLowerCase('zh-TW');
  return items.filter(item => (!type || item.type === type) && (!region || (item.region || '日本') === region) && (!series || seriesKey(item) === series) && (!needle || `${item.name} ${item.series || ''} ${item.character} ${item.japaneseName || ''} ${item.sku || ''}`.toLocaleLowerCase('zh-TW').includes(needle)));
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

export function groupItems(items, groupBy, characterOrder) {
  const groups = new Map();
  const order = new Map(characterOrder.map((name, index) => [name, index]));
  for (const item of items) {
    const key = groupBy === 'series' ? seriesKey(item) : groupBy === 'type' ? item.type : item.character;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  let result = [...groups].map(([name, items]) => ({ name, items }));
  if (groupBy === 'character') result.sort((a, b) => (order.get(a.name) ?? 999) - (order.get(b.name) ?? 999));
  else if (groupBy === 'type') result.sort((a, b) => {
    const index = type => ITEM_TYPES.includes(type) ? ITEM_TYPES.indexOf(type) : ITEM_TYPES.length;
    return index(a.name) - index(b.name);
  });
  else result = result.map(group => ({ ...group, items: [...group.items].sort((a, b) => (order.get(a.character) ?? 999) - (order.get(b.character) ?? 999)) }));
  return result;
}

export function moveCharacter(order, from, to) {
  if (from < 0 || from >= order.length || to < 0 || to >= order.length) return [...order];
  const next = [...order];
  const [character] = next.splice(from, 1);
  next.splice(to, 0, character);
  return next;
}
