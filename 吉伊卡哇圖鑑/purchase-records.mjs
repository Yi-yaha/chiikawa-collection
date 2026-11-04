export const PURCHASE_CURRENCIES = Object.freeze([
  { code:'JPY', name:'日圓', symbol:'¥' }, { code:'USD', name:'美元', symbol:'US$' },
  { code:'HKD', name:'港幣', symbol:'HK$' }, { code:'KRW', name:'韓元', symbol:'₩' },
  { code:'CNY', name:'人民幣', symbol:'CN¥' }, { code:'EUR', name:'歐元', symbol:'€' },
  { code:'THB', name:'泰銖', symbol:'฿' }, { code:'SGD', name:'新加坡幣', symbol:'S$' },
]);
export const purchaseCurrency = code => PURCHASE_CURRENCIES.find(currency => currency.code === code);

// 金額與匯率使用字串保存，空白與 0 元分開。
export function normalizePurchaseAmount(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!/^(?:\d{1,10}|\d{1,3}(?:,\d{3}){1,3})(?:\.\d{1,2})?$/.test(text)) return '';
  const [whole, decimal = ''] = text.replaceAll(',','').split('.');
  if (whole.length > 10) return '';
  const fraction = decimal.replace(/0+$/,'');
  return String(Number(whole)) + (fraction ? '.' + fraction : '');
}
export function normalizePurchaseRate(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!/^\d{1,12}(?:\.\d{1,12})?$/.test(text)) return '';
  const [whole, decimal = ''] = text.split('.');
  const fraction = decimal.replace(/0+$/,'');
  return String(Number(whole)) + (fraction ? '.' + fraction : '');
}
// 以整數精確換算；自動換算的金額無條件進位至整數，匯率仍保留小數。
export function calculatePurchaseField(value, field) {
  if (!purchaseCurrency(value?.currency) || !['twd','foreign','rate'].includes(field)) return {value:'',error:''};
  const keys = ['twd','foreign','rate'].filter(key => key !== field);
  const values = Object.fromEntries(keys.map(key => [key,(key === 'rate' ? normalizePurchaseRate : normalizePurchaseAmount)(value[key])]));
  if (keys.some(key => values[key] === '')) return {value:'',error:''};
  const decimal = text => {
    const [whole,fraction = ''] = text.split('.');
    return [BigInt(whole + fraction),10n ** BigInt(fraction.length)];
  };
  const [[a,as],[b,bs]] = keys.map(key => decimal(values[key]));
  const numerator = field === 'twd' ? a*b : a*bs;
  const denominator = field === 'twd' ? as*bs : as*b;
  if (denominator === 0n) return {value:'',error:field === 'foreign' ? '要計算外幣金額，匯率必須大於 0。' : '要計算匯率，外幣金額必須大於 0。'};
  let text;
  if (field === 'rate') {
    const scale = 10n ** 12n;
    const rounded = (2n*numerator*scale + denominator)/(2n*denominator);
    text = (rounded/scale).toString() + '.' + (rounded%scale).toString().padStart(12,'0');
  } else {
    text = ((numerator + denominator - 1n) / denominator).toString();
  }
  const result = (field === 'rate' ? normalizePurchaseRate : normalizePurchaseAmount)(text);
  return result !== '' ? {value:result,error:''} : {value:'',error:field === 'rate' ? '計算出的匯率過大，請確認填寫的金額。' : '計算出的金額超過 9,999,999,999.99 元，請確認填寫的數字。'};
}
export function normalizePurchaseRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.version === 2) return normalizePurchaseBook(value);
  const currency = purchaseCurrency(value.currency);
  const record = {
    twd:normalizePurchaseAmount(value.twd), currency:currency?.code || 'JPY',
    foreign:currency ? normalizePurchaseAmount(value.foreign) : '',
    note:typeof value.note === 'string' ? value.note.slice(0,2000).trim() : '',
  };
  const rate = currency ? normalizePurchaseRate(value.rate) : '';
  if (rate !== '') record.rate = rate;
  return record.twd !== '' || record.foreign !== '' || record.rate !== undefined || record.note ? record : null;
}
export function mergePurchaseRecord(current, incoming, itemId = 'legacy') {
  const before = normalizePurchaseRecord(current), added = normalizePurchaseRecord(incoming);
  if (!before) return added;
  if (!added) return before;
  if (before.version === 2 || added.version === 2) return mergePurchaseBooks(before,added,itemId);
  const currency = before.foreign !== '' || before.rate !== undefined ? before.currency : added.currency;
  const record = {
    twd:before.twd || added.twd,
    currency,
    foreign:before.foreign || (added.currency === currency ? added.foreign : ''), note:before.note || added.note,
  };
  const compatible = added.currency === currency && ['twd','foreign'].every(key => before[key] === '' || added[key] === '' || before[key] === added[key]);
  const rate = before.rate ?? (compatible ? added.rate : undefined);
  if (rate !== undefined) record.rate = rate;
  return record;
}
export function normalizePurchaseRecords(value, validIds, resolveId = id => id) {
  const result = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  // 先處理目前識別碼；合併商品的舊識別碼只能補入空白欄位。
  const entries = Object.entries(value).sort(([a],[b]) => Number(a !== resolveId(a)) - Number(b !== resolveId(b)));
  for (const [rawId, value] of entries) {
    const id = resolveId(rawId);
    if (validIds && !validIds.has(id)) continue;
    const record = mergePurchaseRecord(result[id], value, id);
    if (record) Object.defineProperty(result,id,{value:record,enumerable:true,configurable:true,writable:true});
  }
  return result;
}
export function formatPurchaseAmount(value) {
  return new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(Number(value));
}
export function purchaseExchangeRate(value) {
  const currency = purchaseCurrency(value?.currency);
  const twd = normalizePurchaseAmount(value?.twd), foreign = normalizePurchaseAmount(value?.foreign);
  const stored = normalizePurchaseRate(value?.rate);
  if (!currency || stored === '' && (twd === '' || foreign === '' || Number(foreign) === 0)) return null;
  const rate = stored !== '' ? Number(stored) : Number(twd) / Number(foreign);
  const precision = rate > 0 && rate < 0.0001 ? {maximumSignificantDigits:4} : {maximumFractionDigits:4};
  return {amount:new Intl.NumberFormat('zh-TW',precision).format(rate),foreignCurrency:currency.name};
}
export function formatPurchaseExchangeRate(value) {
  const rate = purchaseExchangeRate(value);
  return rate ? '1 ' + rate.foreignCurrency + ' ≈ NT$ ' + rate.amount : '';
}
export function describePurchaseRecord(value) {
  const record = normalizePurchaseRecord(value);
  if (!record) return '未填寫金額與備註';
  if (record.version === 2) return record.records.length + ' 筆紀錄，合計 NT$ ' + formatPurchaseAmount(purchaseTotal(record.records)) + '；' + record.records.map((entry,index) => '第 ' + (index+1) + ' 筆：' + entry.qty + ' 個' + (entry.date ? '，' + entry.date : '') + '，' + describePurchaseRecord({...entry,version:undefined})).join('；');
  const parts = [];
  if (record.twd !== '') parts.push('台幣 NT$ ' + formatPurchaseAmount(record.twd));
  if (record.foreign !== '') {
    const currency = purchaseCurrency(record.currency);
    parts.push(currency.name + ' ' + currency.symbol + ' ' + formatPurchaseAmount(record.foreign));
  }
  if (record.rate !== undefined) parts.push('換算匯率：' + formatPurchaseExchangeRate(record));
  if (record.note) parts.push('購買備註：' + record.note);
  return parts.join('；');
}

