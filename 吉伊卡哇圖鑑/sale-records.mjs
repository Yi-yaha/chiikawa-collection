import { normalizePurchaseAmount } from './purchase-records.mjs?v=08ff7e81c7e19075';

// 販售意願與購買紀錄分開；關閉時保留上次售價。
export function normalizeSaleRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = { enabled:value.enabled === true, price:normalizePurchaseAmount(value.price) };
  return typeof value.enabled === 'boolean' || record.price !== '' ? record : null;
}

export function normalizeSaleRecords(value, validIds, resolveId = id => id) {
  const records = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return records;
  const entries = Object.entries(value).sort(([a],[b]) => Number(a !== resolveId(a)) - Number(b !== resolveId(b)));
  for (const [rawId,value] of entries) {
    const id = resolveId(rawId), record = normalizeSaleRecord(value);
    if (!record || validIds && !validIds.has(id) || Object.hasOwn(records,id)) continue;
    Object.defineProperty(records,id,{value:record,enumerable:true,configurable:true,writable:true});
  }
  return records;
}
