import {createClient} from './supabase-client.mjs?v=54f5b55c83672a3a';
import {cloudConfig} from './cloud-config.mjs?v=54f5b55c83672a3a';
import {createReportStore,prepareReportImage,REPORT_STATES,reportError,normalizeReport} from './report-store.mjs?v=54f5b55c83672a3a';
const h = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {message:'<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM12 7v6M9 10h6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L5 21"/>',link:'<path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',heart:'<path d="M20 5a5 5 0 0 0-7 0l-1 1-1-1a5 5 0 0 0-7 7l8 8 8-8a5 5 0 0 0 0-7Z"/>',plus:'<path d="M12 5v14M5 12h14"/>'};
const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths[name] + '</svg>';

export function createReportHub({items,getUserId = () => null,client:override,toast = () => {},openDialog}) {
  const client = override || createClient(cloudConfig.url,cloudConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce',storageKey:'chiikawa-account-session'}});
  const store = createReportStore({client,storage:localStorage,getUserId});
  const $ = id => document.getElementById(id);
  const menu = document.createElement('button');menu.id = 'open-report';menu.setAttribute('aria-haspopup','dialog');menu.setAttribute('aria-controls','report-dialog');
  menu.innerHTML = icon('message') + '回報缺少商品<span id="report-menu-badge" class="report-menu-badge" hidden>有更新</span>';
  $('open-guide').before(menu);
  $('more-button').insertAdjacentHTML('beforeend','<span id="report-notification-dot" class="notification-dot" aria-hidden="true" hidden></span>');
  document.body.insertAdjacentHTML('beforeend',`
    <dialog id="report-intro-dialog" class="panel-dialog report-intro-dialog release-intro" aria-labelledby="report-intro-title">
      <button type="button" class="icon-button report-intro-close" aria-label="關閉提示" data-close="report-intro-dialog" autofocus>${icon('close')}</button>
      <h2 id="report-intro-title">圖鑑有新功能了</h2>
      <dl class="release-features">
        <div><dt>缺漏回報</dt><dd>找不到的商品可以直接回報，也能查看處理進度。</dd></div>
        <div><dt>收藏紀錄</dt><dd>記下購入日期、數量、價格與備註，也支援外幣換算。</dd></div>
        <div><dt>收藏統計</dt><dd>依角色、種類與系列查看收藏概況，也能分析每月花費。</dd></div>
        <div><dt>想要賣</dt><dd>標記想出售的收藏、設定售價，並在待出售清單集中查看。</dd></div>
      </dl>
      <p class="release-privacy">收藏紀錄、花費統計與售價都只有自己看得到。</p>
      <div class="release-contact"><p>圖鑑還在持續改善，功能與內容也會陸續補上。如果使用時遇到問題，或有任何建議，歡迎寫信告訴我：</p><a href="mailto:yi.yaha14@gmail.com">yi.yaha14@gmail.com</a></div>
      <div class="report-intro-actions"><button type="button" class="report-primary" data-close="report-intro-dialog">我知道了</button></div>
    </dialog>
    <dialog id="report-dialog" class="panel-dialog report-dialog" aria-labelledby="report-title" data-dialog-dismiss="explicit">
      <div class="report-topbar"><span>${icon('heart')}吉伊卡哇圖鑑</span><button type="button" class="icon-button" id="report-close" aria-label="關閉回報頁面">${icon('close')}</button></div>
      <div id="report-form-view"><div class="report-heading"><h2 id="report-title">回報缺少商品</h2><button type="button" class="report-history-link" id="report-open-history" hidden>我的回報</button></div>
        <form id="report-form" novalidate>
          <div class="report-field"><label for="report-name">商品或系列名稱<span>必填</span></label><textarea id="report-name" class="report-name" rows="2" maxlength="120" placeholder="例如：兔兔的聖誕娃娃 / 簡單描述外觀" required></textarea>
            <div id="report-matches" class="report-matches" aria-live="polite" hidden></div></div>
          <fieldset class="report-field"><legend>參考資料<span>至少提供一項</span></legend><div class="report-link-input">${icon('link')}<input id="report-link" aria-label="參考連結" type="url" inputmode="url" maxlength="2000" placeholder="貼上商品介紹或販售頁面的連結"></div><div class="report-or">或</div>
            <input type="file" id="report-files" accept="image/jpeg,image/png,image/webp" multiple hidden><button type="button" class="report-upload" id="report-add-images">${icon('image')}<span>新增商品圖片</span>${icon('plus')}</button>
            <p class="report-file-help">最多 3 張，每張 10 MB 以內；JPG、PNG、WebP。</p><div id="report-images" class="report-images" aria-live="polite"></div></fieldset>
          <div class="report-field"><div class="report-label-row"><label for="report-note">補充說明<span class="report-optional">選填</span></label><span id="report-note-count">0 / 1000</span></div><textarea id="report-note" rows="3" maxlength="1000" placeholder="例如：這個系列還缺小八和兔兔，或有其他尺寸的款式。"></textarea></div>
          <footer class="report-footer"><p>${icon('heart')}謝謝你的回報！有更新會再通知～</p><p id="report-error" class="report-error" role="alert" hidden></p><p id="report-storage-warning" class="report-error" role="status" hidden>目前無法保留草稿，請先保持這個頁面開啟。</p><button type="submit" id="report-submit" class="report-primary">送出回報${icon('arrow')}</button><p id="report-progress" class="report-progress" role="status" hidden></p></footer>
        </form>
      </div>
      <div id="report-success" class="report-success" role="status" hidden><div>${icon('check')}</div><h2>已收到你的回報！</h2><p>謝謝你的回報！<br>有更新會再通知～</p><p id="report-receipt-warning" class="report-error" hidden>回報已收到；這個瀏覽器暫時無法保存回報紀錄，請保留這個頁面。</p><section><small>這次回報的商品或系列</small><strong id="report-sent-name"></strong></section><button type="button" class="report-primary" id="report-again">再回報一筆</button><button type="button" class="report-text-button" data-close="report-dialog">返回圖鑑</button></div>
      <div id="report-history" class="report-history" hidden><div class="report-heading"><h2>我的回報</h2><button type="button" id="report-back-form" class="report-history-link">返回填寫</button></div><div id="report-history-list" aria-live="polite"></div></div>
    </dialog>`);
  let images = [], job = null, busy = false, preparing = false, updates = [], checking = null, scope = store.scope, saveTimer, lastCheck = 0, introTimer, introShown = false;
  const form = $('report-form'), dialog = $('report-dialog'), intro = $('report-intro-dialog');
  const value = () => ({name:$('report-name').value,link:$('report-link').value,note:$('report-note').value,images});
  function persist() {
    clearTimeout(saveTimer);
    try {store.saveDraft({...value(),job},scope);$('report-storage-warning').hidden = true;return true;}
    catch {$('report-storage-warning').hidden = false;return false;}
  }
  function renderImages() {
    $('report-images').innerHTML = images.map((image,index) => '<div class="report-image"><img src="' + h(image.dataUrl) + '" alt="' + h(image.filename) + '"><button type="button" class="icon-button" data-remove-report-image="' + index + '" aria-label="移除圖片：' + h(image.filename) + '">' + icon('close') + '</button></div>').join('');
    $('report-add-images').disabled = busy || preparing || images.length >= 3;
  }
  function restoreDraft() {
    const draft = store.draft();job = draft?.job || null;
    for (const [field,id] of [['name','report-name'],['link','report-link'],['note','report-note']]) $(id).value = typeof draft?.[field] === 'string' ? draft[field] : '';
    images = Array.isArray(draft?.images) ? draft.images.filter(image => typeof image?.dataUrl === 'string' && image.dataUrl.startsWith('data:image/jpeg;base64,')).slice(0,3) : [];
    $('report-note-count').textContent = $('report-note').value.length + ' / 1000';renderImages();
  }
  function error(text) {$('report-error').textContent = text;$('report-error').hidden = !text;}
  function showForm() {$('report-form-view').hidden = false;$('report-success').hidden = true;$('report-history').hidden = true;}
  function badge() {
    const seen = store.seen();const unread = updates.some(row => row.version > (seen[row.id] || 1));
    $('report-menu-badge').hidden = !unread;$('report-notification-dot').hidden = !unread;
    $('report-open-history').hidden = !updates.length && !store.receipts().length;
  }
  function renderHistory() {
    $('report-history-list').innerHTML = updates.length ? updates.map(row => '<article><div><strong>' + h(row.name) + '</strong><span>' + h(REPORT_STATES[row.state] || '待查看') + '</span></div>' + (row.reply ? '<p>' + h(row.reply) + '</p>' : '') + '<small>' + h(new Date(row.updated_at).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'})) + '</small></article>').join('') : '<p class="report-empty">目前沒有回報紀錄。</p>';
  }
  async function refresh(force = false) {
    if (document.hidden || checking || !force && Date.now() - lastCheck < 60000) return;
    if (!getUserId() && !store.receipts().length) {updates = [];badge();return;}
    const activeScope = store.scope;lastCheck = Date.now();
    checking = (async () => {
      try {const rows = await store.updates();if (activeScope !== store.scope) return;updates = rows;badge();if (!$('report-history').hidden) renderHistory();}
      catch {if (!$('report-history').hidden) $('report-history-list').textContent = '暫時無法讀取回報，請稍後再試。';}
    })().finally(() => {checking = null;});
    return checking;
  }
  function open() {
    $('more-menu').hidden = true;$('more-button').setAttribute('aria-expanded','false');
    if (intro.open) intro.close();
    if (store.scope !== scope && !busy) {persist();scope = store.scope;restoreDraft();updates = [];}
    openDialog(dialog.id);void refresh(true);
  }
  menu.addEventListener('click',open);
  $('report-open-history').addEventListener('click',async () => {
    $('report-form-view').hidden = true;$('report-success').hidden = true;$('report-history').hidden = false;renderHistory();await refresh(true);
    try {store.markSeen(updates);} catch {}badge();dialog.scrollTop = 0;
  });
  $('report-back-form').addEventListener('click',showForm);
  $('report-again').addEventListener('click',() => {form.reset();images = [];job = null;error('');$('report-matches').hidden = true;renderImages();showForm();persist();$('report-name').focus();});
  $('report-close').addEventListener('click',() => {if (!busy && !preparing) {persist();dialog.close();}});
  dialog.addEventListener('cancel',event => {if (busy || preparing) event.preventDefault();else persist();});
  dialog.addEventListener('close',() => {if (!busy) persist();$('more-button').focus({preventScroll:true});});
  for (const id of ['report-intro-dialog','report-dialog']) $(id).querySelectorAll('[data-close]').forEach(button => button.addEventListener('click',() => $(button.dataset.close).close()));
  $('report-add-images').addEventListener('click',() => {if (!busy && !preparing) $('report-files').click();});
  $('report-files').addEventListener('change',async event => {
    preparing = true;error('');$('report-submit').disabled = true;renderImages();
    try {for (const file of event.target.files || []) {if (images.length >= 3) throw new Error('最多可以附上 3 張圖片。');images.push(await prepareReportImage(file));}persist();}
    catch (failure) {error(reportError(failure));}
    finally {preparing = false;event.target.value = '';renderImages();$('report-submit').disabled = false;persist();}
  });
  $('report-images').addEventListener('click',event => {const button = event.target.closest('[data-remove-report-image]');if (!button || busy || preparing) return;images.splice(Number(button.dataset.removeReportImage),1);renderImages();persist();});
  form.addEventListener('input',() => {error('');$('report-note-count').textContent = $('report-note').value.length + ' / 1000';clearTimeout(saveTimer);saveTimer = setTimeout(persist,250);});
  $('report-name').addEventListener('input',() => {
    const query = $('report-name').value.trim().toLocaleLowerCase();
    const words = query.split(/\s+/).filter(Boolean);
    const matches = query.length >= 2 ? items.filter(item => {const text = [item.name,item.character,item.series].join(' ').toLocaleLowerCase();return words.every(word => text.includes(word));}).slice(0,3) : [];
    $('report-matches').hidden = !matches.length;
    $('report-matches').innerHTML = '<small>圖鑑中可能有這一款</small>' + matches.map(item => '<strong>' + h(item.character + '・' + item.name) + '</strong>').join('') + '<p>若缺少的是其他款式，可以繼續填寫說明。</p>';
  });
  form.addEventListener('submit',async event => {
    event.preventDefault();if (busy || preparing) return;
    try {normalizeReport(value());} catch (failure) {error(reportError(failure));return;}
    busy = true;error('');persist();
    form.querySelectorAll('input,textarea,button').forEach(element => element.disabled = true);$('report-close').disabled = true;$('report-progress').hidden = false;
    try {
      const sentName = value().name;
      const receipt = await store.submit(value(),job,(text,nextJob) => {$('report-progress').textContent = text;job = nextJob;persist();});
      if (receipt.scope === store.scope) {try {store.clearDraft();} catch {}images = [];job = null;form.reset();$('report-note-count').textContent = '0 / 1000';renderImages();}
      $('report-sent-name').textContent = sentName;$('report-receipt-warning').hidden = receipt.stored;
      $('report-form-view').hidden = true;$('report-history').hidden = true;$('report-success').hidden = false;dialog.scrollTop = 0;await refresh(true);
    } catch (failure) {error(reportError(failure));persist();}
    finally {busy = false;form.querySelectorAll('input,textarea,button').forEach(element => element.disabled = false);$('report-close').disabled = false;$('report-progress').hidden = true;renderImages();}
  });
  // 此次功能介紹獨立記錄已看過狀態，不因其他頁面更新再次提示。
  const introKey = 'chiikawa-feature-intro-seen-2026-11-04-v1';
  function seenIntro() {try {if (localStorage.getItem(introKey)) return true;} catch {}try {return !!sessionStorage.getItem(introKey);} catch {return introShown;}}
  function tryIntro() {
    clearTimeout(introTimer);
    if (introShown || seenIntro()) return;
    const url = new URL(location.href);
    const authCallback = url.searchParams.has('code') || url.searchParams.has('error') || /(?:^#|&)(?:access_token|refresh_token|error)=/.test(url.hash);
    if (document.hidden || document.querySelector('dialog[open]') || document.activeElement?.matches('input,textarea,select,[contenteditable]') || authCallback) {introTimer = setTimeout(tryIntro,1500);return;}
    openDialog(intro.id);introShown = true;
    try {localStorage.setItem(introKey,'1');} catch {try {sessionStorage.setItem(introKey,'1');} catch {}}
  }
  window.addEventListener('pagehide',() => {if (!busy && !$('report-success').hidden) return;persist();});
  window.addEventListener('storage',event => {if (event.key === introKey && event.newValue && intro.open) intro.close();});
  const checkScope = () => {if (store.scope !== scope && !busy && !preparing) {persist();scope = store.scope;restoreDraft();updates = [];showForm();badge();}void refresh();};
  client.auth.onAuthStateChange(() => setTimeout(checkScope,0));
  window.addEventListener('online',checkScope);window.addEventListener('focus',checkScope);document.addEventListener('visibilitychange',checkScope);
  setInterval(checkScope,60000);restoreDraft();badge();void refresh();
  return {showIntro:() => {introTimer = setTimeout(tryIntro,800);},open};
}
