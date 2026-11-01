export const normalizeFriendCode = value => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export const FRIEND_INVITE_TITLE = '加我好友，一起分享收藏！';
export const FRIEND_INVITE_DESCRIPTION = '在吉伊卡哇圖鑑加入好友，一起欣賞彼此的娃、比較收藏，分享想收的願望清單。';

export function createFriendInviteURL(siteURL, friendCode) {
  const code = normalizeFriendCode(friendCode);
  if (code.length !== 12) throw new Error('請確認好友代碼後再分享。');
  const url = new URL('./invite.html', siteURL);
  url.searchParams.set('friend', code);
  return url.href;
}

export function getFriendInviteTarget(inviteURL) {
  const invite = new URL(inviteURL);
  const code = normalizeFriendCode(invite.searchParams.get('friend'));
  if (code.length !== 12) return null;
  const target = new URL('./', invite);
  target.searchParams.set('friend', code);
  return target.href;
}
