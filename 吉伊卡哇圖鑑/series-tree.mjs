// 小工具與網站共用同一份系列階層；名稱、母分類與同層順序皆取自資料。
// 完整名稱用來區分各系列的同名資料夾，畫面只顯示最後一段。
export function seriesNodeLabel(node) {
  const name = typeof node === 'string' ? node : node?.name || '';
  return name.split('／').at(-1);
}

export function seriesPathLabel(nodes, name) {
  const node = nodes?.find(node => node.name === name);
  if (!node) return (name || '').split('／').join(' › ');
  const byId = new Map(nodes.map(node => [node.id, node])), path = [], seen = new Set();
  let current = node;
  while (current && !seen.has(current.id)) {
    seen.add(current.id); path.unshift(seriesNodeLabel(current)); current = byId.get(current.parentId);
  }
  return path.join(' › ');
}

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
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('zh-TW');
  const needle = normalize(query.trim());
  const aliases = { '抽賞':'抽獎 一番賞' };
  function branch(node, path = []) {
    if (excluded.has(node.id)) return null;
    const label = seriesNodeLabel(node);
    const names = [...path, label + ' ' + (aliases[label] || '')];
    const ownCount = direct.get(node.name) || 0;
    const matches = !needle || normalize(names.join(' ')).includes(needle);
    const descendants = children.get(node.id) || [];
    const nested = descendants.map(child => branch(child, names)).filter(Boolean);
    const ownOptions = ownCount && matches ? [{ key:node.name, label, count:ownCount }] : [];
    const options = [...ownOptions, ...nested.flatMap(child => child.options)];
    if (!includeEmpty && !options.length || !matches && !nested.length) return null;
    return { ...node, label, ownCount, ownOptions, options, children:nested, hasChildren:descendants.length > 0,
      count:options.reduce((sum, option) => sum + option.count, 0) };
  }
  return (children.get(null) || []).map(node => branch(node)).filter(Boolean);
}
