import { calculatePurchaseField, normalizePurchaseAmount, normalizePurchaseRate, PURCHASE_CURRENCIES } from './purchase-records.mjs?v=5b46c0b58ac51eae';
import { createPurchaseBook } from './purchase-book.mjs?v=5b46c0b58ac51eae';
import { purchaseRecordTotal, purchaseTotal, validPurchaseDate, purchaseCurrency } from './purchase-records.mjs?v=5b46c0b58ac51eae';
import { monthNumber, monthKey, purchasePeriod, recordsInPeriod, periodLabel, periodDates } from './purchase-period.mjs?v=5b46c0b58ac51eae';
import { fetchPurchaseExchangeRate } from './purchase-exchange.mjs?v=5b46c0b58ac51eae';

// 本人的私人收藏紀錄；依既有帳號、離線與版本差異流程保存。
export function createPurchaseHub({ state, getItem, icon, persist, updateCollection, toast, getScope, openDialog }) {
  let book = createPurchaseBook(), records = book.records, fingerprint = '', scope = getScope();
  let editorBase = null, editorScope = null;
  const n = value => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(value);
  const money = value => 'NT$ ' + n(value);
  const h = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const $ = id => document.getElementById(id);
  let activeId = null, edited = null, range = 6, group = 'character', periodEnd = null;
  let statsPeriod = null, monthlyAmounts = new Map(), chartMaximum = 1;
  let timelineCleanup = null, ignoreChartClick = false;
  let selectedUnits = new Set();
  let selectedMonth = null, selectedGroup = null;
  let confirmationResolver = null, manualFields = [], calculatedField = null;
  const clearedFields = new Set();
  let rateRequest = null;
  let dismissRateNotice = null;

  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="purchase-editor" class="panel-dialog purchase-editor" aria-label="編輯收藏紀錄">
      <div class="purchase-editor-header"><button class="icon-button" data-purchase-close="purchase-editor" aria-label="關閉購入紀錄">${icon('close')}</button></div>
      <form id="purchase-purchase-form" novalidate>
        <div class="purchase-record-quantity"><label for="purchase-record-quantity">數量</label><div class="quantity-stepper"><button type="button" id="purchase-record-minus" aria-label="減少這筆紀錄的數量">${icon('minus')}</button><input id="purchase-record-quantity" type="number" min="1" max="9999" step="1" inputmode="numeric" value="1" aria-label="這筆紀錄的數量"><button type="button" id="purchase-record-plus" aria-label="增加這筆紀錄的數量">${icon('plus')}</button></div></div>
        <div class="purchase-record-date"><label for="purchase-date">購入日期 <small>選填</small></label><input id="purchase-date" type="date" lang="zh-TW" aria-label="購入日期，選填"></div>
        <div class="purchase-unit-price-heading"><span>單價</span><output id="purchase-editor-total" aria-live="polite"></output></div>
        <div class="record-money-grid"><label for="purchase-twd">台幣 TWD</label><div class="record-money-field"><span class="record-symbol">NT$</span><input id="purchase-twd" type="text" inputmode="decimal" maxlength="32" aria-label="台幣單價"></div><select id="purchase-currency" aria-label="外幣幣別"><option value="">請選幣別</option>${PURCHASE_CURRENCIES.map(currency => `<option value="${currency.code}">${currency.name} ${currency.code}</option>`).join('')}</select><div class="record-money-field"><span class="record-symbol" id="purchase-symbol">—</span><input id="purchase-foreign" type="text" inputmode="decimal" maxlength="32" aria-label="外幣單價"></div><label for="purchase-rate" class="record-rate-label">匯率<span id="purchase-rate-unit">（台幣／外幣）</span></label><div class="record-money-field"><span class="record-symbol">NT$</span><input id="purchase-rate" type="text" inputmode="decimal" placeholder="匯率" maxlength="32" aria-label="換算匯率"></div></div>
        <div class="purchase-current-rate-action"><button type="button" id="purchase-current-rate" class="purchase-current-rate">帶入目前匯率</button></div>
        <label class="record-note-label" for="purchase-note">備註 <small>選填</small></label><div class="purchase-note-field"><textarea id="purchase-note" class="purchase-note" rows="1" maxlength="2000" placeholder="想記什麼都可以"></textarea><div id="purchase-note-size" class="purchase-note-size" aria-hidden="true"></div></div>
        <p id="purchase-form-error" class="record-error" role="alert" hidden></p><div class="record-form-actions"><button type="button" class="purchase-delete" id="purchase-delete-record">刪除紀錄</button><button type="button" class="record-cancel" data-purchase-close="purchase-editor">取消</button><button type="submit" class="record-save" id="purchase-save-record">儲存</button></div>
      </form>
    </dialog>
    <dialog id="purchase-stats" class="panel-dialog purchase-stats" aria-labelledby="purchase-stats-title"><div class="dialog-heading"><div class="purchase-stats-title-line"><h2 id="purchase-stats-title">收藏統計</h2><button type="button" id="purchase-stats-info" class="icon-button purchase-stats-info" aria-label="統計說明" aria-haspopup="dialog" aria-controls="purchase-stats-help" aria-expanded="false">${icon('info')}</button></div><button class="icon-button" data-purchase-close="purchase-stats" aria-label="關閉收藏統計">${icon('close')}</button></div><div id="purchase-stats-content"></div></dialog>
    <dialog id="purchase-stats-help" class="panel-dialog purchase-stats-help" aria-labelledby="purchase-stats-help-title" aria-describedby="purchase-stats-help-message"><h2 id="purchase-stats-help-title">統計說明</h2><div id="purchase-stats-help-message"><p>選擇 3、6 或 12 個月，再左右滑動查看其他時段。金額、花費分布及明細會一起更新。</p><p>依購入日期統計，金額以單價 × 數量計算。未填購入日期或台幣金額的紀錄不列入花費合計。</p><p>滑動時維持相同的長條比例，方便比較不同月份。記帳內容與統計結果僅自己可見。</p></div><div class="purchase-stats-help-actions"><button type="button" id="purchase-stats-help-close" data-purchase-close="purchase-stats-help">知道了</button></div></dialog>
    <dialog id="purchase-ledger" class="panel-dialog purchase-ledger" aria-labelledby="purchase-ledger-title"><div class="dialog-heading"><h2 id="purchase-ledger-title">購入明細</h2><button class="icon-button" data-purchase-close="purchase-ledger" aria-label="關閉購入明細">${icon('close')}</button></div><div id="purchase-ledger-content"></div></dialog>
    <dialog id="purchase-confirm" class="panel-dialog compact-dialog purchase-confirm" aria-labelledby="purchase-confirm-title" aria-describedby="purchase-confirm-message"><h2 id="purchase-confirm-title"></h2><p id="purchase-confirm-message"></p><div class="confirm-actions"><button type="button" class="secondary-button" id="purchase-confirm-cancel">取消</button><button type="button" class="danger-button" id="purchase-confirm-accept"></button></div></dialog>
  `);

  $('purchase-stats-info').addEventListener('click', () => {
    if (!$('purchase-stats').open || $('purchase-stats-help').open) return;
    $('purchase-stats-info').setAttribute('aria-expanded', 'true');
    openDialog('purchase-stats-help');
    $('purchase-stats-help-close').focus({preventScroll:true});
  });
  $('purchase-stats-help').addEventListener('close', () => {
    $('purchase-stats-info').setAttribute('aria-expanded', 'false');
    if ($('purchase-stats').open) $('purchase-stats-info').focus({preventScroll:true});
  });

  function askConfirmation({ title, message, action }) {
    if ($('purchase-confirm').open) return Promise.resolve(false);
    $('purchase-confirm-title').textContent = title;
    $('purchase-confirm-message').textContent = message;
    $('purchase-confirm-accept').textContent = action;
    $('purchase-confirm').returnValue = 'cancel';
    const answer = new Promise(resolve => { confirmationResolver = resolve; });
    openDialog('purchase-confirm');
    $('purchase-confirm-cancel').focus({preventScroll:true});
    return answer;
  }
  $('purchase-confirm-cancel').addEventListener('click', () => $('purchase-confirm').close('cancel'));
  $('purchase-confirm-accept').addEventListener('click', () => $('purchase-confirm').close('confirm'));
  $('purchase-confirm').addEventListener('close', () => {
    const resolve = confirmationResolver;
    confirmationResolver = null;
    resolve?.($('purchase-confirm').returnValue === 'confirm');
  });

  function syncBook() {
    const currentScope = getScope();
    const stamp = JSON.stringify([state.purchaseRecords,state.quantities]);
    if (scope !== currentScope) {
      for (const id of ['purchase-editor','purchase-ledger','purchase-stats','purchase-stats-help','purchase-confirm']) if ($(id).open) $(id).close();
      edited = null; scope = currentScope; periodEnd = null; range = 6;
    }
    if (fingerprint !== stamp) {
      book = createPurchaseBook(state.quantities,state.purchaseRecords);
      records = book.records; fingerprint = stamp;
    }
  }
  function commit(itemId) {
    const previous = structuredClone(state.purchaseRecords[itemId] || null);
    const saved = book.snapshot(itemId);
    if (saved) state.purchaseRecords[itemId] = saved; else delete state.purchaseRecords[itemId];
    fingerprint = JSON.stringify([state.purchaseRecords,state.quantities]);
    if (!persist()) {
      if (previous) state.purchaseRecords[itemId] = previous; else delete state.purchaseRecords[itemId];
      fingerprint = ''; syncBook();
      throw new Error('目前無法儲存，輸入內容仍保留。請先匯出備份。');
    }
  }
  function changed() {
    updateCollection();
    if ($('purchase-stats').open) renderStats();
    if ($('purchase-ledger').open) $('purchase-ledger').close();
  }
  function editorUnchanged() {
    if (editorScope !== getScope()) throw new Error('帳號已切換，請重新開啟紀錄。');
    if (editorBase !== JSON.stringify(state.purchaseRecords[activeId] || null)) throw new Error('這款紀錄已在其他地方更新，請重新開啟後再編輯。');
  }
  function recordPrice(record) {
    const currency = PURCHASE_CURRENCIES.find(value => value.code === record?.currency);
    return record && record.twd !== '' ? money(purchaseRecordTotal(record)) : record && record.foreign !== '' ? (currency?.symbol || '') + n(purchaseRecordTotal(record, 'foreign')) : '';
  }
  function reductionLabel(units, held) {
    const removed = new Set(units.map(unit => unit.id));
    return purchaseRows(held).flatMap(({record, unit}, index) => {
      const ids = record?.unitIds || [unit.id];
      const quantity = ids.filter(id => removed.has(id)).length;
      if (!quantity) return [];
      const price = recordPrice(record);
      const part = quantity < (record?.qty || 1) ? `中的 ${quantity} 個` : '';
      return [`第 ${index + 1} 筆${price ? `（${price}）` : ''}${part}`];
    }).join('、');
  }
  function requestQuantityChange(id, quantity, apply) {
    syncBook();
    const before = state.quantities[id] || 0;
    if (quantity >= before) return false;
    const held = reconcile(id).held;
    const removed = book.reduction(id,quantity);
    if (!removed.some(unit => book.hasDetails(book.recordFor(unit.id)))) return false;
    const captured = JSON.stringify([state.purchaseRecords[id],state.quantities[id]]), capturedScope = getScope();
    const target = quantity === 0 ? `全部 ${before} 個` : reductionLabel(removed,held);
    askConfirmation({title:'減少收藏數量？',message:`將減少${target}，紀錄仍會保留。`,action:'確認減少'}).then(confirmed => {
      if (confirmed && capturedScope === getScope() && captured === JSON.stringify([state.purchaseRecords[id],state.quantities[id]])) apply();
    });
    return true;
  }
  function quantityChanged(id, quantity) {
    syncBook();
    const previous = reconcile(id).held.map(unit => unit.id);
    book.reconcile(id,quantity);
    const saved = book.snapshot(id);
    if (saved) state.purchaseRecords[id] = saved;
    fingerprint = ''; // 主畫面接著更新收藏數量並保存。
    return previous;
  }
  function restoreQuantity(id, ids) {
    syncBook(); book.restoreHeld(id,ids);
    const saved = book.snapshot(id);
    if (saved) state.purchaseRecords[id] = saved;
    fingerprint = '';
  }
  function closeOverlays() {
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    $('more-menu').hidden = true;
    $('more-button').setAttribute('aria-expanded', 'false');
  }
  function rowsFor(id) { return records.filter(record => record.itemId === id); }
  function total(rows) { return purchaseTotal(rows); }
  function count(rows) { return rows.reduce((sum, record) => sum + record.qty, 0); }
  function dateLabel(record) { return record.date ? record.date.replaceAll('-', '/') : ''; }
  function reconcile(id) { return book.reconcile(id, state.quantities[id] || 0); }
  function purchaseRows(units) {
    const seen = new Set();
    return units.flatMap(unit => {
      const record = book.recordFor(unit.id);
      if (!record) return [{ record: null, unit }];
      if (seen.has(record.id)) return [];
      seen.add(record.id);
      return [{ record, unit: null }];
    });
  }
  function recordMarkup(record, showProduct = false, unit = null, position = null) {
    const itemId = unit?.itemId || record.itemId, item = getItem(itemId) || {name:'收藏商品',character:'',image:''};
    const currency = PURCHASE_CURRENCIES.find(value => value.code === record?.currency);
    const price = record ? recordPrice({ ...record, qty: 1 }) : '';
    const date = record?.date ? record.date.replaceAll('-', '/') : '';
    const label = position ? `編輯第 ${position} 筆收藏紀錄` : '編輯收藏紀錄';
    const action = unit ? `data-purchase-unit-edit="${h(unit.id)}" data-purchase-item="${h(itemId)}" aria-label="${label}"` : `data-purchase-edit="${h(record.id)}" aria-label="${label}"`;
    const extra = [];
    if (record && record.twd !== '' && record.foreign !== '') extra.push((currency?.symbol || '') + n(Number(record.foreign)));
    if (record?.rate) extra.push('匯率 ' + record.rate);
    return `<article class="purchase-purchase-row">${showProduct ? `<div class="purchase-ledger-product"><img src="${h(item.image)}" alt=""><div><strong>${h(item.name)}</strong><span>${h(item.character)}</span></div></div>` : ''}<div class="purchase-row-top"><span>${unit ? 1 : record.qty} 個${date ? `<span class="purchase-dot">·</span>${date}` : ''}</span>${price ? `<strong>${price}<small class="purchase-unit-label">／個</small></strong>` : ''}<button class="record-edit" ${action}>${icon('edit')}</button></div>${extra.length ? `<p class="purchase-row-sub">${h(extra.join('・'))}</p>` : ''}${record?.note ? `<p class="purchase-row-note">${h(record.note)}</p>` : ''}</article>`;
  }
  function renderPurchaseSection(id) {
    syncBook();
    const container = $('detail-record');
    if (!container) return;
    if (!$('purchase-editor').open) activeId = id;
    const units = reconcile(id).held;
    container.className = 'collection-record purchase-purchases purchase-simple-records';
    container.dataset.purchasePurchase = 'true';
    const rows = purchaseRows(units);
    const listed = new Set(rows.flatMap(row => row.record ? [row.record.id] : []));
    rows.push(...records.filter(record => record.itemId === id && !listed.has(record.id)).map(record => ({record,unit:null})));
    container.innerHTML = rows.map(({record,unit},index) => recordMarkup(record,false,unit,index+1)).join('');
    const quantityLabel = document.querySelector('label[for="detail-quantity"]');
    if (quantityLabel) quantityLabel.textContent = $('detail-content').classList.contains('from-friend') ? '我的收藏數量' : '收藏數量';
  }
  function editUnit(id, unitId = null) {
    const units = reconcile(id).held;
    const unit = unitId ? units.find(value => value.id === unitId) : units[0];
    if (!unit) return;
    showEditor(id, book.recordFor(unit.id)?.id || null, unit.id);
  }
  function showEditor(id, recordId = null, unitId = null) {
    clearRateNotice();
    cancelRateRequest();
    syncBook();
    activeId = id;
    editorScope = getScope(); editorBase = JSON.stringify(state.purchaseRecords[id] || null);
    edited = recordId ? records.find(record => record.id === recordId) : null;
    selectedUnits = new Set(edited?.unitIds || (unitId ? [unitId] : []));
    setRecordQuantity(selectedUnits.size || 1);
    $('purchase-delete-record').hidden = !edited;
    for (const key of ['twd', 'foreign', 'rate', 'note', 'date']) $('purchase-' + key).value = edited?.[key] ?? '';
    $('purchase-currency').value = edited?.currency || '';
    $('purchase-form-error').hidden = true;
    clearedFields.clear();
    manualFields = edited?.rate ? [edited.foreign !== '' ? 'foreign' : 'twd','rate'] : ['twd','foreign'];
    calculatedField = edited?.rate ? (edited.foreign !== '' ? 'twd' : 'foreign') : 'rate';
    updateCurrency();
    syncNoteLayout();
    openDialog('purchase-editor');
  }
  function syncNoteLayout() {
    // 由瀏覽器排版決定高度；舊版瀏覽器共用同一格的隱藏文字負責撐高。
    // 不縮小正在編輯的欄位、不重設捲動或選取範圍，保留 iPhone 原生游標操作。
    $('purchase-note-size').textContent = $('purchase-note').value + ' ';
  }
  $('purchase-note').addEventListener('input', syncNoteLayout);
  function recordCandidates() {
    const original = edited?.unitIds || [...selectedUnits];
    const free = reconcile(activeId).held.filter(unit => !book.recordFor(unit.id)).map(unit => unit.id);
    return [...new Set([...original, ...free])];
  }
  function setRecordQuantity(quantity) {
    const candidates = recordCandidates();
    $('purchase-record-quantity').max = String(candidates.length);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > candidates.length) {
      $('purchase-record-quantity').value = String(selectedUnits.size || 1); return false;
    }
    selectedUnits = new Set(candidates.slice(0, quantity));
    $('purchase-record-quantity').value = String(quantity);
    $('purchase-record-minus').disabled = quantity <= 1;
    $('purchase-record-plus').disabled = quantity >= candidates.length;
    updateEditorTotal();
    return true;
  }
  $('purchase-record-minus').addEventListener('click', () => setRecordQuantity(Number($('purchase-record-quantity').value) - 1));
  $('purchase-record-plus').addEventListener('click', () => setRecordQuantity(Number($('purchase-record-quantity').value) + 1));
  $('purchase-record-quantity').addEventListener('change', () => setRecordQuantity(Number($('purchase-record-quantity').value)));
  function updateCurrency() {
    const currency = PURCHASE_CURRENCIES.find(value => value.code === $('purchase-currency').value);
    $('purchase-symbol').textContent = currency?.symbol || '—';
    $('purchase-rate-unit').textContent = '（台幣／' + (currency?.name || '外幣') + '）';
    updateEditorTotal();
  }
  function updateEditorTotal() {
    const long = ['twd','foreign'].some(key => $('purchase-' + key).value.length > 8) || $('purchase-rate').value.length > 10;
    $('purchase-twd').closest('.record-money-grid').classList.toggle('purchase-long-amount',long);
    $('purchase-rate').style.fontSize = $('purchase-rate').value.length > 18 ? '16px' : '';
    const qty = Number($('purchase-record-quantity').value);
    const twd = normalizePurchaseAmount($('purchase-twd').value);
    const foreign = normalizePurchaseAmount($('purchase-foreign').value);
    const currency = PURCHASE_CURRENCIES.find(value => value.code === $('purchase-currency').value);
    const record = { qty, twd, foreign };
    const amount = twd !== '' ? money(purchaseRecordTotal(record)) : foreign !== '' && currency ? currency.symbol + n(purchaseRecordTotal(record, 'foreign')) : '';
    $('purchase-editor-total').textContent = amount && Number.isInteger(qty) && qty > 0 ? `合計 ${amount}` : '';
  }
  function calculate(changed) {
    const value = Object.fromEntries(['twd','foreign','rate'].map(key => [key,$('purchase-' + key).value]));
    value.currency = $('purchase-currency').value;
    if (changed) {
      // 空白或尚未完成的小數也是手動編輯，不得回頭換算並覆寫這一格。
      manualFields = [...manualFields.filter(key => key !== changed), changed].slice(-2);
      if (value[changed].trim()) clearedFields.delete(changed);
      else clearedFields.add(changed);
    }
    const active = manualFields.slice(-2);
    const target = active.length === 2 ? ['twd','foreign','rate'].find(key => !active.includes(key)) : null;
    // 使用者清空的欄位保持空白；重新輸入該欄位後才恢復參與換算。
    const result = purchaseCurrency(value.currency) && target && target !== changed && !clearedFields.has(target) ? calculatePurchaseField(value,target) : {value:'',error:''};
    if (result.value !== '') $('purchase-' + target).value = result.value;
    calculatedField = result.value !== '' || result.error ? target : null;
    $('purchase-form-error').textContent = result.error; $('purchase-form-error').hidden = !result.error;
    updateEditorTotal();
  }
  function setRateLoading(loading) {
    const button = $('purchase-current-rate');
    button.disabled = loading;
    button.textContent = loading ? '取得匯率中…' : '帶入目前匯率';
    button.setAttribute('aria-busy', String(loading));
  }
  function clearRateNotice() {
    dismissRateNotice?.();
    dismissRateNotice = null;
  }
  function notifyCurrencyRequired() {
    clearRateNotice();
    $('purchase-form-error').hidden = true;
    dismissRateNotice = toast('請先選擇外幣幣別', null, { warning:true, duration:3000 });
  }
  function cancelRateRequest() {
    if (!rateRequest) return;
    rateRequest.abort();
    rateRequest = null;
    setRateLoading(false);
  }
  $('purchase-editor').addEventListener('close', cancelRateRequest);
  $('purchase-editor').addEventListener('close', clearRateNotice);
  $('purchase-current-rate').addEventListener('click', async () => {
    if (!$('purchase-editor').open || rateRequest) return;
    const currency = $('purchase-currency').value;
    if (!purchaseCurrency(currency)) {
      notifyCurrencyRequired();
      return;
    }
    clearRateNotice();
    const request = new AbortController(), itemId = activeId, recordId = edited?.id, requestScope = getScope();
    const before = JSON.stringify(['twd','foreign','rate'].map(key => $('purchase-' + key).value));
    rateRequest = request;
    setRateLoading(true);
    $('purchase-form-error').hidden = true;
    try {
      const result = await fetchPurchaseExchangeRate(currency, { signal:request.signal });
      if (request.signal.aborted || rateRequest !== request || !$('purchase-editor').open || activeId !== itemId
        || edited?.id !== recordId || getScope() !== requestScope || $('purchase-currency').value !== currency
        || before !== JSON.stringify(['twd','foreign','rate'].map(key => $('purchase-' + key).value))) return;
      // 以最近手動填寫的有效金額換算；只有一種金額時就沿用該格。
      const validAmount = key => ['twd','foreign'].includes(key) && normalizePurchaseAmount($('purchase-' + key).value) !== '';
      const source = [...manualFields].reverse().find(validAmount) || ['foreign','twd'].find(validAmount);
      manualFields = source ? [source] : [];
      $('purchase-rate').value = result.rate;
      calculate('rate');
      toast('已帶入 ' + result.date.replaceAll('-', '/') + ' 參考匯率，可自行修改');
    } catch (error) {
      if (!request.signal.aborted && rateRequest === request) {
        $('purchase-form-error').textContent = error.message;
        $('purchase-form-error').hidden = false;
      }
    } finally {
      if (rateRequest === request) { rateRequest = null; setRateLoading(false); }
    }
  });
  function filteredRecords() {
    return recordsInPeriod(records, statsPeriod || purchasePeriod(records, range, periodEnd));
  }
  function groupValue(item) {
    if (!item) return '其他';
    if (group === 'character') return item.character;
    return item.type === '吊娃' ? '吊飾娃' : item.type === '娃' ? '玩偶' : item.type;
  }
  function groupedRows(priced) {
    const sums = new Map();
    priced.forEach(record => {
      const label = groupValue(getItem(record.itemId));
      sums.set(label, Math.round(((sums.get(label) || 0) + purchaseRecordTotal(record)) * 100) / 100);
    });
    return [...sums].sort((a, b) => b[1] - a[1]);
  }
  function renderStats() {
    timelineCleanup?.();
    syncBook();
    statsPeriod = purchasePeriod(records, range, periodEnd);
    periodEnd = statsPeriod.end;
    const buckets = new Map();
    for (const record of records) {
      const month = record.date ? monthNumber(record.date) : null;
      if (month === null || record.twd === '') continue;
      if (!buckets.has(month)) buckets.set(month, []);
      buckets.get(month).push(record);
    }
    monthlyAmounts = new Map([...buckets].map(([month, rows]) => [month, total(rows)]));
    chartMaximum = 1;
    for (const amount of monthlyAmounts.values()) chartMaximum = Math.max(chartMaximum, amount);
    $('purchase-stats').classList.remove('is-month');
    $('purchase-stats-content').innerHTML = `
      <section class="purchase-stats-summary purchase-period-summary" aria-label="購買金額合計">
        <div class="purchase-period-controls"><select id="purchase-stats-range" aria-label="統計時間長度">${[3,6,12].map(length => `<option value="${length}"${range === length ? ' selected' : ''}>${length} 個月</option>`).join('')}</select><div class="purchase-period-navigation"><button type="button" id="purchase-period-current">回到本月</button></div></div>
        <div class="purchase-period-total" aria-live="polite" aria-atomic="true"><span id="purchase-stats-period"></span><strong id="purchase-stats-total"></strong></div>
        <button class="purchase-summary-details" data-purchase-all-records aria-label="查看金額明細">明細</button>
      </section>
      <section class="purchase-monthly"><div class="purchase-section-heading"><h3>每月花費</h3><span>台幣</span></div><div id="purchase-timeline" class="purchase-timeline" tabindex="0" role="group" aria-label="月份花費圖表，可左右滑動，點月份查看明細"><div id="purchase-timeline-track" class="purchase-month-chart purchase-timeline-track${range === 12 ? ' is-twelve-months' : ''}"></div></div></section>
      <section class="purchase-breakdown">
        <div class="purchase-section-heading"><h3>花費分布</h3><div class="purchase-breakdown-tabs" role="group" aria-label="花費分布方式">${[['character', '角色'], ['type', '種類']].map(([key, label]) => `<button data-purchase-group="${key}" aria-pressed="${group === key}">${label}</button>`).join('')}</div></div>
        <div class="purchase-distribution" id="purchase-stats-distribution"></div>
      </section>`;
    updatePeriodSummary();
    connectTimeline();
  }
  function updatePeriodSummary() {
    const priced = filteredRecords().filter(record => record.twd !== '');
    const sum = total(priced), label = money(sum);
    $('purchase-stats-period').textContent = periodDates(statsPeriod);
    $('purchase-stats-total').textContent = label;
    $('purchase-stats-total').classList.toggle('is-long-amount', label.length > 16);
    $('purchase-period-current').disabled = statsPeriod.end === statsPeriod.current;
    $('purchase-stats-distribution').innerHTML = groupedRows(priced).map(([label, amount]) => `<button class="purchase-stat-row" data-purchase-group-label="${h(label)}"><span class="purchase-stat-row-top"><span>${h(label)}</span><span><strong>${money(amount)}</strong><small>${sum ? Math.round(amount / sum * 100) : 0}%</small>${icon('chevron')}</span></span></button>`).join('') || '<p class="purchase-helper">這段期間尚無已填金額的紀錄</p>';
  }
  function connectTimeline() {
    const scroller = $('purchase-timeline'), track = $('purchase-timeline-track');
    let slot = 0, frame = 0, paintedStart = -1, paintedEnd = -1, pointer = null;
    function paint(force = false) {
      if (!slot) return;
      const from = Math.max(0, statsPeriod.offset - range * 2), to = Math.min(statsPeriod.count - 1, statsPeriod.offset + range * 3);
      if (!force && paintedStart <= statsPeriod.offset && paintedEnd >= statsPeriod.offset + range - 1) return;
      paintedStart = from; paintedEnd = to;
      track.innerHTML = Array.from({length:to-from+1}, (_, index) => {
        const offset = from + index, month = statsPeriod.first + offset, key = monthKey(month), amount = monthlyAmounts.get(month) || 0;
        return `<button type="button" data-purchase-month="${key}" class="${month === statsPeriod.current ? 'is-current-month' : ''}" style="left:${offset*slot}px;width:${slot}px" aria-label="${key.replace('-', ' 年 ')} 月，${money(amount)}"><span class="purchase-bar-value">${n(amount)}</span><span class="purchase-bar-area"><span style="height:${Math.max(amount ? 2 : 0, amount/chartMaximum*100)}%"></span></span><span class="purchase-month-label">${month%12+1}${range === 12 ? '' : ' '}月<small>${month%12 === 0 ? Math.floor(month/12) : ''}</small></span></button>`;
      }).join('');
    }
    function measure() {
      const width = scroller.getBoundingClientRect().width;
      if (!width) return;
      slot = width / range;
      track.style.width = statsPeriod.count * slot + 'px';
      paint(true);
      scroller.scrollLeft = statsPeriod.offset * slot;
    }
    function positionChanged() {
      frame = 0;
      if (!slot) return;
      const offset = Math.max(0, Math.min(statsPeriod.count-range, Math.round(scroller.scrollLeft/slot)));
      if (offset !== statsPeriod.offset) {
        statsPeriod.offset = offset; statsPeriod.start = statsPeriod.first + offset;
        statsPeriod.end = statsPeriod.start + range - 1; periodEnd = statsPeriod.end;
        updatePeriodSummary();
      }
      paint();
    }
    scroller.addEventListener('scroll', () => {if(!frame)frame=requestAnimationFrame(positionChanged);}, {passive:true});
    scroller.addEventListener('keydown', event => {
      if (event.target !== scroller || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const offset = event.key === 'Home' ? 0 : event.key === 'End' ? statsPeriod.count-range : statsPeriod.offset + (event.key === 'ArrowLeft' ? -1 : 1);
      scroller.scrollLeft = Math.max(0, Math.min(statsPeriod.count-range, offset)) * slot;
    });
    scroller.addEventListener('pointerdown', event => {
      ignoreChartClick = false;
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      pointer = {id:event.pointerId,x:event.clientX,y:event.clientY,left:scroller.scrollLeft,dragging:false};
    });
    scroller.addEventListener('pointermove', event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX-pointer.x, dy = event.clientY-pointer.y;
      if (!pointer.dragging && Math.abs(dx)>8 && Math.abs(dx)>Math.abs(dy)) {
        pointer.dragging = true; ignoreChartClick = true; scroller.setPointerCapture(event.pointerId);
        scroller.classList.add('is-dragging');
      }
      if (pointer.dragging) {event.preventDefault();scroller.scrollLeft=pointer.left-dx;}
    });
    const finish = () => {pointer=null;scroller.classList.remove('is-dragging');};
    scroller.addEventListener('pointerup', finish);
    scroller.addEventListener('pointercancel', finish);
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    frame = requestAnimationFrame(() => {frame=0;measure();});
    timelineCleanup = () => {observer.disconnect();cancelAnimationFrame(frame);};
  }
  function movePeriod(end) {
    if (!statsPeriod) return;
    const target = Math.max(statsPeriod.first+range-1, Math.min(statsPeriod.last,end));
    const scroller = $('purchase-timeline');
    scroller.scrollLeft = (target-range+1-statsPeriod.first)*scroller.getBoundingClientRect().width/range;
  }
  function showStats() {
    closeOverlays(); renderStats(); openDialog('purchase-stats');
  }
  function showLedger(title, rows) {
    rows = rows.filter(record => record.twd !== '' || record.foreign !== '');
    $('purchase-ledger-title').textContent = title;
    $('purchase-ledger-content').innerHTML = `<div class="purchase-ledger-total"><span>${rows.length} 筆紀錄</span><strong>${money(total(rows))}</strong></div>${rows.length ? rows.map(record => recordMarkup(record, true)).join('') : '<p class="purchase-helper">這個範圍尚無購入紀錄</p>'}`;
    openDialog('purchase-ledger');
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.purchaseMonth && ignoreChartClick) {ignoreChartClick=false;event.preventDefault();return;}
    if (button.dataset.purchaseClose) $(button.dataset.purchaseClose).close();
    if (button.dataset.purchaseUnitEdit) editUnit(button.dataset.purchaseItem, button.dataset.purchaseUnitEdit);
    if (button.hasAttribute('data-purchase-edit')) { const record = records.find(value => value.id === button.dataset.purchaseEdit); if (record) showEditor(record.itemId, record.id); }
    if (button.dataset.purchaseGroup) { group = button.dataset.purchaseGroup; renderStats(); }
    if (button.id === 'purchase-period-current') movePeriod(statsPeriod.current);
    if (button.dataset.purchaseMonth) { selectedMonth = button.dataset.purchaseMonth; showLedger(`${selectedMonth.replace('-', '/')} 購入明細`, records.filter(record => record.date?.startsWith(selectedMonth + '-'))); }
    if (button.dataset.purchaseGroupLabel) { selectedGroup = button.dataset.purchaseGroupLabel; showLedger(selectedGroup + '・購入明細', filteredRecords().filter(record => groupValue(getItem(record.itemId)) === selectedGroup)); }
    if (button.hasAttribute('data-purchase-all-records')) showLedger(periodLabel(statsPeriod) + ' 金額明細', filteredRecords());
  });
  document.addEventListener('change', event => {
    if (event.target.id !== 'purchase-stats-range' || !['3','6','12'].includes(event.target.value)) return;
    range = Number(event.target.value);
    renderStats();
    $('purchase-stats-range').focus({preventScroll:true});
  });
  $('purchase-currency').addEventListener('change', () => {clearRateNotice();cancelRateRequest();manualFields = ['twd','foreign','rate'].filter(key => $('purchase-' + key).value.trim()); calculatedField = null; updateCurrency(); if (manualFields.length === 2) calculate();});
  for (const key of ['twd', 'foreign', 'rate']) $('purchase-' + key).addEventListener('input', () => {cancelRateRequest();calculate(key);});
  $('purchase-delete-record').addEventListener('click', async () => {
    if (!$('purchase-editor').open || !edited) return;
    try { editorUnchanged(); } catch (cause) { $('purchase-form-error').textContent = cause.message; $('purchase-form-error').hidden = false; return; }
    const recordId = edited.id;
    const confirmed = await askConfirmation({ title: '刪除這筆紀錄？', message: '這筆填寫的資訊將會清除，收藏數量維持不變。', action: '確認刪除' });
    if (!confirmed || !$('purchase-editor').open || edited?.id !== recordId) return;
    try { editorUnchanged(); } catch {toast('紀錄已更新，請重新開啟'); return;}
    const itemId = activeId;
    const removed = book.remove(recordId);
    try {commit(itemId);} catch (cause) {book.restore(removed);$('purchase-form-error').textContent=cause.message;$('purchase-form-error').hidden=false;return;}
    if (!removed) return;
    $('purchase-editor').close();
    edited = null;
    changed();
    const deletedSnapshot = JSON.stringify(state.purchaseRecords[itemId]), deletedScope = getScope();
    toast('已刪除紀錄', () => {
      syncBook();
      if (deletedScope !== getScope() || JSON.stringify(state.purchaseRecords[itemId]) !== deletedSnapshot || !book.restore(removed)) { toast('這筆已有新的內容，未覆蓋目前紀錄'); return; }
      try {commit(itemId);changed();toast('已復原紀錄');} catch(cause) {toast(cause.message);}
    });
  });
  $('purchase-purchase-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!$('purchase-editor').open) return;
    const qty = Number($('purchase-record-quantity').value);
    const raw = Object.fromEntries(['twd', 'foreign', 'rate'].map(key => [key, $('purchase-' + key).value.trim()]));
    const twd = normalizePurchaseAmount(raw.twd), foreign = normalizePurchaseAmount(raw.foreign), rateValue = normalizePurchaseRate(raw.rate);
    let error = '';
    if (!Number.isInteger(qty) || qty < 1 || qty > recordCandidates().length) error = `這筆數量請填寫 1～${recordCandidates().length} 個，避免與其他紀錄重複。`;
    else if (['twd', 'foreign', 'rate'].some(key => raw[key] !== '' && (key === 'rate' ? normalizePurchaseRate : normalizePurchaseAmount)(raw[key]) === '')) error = '金額與匯率請填寫 0 以上的數字。';
    else if ((foreign || rateValue) && !$('purchase-currency').value) error = '請先選擇外幣幣別。';
    else if ($('purchase-date').validity.badInput || !validPurchaseDate($('purchase-date').value)) error = '請選擇有效的購入日期，或留白。';
    if (!error && calculatedField) error = calculatePurchaseField({twd,foreign,rate:rateValue,currency:$('purchase-currency').value},calculatedField).error;
    if (error === '請先選擇外幣幣別。') { notifyCurrencyRequired(); return; }
    if (error) { $('purchase-form-error').textContent = error; $('purchase-form-error').hidden = false; return; }
    try {
      editorUnchanged();
      reconcile(activeId);
      setRecordQuantity(qty);
      book.save({ itemId: activeId, recordId: edited?.id, unitIds: [...selectedUnits], date: $('purchase-date').value, twd, foreign, rate: rateValue, currency: $('purchase-currency').value, note: $('purchase-note').value.trim() });
      commit(activeId);
      editorBase = JSON.stringify(state.purchaseRecords[activeId] || null);
    } catch (cause) { $('purchase-form-error').textContent = cause.message; $('purchase-form-error').hidden = false; return; }
    $('purchase-editor').close();
    changed();
    toast('已儲存紀錄');
  });

  return {
    renderDetail:renderPurchaseSection,
    refreshDetail:renderPurchaseSection,
    requestQuantityChange, quantityChanged, restoreQuantity,
    sync() {syncBook();if ($('purchase-stats').open) renderStats();},
    onReady() {
      syncBook();
      $('open-settings').insertAdjacentHTML('beforebegin', `<button id="open-purchase-stats" aria-haspopup="dialog" aria-controls="purchase-stats">${icon('grid')}收藏統計</button>`);
      $('open-purchase-stats').addEventListener('click',showStats);
    },
  };
}
