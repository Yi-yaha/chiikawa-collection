export const PURCHASE_CURRENCIES = Object.freeze([
  { code:'JPY', name:'日圓', symbol:'¥' }, { code:'USD', name:'美元', symbol:'US$' },
  { code:'HKD', name:'港幣', symbol:'HK$' }, { code:'KRW', name:'韓元', symbol:'₩' },
  { code:'CNY', name:'人民幣', symbol:'CN¥' }, { code:'EUR', name:'歐元', symbol:'€' },
  { code:'THB', name:'泰銖', symbol:'฿' }, { code:'SGD', name:'新加坡幣', symbol:'S$' },
]);
export const purchaseCurrency = code => PURCHASE_CURRENCIES.find(currency => currency.code === code);

// 金額使用字串保存，空白與 0 元分開，不以換算結果取代實際填寫的金額。
export function normalizePurchaseAmount(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!/^(?:\d{1,10}|\d{1,3}(?:,\d{3}){1,3})(?:\.\d{1,2})?$/.test(text)) return '';
  const [whole, decimal = ''] = text.replaceAll(',','').split('.');
  if (whole.length > 10) return '';
  const fraction = decimal.replace(/0+$/,'');
  return String(Number(whole)) + (fraction ? '.' + fraction : '');
}
export function normalizePurchaseRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const currency = purchaseCurrency(value.currency);
  const record = {
    twd:normalizePurchaseAmount(value.twd), currency:currency?.code || 'JPY',
    foreign:currency ? normalizePurchaseAmount(value.foreign) : '',
    note:typeof value.note === 'string' ? value.note.slice(0,2000).trim() : '',
  };
  return record.twd !== '' || record.foreign !== '' || record.note ? record : null;
}
export function mergePurchaseRecord(current, incoming) {
  const before = normalizePurchaseRecord(current), added = normalizePurchaseRecord(incoming);
  if (!before) return added;
  if (!added) return before;
  return {
    twd:before.twd || added.twd,
    currency:before.foreign !== '' ? before.currency : added.currency,
    foreign:before.foreign || added.foreign, note:before.note || added.note,
  };
}
export function normalizePurchaseRecords(value, validIds, resolveId = id => id) {
  const result = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  // 先處理目前識別碼；合併商品的舊識別碼只能補入空白欄位。
  const entries = Object.entries(value).sort(([a],[b]) => Number(a !== resolveId(a)) - Number(b !== resolveId(b)));
  for (const [rawId, value] of entries) {
    const id = resolveId(rawId);
    if (validIds && !validIds.has(id)) continue;
    const record = mergePurchaseRecord(result[id], value);
    if (record) Object.defineProperty(result,id,{value:record,enumerable:true,configurable:true,writable:true});
  }
  return result;
}
export function formatPurchaseAmount(value) {
  return new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(Number(value));
}
export function describePurchaseRecord(value) {
  const record = normalizePurchaseRecord(value);
  if (!record) return '未填寫金額與備註';
  const parts = [];
  if (record.twd !== '') parts.push('台幣 NT$ ' + formatPurchaseAmount(record.twd));
  if (record.foreign !== '') {
    const currency = purchaseCurrency(record.currency);
    parts.push(currency.name + ' ' + currency.symbol + ' ' + formatPurchaseAmount(record.foreign));
  }
  if (record.note) parts.push('購買備註：' + record.note);
  return parts.join('；');
}
