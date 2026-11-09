import { createClient } from './supabase-client.mjs?v=1829a38da2d799c2';
import { cloudConfig } from './cloud-config.mjs?v=1829a38da2d799c2';
import { createCloudStore } from './cloud-store.mjs?v=1829a38da2d799c2';
import { ACCOUNT_SESSION_KEY, readLocalSession, readLocalProfile, saveLocalProfile } from './account-cache.mjs?v=1829a38da2d799c2';
import { createAvatarStore, prepareAvatar } from './avatar-store.mjs?v=1829a38da2d799c2';
import { createFriendInviteURL } from './friend-invite.mjs?v=1829a38da2d799c2';
import { describePurchaseRecord } from './purchase-records.mjs?v=1829a38da2d799c2';
import { STORAGE_KEY, ITEM_TYPES, typeLabel, seriesLabel, filterItems, groupItems, groupSeriesOptions } from './model.mjs?v=1829a38da2d799c2';
import { normalizeNickname, validNickname, normalizeFriendCode, formatFriendCode, collectionStats, compareCollections, notificationCount } from './social-model.mjs?v=1829a38da2d799c2';

const $ = id => document.getElementById(id);
const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = value => Number(value || 0).toLocaleString('zh-TW');
const percentage = value => new Intl.NumberFormat('zh-TW', { style:'percent', maximumFractionDigits:1 }).format(value || 0);
const closeButton = (id, label) => '<button class="icon-button" data-close="' + id + '" aria-label="' + label + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button>';
const safeImage = value => { try { const url = new URL(value); return ['http:','https:','blob:'].includes(url.protocol) ? h(url.href) : ''; } catch { return ''; } };
function errorText(error) {
  const message = String(error?.message || error || '');
  if (/找不到|請先|你們|邀請|自己的|目前無法|這筆|收藏資料|設定資料|請稍候|封鎖/u.test(message)) return message;
  if (/expired|invalid.*token|otp_expired|Token has expired/i.test(message)) return '驗證碼不正確或已過期，請確認後重試，或重新寄送。';
  if (/rate.limit|too many|security purposes/i.test(message)) return '操作太頻繁，請稍候再試。';
  if (/provider.*(disabled|not enabled)|unsupported provider/i.test(message)) return '這個登入方式暫時無法使用，請稍後再試。';
  if (/email.*(authorized|send|smtp)|sending.*email/i.test(message)) return '驗證信暫時無法寄出，請稍後再試。';
  if (/fetch|network|offline|timeout/i.test(message)) return '暫時無法連線，請確認網路後再試。收藏紀錄會保留。';
  return '操作暫時未完成，請稍後再試。';
}

