// 搜尋只在比對時忽略空白，保留欄位輸入、商品名稱與系列資料原文。
export function normalizeSearchText(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('zh-TW').replace(/\s+/gu, '');
}

// 小工具與網站共用同一份系列階層；名稱、母分類與同層順序皆取自資料。
export function seriesHierarchy(nodes, items, { query = '', includeEmpty = false, excluded = new Set() } = {}) {
  const direct = new Map(), children = new Map(), byId = new Map(nodes.map(node => [node.id, node]));
  for (const item of items) {
    const name = (item.series || '').trim();
    if (name) direct.set(name, (direct.get(name) || 0) + 1);
  }
  for (const node of nodes) {
    const parent = byId.has(node.parentId) ? node.parentId : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(node);
  }
  const needle = normalizeSearchText(query);
  const aliases = { '抽賞':'抽獎 一番賞' };
  function branch(node, path = []) {
    if (excluded.has(node.id)) return null;
    const names = [...path, node.name + ' ' + (aliases[node.name] || '')];
    const ownCount = direct.get(node.name) || 0;
    const matches = !needle || normalizeSearchText(names.join(' ')).includes(needle);
    const descendants = children.get(node.id) || [];
    const nested = descendants.map(child => branch(child, names)).filter(Boolean);
    const ownOptions = ownCount && matches ? [{ key:node.name, label:node.name, count:ownCount }] : [];
    const options = [...ownOptions, ...nested.flatMap(child => child.options)];
    if (!includeEmpty && !options.length || !matches && !nested.length) return null;
    return { ...node, label:node.name, ownCount, ownOptions, options, children:nested, hasChildren:descendants.length > 0,
      count:options.reduce((sum, option) => sum + option.count, 0) };
  }
  return (children.get(null) || []).map(node => branch(node)).filter(Boolean);
}
