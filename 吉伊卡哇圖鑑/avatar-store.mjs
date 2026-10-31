const BUCKET = 'collection-avatars';

export async function prepareAvatar(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('請選擇 JPG、PNG 或 WebP 照片。');
  if (file.size > 20 * 1024 * 1024) throw new Error('照片請小於 20 MB。');
  let picture;
  try { picture = await createImageBitmap(file, { imageOrientation:'from-image' }); }
  catch { throw new Error('無法讀取這張照片，請改用 JPG、PNG 或 WebP。'); }
  try {
    const edge = Math.min(picture.width,picture.height);
    if (!edge) throw new Error('無法讀取這張照片，請重新選擇。');
    const size = Math.min(edge,512), canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    canvas.getContext('2d').drawImage(picture,(picture.width-edge)/2,(picture.height-edge)/2,edge,edge,0,0,size,size);
    const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/webp',0.85));
    if (!blob) throw new Error('無法處理這張照片，請重新選擇。');
    return blob;
  } finally { picture.close(); }
}

export function createAvatarStore(client) {
  const cache = new Map();
  const bucket = () => client.storage.from(BUCKET);
  return {
    clear() { cache.clear(); },
    url(path) { const value = cache.get(path); return value && value.until > Date.now() ? value.url : ''; },
    async load(paths) {
      const missing = [...new Set(paths.filter(Boolean))].filter(path => !cache.has(path) || cache.get(path).until <= Date.now());
      if (!missing.length) return;
      try {
        const { data,error } = await bucket().createSignedUrls(missing,300);
        if (error) return;
        for (const row of data || []) if (row.signedUrl) cache.set(row.path,{ url:row.signedUrl,until:Date.now()+240000 });
      } catch { /* 照片載入失敗時保留空白，不影響收藏與好友。 */ }
    },
    async upload(uid,blob) {
      const path = uid + '/' + crypto.randomUUID() + '.webp';
      const { error } = await bucket().upload(path,blob,{ contentType:blob.type,cacheControl:'300',upsert:false });
      if (error) throw new Error('照片暫時無法上傳，請確認連線後再試。');
      return path;
    },
    async remove(path) {
      if (!path) return;
      const { error } = await bucket().remove([path]);
      if (!error) cache.delete(path);
    },
  };
}
