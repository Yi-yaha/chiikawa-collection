const h = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const n = value => value.toLocaleString('zh-TW');
const icons = {
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  star:'<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.5-4.4 6.3-.9L12 3Z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".8" fill="currentColor" stroke="none"/>',
};
const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[name] + '</svg>';

function imageURL(value) {
  if (!value) return '';
  try {
    const url = new URL(value,document.baseURI);
    return ['http:','https:','blob:'].includes(url.protocol) ? h(url.href) : '';
  } catch { return ''; }
}

// 收藏概況與好友圖鑑使用同一張預覽卡，圖片和資訊按鈕都開啟商品詳情。
export function catalogPreviewCard(item, { quantity, friend = false, wished = false, comparison = '' }) {
  const id = h(item.id), name = h(item.character + '・' + item.name), title = h(item.name);
  const detail = `${friend ? 'data-friend-detail' : 'data-overview-product'}="${id}" aria-label="查看${name}的詳細資訊" aria-haspopup="dialog" aria-controls="detail-dialog"`;
  const heading = friend ? 'h3' : 'h4';
  const quantityLabel = quantity ? (friend ? '好友收藏 ' : '已收藏 ') + n(quantity) + ' 個' : '';
  const status = quantity ? `<span class="collect-button owned ${friend ? 'friend-status' : 'overview-card-status'}" role="img" aria-label="${quantityLabel}" title="${quantityLabel}">${icon('heart')}</span>`
    : wished ? `<span class="wish-button wished friend-status" role="img" aria-label="好友想收藏">${icon('star')}</span>` : '';
  const caption = friend ? (comparison ? `<p class="friend-comparison-quantity">${h(comparison)}</p>` : '')
    : `<small class="overview-card-caption">${h(item.character)}${quantity ? '・' + n(quantity) + ' 個' : ''}</small>`;
  return `<article class="product-card ${friend ? 'friend-product' : 'overview-card'}${quantity ? ' owned' : wished ? ' wished' : ''}" ${friend ? 'data-friend-item' : 'data-overview-item'}="${id}">
    <div class="product-visual">
      <button type="button" class="product-image-button${friend ? ' friend-product-image' : ''}" ${detail}><div class="product-image"><img src="${imageURL(item.image)}" alt="${name}" width="200" height="200" loading="lazy" decoding="async"></div></button>
      ${status}
    </div>
    <div class="product-meta"><${heading} class="product-name" title="${title}">${title}</${heading}><button type="button" class="product-info-button${friend ? ' friend-product-info' : ''}" ${detail}>${icon('info')}</button></div>
    ${caption}
  </article>`;
}
