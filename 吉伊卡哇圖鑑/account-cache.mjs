import { STORAGE_KEY } from './model.mjs?v=8d31eb23fdb1d6d1';

export const ACCOUNT_SESSION_KEY = 'chiikawa-account-session';
const profileKey = uid => STORAGE_KEY + '-account-' + uid + '-profile';

// 只用於立即顯示這台裝置的資料；登入有效性及雲端存取仍由帳號服務確認。
export function readLocalSession(storage) {
  try {
    const session = JSON.parse(storage.getItem(ACCOUNT_SESSION_KEY) || 'null');
    return session && typeof session.user?.id === 'string' && session.user.id &&
      typeof session.access_token === 'string' && session.access_token &&
      typeof session.refresh_token === 'string' && session.refresh_token &&
      Number.isFinite(session.expires_at) ? session : null;
  } catch { return null; }
}

export function readLocalProfile(storage, uid) {
  try {
    const profile = JSON.parse(storage.getItem(profileKey(uid)) || 'null');
    return profile?.id === uid && typeof profile.nickname === 'string' &&
      typeof profile.friend_code === 'string' ? profile : null;
  } catch { return null; }
}

export function saveLocalProfile(storage, profile) {
  if (!profile?.id) return;
  try {
    storage.setItem(profileKey(profile.id), JSON.stringify({
      id:profile.id, nickname:profile.nickname, avatar_path:profile.avatar_path || null, friend_code:profile.friend_code,
    }));
  } catch { /* 儲存空間不可用時仍可繼續使用目前的帳號。 */ }
}
