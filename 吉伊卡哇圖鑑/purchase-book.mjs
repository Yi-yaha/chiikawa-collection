import { purchaseBookValue, normalizePurchaseEntry, normalizePurchaseBook } from './purchase-records.mjs?v=fadb2113ec9b9e2d';

// 一個收藏單位最多只屬於一筆紀錄；移出收藏只改持有狀態，不刪購入歷史。
export function createPurchaseBook(quantities = {}, saved = {}) {
  const books = new Map(), records = [];
  function ensure(itemId) {
    if (!books.has(itemId)) books.set(itemId,{version:2,units:[],records:[],deletedIds:[]});
    return books.get(itemId);
  }
  function append(itemId, quantity) {
    const book = ensure(itemId), used = new Set(book.units.map(unit => unit.id));
    let serial = book.units.length;
    for (let i=0;i<quantity;i++) {
      let id; do {id = itemId + ':copy:' + (++serial);} while (used.has(id));
      book.units.push({id,held:true}); used.add(id);
    }
  }
  for (const itemId of new Set([...Object.keys(quantities),...Object.keys(saved)])) {
    const book = purchaseBookValue(saved[itemId],itemId,quantities[itemId] || 0);
    books.set(itemId,book);
    book.records.forEach(record => {record.itemId = itemId;records.push(record);});
  }
  const list = itemId => ensure(itemId).units.map((unit,index) => ({...unit,itemId,number:index+1}));
  const recordFor = unitId => records.find(record => record.unitIds.includes(unitId)) || null;
  const hasDetails = record => Boolean(record && ['twd','foreign','rate','date','note'].some(key => String(record[key] ?? '').trim() !== ''));
  function status(itemId) { return {held:list(itemId).filter(unit => unit.held)}; }
  function reduction(itemId, quantity) {
    const held = status(itemId).held;
    return [...held].sort((a,b) => Number(hasDetails(recordFor(a.id))) - Number(hasDetails(recordFor(b.id))) || b.number-a.number)
      .slice(0,Math.max(0,held.length-quantity));
  }
  function reconcile(itemId, quantity) {
    const held = status(itemId).held;
    if (quantity > held.length) append(itemId,quantity-held.length);
    else if (quantity < held.length) {
      const removed = new Set(reduction(itemId,quantity).map(unit => unit.id));
      ensure(itemId).units.forEach(unit => {if (removed.has(unit.id)) unit.held = false;});
    }
    return status(itemId);
  }
  for (const itemId of books.keys()) reconcile(itemId,quantities[itemId] || 0);
  function snapshot(itemId) {
    const book = ensure(itemId);
    if (!book.records.length && !book.deletedIds.length) return null;
    return normalizePurchaseBook(book);
  }
  function restoreHeld(itemId, ids) {
    const held = new Set(ids);
    ensure(itemId).units.forEach(unit => {unit.held = held.has(unit.id);});
  }
  function save({itemId,recordId,unitIds,...values}) {
    const book = ensure(itemId), before = recordId ? book.records.find(record => record.id === recordId) : null;
    if (recordId && !before) throw new Error('紀錄已更新，請重新開啟後再編輯。');
    const ids = [...new Set(unitIds || [])], allowed = new Set(book.units.filter(unit => unit.held || before?.unitIds.includes(unit.id)).map(unit => unit.id));
    if (!ids.length || ids.length > 9999 || ids.some(id => !allowed.has(id))) throw new Error('收藏數量已變更，請重新開啟後再編輯。');
    if (ids.some(id => records.some(record => record !== before && record.unitIds.includes(id)))) throw new Error('其中已有收藏紀錄，請編輯原紀錄。');
    const details = normalizePurchaseEntry(values);
    if (!hasDetails(details)) {if (before) remove(before.id);return null;}
    const record = {id:before?.id || itemId + ':' + crypto.randomUUID(),itemId,qty:ids.length,unitIds:ids,...details};
    if (before) {delete before.rate;Object.assign(before,record);}
    else {book.records.push(record);records.push(record);}
    return record;
  }
  function remove(id) {
    const record = records.find(record => record.id === id);
    if (!record) return null;
    const book = ensure(record.itemId), index = book.records.indexOf(record);
    book.records.splice(index,1); records.splice(records.indexOf(record),1);
    if (!book.deletedIds.includes(id)) book.deletedIds.push(id);
    return {index,record:structuredClone(record)};
  }
  function restore(removed) {
    if (!removed) return false;
    const {record,index} = removed, book = ensure(record.itemId);
    if (records.some(row => row.id === record.id || row.unitIds.some(id => record.unitIds.includes(id)))) return false;
    book.deletedIds = book.deletedIds.filter(id => id !== record.id);
    book.records.splice(Math.min(index,book.records.length),0,record); records.push(record);
    return true;
  }
  return {records,list,recordFor,hasDetails,status,reconcile,reduction,restoreHeld,snapshot,save,remove,restore};
}
