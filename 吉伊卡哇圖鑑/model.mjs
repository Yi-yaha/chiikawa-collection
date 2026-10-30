export const STORAGE_KEY = 'chiikawa-collection-v1';
const splitOtherCharacters = ['小甲蟲','那孩子','哥布林','奧德','鎧甲人','流星','綜合角色','人魚島'];

export function normalizeSaved(value, characters, validIds) {
  const input = value && typeof value === 'object' ? value : {};
  const owned = Array.isArray(input.owned) ? [...new Set(input.owned.filter(id => typeof id === 'string' && validIds.has(id)))] : [];
  const givenOrder = Array.isArray(input.characterOrder)
    ? input.characterOrder.flatMap(c => c === '其他角色' ? splitOtherCharacters : [c]).filter(c => characters.includes(c))
    : [];
  const characterOrder = [...new Set([...givenOrder, ...characters])];
  return { version: 1, owned, characterOrder, groupBy: input.groupBy === 'series' ? 'series' : 'character' };
}

export function scopeItems(items, scope, owned) {
  if (scope === 'mine') return items.filter(item => owned.has(item.id));
  return items.filter(item => item.character === scope);
}

export function filterItems(items, { type = '', series = '', query = '' } = {}) {
  const needle = query.trim().toLocaleLowerCase('zh-TW');
  return items.filter(item => (!type || item.type === type) && (!series || item.name === series) && (!needle || `${item.name} ${item.character} ${item.japaneseName || ''} ${item.sku || ''}`.toLocaleLowerCase('zh-TW').includes(needle)));
}

export function groupItems(items, groupBy, characterOrder) {
  const groups = new Map();
  const order = new Map(characterOrder.map((name, index) => [name, index]));
  for (const item of items) {
    const key = groupBy === 'series' ? item.name : item.character;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  let result = [...groups].map(([name, items]) => ({ name, items }));
  if (groupBy === 'character') result.sort((a, b) => (order.get(a.name) ?? 999) - (order.get(b.name) ?? 999));
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
