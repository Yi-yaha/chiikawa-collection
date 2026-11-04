import { calculatePurchaseField, normalizePurchaseAmount, normalizePurchaseRate, PURCHASE_CURRENCIES } from './purchase-records.mjs?v=e617453ea7d86ccd';
import { createPurchaseBook } from './purchase-book.mjs?v=e617453ea7d86ccd';
import { purchaseRecordTotal, purchaseTotal, validPurchaseDate, purchaseCurrency } from './purchase-records.mjs?v=e617453ea7d86ccd';

// 本人的私人收藏紀錄；依既有帳號、離線與版本差異流程保存。
export function createPurchaseHub({ state, getItem, icon, persist, updateCollection, toast, getScope }) {
  let book = createPurchaseBook(), records = book.records, fingerprint = '', scope = getScope();
  let editorBase = null, editorScope = null;
  const n = value => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(value);
  const money = value => 'NT$ ' + n(value);
  const h = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const $ = id => document.getElementById(id);
  let activeId = null, edited = null, range = 'all', group = 'character';
  let selectedUnits = new Set();
  let selectedMonth = null, selectedGroup = null;
  let confirmationResolver = null, manualFields = [], calculatedField = null;

  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="purchase-editor" class="panel-dialog purchase-editor" aria-label="編輯收藏紀錄">
      <div class="purchase-editor-header"><button class="icon-button" data-purchase-close="purchase-editor" aria-label="關閉購入紀錄">${icon('close')}</button></div>
      <form id="purchase-purchase-form" novalidate>
        <div class="purchase-record-quantity"><label for="purchase-record-quantity">數量</label><div class="quantity-stepper"><button type="button" id="purchase-record-minus" aria-label="減少這筆紀錄的數量">${icon('minus')}</button><input id="purchase-record-quantity" type="number" min="1" max="9999" step="1" inputmode="numeric" value="1" aria-label="這筆紀錄的數量"><button type="button" id="purchase-record-plus" aria-label="增加這筆紀錄的數量">${icon('plus')}</button></div></div>
        <div class="purchase-record-date"><label for="purchase-date">購入日期 <small>選填</small></label><input id="purchase-date" type="date" lang="zh-TW" aria-label="購入日期，選填"></div>
        <div class="purchase-unit-price-heading"><span>單價</span><output id="purchase-editor-total" aria-live="polite"></output></div>
        <div class="record-money-grid"><label for="purchase-twd">台幣 TWD</label><div class="record-money-field"><span class="record-symbol">NT$</span><input id="purchase-twd" type="text" inputmode="decimal" maxlength="32" aria-label="台幣單價"></div><select id="purchase-currency" aria-label="外幣幣別"><option value="">請選幣別</option>${PURCHASE_CURRENCIES.map(currency => `<option value="${currency.code}">${currency.name} ${currency.code}</option>`).join('')}</select><div class="record-money-field"><span class="record-symbol" id="purchase-symbol">—</span><input id="purchase-foreign" type="text" inputmode="decimal" maxlength="32" aria-label="外幣單價"></div><label for="purchase-rate" class="record-rate-label">匯率<span id="purchase-rate-unit">（台幣／外幣）</span></label><div class="record-money-field"><span class="record-symbol">NT$</span><input id="purchase-rate" type="text" inputmode="decimal" placeholder="匯率" maxlength="32" aria-label="換算匯率"></div></div>
        <label class="record-note-label" for="purchase-note">備註 <small>選填</small></label><textarea id="purchase-note" class="purchase-note" rows="1" maxlength="2000" placeholder="想記什麼都可以"></textarea>
        <p id="purchase-form-error" class="record-error" role="alert" hidden></p><div class="record-form-actions"><button type="button" class="purchase-delete" id="purchase-delete-record">刪除紀錄</button><button type="button" class="record-cancel" data-purchase-close="purchase-editor">取消</button><button type="submit" class="record-save" id="purchase-save-record">儲存</button></div>
      </form>
    </dialog>
    <dialog id="purchase-stats" class="panel-dialog purchase-stats" aria-labelledby="purchase-stats-title"><div class="dialog-heading"><div class="purchase-stats-title-line"><h2 id="purchase-stats-title">收藏統計</h2><button type="button" id="purchase-stats-info" class="icon-button purchase-stats-info" aria-label="統計說明" aria-haspopup="dialog" aria-controls="purchase-stats-help" aria-expanded="false">${icon('info')}</button></div><button class="icon-button" data-purchase-close="purchase-stats" aria-label="關閉收藏統計">${icon('close')}</button></div><div id="purchase-stats-content"></div></dialog>
    <dialog id="purchase-stats-help" class="panel-dialog purchase-stats-help" aria-labelledby="purchase-stats-help-title" aria-describedby="purchase-stats-help-message"><h2 id="purchase-stats-help-title">統計說明</h2><div id="purchase-stats-help-message"><p>這裡只統計已記帳的收藏紀錄，未填寫金額的收藏不會計入。金額依單價 × 數量計算。</p><p>記帳內容與統計結果僅自己可見。</p></div><div class="purchase-stats-help-actions"><button type="button" id="purchase-stats-help-close" data-purchase-close="purchase-stats-help">知道了</button></div></dialog>
    <dialog id="purchase-ledger" class="panel-dialog purchase-ledger" aria-labelledby="purchase-ledger-title"><div class="dialog-heading"><h2 id="purchase-ledger-title">購入明細</h2><button class="icon-button" data-purchase-close="purchase-ledger" aria-label="關閉購入明細">${icon('close')}</button></div><div id="purchase-ledger-content"></div></dialog>
    <dialog id="purchase-confirm" class="panel-dialog compact-dialog purchase-confirm" aria-labelledby="purchase-confirm-title" aria-describedby="purchase-confirm-message"><h2 id="purchase-confirm-title"></h2><p id="purchase-confirm-message"></p><div class="confirm-actions"><button type="button" class="secondary-button" id="purchase-confirm-cancel">取消</button><button type="button" class="danger-button" id="purchase-confirm-accept"></button></div></dialog>
  `);

  $('purchase-stats-info').addEventListener('click', () => {
    if (!$('purchase-stats').open || $('purchase-stats-help').open) return;
    $('purchase-stats-info').setAttribute('aria-expanded', 'true');
    $('purchase-stats-help').showModal();
    $('purchase-stats-help-close').focus();
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
    $('purchase-confirm').showModal();
    $('purchase-confirm-cancel').focus();
    return answer;
  }
  $('purchase-confirm-cancel').addEventListener('click', () => $('purchase-confirm').close('cancel'));
  $('purchase-confirm-accept').addEventListener('click', () => $('purchase-confirm').close('confirm'));
  $('purchase-confirm').addEventListener('close', () => {
    const resolve = confirmationResolver;
    confirmationResolver = null;
    resolve?.($('purchase-confirm').returnValue === 'confirm');
  });
  $('purchase-confirm').addEventListener('click', event => {
    if (event.target !== $('purchase-confirm')) return;
    const bounds = $('purchase-confirm').getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $('purchase-confirm').close('cancel');
  });

  function syncBook() {
    const currentScope = getScope();
    const stamp = JSON.stringify([state.purchaseRecords,state.quantities]);
    if (scope !== currentScope) {
      for (const id of ['purchase-editor','purchase-ledger','purchase-stats','purchase-stats-help','purchase-confirm']) if ($(id).open) $(id).close();
      edited = null; scope = currentScope;
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
    manualFields = edited?.rate ? [edited.foreign !== '' ? 'foreign' : 'twd','rate'] : ['twd','foreign'];
    calculatedField = edited?.rate ? (edited.foreign !== '' ? 'twd' : 'foreign') : 'rate';
    updateCurrency();
    if (!$('purchase-editor').open) $('purchase-editor').showModal();
    resizeNote();
  }
  function resizeNote() {
    const editor = $('purchase-editor');
    if (!editor.open) return;
    const note = $('purchase-note'), scrollTop = editor.scrollTop;
    note.style.height = '0px';
    note.style.height = (note.scrollHeight + note.offsetHeight - note.clientHeight) + 'px';
    editor.scrollTop = scrollTop;
  }
  $('purchase-note').addEventListener('input', resizeNote);
  window.addEventListener('resize', resizeNote);
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
    $('purchase-rate').style.fontSize = $('purchase-rate').value.length > 18 ? '12px' : '';
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
      if (calculatedField === changed) calculatedField = null;
      manualFields = manualFields.filter(key => key !== changed);
      if (value[changed].trim()) manualFields.push(changed);
    }
    const active = manualFields.filter(key => (key === 'rate' ? normalizePurchaseRate : normalizePurchaseAmount)(value[key]) !== '').slice(-2);
    const target = active.length === 2 ? ['twd','foreign','rate'].find(key => !active.includes(key)) : calculatedField;
    const result = purchaseCurrency(value.currency) && target ? calculatePurchaseField(value,target) : {value:'',error:''};
    if (result.value !== '') $('purchase-' + target).value = result.value;
    calculatedField = active.length === 2 && purchaseCurrency(value.currency) ? target : null;
    $('purchase-form-error').textContent = result.error; $('purchase-form-error').hidden = !result.error;
    updateEditorTotal();
  }
  function filteredRecords() {
    const now = new Date(), prefix = range === 'year' ? String(now.getFullYear()) + '-' : `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-`;
    return records.filter(record => range === 'all' || record.date?.startsWith(prefix));
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
    syncBook();
    const rows = filteredRecords(), priced = rows.filter(record => record.twd !== '');
    const sum = total(priced), sumLabel = money(sum);
    const now = new Date();
    const months = Array.from({length:6},(_,index) => {const date = new Date(now.getFullYear(),now.getMonth()-5+index,1);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;});
    const monthly = months.map(month => total(priced.filter(record => record.date?.startsWith(month + '-'))));
    const max = Math.max(...monthly, 1), grouped = groupedRows(priced);
    $('purchase-stats').classList.toggle('is-month', range === 'month');
    $('purchase-stats-content').innerHTML = `
      <section class="purchase-stats-summary${sumLabel.length > 12 ? ' is-long-total' : ''}" aria-label="購買金額合計">
        <select id="purchase-stats-range" aria-label="統計期間">${[['all', '全部紀錄'], ['year', '今年'], ['month', '本月']].map(([key, label]) => `<option value="${key}"${range === key ? ' selected' : ''}>${label}</option>`).join('')}</select>
        <strong aria-live="polite">${sumLabel}</strong>
        <button class="purchase-summary-details" data-purchase-all-records aria-label="查看金額明細">明細</button>
      </section>
      ${range === 'month' ? '' : `<section class="purchase-monthly">
        <div class="purchase-section-heading"><h3>每月花費</h3><span>近 6 個月・台幣</span></div>
        <div class="purchase-month-chart" role="group" aria-label="近六個月購入花費，台幣">${months.map((month, index) => `<button data-purchase-month="${month}" aria-label="${month} ${money(monthly[index])}"><span class="purchase-bar-value">${monthly[index] ? n(monthly[index]) : '—'}</span><span class="purchase-bar-area"><span style="height:${Math.max(monthly[index] ? 5 : 0, monthly[index] / max * 100)}%"></span></span><span>${Number(month.slice(5))} 月</span></button>`).join('')}</div>
      </section>`}
      <section class="purchase-breakdown">
        <div class="purchase-section-heading"><h3>花費分布</h3><div class="purchase-breakdown-tabs" role="group" aria-label="花費分布方式">${[['character', '角色'], ['type', '種類']].map(([key, label]) => `<button data-purchase-group="${key}" aria-pressed="${group === key}">${label}</button>`).join('')}</div></div>
        <div class="purchase-distribution">${grouped.map(([label, amount]) => `<button class="purchase-stat-row" data-purchase-group-label="${h(label)}"><span class="purchase-stat-row-top"><span>${h(label)}</span><span><strong>${money(amount)}</strong><small>${sum ? Math.round(amount / sum * 100) : 0}%</small>${icon('chevron')}</span></span></button>`).join('') || '<p class="purchase-helper">這段期間尚無已填金額的紀錄</p>'}</div>
      </section>`;
  }
  function showStats() {
    closeOverlays(); renderStats(); $('purchase-stats').showModal();
  }
  function showLedger(title, rows) {
    rows = rows.filter(record => record.twd !== '' || record.foreign !== '');
    $('purchase-ledger-title').textContent = title;
    $('purchase-ledger-content').innerHTML = `<div class="purchase-ledger-total"><span>${rows.length} 筆紀錄</span><strong>${money(total(rows))}</strong></div>${rows.length ? rows.map(record => recordMarkup(record, true)).join('') : '<p class="purchase-helper">這個範圍尚無購入紀錄</p>'}`;
    $('purchase-ledger').showModal();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.purchaseClose) $(button.dataset.purchaseClose).close();
    if (button.dataset.purchaseUnitEdit) editUnit(button.dataset.purchaseItem, button.dataset.purchaseUnitEdit);
    if (button.hasAttribute('data-purchase-edit')) { const record = records.find(value => value.id === button.dataset.purchaseEdit); if (record) showEditor(record.itemId, record.id); }
    if (button.dataset.purchaseGroup) { group = button.dataset.purchaseGroup; renderStats(); }
    if (button.dataset.purchaseMonth) { selectedMonth = button.dataset.purchaseMonth; showLedger(`${selectedMonth.replace('-', '/')} 購入明細`, filteredRecords().filter(record => record.date?.startsWith(selectedMonth + '-'))); }
    if (button.dataset.purchaseGroupLabel) { selectedGroup = button.dataset.purchaseGroupLabel; showLedger(selectedGroup + '・購入明細', filteredRecords().filter(record => groupValue(getItem(record.itemId)) === selectedGroup)); }
    if (button.hasAttribute('data-purchase-all-records')) showLedger('金額明細', filteredRecords());
  });
  document.addEventListener('change', event => {
    if (event.target.id !== 'purchase-stats-range' || !['all', 'year', 'month'].includes(event.target.value)) return;
    range = event.target.value;
    renderStats();
    $('purchase-stats-range').focus({preventScroll:true});
  });
  $('purchase-currency').addEventListener('change', () => {manualFields = ['twd','foreign','rate'].filter(key => $('purchase-' + key).value.trim()); calculatedField = null; updateCurrency(); if (manualFields.length === 2) calculate();});
  for (const key of ['twd', 'foreign', 'rate']) $('purchase-' + key).addEventListener('input', () => calculate(key));
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
  for (const id of ['purchase-editor', 'purchase-stats', 'purchase-ledger', 'purchase-stats-help']) $(id).addEventListener('click', event => { if (event.target !== $(id)) return; const bounds = $(id).getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $(id).close(); });

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
