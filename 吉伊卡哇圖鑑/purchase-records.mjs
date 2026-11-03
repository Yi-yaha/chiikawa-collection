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
// 以整數處理小數，金額四捨五入至小數兩位，避免 1.005 被算成 1.00。
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
  const digits = field === 'rate' ? 12 : 2;
  const scale = 10n ** BigInt(digits);
  const rounded = (2n*numerator*scale + denominator)/(2n*denominator);
  const text = (rounded/scale).toString() + '.' + (rounded%scale).toString().padStart(digits,'0');
  const result = (field === 'rate' ? normalizePurchaseRate : normalizePurchaseAmount)(text);
  return result !== '' ? {value:result,error:''} : {value:'',error:field === 'rate' ? '計算出的匯率過大，請確認填寫的金額。' : '計算出的金額超過 9,999,999,999.99 元，請確認填寫的數字。'};
}
export function normalizePurchaseRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
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
export function mergePurchaseRecord(current, incoming) {
  const before = normalizePurchaseRecord(current), added = normalizePurchaseRecord(incoming);
  if (!before) return added;
  if (!added) return before;
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
    const record = mergePurchaseRecord(result[id], value);
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