export function validPurchaseDate(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function normalizePurchaseEntry(value) {
  if (!value || value.version !== undefined) return null;
  const details = normalizePurchaseRecord(value) || {twd:'',currency:'JPY',foreign:'',note:''};
  const date = typeof value.date === 'string' && validPurchaseDate(value.date) ? value.date : '';
  return {...details,date};
}
const purchaseIdentifier = value => typeof value === 'string' && /^[A-Za-z0-9:_-]{1,160}$/.test(value);
export function normalizePurchaseBook(value) {
  if (value?.version !== 2 || !Array.isArray(value.units) || !Array.isArray(value.records) || !Array.isArray(value.deletedIds)
    || value.units.length > 100000 || value.records.length > 10000 || value.deletedIds.length > 10000) return null;
  const units = [], records = [], seenUnits = new Set(), used = new Set(), ids = new Set();
  const deletedIds = [...new Set(value.deletedIds.filter(purchaseIdentifier))];
  for (const unit of value.units) {
    if (!purchaseIdentifier(unit?.id) || typeof unit.held !== 'boolean' || seenUnits.has(unit.id)) return null;
    seenUnits.add(unit.id); units.push({id:unit.id,held:unit.held});
  }
  if (units.filter(unit => unit.held).length > 9999) return null;
  for (const entry of value.records) {
    if (!purchaseIdentifier(entry?.id) || ids.has(entry.id) || deletedIds.includes(entry.id) || !Array.isArray(entry.unitIds)
      || !Number.isInteger(entry.qty) || entry.qty < 1 || entry.qty > 9999 || entry.unitIds.length !== entry.qty) return null;
    const unitIds = [...new Set(entry.unitIds)];
    if (unitIds.length !== entry.qty || unitIds.some(id => !seenUnits.has(id) || used.has(id))) return null;
    const details = normalizePurchaseEntry(entry);
    if (!details) return null;
    ids.add(entry.id); unitIds.forEach(id => used.add(id));
    records.push({id:entry.id,qty:unitIds.length,unitIds,...details});
  }
  return {version:2,units,records,deletedIds};
}
export function purchaseBookValue(value, itemId, quantity = 0) {
  const saved = normalizePurchaseRecord(value);
  if (saved?.version === 2) return structuredClone(saved);
  const units = Array.from({length:Math.max(quantity,saved ? 1 : 0)},(_,i) => ({id:itemId + ':copy:' + (i+1),held:i < quantity}));
  const records = saved ? [{id:itemId + ':legacy',qty:1,unitIds:[units[0].id],...normalizePurchaseEntry(saved)}] : [];
  return {version:2,units,records,deletedIds:[]};
}
export function mergePurchaseBooks(current, incoming, itemId) {
  const before = purchaseBookValue(current,itemId), added = purchaseBookValue(incoming,itemId);
  const result = structuredClone(before), used = new Set(result.records.flatMap(entry => entry.unitIds));
  const unitMap = new Map(result.units.map(unit => [unit.id,unit]));
  // 同一份備份重複匯入不累加；目前的內容、刪除及持有狀態優先。
  for (const entry of added.records) {
    if (result.deletedIds.includes(entry.id)) continue;
    const existing = result.records.find(row => row.id === entry.id);
    if (existing) {
      const details = mergePurchaseRecord(normalizePurchaseRecord(existing),normalizePurchaseRecord(entry));
      Object.assign(existing,details || {},{date:existing.date || entry.date});
    } else if (!entry.unitIds.some(id => used.has(id))) {
      for (const id of entry.unitIds) if (!unitMap.has(id)) {
        const unit = added.units.find(unit => unit.id === id);
        // 匯入價格不自行增加目前的收藏數量。
        const copy = {id,held:false}; result.units.push(copy); unitMap.set(id,copy);
      }
      result.records.push(structuredClone(entry)); entry.unitIds.forEach(id => used.add(id));
    }
  }
  return normalizePurchaseBook(result);
}
const purchaseCents = (record, field = 'twd') => {
  const amount = normalizePurchaseAmount(record?.[field]);
  const qty = record?.qty ?? 1;
  if (amount === '' || !Number.isInteger(qty) || qty < 1) return 0n;
  const [whole,fraction = ''] = amount.split('.');
  return (BigInt(whole)*100n + BigInt(fraction.padEnd(2,'0'))) * BigInt(qty);
};
export const purchaseRecordTotal = (record, field = 'twd') => Number(purchaseCents(record,field))/100;
export const purchaseTotal = records => Number(records.reduce((sum,record) => sum + purchaseCents(record),0n))/100;
