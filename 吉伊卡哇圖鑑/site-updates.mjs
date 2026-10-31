// 返回網站時確認頁面版本；編輯中及登入回跳時保留目前畫面。
export function watchForSiteUpdates({ win = window, doc = document, fetcher = fetch, now = Date.now } = {}) {
  const current = doc.querySelector('meta[name="chiikawa-site-version"]')?.content;
  if (!current) return;
  let checking = false, lastCheck = -Infinity, pending = '';
  const authCallback = url => url.searchParams.has('code') || url.searchParams.has('error') || /(?:^#|&)(?:access_token|refresh_token|error)=/.test(url.hash);
  function applyUpdate() {
    if (!pending || doc.hidden || doc.querySelector('dialog[open]') || doc.activeElement?.matches('input,textarea,select,[contenteditable]')) return;
    const url = new URL(win.location.href);
    if (authCallback(url) || url.searchParams.get('_site') === pending) return;
    url.searchParams.set('_site', pending);
    pending = '';
    win.location.replace(url.href);
  }
  async function check() {
    const time = now();
    if (checking || doc.hidden || time - lastCheck < 60_000 || authCallback(new URL(win.location.href))) return;
    lastCheck = time; checking = true;
    try {
      const url = new URL('./site-version.json', win.location.href);
      url.searchParams.set('check', String(time));
      const response = await fetcher(url.href, { cache:'no-store' });
      if (!response.ok) return;
      const { version } = await response.json();
      if (typeof version === 'string' && /^[a-f0-9]{16}$/.test(version) && version !== current) {
        pending = version; applyUpdate();
      }
    } catch { /* 離線或檢查失敗時繼續使用現有頁面。 */ }
    finally { checking = false; }
  }
  win.addEventListener('pageshow', event => { if (event.persisted) lastCheck = -Infinity; void check(); });
  win.addEventListener('online', () => { lastCheck = -Infinity; void check(); });
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) { applyUpdate(); void check(); } });
  doc.addEventListener('close', () => queueMicrotask(applyUpdate), true);
  doc.addEventListener('focusout', () => queueMicrotask(applyUpdate));
  void check();
}
