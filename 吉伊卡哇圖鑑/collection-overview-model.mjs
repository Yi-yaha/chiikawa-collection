import { ITEM_TYPES, typeLabel, seriesKey, seriesLabel, UNASSIGNED_SERIES } from './model.mjs?v=72b4edb3da004c3e';
import { seriesHierarchy } from './series-tree.mjs?v=72b4edb3da004c3e';

export const collectionQuantity = (quantities, id) => Number.isInteger(quantities?.[id]) && quantities[id] > 0 ? quantities[id] : 0;

// 只讀取圖鑑原有的系列與階層，不由商品名稱推測分類。
export function overviewSeries(items, seriesTree = []) {
  const options = [], known = new Set();
  function visit(nodes, depth = 0, parentKey = '', path = []) {
    for (const node of nodes) {
      const names = [...new Set(node.options.map(option => option.key))];
      options.push({ key:'node:' + node.id, label:node.name, depth, names, parentKey, hasChildren:Boolean(node.children.length), path:[...path,node.name] });
      known.add(node.name);
      if (node.ownCount && node.children.length) options.push({key:'series:' + node.name,label:node.name + '（本層）',depth:depth+1,names:[node.name],parentKey:'node:' + node.id,path:[...path,node.name]});
      visit(node.children, depth + 1, 'node:' + node.id, [...path,node.name]);
    }
  }
  const tree = seriesHierarchy(seriesTree, items);
  visit(tree);
  for (const name of new Set(items.map(seriesKey))) {
    if (!known.has(name)) options.push({ key:'series:' + name, label:seriesLabel(name), depth:0, names:[name] });
  }
  return { tree, options };
}

export function overviewScope(items, filters = {}, options = []) {
  const option = options.find(row => row.key === filters.series);
  const names = option ? new Set(option.names) : filters.series?.startsWith('series:') ? new Set([filters.series.slice(7)]) : null;
  return items.filter(item => (!filters.character || item.character === filters.character) &&
    (!filters.region || (item.region || '日本') === filters.region) && (!filters.type || item.type === filters.type) &&
    (!names || names.has(seriesKey(item))));
}

export function collectionOverview(items, quantities, { filters = {}, characters = [], seriesTree = [], seriesOptions } = {}) {
  const options = seriesOptions || overviewSeries(items, seriesTree).options;
  const scope = overviewScope(items, filters, options);
  const owned = scope.filter(item => collectionQuantity(quantities, item.id));
  const total = rows => ({ styles:rows.length, pieces:rows.reduce((sum, item) => sum + collectionQuantity(quantities, item.id), 0) });
  function groups(key, order, label) {
    const counts = new Map();
    for (const item of scope) {
      const name = item[key] || '其他';
      if (!counts.has(name)) counts.set(name, { key:name, label:label(name), styles:0, pieces:0, total:0 });
      const row = counts.get(name), qty = collectionQuantity(quantities, item.id);
      row.total++;
      if (qty) { row.styles++; row.pieces += qty; }
    }
    const positions = new Map(order.map((name, index) => [name, index]));
    return [...counts.values()].filter(row => row.styles).sort((a,b) => b.styles-a.styles ||
      (positions.get(a.key) ?? order.length) - (positions.get(b.key) ?? order.length) || a.label.localeCompare(b.label,'zh-TW'))
      .map(row => ({ ...row, ratio:owned.length ? row.styles/owned.length : 0, completeness:row.styles/row.total }));
  }
  const direct = new Map();
  for (const item of scope) {
    const name = seriesKey(item), qty = collectionQuantity(quantities,item.id);
    if (!direct.has(name)) direct.set(name, { key:'series:' + name, name, label:seriesLabel(name), styles:0, pieces:0, total:0 });
    const row = direct.get(name); row.total++;
    if (qty) { row.styles++; row.pieces += qty; }
  }
  const ranking = [...direct.values()].filter(row => row.styles && row.name !== UNASSIGNED_SERIES)
    .map(row => ({ ...row, completeness:row.styles/row.total }))
    .sort((a,b) => b.completeness-a.completeness || b.styles-a.styles || a.label.localeCompare(b.label,'zh-TW'));
  function branches(nodes) {
    return nodes.map(node => {
      const names = [...new Set(node.options.map(option => option.key))];
      const rows = names.map(name => direct.get(name)).filter(Boolean);
      const result = { key:'node:' + node.id, label:node.name, names, children:branches(node.children),
        styles:rows.reduce((sum,row) => sum+row.styles,0), pieces:rows.reduce((sum,row) => sum+row.pieces,0), total:rows.reduce((sum,row) => sum+row.total,0) };
      return { ...result, completeness:result.total ? result.styles/result.total : 0 };
    }).filter(node => node.styles);
  }
  const tree = branches(seriesHierarchy(seriesTree, scope));
  const treeNames = new Set(options.filter(row => row.key.startsWith('node:')).flatMap(row => row.names));
  for (const row of direct.values()) if (row.styles && !treeNames.has(row.name)) tree.push({ ...row, names:[row.name], children:[], completeness:row.styles/row.total });
  return { ...total(owned), total:scope.length, scope, owned, characters:groups('character',characters,name => name), types:groups('type',ITEM_TYPES,typeLabel), ranking, tree };
}
