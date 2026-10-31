import { typeLabel } from './model.mjs?v=1909f35c2ced5dc9';

export const normalizeNickname = value => String(value ?? '').trim().replace(/\s+/gu, ' ');
export const validNickname = value => {
  const name = normalizeNickname(value);
  return [...name].length >= 1 && [...name].length <= 24 && !/[\u0000-\u001f\u007f-\u009f]/u.test(name);
};
export const normalizeFriendCode = value => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const formatFriendCode = value => normalizeFriendCode(value).match(/.{1,4}/g)?.join('－') || '';

export function collectionStats(items, quantities = {}) {
  const owned = items.filter(item => Number.isInteger(quantities[item.id]) && quantities[item.id] > 0);
  const countBy = key => {
    const counts = new Map();
    for (const item of owned) counts.set(item[key], (counts.get(item[key]) || 0) + 1);
    return [...counts].map(([name, count]) => ({ name, label:key === 'type' ? typeLabel(name) : name, count, ratio:owned.length ? count / owned.length : 0, total:items.filter(item => item[key] === name).length }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-TW'));
  };
  return {
    styles:owned.length,
    pieces:owned.reduce((sum, item) => sum + quantities[item.id], 0),
    multiples:owned.filter(item => quantities[item.id] > 1).length,
    characters:countBy('character'),
    types:countBy('type'),
    total:items.length,
  };
}

export function compareCollections(items, mine = {}, theirs = {}) {
  const both = [], theirsOnly = [], mineOnly = [];
  for (const item of items) {
    const a = mine[item.id] > 0, b = theirs[item.id] > 0;
    if (a && b) both.push(item);
    else if (b) theirsOnly.push(item);
    else if (a) mineOnly.push(item);
  }
  return { both, theirsOnly, mineOnly };
}

export function notificationCount(friends = [], notifications = []) {
  return friends.filter(friend => friend.status === 'pending' && friend.incoming).length
    + notifications.filter(note => note.kind === 'friend_accepted' && !note.read_at).length;
}
