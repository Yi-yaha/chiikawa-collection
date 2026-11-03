import { getFriendInviteTarget } from './friend-invite.mjs?v=c8aa55ad9b7e451c';

const target = getFriendInviteTarget(location.href);
const link = document.getElementById('open-friend-invite');
if (target) {
  link.href = target;
  location.replace(target);
} else {
  document.getElementById('invite-status').textContent = '這個好友邀請連結不完整，請向對方重新索取。';
  link.textContent = '返回圖鑑';
}
