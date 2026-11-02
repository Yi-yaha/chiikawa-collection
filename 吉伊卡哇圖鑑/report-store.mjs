export const REPORT_STATES = Object.freeze({queued:'待查看',in_progress:'整理中',pending_release:'待發布',added:'已補上',already_listed:'已收錄',needs_info:'需要更多資料',closed:'已結案'});
export function normalizeReport(input) {
  const name = String(input.name || '').trim(), note = String(input.note || '').trim();
  let link = String(input.link || '').trim();
  if (!name || name.length > 120) throw new Error('請填寫商品、系列名稱或外觀描述（120 字以內）。');
  if (note.length > 1000) throw new Error('補充說明請控制在 1000 字以內。');
  if (link) {
    try { const url = new URL(link); if (!['https:','http:'].includes(url.protocol)) throw new Error(); link = url.href; }
    catch { throw new Error('請貼上完整的商品連結，例如 https:// 開頭的網址。'); }
    if (link.length > 2000) throw new Error('參考連結太長，請使用商品頁面的原始網址。');
  }
  const images = input.images || [];
  if (images.length > 3) throw new Error('最多可以附上 3 張圖片。');
  if (!link && !images.length) throw new Error('請提供參考連結或商品圖片，選擇其中一項就可以。');
  return {name,link,note,images};
}
export function reportError(error) {
  const message = String(error?.message || '');
  if (/請|回報|圖片|找不到|僅限/.test(message)) return message;
  if (/network|fetch|offline|timeout/i.test(message)) return '暫時無法連線，填寫內容已保留，請確認網路後再試。';
  return '這次尚未送出，填寫內容已保留，請稍後再試。';
}
export function createReportStore({client,storage,getUserId = () => null,randomUUID = () => crypto.randomUUID()}) {
  const prefix = 'chiikawa-catalog-reports-v1';
  const scope = () => getUserId() || 'guest';
  const key = kind => prefix + '-' + scope() + '-' + kind;
  const read = (kind, fallback) => { try { return JSON.parse(storage.getItem(key(kind)) || 'null') ?? fallback; } catch { return fallback; } };
  const write = (kind,value) => storage.setItem(key(kind),JSON.stringify(value));
  const rpc = async (name,args) => { const result = await client.rpc(name,args); if (result.error) throw result.error; return result.data; };
  let sending = null;
  return {
    get scope() { return scope(); },
    draft:() => read('draft',null),
    saveDraft:(value,targetScope = scope()) => storage.setItem(prefix + '-' + targetScope + '-draft',JSON.stringify(value)),
    clearDraft:() => storage.removeItem(key('draft')),
    receipts:() => read('receipts',[]).filter(row => row && typeof row.id === 'string' && /^[a-f0-9]{64}$/.test(row.token || '')).slice(-100),
    seen:() => read('seen',{}),
    markSeen(rows) { const seen = read('seen',{}); for (const row of rows) seen[row.id] = row.version; write('seen',seen); },
    async updates() { return await rpc('get_catalog_report_updates',{p_receipts:this.receipts().map(({id,token}) => ({id,token}))}); },
    submit(input,previousJob,onProgress = () => {}) {
      if (sending) return sending;
      const submissionScope = scope();
      const receiptsKey = key('receipts');
      const work = async () => {
        const value = normalizeReport(input);
        const fingerprint = JSON.stringify([value.name,value.link,value.note,value.images.map(image => image.dataUrl)]);
        const signature = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprint))),byte => byte.toString(16).padStart(2,'0')).join('');
        const job = previousJob?.signature === signature ? previousJob : {id:randomUUID(),token:randomUUID().replaceAll('-','') + randomUUID().replaceAll('-',''),signature};
        let device;
        try { device = storage.getItem(prefix + '-device'); if (!device) {device = randomUUID();storage.setItem(prefix + '-device',device);} } catch {device = randomUUID();}
        onProgress('正在送出回報…',job);
        const reservation = await rpc('begin_catalog_report',{p_id:job.id,p_token:job.token,p_device:device,p_name:value.name,p_link:value.link,p_note:value.note,p_images:value.images.length});
        if (reservation.state === 'uploading') {
          for (const [index,image] of value.images.entries()) {
            onProgress('正在傳送圖片 ' + (index + 1) + '／' + value.images.length + '…',job);
            const bytes = Uint8Array.from(atob(image.dataUrl.split(',')[1]),character => character.charCodeAt(0));
            const result = await client.storage.from('catalog-report-images').upload(job.id + '/' + job.token + '/' + index + '.jpg',new Blob([bytes],{type:'image/jpeg'}),{contentType:'image/jpeg',upsert:false});
            if (result.error && String(result.error.statusCode || result.error.status) !== '409' && !/already exists|duplicate/i.test(result.error.message || '')) throw result.error;
          }
        }
        const receipt = await rpc('finish_catalog_report',{p_id:job.id,p_token:job.token});
        let stored = true;
        try {
          const rows = JSON.parse(storage.getItem(receiptsKey) || '[]').filter(row => row.id !== job.id);
          rows.push({id:job.id,token:job.token,version:receipt.version});
          storage.setItem(receiptsKey,JSON.stringify(rows.slice(-100)));
          if (scope() === submissionScope) this.markSeen([receipt]);
        } catch {stored = false;}
        return {...receipt,job,stored,scope:submissionScope};
      };
      sending = work().finally(() => {sending = null;});
      return sending;
    },
  };
}

export async function prepareReportImage(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('請選擇 JPG、PNG 或 WebP 圖片。');
  if (file.size > 10 * 1024 * 1024) throw new Error('圖片超過 10 MB，請選擇較小的圖片。');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error();
    const canvas = document.createElement('canvas');
    const scale = Math.min(1,1024 / Math.max(image.naturalWidth,image.naturalHeight));
    canvas.width = Math.max(1,Math.round(image.naturalWidth * scale));canvas.height = Math.max(1,Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');context.fillStyle = '#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    let dataUrl;
    for (const quality of [.84,.68,.5,.35]) {dataUrl = canvas.toDataURL('image/jpeg',quality);if (dataUrl.length < 700000) break;}
    if (dataUrl.length >= 700000) throw new Error('這張圖片較大，請裁切後再選一次。');
    return {filename:file.name,dataUrl};
  } catch (error) {if (/圖片|請/.test(error.message || '')) throw error;throw new Error('這張圖片無法開啟，請換一張圖片。');}
  finally {URL.revokeObjectURL(url);}
}
