import { createClient } from './supabase-client.mjs?v=c1809ced1e097cac';
import { cloudConfig } from './cloud-config.mjs?v=c1809ced1e097cac';
import { createCloudStore } from './cloud-store.mjs?v=c1809ced1e097cac';
import { createAvatarStore, prepareAvatar } from './avatar-store.mjs?v=c1809ced1e097cac';
import { STORAGE_KEY, ITEM_TYPES, typeLabel, filterItems } from './model.mjs?v=c1809ced1e097cac';
import { normalizeNickname, validNickname, normalizeFriendCode, formatFriendCode, collectionStats, compareCollections, notificationCount } from './social-model.mjs?v=c1809ced1e097cac';

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

export function createAccountHub({ items, characters, getSaved, applySaved, normalize, merge, onScope, toast, client:clientOverride }) {
  const client = clientOverride || createClient(cloudConfig.url, cloudConfig.publishableKey, {
    auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:'pkce', storageKey:'chiikawa-account-session' },
  });
  let user = null, profile = null, authLoading = true, sessionGeneration = 0;
  let friends = [], notifications = [], blocks = [], friendsLoaded = false, friendsError = '', refreshingFriends = false;
  let selectedFriend = null, friendSnapshot = null, lookup = null, friendTab = 'collection', compareTab = 'both', friendConfirmation = null;
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
  const canonicalURL = () => location.origin + location.pathname;
  const dateText = value => new Intl.DateTimeFormat('zh-TW', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Taipei' }).format(new Date(value));
  const rpc = async (name, args = {}) => { const result = await client.rpc(name, args); if (result.error) throw result.error; return result.data; };
  const message = (id, text, error = false) => { const target = $(id); if (target) { target.textContent = text; target.classList.toggle('error', error); } };
  const open = id => { const dialog = $(id); if (!dialog.open) dialog.showModal(); };
  const closeMenu = () => { $('more-menu').hidden = true; $('more-button').setAttribute('aria-expanded','false'); };

  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="account-dialog" class="panel-dialog account-dialog" aria-labelledby="account-title"><div id="account-content"></div></dialog>
    <dialog id="friends-dialog" class="panel-dialog friends-dialog" aria-labelledby="friends-title"><div id="friends-content"></div></dialog>
    <dialog id="migration-dialog" class="panel-dialog account-dialog" aria-labelledby="migration-title"><div class="dialog-heading"><h2 id="migration-title">帶入原有收藏</h2>${closeButton('migration-dialog','關閉帶入收藏')}</div><p class="dialog-description">將這台裝置原本的收藏加入目前帳號。同款數量保留較大的紀錄，重複帶入不會累加。</p><div id="migration-summary" class="migration-summary"></div><p class="social-note">確認儲存成功前，原本的本機紀錄會繼續保留。</p><p id="migration-message" class="form-message" role="status"></p><div class="confirm-actions"><button class="secondary-button" id="skip-migration">暫時略過</button><button class="primary-button" id="confirm-migration">加入帳號</button></div></dialog>
    <dialog id="sync-conflict-dialog" class="panel-dialog account-dialog" aria-labelledby="sync-conflict-title"><div class="dialog-heading"><h2 id="sync-conflict-title">確認同步差異</h2>${closeButton('sync-conflict-dialog','關閉同步差異')}</div><p class="dialog-description">這些紀錄也在其他裝置更新過。請選擇要保留的版本，其他收藏會照常同步。</p><div id="sync-conflict-content"></div></dialog>
  `);
  for (const id of ['account-dialog','friends-dialog','migration-dialog','sync-conflict-dialog']) {
    $(id).addEventListener('click', event => {
      if (event.target !== $(id)) return;
      if (id === 'account-dialog' && user && !profile?.nickname) return;
      const rect = $(id).getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $(id).close();
    });
  }
  $('account-dialog').addEventListener('cancel', event => { if (user && !profile?.nickname) event.preventDefault(); });
  $('account-dialog').addEventListener('close', () => { resetAvatarDraft(); if (!user || profile?.nickname) $('more-button').focus({ preventScroll:true }); });
  $('friends-dialog').addEventListener('close', () => { selectedFriend = null; friendSnapshot = null; $('more-button').focus({ preventScroll:true }); });

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
    $('data-description').textContent = user ? '收藏數量、願望清單、角色順序與收藏設定會與帳號同步，也可以另外匯出備份。' : '目前收藏儲存在這台裝置。登入帳號後，可以在手機與電腦接續使用，也能繼續匯出備份。';
    const inline = $('profile-sync-status');
    if (inline) inline.textContent = label;
  }
  function renderBadge() {
    const count = user ? notificationCount(friends, notifications) : 0;
    const incoming = friends.filter(friend => friend.status === 'pending' && friend.incoming).length;
    $('more-notification-dot').hidden = !count;
    $('friends-menu-badge').hidden = !count;
    $('friends-menu-badge').textContent = incoming ? n(incoming) + ' 則邀請' : n(count) + ' 則新通知';
    $('more-button').setAttribute('aria-label', '更多選項' + (count ? '，有 ' + n(count) + ' 則待處理或未讀通知' : ''));
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
        profile = result.data; resetAvatarDraft(); await photos.load([profile.avatar_path]);
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
    if (!guest.owned.length && !guest.wishlist.length || handled) return;
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
      const item = items.find(item => item.id === conflict.id);
      return '<section class="conflict-row"><h3>' + (conflict.id === '__settings' ? '角色順序與收藏設定' : h(item ? item.character + '・' + item.name : '收藏紀錄')) + '</h3><div class="conflict-choices"><button class="secondary-button" data-conflict="' + h(conflict.id) + '" data-choice="local">保留這台裝置' + (item ? '<small>' + describe(conflict.local) + '</small>' : '') + '</button><button class="secondary-button" data-conflict="' + h(conflict.id) + '" data-choice="remote">保留帳號版本' + (item ? '<small>' + describe(conflict.remote) + '</small>' : '') + '</button></div></section>';
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
      const [nextFriends, noteResult, nextBlocks] = await Promise.all([
        rpc('list_collection_friends'),
        client.from('notifications').select('id,actor_id,actor_nickname,kind,read_at,created_at').order('read_at',{ ascending:true, nullsFirst:true }).order('created_at',{ ascending:false }).limit(50),
        rpc('list_collection_blocks'),
      ]);
      if (user?.id !== activeUid) return;
      if (noteResult.error) throw noteResult.error;
      await photos.load([profile?.avatar_path,...(nextFriends || []).filter(friend => friend.status === 'accepted').map(friend => friend.avatar_path)]);
      if (user?.id !== activeUid) return;
      friends = nextFriends || []; notifications = noteResult.data || []; blocks = nextBlocks || [];
      friendsLoaded = true; friendsError = ''; renderBadge();
      if ($('friends-dialog').open && !selectedFriend) renderFriends();
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
    return '<div class="friend-row">' + avatar(friend) + '<div class="friend-row-info"><strong>' + h(friend.nickname || '收藏好友') + '</strong><span>' + (type === 'accepted' ? '看看收藏與彼此的差異' : type === 'incoming' ? '想與你分享收藏' : '等待對方接受') + '</span></div>' +
      (type === 'accepted' ? '<button class="secondary-button" data-view-friend="' + h(friend.id) + '">查看</button>' : type === 'incoming' ? '<div class="friend-row-actions"><button class="text-button" data-friend-id="' + h(friend.id) + '" data-response="decline">婉拒</button><button class="primary-button" data-friend-id="' + h(friend.id) + '" data-response="accept">接受</button></div>' : '<button class="text-button" data-friend-id="' + h(friend.id) + '" data-response="cancel">取消邀請</button>') + '</div>';
  }
  function renderFriends() {
    if (selectedFriend && friendSnapshot) { renderFriendDetail(); return; }
    const incoming = friends.filter(friend => friend.status === 'pending' && friend.incoming);
    const outgoing = friends.filter(friend => friend.status === 'pending' && !friend.incoming);
    const accepted = friends.filter(friend => friend.status === 'accepted');
    const news = notifications.filter(note => note.kind === 'friend_accepted');
    const codeInput = $('friend-code-input');
    const restoreCodeFocus = document.activeElement === codeInput;
    const selection = restoreCodeFocus ? [codeInput.selectionStart,codeInput.selectionEnd] : null;
    const codeValue = codeInput?.value || sessionStorage.getItem('chiikawa-pending-friend') || '';
    $('friends-content').innerHTML = '<div class="dialog-heading"><div><span class="social-eyebrow">一起收集喜歡的娃</span><h2 id="friends-title">好友</h2></div>' + closeButton('friends-dialog','關閉好友') + '</div><p class="sharing-note">成為好友後，你們可以互相查看收藏清單、數量與進度，並比較彼此的收藏差異。</p>' +
      '<div class="my-friend-code"><span>我的好友代碼</span><div><code>' + h(formatFriendCode(profile?.friend_code)) + '</code><button class="text-button" data-action="copy-code">複製</button><button class="text-button" data-action="copy-invite">分享連結</button></div></div>' +
      '<form id="find-friend-form" class="find-friend-form"><label for="friend-code-input">加入好友</label><div><input id="friend-code-input" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" placeholder="輸入好友代碼" maxlength="20" value="' + h(codeValue) + '" required><button class="secondary-button" type="submit">尋找</button></div></form><div id="friend-lookup-result">' + (lookup ? '<div class="friend-row">' + avatar(lookup) + '<div class="friend-row-info"><strong>' + h(lookup.nickname) + '</strong><span>接受邀請後，彼此分享收藏</span></div><button class="primary-button" id="send-friend-request">送出邀請</button></div>' : '') + '</div><p id="friends-message" class="form-message" role="status"></p>' +
      (friendsError ? '<div class="social-error"><p>' + h(friendsError) + '</p><button class="secondary-button" data-action="refresh-friends">重新讀取</button></div>' : !friendsLoaded ? '<p class="social-loading" role="status">正在讀取好友…</p>' : '') +
      (incoming.length ? '<section class="friends-section"><h3>收到的邀請 <span class="section-count">' + n(incoming.length) + '</span></h3>' + incoming.map(friend => friendRow(friend,'incoming')).join('') + '</section>' : '') +
      '<section class="friends-section"><h3>我的好友 <span class="section-count">' + n(accepted.length) + '</span></h3>' + (accepted.length ? accepted.map(friend => friendRow(friend,'accepted')).join('') : friendsLoaded ? '<div class="social-empty"><strong>一起分享收藏的樂趣</strong><p>把好友代碼分享給朋友，或輸入對方的代碼，邀請彼此成為收藏好友。</p></div>' : '') + '</section>' +
      (outgoing.length ? '<section class="friends-section"><h3>已送出的邀請</h3>' + outgoing.map(friend => friendRow(friend,'outgoing')).join('') + '</section>' : '') +
      (news.length ? '<section class="friends-section"><h3>最新通知</h3>' + news.map(note => '<div class="notification-row ' + (!note.read_at ? 'unread' : '') + '"><div><strong>' + h(note.actor_nickname) + ' 已接受你的好友邀請</strong><span>' + dateText(note.created_at) + '</span></div>' + (!note.read_at ? '<button class="text-button" data-read-notification="' + h(note.id) + '">知道了</button>' : '<span class="social-note">已讀</span>') + '</div>').join('') + '</section>' : '') +
      (blocks.length ? '<details class="blocked-list"><summary>封鎖名單（' + n(blocks.length) + '）</summary>' + blocks.map(block => '<div class="friend-row"><div class="friend-row-info"><strong>' + h(block.nickname) + '</strong></div><button class="text-button" data-unblock="' + h(block.id) + '">解除封鎖</button></div>').join('') + '<p class="social-note">解除封鎖後，需要重新加入好友才會分享收藏。</p></details>' : '');
    if (restoreCodeFocus) { $('friend-code-input').focus({ preventScroll:true }); $('friend-code-input').setSelectionRange(...selection); }
  }
  async function loadFriendSnapshot(showLoading = true) {
    if (!selectedFriend || !user) return;
    const activeUid = user.id, selectedId = selectedFriend.other_id;
    if (showLoading) $('friends-content').innerHTML = '<div class="dialog-heading"><h2 id="friends-title">好友收藏</h2>' + closeButton('friends-dialog','關閉好友收藏') + '</div><p class="social-loading" role="status">正在整理收藏…</p>';
    try {
      const result = await rpc('get_friend_collection',{ p_friend_id:selectedId });
      if (user?.id !== activeUid || selectedFriend?.other_id !== selectedId) return;
      await photos.load([result.profile?.avatar_path]);
      if (user?.id !== activeUid || selectedFriend?.other_id !== selectedId) return;
      const previous = JSON.stringify(friendSnapshot);
      const normalized = normalize({ quantities:Object.fromEntries(result.items.map(row => [row.item_id,row.quantity])) });
      friendSnapshot = { profile:result.profile, quantities:normalized.quantities };
      if (showLoading || previous !== JSON.stringify(friendSnapshot)) renderFriendDetail();
    } catch (error) {
      if (selectedFriend?.other_id !== selectedId) return;
      selectedFriend = null; friendSnapshot = null; renderFriends(); message('friends-message',errorText(error),true);
    }
  }
  function statsList(rows, mode = 'ratio') {
    return '<div class="stats-list">' + rows.slice(0,3).map(row => '<div class="stat-line"><div><span>' + h(row.label) + '</span><strong>' + (mode === 'progress' ? n(row.count) + '／' + n(row.total) + ' 款' : n(row.count) + ' 款 <small>' + percentage(row.ratio) + '</small>') + '</strong></div><span class="stat-track"><span style="width:' + (100 * (mode === 'progress' ? row.count/row.total : row.ratio)).toFixed(2) + '%"></span></span></div>').join('') + '</div>';
  }
  function renderFriendDetail() {
    if (!friendSnapshot || !selectedFriend) return;
    const previousFilters = Object.fromEntries(['friend-search','friend-character','friend-type','friend-series'].map(id => [id,$(id)?.value || '']));
    const previousScroll = $('friends-dialog').scrollTop;
    const { profile:other, quantities } = friendSnapshot;
    const stats = collectionStats(items,quantities), myStats = collectionStats(items,getSaved().quantities);
    const differences = compareCollections(items,getSaved().quantities,quantities);
    const character = stats.characters[0], type = stats.types[0];
    const myCharacter = myStats.characters[0];
    $('friends-content').innerHTML = '<div class="dialog-heading"><div class="friend-detail-heading"><button class="icon-button" data-action="back-friends" aria-label="返回好友清單"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><h2 id="friends-title">' + h(other.nickname) + '的收藏</h2></div>' + closeButton('friends-dialog','關閉好友收藏') + '</div>' +
      '<div class="friend-profile">' + avatar(other,'large') + '<div><strong>' + h(other.nickname) + '</strong><p>已收藏 <b>' + n(stats.styles) + '</b> 款，共 <b>' + n(stats.pieces) + '</b> 個</p></div><button class="text-button" data-action="friend-settings">好友設定</button></div>' +
      '<div id="friend-settings" class="friend-settings" hidden><button class="text-button" data-confirm-friend="remove">移除好友</button><button class="text-button" data-confirm-friend="block">封鎖這位使用者</button></div><div id="friend-confirmation"></div><p id="friends-message" class="form-message" role="status"></p>' +
      '<p class="collection-story">' + (stats.styles ? '收藏以<strong>' + h(character.label) + '</strong>為主，最常收<strong>' + h(type.label) + '</strong>。' + (stats.multiples ? '有 ' + n(stats.multiples) + ' 款擁有不只一個。' : '') : '收藏旅程剛開始，期待新的娃加入。') + '</p>' +
      (stats.styles ? '<div class="friend-stats-grid"><section class="friend-stat-card"><h3>最常收的角色</h3>' + statsList(stats.characters) + '</section><section class="friend-stat-card"><h3>收藏種類比例</h3>' + statsList(stats.types) + '<p class="social-note">以已收藏款數計算</p></section><section class="friend-stat-card progress-stat-card"><h3>種類收集進度</h3>' + statsList(stats.types,'progress') + '<p class="social-note">以完整圖鑑中各種類的款數計算</p></section></div>' : '') +
      '<div class="friend-view-tabs" role="group" aria-label="好友收藏檢視"><button data-friend-tab="collection" aria-pressed="' + (friendTab === 'collection') + '">他的收藏</button><button data-friend-tab="compare" aria-pressed="' + (friendTab === 'compare') + '">收藏比較</button></div>' +
      (friendTab === 'compare' ? '<div class="comparison-intro"><p>你們共同收藏了 <strong>' + n(differences.both.length) + '</strong> 款。</p>' + (myCharacter && character ? '<p class="social-note">你最常收' + h(myCharacter.label) + '，對方最常收' + h(character.label) + '。</p>' : '') + '<div class="comparison-counts"><span>你：' + n(myStats.styles) + ' 款／' + n(myStats.pieces) + ' 個</span><span>對方：' + n(stats.styles) + ' 款／' + n(stats.pieces) + ' 個</span></div></div><div class="comparison-tabs" role="group" aria-label="比較收藏差異">' + [['both','我們都有'],['theirsOnly','他有，我還沒有'],['mineOnly','我有，他還沒有']].map(([key,label]) => '<button data-compare-tab="' + key + '" aria-pressed="' + (compareTab === key) + '">' + label + '<strong>' + n(differences[key].length) + '</strong></button>').join('') + '</div>' : '') +
      '<div class="friend-product-filters"><label class="visually-hidden" for="friend-search">搜尋好友收藏</label><input id="friend-search" type="search" placeholder="搜尋娃娃名稱或角色"><label class="visually-hidden" for="friend-character">篩選角色</label><select id="friend-character"><option value="">全部角色</option>' + characters.map(character => '<option value="' + h(character) + '">' + h(character) + '</option>').join('') + '</select><label class="visually-hidden" for="friend-type">篩選種類</label><select id="friend-type"><option value="">全部種類</option>' + ITEM_TYPES.map(type => '<option value="' + h(type) + '">' + h(typeLabel(type)) + '</option>').join('') + '</select><label class="visually-hidden" for="friend-series">篩選系列</label><select id="friend-series"><option value="">全部系列</option>' + [...new Set(items.filter(item => quantities[item.id] > 0 || friendTab === 'compare' && getSaved().quantities[item.id] > 0).map(item => item.name))].sort((a,b) => a.localeCompare(b,'zh-TW')).map(name => '<option value="' + h(name) + '">' + h(name) + '</option>').join('') + '</select></div><p id="friend-results-count" class="friend-results-count" role="status" aria-live="polite"></p><div id="friend-products" class="friend-products"></div>';
    for (const [id,value] of Object.entries(previousFilters)) { $(id).value = value; if ($(id).value !== value) $(id).value = ''; }
    renderFriendProducts();
    $('friends-dialog').scrollTop = previousScroll;
  }
  function renderFriendProducts() {
    if (!friendSnapshot || !$('friend-products')) return;
    const myQuantities = getSaved().quantities, theirQuantities = friendSnapshot.quantities;
    const scope = friendTab === 'collection' ? items.filter(item => theirQuantities[item.id]>0) : compareCollections(items,myQuantities,theirQuantities)[compareTab];
    const character = $('friend-character').value;
    const filtered = filterItems(scope.filter(item => !character || item.character === character),{ query:$('friend-search').value, type:$('friend-type').value, series:$('friend-series').value });
    $('friend-results-count').textContent = '顯示 ' + n(filtered.length) + ' 款' + (friendTab === 'collection' ? '・共 ' + n(filtered.reduce((sum,item) => sum+(theirQuantities[item.id] || 0),0)) + ' 個' : '');
    $('friend-products').innerHTML = filtered.length ? filtered.map(item => '<article class="friend-product"><div class="friend-product-image"><img src="' + safeImage(item.image) + '" alt="' + h(item.character + '・' + item.name) + '" width="200" height="200" loading="lazy" decoding="async"></div><small>' + h(item.character) + '・' + h(typeLabel(item.type)) + '</small><h3>' + h(item.name) + '</h3><p>' + (friendTab === 'collection' ? '收藏 ' + n(theirQuantities[item.id]) + ' 個' : '你 ' + n(myQuantities[item.id]) + ' 個・對方 ' + n(theirQuantities[item.id]) + ' 個') + '</p></article>').join('') : '<div class="social-empty"><strong>這裡還沒有娃</strong><p>可以切換比較項目，或調整篩選條件。</p></div>';
    $('friends-content').querySelectorAll('[data-compare-tab]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.compareTab === compareTab)));
  }
  $('friends-content').addEventListener('submit',event => {
    if (event.target.id !== 'find-friend-form') return; event.preventDefault();
    void action(event.submitter,async () => {
      const code = normalizeFriendCode($('friend-code-input').value);
      if (code.length !== 12) { message('friends-message','請輸入完整的 12 碼好友代碼。',true); return; }
      const found = await rpc('lookup_collection_friend',{ p_code:code });
      if (normalizeFriendCode($('friend-code-input')?.value) !== code) { message('friends-message','好友代碼已變更，請重新尋找。'); return; }
      lookup = { ...found, code }; renderFriends();
    },'friends-message');
  });
  $('friends-content').addEventListener('input',event => {
    if (event.target.id === 'friend-search') renderFriendProducts();
    if (event.target.id === 'friend-code-input') { lookup = null; $('friend-lookup-result').replaceChildren(); }
  });
  $('friends-content').addEventListener('change',event => { if (['friend-character','friend-type','friend-series'].includes(event.target.id)) renderFriendProducts(); });
  $('friends-content').addEventListener('click',event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.viewFriend) {
      selectedFriend = friends.find(friend => friend.id === button.dataset.viewFriend && friend.status === 'accepted');
      friendTab = 'collection'; compareTab = 'both'; friendConfirmation = null; void loadFriendSnapshot();
    } else if (button.dataset.friendTab) { friendTab = button.dataset.friendTab; renderFriendDetail(); }
    else if (button.dataset.compareTab) { compareTab = button.dataset.compareTab; renderFriendProducts(); }
    else if (button.dataset.action === 'back-friends') { selectedFriend = null; friendSnapshot = null; renderFriends(); }
    else if (button.dataset.action === 'refresh-friends') void refreshFriends();
    else if (button.dataset.action === 'friend-settings') $('friend-settings').hidden = !$('friend-settings').hidden;
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
    } else if (button.dataset.readNotification) {
      void action(button,async () => { await rpc('read_collection_notifications',{ p_ids:[button.dataset.readNotification] }); await refreshFriends(); },'friends-message');
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
    if (button.dataset.action === 'copy-invite') { const url = new URL(canonicalURL()); url.searchParams.set('friend',profile.friend_code); void copyText(url.href); }
  });
  async function handleSession(session) {
    const nextUser = session?.user || null;
    if (!authLoading && user?.id === nextUser?.id) { user = nextUser; return; }
    const current = ++sessionGeneration;
    resetAvatarDraft(); photos.clear();
    user = nextUser; profile = null; authLoading = true; friends = []; notifications = []; blocks = []; friendsLoaded = false; friendsError = ''; renderBadge();
    if (!user) {
      store.close(); authLoading = false;
      if ($('friends-dialog').open) $('friends-dialog').close();
      if ($('migration-dialog').open) $('migration-dialog').close();
      if ($('sync-conflict-dialog').open) $('sync-conflict-dialog').close();
      renderSync(); if ($('account-dialog').open || pendingHub) { renderAccount(); open('account-dialog'); } return;
    }
    try {
      const [profileResult] = await Promise.all([
        client.from('profiles').select('id,nickname,avatar_path,friend_code').eq('id',user.id).single(),
        store.open(user.id,false),
      ]);
      if (current !== sessionGeneration) return;
      if (profileResult.error) throw profileResult.error;
      profile = profileResult.data; await photos.load([profile.avatar_path]);
      if (current !== sessionGeneration) return;
      authLoading = false; renderSync();
      if (!profile.nickname) { renderAccount(); open('account-dialog'); }
      else {
        store.enableWrites();
        if ($('account-dialog').open) $('account-dialog').close();
        const migrating = maybeOfferMigration(); void refreshFriends();
        if (!migrating && (pendingHub || sessionStorage.getItem('chiikawa-pending-friend'))) { pendingHub = false; showFriends(); }
      }
    } catch (error) {
      if (current !== sessionGeneration) return;
      authLoading = false; renderAccount(); message('account-message','帳號資料暫時無法讀取，請確認連線後重新登入。',true); renderSync();
    }
  }
  const invite = normalizeFriendCode(new URL(location.href).searchParams.get('friend'));
  if (invite.length === 12) { sessionStorage.setItem('chiikawa-pending-friend',invite); const url = new URL(location.href); url.searchParams.delete('friend'); history.replaceState(null,'',url); pendingHub = true; }
  const { data:authSubscription } = client.auth.onAuthStateChange((_event, session) => { setTimeout(() => { void handleSession(session); },0); });
  void client.auth.getSession().then(({ data, error }) => { if (error) { authLoading = false; renderSync(); } else void handleSession(data.session); });
  const refresh = () => { if (user && !document.hidden) { void store.sync(); void refreshFriends(); } };
  window.addEventListener('online',refresh);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',refresh);
  const poll = setInterval(refresh,30000);
  renderSync(); renderBadge();
  return {
    capture:saved => store.capture(saved),
    get userId() { return store.userId; },
    destroy() { clearInterval(poll); resetAvatarDraft(); photos.clear(); authSubscription.subscription.unsubscribe(); store.destroy(); },
  };
}