export function createAccountHub({ items, characters, seriesTree, getSaved, applySaved, normalize, merge, onScope, onOpenDetail, toast, openDialog, client:clientOverride, initialView = null }) {
  const client = clientOverride || createClient(cloudConfig.url, cloudConfig.publishableKey, {
    auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:'pkce', storageKey:ACCOUNT_SESSION_KEY },
  });
  let pendingView = initialView;
  let collectionReady, viewReady;
  const collectionReadyPromise = new Promise(resolve => { collectionReady = resolve; });
  const ready = new Promise(resolve => { viewReady = resolve; });
  let user = null, profile = null, authLoading = true, sessionGeneration = 0;
  let sessionStarted = false, sessionConfirmed = false, profileError = '', profileRequest = null;
  let friends = [], blocks = [], friendsLoaded = false, friendsError = '', refreshingFriends = false;
  let selectedFriend = null, friendSnapshot = null, lookup = null, friendTab = 'collection', compareTab = 'both', friendConfirmation = null;
  let friendLookupGeneration = 0;
  let friendAnalysisOpen = false, friendAnalysisTab = 'characters', friendAnalysisExpanded = false, friendCollectionScroll = 0;
  let friendFiltersExpanded = false, friendOwnership = 'all';
  const friendFilterIds = ['friend-search','friend-character','friend-region','friend-type','friend-series','friend-grouping'];
  const friendSeriesBranches = new Set();
  let friendDetailOrigin = null;
  let syncStatus = { state:'guest', pending:0, conflicts:[] };
  let syncWarningShown = false;
  let pendingHub = false, activeAction = false, migrationGuest = null;
  let avatarDraft, avatarPreview = '', avatarBusy = false, avatarGeneration = 0;
  const photos = createAvatarStore(client);
  const prompted = new Set();
  const storage = window.localStorage;
  const avatar = (person, extra = '', draft = false) => {
    const url = draft && avatarDraft !== undefined ? avatarPreview : photos.url(person?.avatar_path);
    return '<span class="social-avatar ' + extra + '"' + (!url ? ' role="img" aria-label="未設定頭貼"' : '') + '>' + (url ? '<img src="' + (draft && avatarDraft !== undefined ? h(url) : safeImage(url)) + '" alt="" width="64" height="64" loading="lazy">' : '') + '</span>';
  };
  function resetAvatarDraft() {
    avatarGeneration++; avatarDraft = undefined; avatarBusy = false;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    avatarPreview = '';
  }
  const canonicalURL = () => new URL('./',location.href).href;
  const rpc = async (name, args = {}) => { const result = await client.rpc(name, args); if (result.error) throw result.error; return result.data; };
  const message = (id, text, error = false) => { const target = $(id); if (target) { target.textContent = text; target.classList.toggle('error', error); } };
  const open = id => openDialog(id);
  const closeMenu = () => { $('more-menu').hidden = true; $('more-button').setAttribute('aria-expanded','false'); };

  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="account-dialog" class="panel-dialog account-dialog" aria-labelledby="account-title"><div id="account-content"></div></dialog>
    <dialog id="friends-dialog" class="panel-dialog friends-dialog" aria-labelledby="friends-title"><div id="friends-content"></div></dialog>
    <dialog id="migration-dialog" class="panel-dialog account-dialog" aria-labelledby="migration-title"><div class="dialog-heading"><h2 id="migration-title">帶入原有收藏</h2>${closeButton('migration-dialog','關閉帶入收藏')}</div><p class="dialog-description">將這台裝置原本的收藏加入目前帳號。同款數量保留較大的紀錄，重複帶入不會累加。</p><div id="migration-summary" class="migration-summary"></div><p class="social-note">確認儲存成功前，原本的本機紀錄會繼續保留。</p><p id="migration-message" class="form-message" role="status"></p><div class="confirm-actions"><button class="secondary-button" id="skip-migration">暫時略過</button><button class="primary-button" id="confirm-migration">加入帳號</button></div></dialog>
    <dialog id="sync-conflict-dialog" class="panel-dialog account-dialog" aria-labelledby="sync-conflict-title"><div class="dialog-heading"><h2 id="sync-conflict-title">確認同步差異</h2>${closeButton('sync-conflict-dialog','關閉同步差異')}</div><p class="dialog-description">這些紀錄也在其他裝置更新過。請選擇要保留的版本，其他收藏會照常同步。</p><div id="sync-conflict-content"></div></dialog>
  `);
  $('account-dialog').addEventListener('cancel', event => { if (user && !profile?.nickname) event.preventDefault(); });
  $('account-dialog').addEventListener('close', () => {
    resetAvatarDraft();
    if (pendingView?.open === 'account') pendingView = null;
    if (!user) { pendingHub = false; clearFriendLookup(); }
    if (!user || profile?.nickname) $('more-button').focus({ preventScroll:true });
  });
  $('friends-dialog').addEventListener('close', () => {
    selectedFriend = null; friendSnapshot = null; friendConfirmation = null; pendingHub = false; pendingView = null;
    clearFriendLookup();
    $('more-button').focus({ preventScroll:true });
  });
  $('detail-dialog').addEventListener('close',() => {
    if (!friendDetailOrigin || !$('friends-dialog').open) return;
    const origin = [...$('friends-content').querySelectorAll('[data-friend-detail]')].find(button => button.dataset.friendDetail === friendDetailOrigin);
    (origin || $('friend-search'))?.focus({preventScroll:true});
    friendDetailOrigin = null;
  });

  const store = createCloudStore({ client, storage, normalize, onApply:saved => { applySaved(saved); if (selectedFriend && friendSnapshot && $('friends-dialog').open) renderFriendDetail(); }, onScope,
    online:() => navigator.onLine,
    onStatus:status => {
      syncStatus = status; renderSync();
      if (status.state === 'saved' || status.state === 'guest') syncWarningShown = false;
      if (status.pending && (!status.storageOK || status.state === 'error') && !syncWarningShown) {
        syncWarningShown = true;
        toast(status.storageOK ? '暫時無法同步，收藏已保留，連線恢復後會自動重試' : '目前無法保留待同步紀錄，請到資料管理匯出備份');
      }
      if ($('sync-conflict-dialog').open) renderConflicts();
      if (status.state === 'saved' || status.state === 'conflict') maybeOfferMigration();
    },
  });

  function renderSync() {
    const messages = {
      guest:'收藏儲存在這台裝置', loading:'正在讀取帳號收藏…', syncing:'正在同步收藏…',
      saved:'收藏已與帳號同步', pending:navigator.onLine ? '收藏已留在這台裝置，等待同步' : '目前離線，收藏等待連線後同步',
      conflict:'有收藏在其他裝置更新，請確認差異', error:'暫時無法同步，這台裝置的收藏會保留',
    };
    const label = !syncStatus.storageOK && user ? '目前無法保留待同步紀錄，請先匯出備份' : messages[syncStatus.state] || messages.guest;
    $('account-menu-name').textContent = profile?.nickname || (authLoading ? '正在讀取帳號…' : '個人資料');
    $('account-menu-status').textContent = user ? label : '登入，讓收藏跟著你';
    $('cloud-sync-label').textContent = label;
    $('cloud-sync-status').dataset.state = syncStatus.state;
    $('sync-now').hidden = !user;
    $('resolve-sync').hidden = !syncStatus.conflicts?.length;
    $('import-guest-collection').hidden = !user;
    $('data-description').textContent = user ? '收藏數量、購買金額與備註、願望清單及收藏設定會與帳號同步，也可以另外匯出備份。' : '目前收藏與購買紀錄儲存在這台裝置。登入帳號後，可以在手機與電腦接續使用，也能繼續匯出備份。';
    const inline = $('profile-sync-status');
    if (inline) inline.textContent = label;
  }
  function renderBadge() {
    const count = user ? notificationCount(friends) : 0;
    $('more-notification-dot').hidden = !count;
    $('friends-menu-badge').hidden = !count;
    $('friends-menu-badge').textContent = n(count) + ' 則邀請';
    $('more-button').setAttribute('aria-label', '更多選項' + (count ? '，有 ' + n(count) + ' 則待處理邀請' : ''));
  }
  function renderAccount() {
    if (authLoading) {
      $('account-content').innerHTML = '<div class="dialog-heading"><h2 id="account-title">個人資料</h2>' + closeButton('account-dialog','關閉個人資料') + '</div><p class="social-loading" role="status">正在讀取帳號…</p>';
      return;
    }
    if (!user) {
      $('account-content').innerHTML = '<div class="dialog-heading"><h2 id="account-title">讓收藏跟著你</h2>' + closeButton('account-dialog','關閉登入') + '</div><p class="dialog-description">登入後，自動保存收藏與願望清單。換一台裝置，也能接著收集喜歡的娃。</p>' +
        '<button class="google-signin" id="google-signin"' + (!cloudConfig.googleEnabled ? ' disabled' : '') + '><span class="google-letter" aria-hidden="true">G</span>使用 Google 登入</button>' + (!cloudConfig.googleEnabled ? '<p class="social-note centered">Google 登入準備中</p>' : '') +
        '<p id="account-message" class="form-message" role="status"></p><p class="account-footnote"><a href="./privacy.html" target="_blank" rel="noopener noreferrer">隱私權與資料說明</a></p>';
      return;
    }
    if (!profile) {
      $('account-content').innerHTML = '<div class="dialog-heading"><h2 id="account-title">個人資料</h2>' + closeButton('account-dialog','關閉個人資料') + '</div><p class="social-note">' + h(profileError || '帳號資料暫時無法更新，收藏會保留在這台裝置。') + '</p><button class="secondary-button" id="retry-account">重新讀取</button><button class="text-button logout-button" id="account-signout">登出帳號</button>';
      return;
    }
    const onboarding = !profile?.nickname;
    $('account-content').innerHTML = '<div class="dialog-heading"><h2 id="account-title">' + (onboarding ? '先取個暱稱吧' : '個人資料') + '</h2>' + (onboarding ? '' : closeButton('account-dialog','關閉個人資料')) + '</div>' +
      (onboarding ? '<p class="dialog-description">希望大家怎麼稱呼你？這個暱稱會顯示給好友，之後也能在這裡修改。</p>' : '') +
      '<div class="profile-portrait"><span id="profile-avatar-preview">' + avatar(profile,'large',true) + '</span><div><strong>' + h(profile?.nickname || '新的收藏旅程') + '</strong><span>' + h(user.email || '') + '</span></div></div>' +
      '<form id="profile-form" class="social-form"><label for="profile-nickname">暱稱</label><input id="profile-nickname" name="nickname" type="text" autocomplete="nickname" maxlength="48" placeholder="希望大家怎麼稱呼你？" value="' + h(profile?.nickname || '') + '" required aria-describedby="nickname-help"><p id="nickname-help" class="social-note">1～24 個字，可以隨時更改。</p><span class="profile-field-label">頭貼（選填）</span><div class="avatar-actions"><label class="secondary-button avatar-upload-button" for="profile-avatar-file" tabindex="0" role="button">上傳照片</label><input id="profile-avatar-file" type="file" accept="image/jpeg,image/png,image/webp" hidden><button class="text-button" id="remove-avatar" type="button"' + (!(avatarDraft !== undefined ? avatarDraft : profile?.avatar_path) ? ' hidden' : '') + '>移除照片，留白</button></div><p class="social-note">可以留白。支援 JPG、PNG、WebP，20 MB 以內；照片會自動裁成正方形。</p><button class="primary-button full-width" type="submit">' + (onboarding ? '設定完成，開始收藏' : '儲存個人資料') + '</button></form><p id="account-message" class="form-message" role="status"></p>' +
      (!onboarding ? '<section class="profile-section"><h3>我的好友代碼</h3><div class="friend-code-row"><code>' + h(formatFriendCode(profile.friend_code)) + '</code><button class="secondary-button" data-action="copy-code">複製</button></div><button class="text-button" data-action="copy-invite">複製好友邀請連結</button><p class="social-note">成為好友後，彼此就能查看收藏、數量與進度。</p></section><section class="profile-section"><h3>登入方式</h3><p class="login-method">Google 帳號登入</p></section><p id="profile-sync-status" class="social-note"></p>' : '') +
      '<button class="text-button logout-button" id="account-signout">登出帳號</button>';
    renderSync();
  }
  async function action(button, task, messageId = 'account-message') {
    if (activeAction) return;
    activeAction = true;
    if (button) button.disabled = true;
    message(messageId,'');
    try { await task(); } catch (error) { message(messageId,errorText(error),true); }
    finally { activeAction = false; if (button?.isConnected) button.disabled = false; }
  }
  $('account-content').addEventListener('submit', event => {
    event.preventDefault();
    if (event.target.id === 'profile-form') {
      void action(event.submitter,async () => {
        if (avatarBusy) { message('account-message','照片正在處理，請稍候再儲存。'); return; }
        const nickname = normalizeNickname($('profile-nickname').value);
        if (!validNickname(nickname)) { message('account-message','請輸入 1～24 個字的暱稱。',true); return; }
        const first = !profile?.nickname, activeUid = user.id, previousPath = profile?.avatar_path;
        const uploaded = avatarDraft ? await photos.upload(activeUid,avatarDraft) : null;
        const avatar_path = avatarDraft === undefined ? previousPath || null : uploaded;
        const result = await client.from('profiles').update({ nickname, avatar_path }).eq('id',activeUid).select().single();
        if (result.error) { if (uploaded) void photos.remove(uploaded); throw result.error; }
        if (user?.id !== activeUid) return;
        profile = result.data; saveLocalProfile(storage,profile); resetAvatarDraft(); await photos.load([profile.avatar_path]);
        if (user?.id !== activeUid) return;
        if (previousPath && previousPath !== avatar_path) void photos.remove(previousPath);
        store.enableWrites(); renderAccount(); renderSync();
        if (first) { $('account-dialog').close(); const migrating = maybeOfferMigration(); if (!migrating && (pendingHub || sessionStorage.getItem('chiikawa-pending-friend'))) { pendingHub = false; showFriends(); } }
        else message('account-message','個人資料已更新。');
        void refreshFriends();
      });
    }
  });
  $('account-content').addEventListener('change',event => {
    if (event.target.id !== 'profile-avatar-file' || !event.target.files?.[0] || activeAction) return;
    const file = event.target.files[0], generation = ++avatarGeneration;
    avatarBusy = true; message('account-message','正在處理照片…');
    void prepareAvatar(file).then(blob => {
      if (generation !== avatarGeneration) return;
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      avatarDraft = blob; avatarPreview = URL.createObjectURL(blob);
      $('profile-avatar-preview').innerHTML = avatar(profile,'large',true);
      $('remove-avatar').hidden = false; message('account-message','照片已選好，儲存個人資料後會套用。');
    }).catch(error => { if (generation === avatarGeneration) message('account-message',error.message,true); })
      .finally(() => { if (generation === avatarGeneration) avatarBusy = false; });
  });
  $('account-content').addEventListener('keydown',event => {
    if (event.target.matches('.avatar-upload-button') && ['Enter',' '].includes(event.key)) { event.preventDefault(); $('profile-avatar-file').click(); }
  });
  $('account-content').addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.id === 'remove-avatar') {
      resetAvatarDraft(); avatarDraft = null; $('profile-avatar-preview').innerHTML = avatar(profile,'large',true);
      button.hidden = true; message('account-message','儲存後，頭貼會改為空白。');
    } else if (button.id === 'google-signin') {
      void action(button,async () => {
        const result = await client.auth.signInWithOAuth({ provider:'google', options:{ redirectTo:canonicalURL() } });
        if (result.error) throw result.error;
      });
    } else if (button.id === 'retry-account') {
      authLoading = true; renderAccount(); void loadProfile(sessionGeneration);
    } else if (button.id === 'account-signout') {
      void action(button,async () => {
        const result = await client.auth.signOut({ scope:'local' });
        if (result.error) throw result.error;
        $('account-dialog').close(); toast('已登出，帳號收藏已分開保留');
      });
    }
  });

  function readGuest() { try { return normalize(JSON.parse(storage.getItem(STORAGE_KEY) || 'null')); } catch { return normalize(null); } }
  function maybeOfferMigration() {
    if (!user || !profile?.nickname || !store.ready || prompted.has(user.id)) return;
    const guest = readGuest();
    let handled = false;
    try { handled = storage.getItem(accountStorageKeyForMigration(user.id)) === 'handled'; } catch {}
    if ((!guest.owned.length && !guest.wishlist.length && !Object.keys(guest.purchaseRecords || {}).length && !Object.keys(guest.saleRecords || {}).length) || handled) return;
    prompted.add(user.id); showMigration(); return true;
  }
  const accountStorageKeyForMigration = uid => STORAGE_KEY + '-migration-' + uid;
  function mergedGuest() {
    const current = getSaved(), guest = migrationGuest || readGuest();
    const incoming = current.owned.length || current.wishlist.length ? { ...guest, characterOrder:current.characterOrder, groupBy:current.groupBy, includedTypes:current.includedTypes } : guest;
    return merge(current,incoming);
  }
  function showMigration() {
    if (!user || !store.ready) { toast('請等待帳號收藏讀取完成後再試'); return; }
    migrationGuest = readGuest();
    const current = getSaved(), combined = mergedGuest();
    $('migration-summary').innerHTML = '<div><span>這台裝置原有收藏</span><strong>' + n(migrationGuest.owned.length) + ' 款</strong></div><div><span>帳號目前收藏</span><strong>' + n(current.owned.length) + ' 款</strong></div><div><span>合併後收藏</span><strong>' + n(combined.owned.length) + ' 款，共 ' + n(Object.values(combined.quantities).reduce((a,b) => a+b,0)) + ' 個</strong></div><div><span>合併後願望清單</span><strong>' + n(combined.wishlist.length) + ' 款</strong></div>';
    message('migration-message',''); open('migration-dialog');
  }
  function migrationHandled() { try { storage.setItem(accountStorageKeyForMigration(user.id),'handled'); } catch {} }
  $('skip-migration').addEventListener('click',() => { migrationHandled(); $('migration-dialog').close(); });
  $('migration-dialog').addEventListener('close',() => {
    if (user && profile?.nickname && (pendingHub || sessionStorage.getItem('chiikawa-pending-friend'))) { pendingHub = false; showFriends(); }
  });
  $('confirm-migration').addEventListener('click',() => {
    if (!user) return;
    const combined = mergedGuest(); store.capture(combined); applySaved(combined); migrationHandled(); $('migration-dialog').close();
    toast('原有收藏已加入帳號，正在同步'); void store.sync();
  });

  function renderConflicts() {
    const conflicts = syncStatus.conflicts || [];
    if (!conflicts.length) { $('sync-conflict-dialog').close(); return; }
    const describe = value => value.quantity ? '收藏 ' + n(value.quantity) + ' 個' : value.wished ? '願望清單' : '未收藏';
    $('sync-conflict-content').innerHTML = conflicts.map(conflict => {
      const item = items.find(item => item.id === (conflict.itemId || conflict.id));
      const saleIds = conflict.id === '__settings' ? [...new Set([...Object.keys(conflict.local.saleRecords || {}),...Object.keys(conflict.remote.saleRecords || {})])].filter(id => JSON.stringify(conflict.local.saleRecords?.[id]) !== JSON.stringify(conflict.remote.saleRecords?.[id])) : [];
      const detail = value => conflict.kind === 'record' ? h(describePurchaseRecord(value)) : conflict.id === '__settings' ? saleIds.map(id => {
        const item = items.find(item => item.id === id), record = value.saleRecords?.[id];
        return h((item ? item.character + '・' + item.name : '商品') + '：' + (record?.enabled ? '想要賣' : '未販售') + (record?.price ? '，NT$ ' + record.price : ''));
      }).join('<br>') : describe(value);
      return '<section class="conflict-row"><h3>' + (conflict.id === '__settings' ? '角色順序、收藏與販售設定' : h(item ? item.character + '・' + item.name : '收藏紀錄')) + (conflict.kind === 'record' ? '的收藏紀錄' : '') + '</h3><div class="conflict-choices"><button class="secondary-button" data-conflict="' + h(conflict.id) + '" data-choice="local">保留這台裝置' + (item || saleIds.length ? '<small>' + detail(conflict.local) + '</small>' : '') + '</button><button class="secondary-button" data-conflict="' + h(conflict.id) + '" data-choice="remote">保留帳號版本' + (item || saleIds.length ? '<small>' + detail(conflict.remote) + '</small>' : '') + '</button></div></section>';
    }).join('');
  }
  $('sync-conflict-content').addEventListener('click',event => { const button = event.target.closest('[data-conflict]'); if (button) store.resolve(button.dataset.conflict,button.dataset.choice); });
  $('open-account').addEventListener('click',() => { closeMenu(); renderAccount(); open('account-dialog'); });
  $('open-friends').addEventListener('click',() => { closeMenu(); showFriends(); });
  $('sync-now').addEventListener('click',() => { void store.sync(); });
  $('resolve-sync').addEventListener('click',() => { renderConflicts(); if (syncStatus.conflicts?.length) open('sync-conflict-dialog'); });
  $('import-guest-collection').addEventListener('click',showMigration);

  async function refreshFriends() {
    if (!user || !profile?.nickname || refreshingFriends || document.hidden) return;
    const activeUid = user.id; refreshingFriends = true;
    try {
      const [nextFriends, nextBlocks] = await Promise.all([
        rpc('list_collection_friends'),
        rpc('list_collection_blocks'),
      ]);
      if (user?.id !== activeUid) return;
      await photos.load([profile?.avatar_path,...(nextFriends || []).filter(friend => friend.status === 'accepted').map(friend => friend.avatar_path)]);
      if (user?.id !== activeUid) return;
      const listChanged = !friendsLoaded || Boolean(friendsError) || JSON.stringify(friends) !== JSON.stringify(nextFriends || []) || JSON.stringify(blocks) !== JSON.stringify(nextBlocks || []);
      friends = nextFriends || []; blocks = nextBlocks || [];
      friendsLoaded = true; friendsError = ''; renderBadge();
      if (listChanged && $('friends-dialog').open && !selectedFriend) renderFriends();
      if (selectedFriend && !friends.some(friend => friend.other_id === selectedFriend.other_id && friend.status === 'accepted')) {
        selectedFriend = null; friendSnapshot = null; renderFriends(); toast('好友關係已更新，目前無法查看對方收藏');
      } else if (selectedFriend && $('friends-dialog').open) await loadFriendSnapshot(false);
    } catch (error) {
      if (user?.id !== activeUid) return;
      friendsError = errorText(error);
      if ($('friends-dialog').open && !selectedFriend) renderFriends();
    } finally { refreshingFriends = false; }
  }
  function showFriends() {
    if (authLoading || !user || !profile?.nickname) {
      pendingHub = true; renderAccount(); open('account-dialog'); return;
    }
    selectedFriend = null; friendSnapshot = null; lookup = null; friendConfirmation = null;
    renderFriends(); open('friends-dialog'); void refreshFriends();
    const inviteCode = sessionStorage.getItem('chiikawa-pending-friend');
    if (inviteCode) { const input = $('friend-code-input'); if (input) input.value = formatFriendCode(inviteCode); }
  }
  function friendRow(friend, type) {
    if (type === 'accepted') return '<button type="button" class="friend-row friend-row-link" data-view-friend="' + h(friend.id) + '" aria-label="查看' + h(friend.nickname || '收藏好友') + '的收藏">' + avatar(friend) + '<span class="friend-row-info"><strong>' + h(friend.nickname || '收藏好友') + '</strong></span><svg class="friend-row-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>';
    return '<div class="friend-row">' + avatar(friend) + '<div class="friend-row-info"><strong>' + h(friend.nickname || '收藏好友') + '</strong><span>' + (type === 'incoming' ? '想與你分享收藏' : '等待對方接受') + '</span></div>' +
      (type === 'incoming' ? '<div class="friend-row-actions"><button class="text-button" data-friend-id="' + h(friend.id) + '" data-response="decline">婉拒</button><button class="primary-button" data-friend-id="' + h(friend.id) + '" data-response="accept">接受</button></div>' : '<button class="text-button" data-friend-id="' + h(friend.id) + '" data-response="cancel">取消邀請</button>') + '</div>';
  }
  function renderFriends() {
    if (selectedFriend && friendSnapshot) { renderFriendDetail(); return; }
    const incoming = friends.filter(friend => friend.status === 'pending' && friend.incoming);
    const outgoing = friends.filter(friend => friend.status === 'pending' && !friend.incoming);
    const accepted = friends.filter(friend => friend.status === 'accepted');
    const codeInput = $('friend-code-input');
    const restoreCodeFocus = document.activeElement === codeInput;
    const selection = restoreCodeFocus ? [codeInput.selectionStart,codeInput.selectionEnd] : null;
    const codeValue = codeInput?.value ?? formatFriendCode(sessionStorage.getItem('chiikawa-pending-friend') || '');
    $('friends-content').innerHTML = '<div class="dialog-heading"><div><span class="social-eyebrow">一起收集喜歡的娃</span><h2 id="friends-title">好友</h2></div>' + closeButton('friends-dialog','關閉好友') + '</div>' +
      '<div class="my-friend-code"><span>我的好友代碼</span><div><code>' + h(formatFriendCode(profile?.friend_code)) + '</code><button class="text-button" data-action="copy-code">複製</button><button class="text-button" data-action="copy-invite">分享連結</button></div></div>' +
      '<form id="find-friend-form" class="find-friend-form"><label for="friend-code-input">加入好友</label><div><div class="friend-code-field"><input id="friend-code-input" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" placeholder="輸入好友代碼" maxlength="20" value="' + h(codeValue) + '" required><button id="clear-friend-code" class="friend-code-clear" type="button" aria-label="清空好友代碼"' + (!codeValue ? ' hidden' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div><button class="primary-button" type="submit">尋找</button></div></form><div id="friend-lookup-result">' + (lookup ? '<div class="friend-row">' + avatar(lookup) + '<div class="friend-row-info"><strong>' + h(lookup.nickname) + '</strong><span>接受邀請後，彼此分享收藏</span></div><button class="primary-button" id="send-friend-request">送出邀請</button></div>' : '') + '</div><p id="friends-message" class="form-message" role="status"></p>' +
      (friendsError ? '<div class="social-error"><p>' + h(friendsError) + '</p><button class="secondary-button" data-action="refresh-friends">重新讀取</button></div>' : !friendsLoaded ? '<p class="social-loading" role="status">正在讀取好友…</p>' : '') +
      '<section class="friends-section"><h3>我的好友 <span class="section-count">' + n(accepted.length) + '</span></h3>' + (accepted.length ? accepted.map(friend => friendRow(friend,'accepted')).join('') : friendsLoaded ? '<div class="social-empty"><strong>一起分享收藏的樂趣</strong><p>把好友代碼分享給朋友，或輸入對方的代碼，邀請彼此成為收藏好友。</p></div>' : '') + '</section>' +
      (outgoing.length ? '<section class="friends-section"><h3>已送出的邀請</h3>' + outgoing.map(friend => friendRow(friend,'outgoing')).join('') + '</section>' : '') +
      (incoming.length ? '<section class="friends-section pending-notifications"><h3>待處理通知 <span class="section-count">' + n(incoming.length) + '</span></h3>' + incoming.map(friend => friendRow(friend,'incoming')).join('') + '</section>' : '') +
      (blocks.length ? '<details class="blocked-list"><summary>封鎖名單（' + n(blocks.length) + '）</summary>' + blocks.map(block => '<div class="friend-row"><div class="friend-row-info"><strong>' + h(block.nickname) + '</strong></div><button class="text-button" data-unblock="' + h(block.id) + '">解除封鎖</button></div>').join('') + '<p class="social-note">解除封鎖後，需要重新加入好友才會分享收藏。</p></details>' : '');
    if (restoreCodeFocus) { $('friend-code-input').focus({ preventScroll:true }); $('friend-code-input').setSelectionRange(...selection); }
  }
  async function loadFriendSnapshot(showLoading = true, render = true) {
    if (!selectedFriend || !user) return;
    const activeUid = user.id, selectedId = selectedFriend.other_id;
    if (showLoading) $('friends-content').innerHTML = '<div class="dialog-heading"><h2 id="friends-title">好友收藏</h2>' + closeButton('friends-dialog','關閉好友收藏') + '</div><p class="social-loading" role="status">正在整理收藏…</p>';
    try {
      const result = await rpc('get_friend_collection',{ p_friend_id:selectedId });
      if (user?.id !== activeUid || selectedFriend?.other_id !== selectedId) return;
      await photos.load([result.profile?.avatar_path]);
      if (user?.id !== activeUid || selectedFriend?.other_id !== selectedId) return;
      const previous = JSON.stringify(friendSnapshot);
      const normalized = normalize({ quantities:Object.fromEntries(result.items.map(row => [row.item_id,row.quantity])), wishlist:result.wishlist });
      friendSnapshot = { profile:result.profile, quantities:normalized.quantities, wishlist:Array.isArray(result.wishlist) ? normalized.wishlist : null };
      if (render && (showLoading || previous !== JSON.stringify(friendSnapshot))) renderFriendDetail();
    } catch (error) {
      if (selectedFriend?.other_id !== selectedId) return;
      selectedFriend = null; friendSnapshot = null;
      if (render) { renderFriends(); message('friends-message',errorText(error),true); }
      else friendsError = errorText(error);
    }
  }
  function statsList(rows, mode = 'ratio') {
    return '<div class="stats-list">' + rows.map(row => '<div class="stat-line"><div><span>' + h(row.label) + '</span><strong>' + (mode === 'progress' ? n(row.count) + '／' + n(row.total) + ' 款' : n(row.count) + ' 款 <small>' + percentage(row.ratio) + '</small>') + '</strong></div><span class="stat-track" aria-hidden="true"><span style="width:' + (100 * (mode === 'progress' ? row.count/row.total : row.ratio)).toFixed(2) + '%"></span></span></div>').join('') + '</div>';
  }
  function renderFriendAnalysis() {
    const target = $('friend-analysis-view');
    if (!target || !friendSnapshot) return;
    const stats = collectionStats(items,friendSnapshot.quantities);
    const progress = friendAnalysisTab === 'progress', characters = friendAnalysisTab === 'characters';
    const rows = characters ? stats.characters : stats.types;
    const labels = [['characters','角色偏好'],['types','種類分布'],['progress','收集進度']];
    target.innerHTML = '<p class="friend-analysis-owner">' + h(friendSnapshot.profile.nickname) + '・' + n(stats.styles) + ' 款收藏</p>' +
      '<div class="friend-analysis-tabs" role="group" aria-label="分析項目">' + labels.map(([key,label]) => '<button data-friend-analysis-tab="' + key + '" aria-pressed="' + (friendAnalysisTab === key) + '" aria-controls="friend-analysis-results">' + label + '</button>').join('') + '</div>' +
      '<div id="friend-analysis-results" aria-live="polite"><h3 class="visually-hidden">' + labels.find(([key]) => key === friendAnalysisTab)[1] + '</h3>' +
      (stats.styles ? statsList(friendAnalysisExpanded ? rows : rows.slice(0,3),progress ? 'progress' : 'ratio') +
        '<p class="friend-analysis-note">' + (progress ? '已收藏款數／完整圖鑑中該種類的款數' : '比例以已收藏的 ' + n(stats.styles) + ' 款計算，同款多個只算 1 款') + '</p>' :
        '<div class="social-empty"><strong>收藏旅程剛開始</strong><p>有了收藏後，就能在這裡看看偏好與進度。</p></div>') + '</div>' +
      (rows.length > 3 ? '<button class="text-button friend-analysis-more" data-action="toggle-friend-analysis" aria-expanded="' + friendAnalysisExpanded + '" aria-controls="friend-analysis-results">' + (friendAnalysisExpanded ? '收合為前三名' : '查看全部' + (characters ? '角色' : '種類') + '（' + n(rows.length) + '）') + '</button>' : '');
  }
  function setFriendAnalysis(show) {
    if (!friendSnapshot || !$('friend-collection-view')) return;
    if (show) friendCollectionScroll = $('friends-dialog').scrollTop;
    friendAnalysisOpen = show;
    $('friend-collection-view').hidden = show;
    $('friend-analysis-view').hidden = !show;
    const back = $('friend-detail-back');
    back.dataset.action = show ? 'back-friend-collection' : 'back-friends';
    back.setAttribute('aria-label',show ? '返回好友收藏' : '返回好友清單');
    $('friends-title').textContent = show ? '收藏分析' : friendSnapshot.profile.nickname + '的收藏';
    if (show) renderFriendAnalysis();
    $('friends-dialog').scrollTop = show ? 0 : friendCollectionScroll;
    (show ? back : $('open-friend-analysis'))?.focus({ preventScroll:true });
  }
  function renderFriendDetail(restoredFilters) {
    if (!friendSnapshot || !selectedFriend) return;
    const previousFilters = Object.fromEntries(friendFilterIds.map(id => [id,
      restoredFilters ? (typeof restoredFilters[id] === 'string' ? restoredFilters[id] : '') : $(id)?.value || '',
    ]));
    const previousScroll = $('friends-dialog').scrollTop;
    const { profile:other, quantities, wishlist } = friendSnapshot;
    const stats = collectionStats(items,quantities), myStats = collectionStats(items,getSaved().quantities);
    const differences = compareCollections(items,getSaved().quantities,quantities);
    const character = stats.characters[0], type = stats.types[0];
    const myCharacter = myStats.characters[0];
    $('friends-content').innerHTML = '<div class="dialog-heading"><div class="friend-detail-heading"><button id="friend-detail-back" class="icon-button" data-action="' + (friendAnalysisOpen ? 'back-friend-collection' : 'back-friends') + '" aria-label="' + (friendAnalysisOpen ? '返回好友收藏' : '返回好友清單') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><h2 id="friends-title">' + (friendAnalysisOpen ? '收藏分析' : h(other.nickname) + '的收藏') + '</h2></div>' + closeButton('friends-dialog','關閉好友收藏') + '</div>' +
      '<div id="friend-collection-view"' + (friendAnalysisOpen ? ' hidden' : '') + '>' +
      '<div class="friend-profile">' + avatar(other,'large') + '<div><strong>' + h(other.nickname) + '</strong><p>已收藏 <b>' + n(stats.styles) + '</b> 款，共 <b>' + n(stats.pieces) + '</b> 個</p></div><button class="secondary-button friend-settings-button" data-action="friend-settings" aria-expanded="false" aria-controls="friend-settings">好友設定</button></div>' +
      '<div id="friend-settings" class="friend-settings" hidden><button class="text-button" data-confirm-friend="remove">移除好友</button><button class="text-button" data-confirm-friend="block">封鎖這位使用者</button></div><div id="friend-confirmation"></div><p id="friends-message" class="form-message" role="status"></p>' +
      '<div class="friend-collection-summary"><p class="collection-story">' + (stats.styles ? '<strong>' + h(character.label) + '</strong>為主・最常收<strong>' + h(type.label) + '</strong>' : '收藏旅程剛開始，期待新的娃加入。') + '</p>' +
      (stats.styles ? '<button id="open-friend-analysis" class="text-button friend-analysis-link" data-action="open-friend-analysis" aria-controls="friend-analysis-view">查看分析<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>' : '') + '</div>' +
      '<div class="friend-view-tabs" role="group" aria-label="好友收藏檢視"><button data-friend-tab="collection" aria-pressed="' + (friendTab === 'collection') + '">他的收藏</button><button data-friend-tab="compare" aria-pressed="' + (friendTab === 'compare') + '">收藏比較</button><button data-friend-tab="wishlist" aria-pressed="' + (friendTab === 'wishlist') + '">他的願望清單</button></div>' +
      (friendTab === 'compare' ? '<div class="comparison-intro"><p>你們共同收藏了 <strong>' + n(differences.both.length) + '</strong> 款。</p>' + (myCharacter && character ? '<p class="social-note">你最常收' + h(myCharacter.label) + '，對方最常收' + h(character.label) + '。</p>' : '') + '<div class="comparison-counts"><span>你：' + n(myStats.styles) + ' 款／' + n(myStats.pieces) + ' 個</span><span>對方：' + n(stats.styles) + ' 款／' + n(stats.pieces) + ' 個</span></div></div><div class="comparison-tabs" role="group" aria-label="比較收藏差異">' + [['both','我們都有'],['theirsOnly','他有，我還沒有'],['mineOnly','我有，他還沒有']].map(([key,label]) => '<button data-compare-tab="' + key + '" aria-pressed="' + (compareTab === key) + '">' + label + '<strong>' + n(differences[key].length) + '</strong></button>').join('') + '</div>' : '') +
      friendCatalogControls() + '<div id="friend-products" class="friend-products"></div></div><section id="friend-analysis-view" class="friend-analysis"' + (friendAnalysisOpen ? '' : ' hidden') + ' aria-label="收藏分析"></section>';
    for (const [id,value] of Object.entries(previousFilters)) { $(id).value = value || (id === 'friend-grouping' ? 'character' : ''); if ($(id).value !== value && id !== 'friend-grouping') $(id).value = ''; }
    renderFriendProducts();
    if (friendAnalysisOpen) renderFriendAnalysis();
    $('friends-dialog').scrollTop = previousScroll;
  }
  // 商品卡片、搜尋、篩選與排列共用主要圖鑑的元件樣式。
  const catalogIcon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">' + ({
    search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
    sliders:'<path d="M3 6h6m4 0h8M3 12h12m4 0h2M3 18h2m4 0h12M9 3v6m6 0v6M5 15v6"/>',
    chevron:'<path d="m7 9 5 5 5-5"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    star:'<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.5-4.4 6.3-.9L12 3Z"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".8" fill="currentColor" stroke="none"/>'
  }[name] || '') + '</svg>';
  function friendCatalogControls() {
    const select = (id,label,options) => '<label class="select-control"><select id="' + id + '" aria-label="' + label + '">' + options.map(([key,name]) => '<option value="' + h(key) + '">' + h(name) + '</option>').join('') + '</select><span>' + catalogIcon('chevron') + '</span></label>';
    return '<div class="friend-product-filters"><div class="search-filter-row friend-search-row"><label class="search-control">' + catalogIcon('search') + '<input id="friend-search" type="search" autocomplete="off" aria-label="搜尋好友圖鑑的品名、系列名稱或角色" placeholder="搜尋品名、系列或角色"></label><button id="friend-filter-toggle" class="filter-toggle" type="button" aria-label="展開角色、地區、種類與系列篩選" aria-expanded="false" aria-controls="friend-filter-options">' + catalogIcon('sliders') + '<span class="visually-hidden" id="friend-filter-toggle-label">篩選</span><span id="friend-filter-count" class="filter-count" hidden>0</span></button></div>' +
      '<div id="friend-filter-options" class="filter-options friend-filter-options" hidden>' +
      select('friend-character','篩選角色',[['','全部角色'],...characters.map(name => [name,name])]) +
      select('friend-region','篩選地區',[['','全部地區'],...['日本','台灣','韓國','香港','中國'].map(name => [name,name])]) +
      select('friend-type','篩選種類',[['','全部種類'],...ITEM_TYPES.map(type => [type,typeLabel(type)])]) +
      '<div class="series-anchor"><input type="hidden" id="friend-series"><button type="button" id="friend-series-toggle" class="select-control series-toggle" aria-label="篩選系列：全部系列" aria-expanded="false" aria-controls="friend-series-panel"><span id="friend-series-label">全部系列</span><span>' + catalogIcon('chevron') + '</span></button></div>' +
      '<section id="friend-series-panel" class="friend-series-panel" aria-label="選擇系列" hidden><label class="series-search-wrap">' + catalogIcon('search') + '<input id="friend-series-search" type="search" placeholder="搜尋系列或分類" aria-label="搜尋好友圖鑑系列或分類"></label><div id="friend-series-options" class="series-options"></div></section></div></div>' +
      '<section class="catalog-toolbar friend-catalog-toolbar" aria-label="好友商品顯示方式"><div class="ownership-control" role="group" aria-label="篩選我的擁有狀態">' + [['all','全部'],['owned','我已擁有'],['unowned','我未擁有']].map(([key,label]) => '<button type="button" data-friend-ownership="' + key + '" aria-pressed="false">' + label + '</button>').join('') + '</div><label class="grouping-control"><select id="friend-grouping" aria-label="好友圖鑑排列方式"><option value="character">依角色</option><option value="series">依系列</option></select><span data-icon="chevron">' + catalogIcon('chevron') + '</span></label></section>' +
      '<div id="friend-active-filters" class="active-filters"></div><p id="friend-results-count" class="friend-results-count" role="status" aria-live="polite"></p>';
  }
  function friendProductScope() {
    const mine = getSaved().quantities, theirs = friendSnapshot.quantities;
    if (friendTab === 'compare') return compareCollections(items,mine,theirs)[compareTab];
    const wished = new Set(friendSnapshot.wishlist || []);
    return items.filter(item => friendTab === 'wishlist' ? wished.has(item.id) : theirs[item.id] > 0);
  }
  function friendFilteredItems({ series = true } = {}) {
    const character = $('friend-character').value, mine = getSaved().quantities;
    return filterItems(friendProductScope().filter(item => (!character || item.character === character) &&
      (friendOwnership === 'all' || (friendOwnership === 'owned' ? mine[item.id] > 0 : !mine[item.id]))),
      { query:$('friend-search').value, region:$('friend-region').value, type:$('friend-type').value, series:series ? $('friend-series').value : '' });
  }
  function renderFriendSeriesOptions(revealSelection = false) {
    const selected = $('friend-series').value, search = $('friend-series-search').value;
    const available = friendFilteredItems({series:false});
    const categories = groupSeriesOptions(available,{ query:search, catalog:items, seriesTree });
    const option = ({key,label,count}) => '<button type="button" class="series-option ' + (selected === key ? 'selected' : '') + '" data-friend-series="' + h(key) + '" aria-pressed="' + (selected === key) + '"><span>' + h(label) + '</span><small>' + n(count) + ' 款</small></button>';
    const branch = node => {
      if (!node.hasChildren && !node.children) return node.options.map(option).join('');
      if (!node.hasChildren) return node.ownOptions.map(option).join('');
      const hasSelection = node.options.some(({key}) => key === selected);
      if (revealSelection && hasSelection) friendSeriesBranches.add(node.id);
      const expanded = Boolean(search) || friendSeriesBranches.has(node.id);
      return '<section class="series-category"><button type="button" class="series-category-toggle' + (hasSelection ? ' has-selection' : '') + '" data-friend-series-branch="' + h(node.id) + '" aria-expanded="' + expanded + '" aria-controls="friend-series-branch-' + h(node.id) + '"><span class="series-category-name">' + h(node.label) + '</span><small>' + n(node.options.length) + ' 個系列</small>' + catalogIcon('chevron') + '</button><div id="friend-series-branch-' + h(node.id) + '" class="series-category-options"' + (expanded ? '' : ' hidden') + '>' + node.ownOptions.map(option).join('') + node.children.map(branch).join('') + '</div></section>';
    };
    $('friend-series-options').innerHTML = option({key:'',label:'全部系列',count:available.length}) + categories.map(branch).join('');
    if (revealSelection && selected) requestAnimationFrame(() => {
      const target = $('friend-series-options')?.querySelector('.series-option.selected');
      if (target) $('friend-series-options').scrollTop = target.offsetTop - $('friend-series-options').offsetTop - $('friend-series-options').clientHeight / 2 + target.clientHeight / 2;
    });
  }
  function renderFriendFilterDisclosure() {
    const count = ['friend-character','friend-region','friend-type','friend-series'].filter(id => $(id).value).length;
    $('friend-filter-options').hidden = !friendFiltersExpanded;
    $('friend-filter-toggle').setAttribute('aria-expanded',String(friendFiltersExpanded));
    $('friend-filter-toggle').setAttribute('aria-label',(friendFiltersExpanded ? '收合' : '展開') + '角色、地區、種類與系列篩選' + (count ? '，已套用 ' + count + ' 個條件' : ''));
    $('friend-filter-toggle-label').textContent = friendFiltersExpanded ? '收合篩選' : '篩選';
    $('friend-filter-count').hidden = !count;
    $('friend-filter-count').textContent = String(count);
    $('friend-series-label').textContent = $('friend-series').value ? seriesLabel($('friend-series').value) : '全部系列';
    $('friend-series-toggle').setAttribute('aria-label','篩選系列：' + $('friend-series-label').textContent);
    const filters = [['friend-character','角色'],['friend-region','地區'],['friend-type','種類'],['friend-series','系列'],['friend-search','搜尋']];
    $('friend-active-filters').innerHTML = filters.filter(([id]) => $(id).value).map(([id,label]) => '<button type="button" class="filter-chip" data-friend-remove-filter="' + id + '" aria-label="移除' + label + '篩選">' + h(label + '：' + (id === 'friend-type' ? typeLabel($(id).value) : id === 'friend-series' ? seriesLabel($(id).value) : $(id).value)) + catalogIcon('close') + '</button>').join('');
    $('friends-content').querySelectorAll('[data-friend-ownership]').forEach(button => {
      const active = button.dataset.friendOwnership === friendOwnership;
      button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active));
    });
  }
  function friendProductCard(item) {
    const mine = getSaved().quantities[item.id] || 0, theirs = friendSnapshot.quantities[item.id] || 0;
    const owned = theirs > 0, wished = !owned && friendTab === 'wishlist';
    const name = h(item.character + '・' + item.name);
    const detail = ' data-friend-detail="' + h(item.id) + '" aria-label="查看' + name + '的詳細資訊" aria-haspopup="dialog" aria-controls="detail-dialog"';
    return '<article class="product-card friend-product' + (owned ? ' owned' : wished ? ' wished' : '') + '" data-friend-item="' + h(item.id) + '"><div class="product-visual"><button type="button" class="product-image-button friend-product-image"' + detail + '><div class="product-image"><img src="' + safeImage(item.image) + '" alt="' + name + '" width="200" height="200" loading="lazy" decoding="async"></div></button>' +
      (owned ? '<span class="collect-button owned friend-status" role="img" aria-label="好友收藏 ' + n(theirs) + ' 個" title="好友收藏 ' + n(theirs) + ' 個">' + catalogIcon('heart') + '</span>' : wished ? '<span class="wish-button wished friend-status" role="img" aria-label="好友想收藏">' + catalogIcon('star') + '</span>' : '') +
      '</div><div class="product-meta"><h3 class="product-name" title="' + h(item.name) + '">' + h(item.name) + '</h3><button type="button" class="product-info-button friend-product-info"' + detail + '>' + catalogIcon('info') + '</button></div>' +
      (friendTab === 'compare' ? '<p class="friend-comparison-quantity">我 ' + n(mine) + ' 個・對方 ' + n(theirs) + ' 個</p>' : '') + '</article>';
  }
  function renderFriendProducts() {
    if (!friendSnapshot || !$('friend-products')) return;
    renderFriendFilterDisclosure();
    if (friendTab === 'wishlist' && friendSnapshot.wishlist === null) {
      $('friend-results-count').textContent = '';
      $('friend-products').innerHTML = '<div class="social-empty"><strong>願望清單暫時無法讀取</strong><p>請稍後再試。</p><button class="primary-button" data-action="retry-friend-collection">重新讀取</button></div>';
      return;
    }
    const scope = friendProductScope(), filtered = friendFilteredItems();
    $('friend-results-count').textContent = (friendTab === 'wishlist' ? '想收藏 ' : '顯示 ') + n(filtered.length) + ' 款' + (friendTab === 'collection' ? '・共 ' + n(filtered.reduce((sum,item) => sum+(friendSnapshot.quantities[item.id] || 0),0)) + ' 個' : '');
    const grouping = $('friend-grouping').value || 'character';
    const groups = groupItems(filtered,grouping,characters,seriesTree);
    $('friend-products').innerHTML = filtered.length ? groups.map(group => '<section class="catalog-group"><div class="group-heading"><h3>' + h(grouping === 'series' ? seriesLabel(group.name) : group.name) + '</h3><span class="group-counts">' + n(group.items.length) + ' 款</span><div class="group-line"></div></div><div class="product-grid">' + group.items.map(friendProductCard).join('') + '</div></section>').join('') : '<div class="social-empty"><strong>' + (friendTab === 'wishlist' && !scope.length ? '他的願望清單還沒有娃' : '沒有符合條件的娃') + '</strong><p>' + (friendTab === 'wishlist' && !scope.length ? '之後想收藏的娃會顯示在這裡。' : '可以切換檢視項目，或調整篩選條件。') + '</p></div>';
    if (!$('friend-series-panel').hidden) renderFriendSeriesOptions();
    $('friends-content').querySelectorAll('[data-compare-tab]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.compareTab === compareTab)));
  }
  $('friends-content').addEventListener('submit',event => {
    if (event.target.id !== 'find-friend-form') return; event.preventDefault();
    void action(event.submitter,async () => {
      const code = normalizeFriendCode($('friend-code-input').value);
      if (code.length !== 12) { message('friends-message','請輸入完整的 12 碼好友代碼。',true); return; }
      const generation = ++friendLookupGeneration;
      let found;
      try { found = await rpc('lookup_collection_friend',{ p_code:code }); }
      catch (error) { if (generation === friendLookupGeneration) throw error; return; }
      if (generation !== friendLookupGeneration || normalizeFriendCode($('friend-code-input')?.value) !== code) return;
      lookup = { ...found, code }; renderFriends();
    },'friends-message');
  });
  $('friends-content').addEventListener('input',event => {
    if (event.target.id === 'friend-search') renderFriendProducts();
    if (event.target.id === 'friend-series-search') renderFriendSeriesOptions();
    if (event.target.id === 'friend-code-input') {
      friendLookupGeneration++; lookup = null; $('friend-lookup-result').replaceChildren();
      $('clear-friend-code').hidden = !event.target.value;
      message('friends-message','');
    }
  });
  $('friends-content').addEventListener('change',event => { if (['friend-character','friend-region','friend-type','friend-series','friend-grouping'].includes(event.target.id)) {
      if (event.target.id === 'friend-series' && event.target.value) $('friend-grouping').value = 'series';
      renderFriendProducts();
    } });
  function clearFriendLookup() {
    friendLookupGeneration++; lookup = null;
    sessionStorage.removeItem('chiikawa-pending-friend');
    const input = $('friend-code-input'); if (input) input.value = '';
    const clearButton = $('clear-friend-code'); if (clearButton) clearButton.hidden = true;
    $('friend-lookup-result')?.replaceChildren();
    message('friends-message','');
  }
  $('friends-content').addEventListener('click',event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.friendDetail) {
      const id = button.dataset.friendDetail;
      if (items.some(item => item.id === id) && onOpenDetail) { friendDetailOrigin = id; onOpenDetail(id); }
    } else if (button.id === 'clear-friend-code') {
      clearFriendLookup();
      $('friend-code-input').focus({ preventScroll:true });
    } else if (button.dataset.viewFriend) {
      selectedFriend = friends.find(friend => friend.id === button.dataset.viewFriend && friend.status === 'accepted');
      friendAnalysisOpen = false; friendAnalysisTab = 'characters'; friendAnalysisExpanded = false; friendCollectionScroll = 0;
      friendFiltersExpanded = false; friendOwnership = 'all'; friendSeriesBranches.clear();
      friendTab = 'collection'; compareTab = 'both'; friendConfirmation = null; void loadFriendSnapshot();
    } else if (button.id === 'friend-filter-toggle') { friendFiltersExpanded = !friendFiltersExpanded; renderFriendFilterDisclosure(); }
    else if (button.dataset.friendOwnership) { friendOwnership = button.dataset.friendOwnership; renderFriendProducts(); }
    else if (button.dataset.friendRemoveFilter) { $(button.dataset.friendRemoveFilter).value = ''; renderFriendProducts(); }
    else if (button.id === 'friend-series-toggle') {
      const show = $('friend-series-panel').hidden;
      $('friend-series-panel').hidden = !show; button.setAttribute('aria-expanded',String(show));
      if (show) { $('friend-series-search').value = ''; renderFriendSeriesOptions(true); }
    } else if (button.dataset.friendSeriesBranch) {
      const id = button.dataset.friendSeriesBranch;
      if (friendSeriesBranches.has(id)) friendSeriesBranches.delete(id); else friendSeriesBranches.add(id);
      renderFriendSeriesOptions();
    } else if (button.hasAttribute('data-friend-series')) {
      $('friend-series').value = button.dataset.friendSeries;
      if (button.dataset.friendSeries) $('friend-grouping').value = 'series';
      $('friend-series-panel').hidden = true; $('friend-series-toggle').setAttribute('aria-expanded','false');
      renderFriendProducts(); $('friend-series-toggle').focus({preventScroll:true});
    }
    else if (button.dataset.action === 'open-friend-analysis') { setFriendAnalysis(true); }
    else if (button.dataset.action === 'back-friend-collection') { setFriendAnalysis(false); }
    else if (button.dataset.friendAnalysisTab) {
      friendAnalysisTab = button.dataset.friendAnalysisTab; friendAnalysisExpanded = false; renderFriendAnalysis();
      $('friends-content').querySelector('[data-friend-analysis-tab="' + friendAnalysisTab + '"]')?.focus({ preventScroll:true });
    } else if (button.dataset.action === 'toggle-friend-analysis') {
      friendAnalysisExpanded = !friendAnalysisExpanded; renderFriendAnalysis();
      $('friends-content').querySelector('[data-action="toggle-friend-analysis"]')?.focus({ preventScroll:true });
    } else if (button.dataset.friendTab) { friendTab = button.dataset.friendTab; renderFriendDetail(); }
    else if (button.dataset.compareTab) { compareTab = button.dataset.compareTab; renderFriendProducts(); }
    else if (button.dataset.action === 'back-friends') { selectedFriend = null; friendSnapshot = null; renderFriends(); }
    else if (button.dataset.action === 'refresh-friends') void refreshFriends();
    else if (button.dataset.action === 'retry-friend-collection') void loadFriendSnapshot();
    else if (button.dataset.action === 'friend-settings') {
      $('friend-settings').hidden = !$('friend-settings').hidden;
      button.setAttribute('aria-expanded',String(!$('friend-settings').hidden));
    }
    else if (button.dataset.confirmFriend && selectedFriend) {
      friendConfirmation = button.dataset.confirmFriend;
      $('friend-confirmation').innerHTML = '<div class="social-confirm"><strong>' + (friendConfirmation === 'block' ? '封鎖' : '移除') + h(selectedFriend.nickname) + '？</strong><p>' + (friendConfirmation === 'block' ? '彼此將停止分享收藏，也無法再送出好友邀請。' : '彼此將停止分享收藏，之後仍可重新加入好友。') + '</p><div><button class="secondary-button" data-action="cancel-friend-confirmation">先保留</button><button class="danger-button" data-action="confirm-friend-change">確認' + (friendConfirmation === 'block' ? '封鎖' : '移除') + '</button></div></div>';
    } else if (button.dataset.action === 'cancel-friend-confirmation') { friendConfirmation = null; $('friend-confirmation').innerHTML = ''; }
    else if (button.dataset.action === 'confirm-friend-change' && selectedFriend && friendConfirmation) {
      void action(button,async () => {
        if (friendConfirmation === 'block') await rpc('block_collection_user',{ p_other_id:selectedFriend.other_id });
        else await rpc('respond_collection_friend',{ p_friendship_id:selectedFriend.id, p_action:'remove' });
        selectedFriend = null; friendSnapshot = null; friendConfirmation = null; await refreshFriends(); renderFriends(); toast('好友關係已更新，已停止分享收藏');
      },'friends-message');
    } else if (button.dataset.response) {
      void action(button,async () => {
        await rpc('respond_collection_friend',{ p_friendship_id:button.dataset.friendId, p_action:button.dataset.response });
        await refreshFriends(); toast(button.dataset.response === 'accept' ? '已成為好友，可以互相欣賞收藏了' : '好友邀請已更新');
      },'friends-message');
    } else if (button.id === 'send-friend-request' && lookup) {
      void action(button,async () => {
        await rpc('request_collection_friend',{ p_code:lookup.code }); lookup = null; sessionStorage.removeItem('chiikawa-pending-friend'); await refreshFriends(); renderFriends(); message('friends-message','邀請已送出，等待對方接受。');
      },'friends-message');
    } else if (button.dataset.unblock) {
      void action(button,async () => { await rpc('unblock_collection_user',{ p_other_id:button.dataset.unblock }); await refreshFriends(); toast('已解除封鎖'); },'friends-message');
    }
  });
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('已複製'); }
    catch { toast('暫時無法複製，請長按好友代碼複製'); }
  }
  document.addEventListener('click',event => {
    const button = event.target.closest('[data-action]');
    if (!profile?.friend_code || !button) return;
    if (button.dataset.action === 'copy-code') void copyText(formatFriendCode(profile.friend_code));
    if (button.dataset.action === 'copy-invite') void copyText(createFriendInviteURL(canonicalURL(),profile.friend_code));
  });
  function getViewState() {
    if (pendingView) return pendingView;
    return {
      userId:user?.id || null, open:$('friends-dialog').open ? 'friends' : $('account-dialog').open ? 'account' : null,
      friendId:selectedFriend?.other_id || null, friendTab, compareTab,
      friendAnalysisOpen, friendAnalysisTab, friendAnalysisExpanded, friendCollectionScroll, friendFiltersExpanded, friendOwnership,
      filters:Object.fromEntries(friendFilterIds.map(id => [id,$(id)?.value || ''])),
      scroll:$('friends-dialog').scrollTop,
    };
  }
  async function restoreView() {
    const view = pendingView;
    if (!view) return;
    try {
      if (view.userId !== (user?.id || null)) return;
      if (view.open === 'account') { renderAccount(); open('account-dialog'); return; }
      if (view.open !== 'friends' || !user || !profile?.nickname || document.querySelector('dialog[open]')) return;
      // 先備妥指定好友、檢視與篩選，再一次開啟目的畫面。
      await refreshFriends();
      if (view.userId !== (user?.id || null)) return;
      selectedFriend = friends.find(friend => friend.other_id === view.friendId && friend.status === 'accepted') || null;
      if (selectedFriend) {
        friendTab = ['collection','compare','wishlist'].includes(view.friendTab) ? view.friendTab : 'collection';
        compareTab = ['both','theirsOnly','mineOnly'].includes(view.compareTab) ? view.compareTab : 'both';
        friendAnalysisOpen = Boolean(view.friendAnalysisOpen);
        friendAnalysisTab = ['characters','types','progress'].includes(view.friendAnalysisTab) ? view.friendAnalysisTab : 'characters';
        friendAnalysisExpanded = Boolean(view.friendAnalysisExpanded);
        friendFiltersExpanded = Boolean(view.friendFiltersExpanded);
        friendOwnership = ['all','owned','unowned'].includes(view.friendOwnership) ? view.friendOwnership : 'all';
        friendCollectionScroll = Number(view.friendCollectionScroll) || 0;
        await loadFriendSnapshot(false, false);
        if (view.userId !== (user?.id || null)) return;
      }
      if (selectedFriend && friendSnapshot) renderFriendDetail(view.filters);
      else renderFriends();
      open('friends-dialog');
      $('friends-dialog').scrollTop = Number(view.scroll) || 0;
    } finally { pendingView = null; }
  }
  async function loadProfile(current) {
    if (!user) return;
    if (profileRequest?.generation === current) return profileRequest.promise;
    const activeUid = user.id;
    const work = async () => {
      try {
        const result = await client.from('profiles').select('id,nickname,avatar_path,friend_code').eq('id',activeUid).single();
        if (current !== sessionGeneration) return;
        if (result.error) throw result.error;
        profile = result.data; saveLocalProfile(storage,profile); profileError = '';
        authLoading = false; renderSync();
        // 背景更新不重建正在編輯的表單，也不關閉使用者剛開啟的個人資料。
        if (!profile.nickname) {
          if (!$('profile-form')) renderAccount();
          if (!$('account-dialog').open) open('account-dialog');
        } else {
          if (sessionConfirmed) store.enableWrites();
          if ($('account-dialog').open && !$('profile-form')) renderAccount();
          const migrating = maybeOfferMigration();
          if (pendingView && !migrating) await restoreView(); else void refreshFriends();
          if (current !== sessionGeneration) return;
          if (!migrating && (pendingHub || sessionStorage.getItem('chiikawa-pending-friend'))) { pendingHub = false; showFriends(); }
        }
        void photos.load([profile.avatar_path]).then(() => {
          if (current === sessionGeneration && avatarDraft === undefined && $('profile-avatar-preview')) $('profile-avatar-preview').innerHTML = avatar(profile,'large',true);
        });
      } catch (error) {
        if (current !== sessionGeneration) return;
        authLoading = false; profileError = '帳號資料暫時無法更新，收藏會保留在這台裝置，連線恢復後會再試一次。';
        if (!$('profile-form')) renderAccount();
        renderSync();
      } finally { if (current === sessionGeneration) { collectionReady(); viewReady(); } }
    };
    const promise = work();
    profileRequest = {generation:current,promise};
    try { await promise; } finally { if (profileRequest?.promise === promise) profileRequest = null; }
  }
  async function handleSession(session, local = false) {
    const nextUser = session?.user || null;
    if (sessionStarted && user?.id === nextUser?.id) {
      user = nextUser;
      if (!local && !sessionConfirmed) { sessionConfirmed = true; if (profile?.nickname) store.enableWrites(); }
      return;
    }
    sessionStarted = true; sessionConfirmed = !local;
    const current = ++sessionGeneration;
    resetAvatarDraft(); photos.clear();
    user = nextUser; profile = user ? readLocalProfile(storage,user.id) : null; profileError = '';
    authLoading = Boolean(user && !profile); friends = []; blocks = []; friendsLoaded = false; friendsError = ''; renderBadge();
    if (!user) {
      store.close(); authLoading = false;
      if ($('friends-dialog').open) $('friends-dialog').close();
      if ($('migration-dialog').open) $('migration-dialog').close();
      if ($('sync-conflict-dialog').open) $('sync-conflict-dialog').close();
      collectionReady(); await restoreView(); viewReady();
      renderSync(); if ($('account-dialog').open || pendingHub) { renderAccount(); open('account-dialog'); } return;
    }
    void store.open(user.id,false);
    collectionReady(); renderSync();
    if ($('account-dialog').open) renderAccount();
    if (profile?.nickname) {
      if (sessionConfirmed) store.enableWrites();
      if (pendingView?.open === 'account') { await restoreView(); viewReady(); }
      else if (pendingView?.open !== 'friends') viewReady();
    }
    if (current === sessionGeneration) void loadProfile(current);
  }
  const invite = normalizeFriendCode(new URL(location.href).searchParams.get('friend'));
  if (invite.length === 12) { sessionStorage.setItem('chiikawa-pending-friend',invite); const url = new URL(location.href); url.searchParams.delete('friend'); history.replaceState(null,'',url); pendingHub = true; }
  const localSession = readLocalSession(storage);
  if (localSession) void handleSession(localSession,true);
  let authEvents = 0;
  const sessionError = () => { authLoading = false; renderSync(); collectionReady(); viewReady(); };
  const { data:authSubscription } = client.auth.onAuthStateChange((event, session) => {
    authEvents++;
    setTimeout(() => {
      // 初始連線失敗也可能回報空帳號；仍有登入紀錄時先沿用本機資料。
      if (event === 'INITIAL_SESSION' && !session && user && readLocalSession(storage)?.user.id === user.id) { sessionError(); return; }
      void handleSession(session);
    },0);
  });
  const initialAuthEvents = authEvents;
  void client.auth.getSession().then(({ data, error }) => { if (initialAuthEvents !== authEvents) return; if (error) sessionError(); else void handleSession(data.session); }).catch(sessionError);
  const refresh = () => { if (user && !document.hidden) { void store.sync(); void refreshFriends(); if (profileError) void loadProfile(sessionGeneration); } };
  window.addEventListener('online',refresh);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',refresh);
  const poll = setInterval(refresh,30000);
  renderSync(); renderBadge();
  return {
    get client() { return client; },
    collectionReady:collectionReadyPromise,
    ready,
    getViewState,
    capture(saved) {
      store.capture(saved);
      if (selectedFriend && friendSnapshot && $('friends-dialog').open) renderFriendDetail();
    },
    get userId() { return store.userId; },
    destroy() { clearInterval(poll); resetAvatarDraft(); photos.clear(); authSubscription.subscription.unsubscribe(); store.destroy(); },
  };
}
