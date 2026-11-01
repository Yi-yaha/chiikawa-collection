// 每個分頁各自保存瀏覽位置，不混入收藏或帳號同步資料。
export function createViewState({ key, read, win = window, doc = document }) {
  let saved = null, enabled = false, timer, idle, lastValue;
  try { const value = JSON.parse(win.sessionStorage.getItem(key)); if (value?.version === 1) saved = value; } catch {}
  function save() {
    if (!enabled) return;
    try { const value = JSON.stringify({ version:1, ...read() });
      if (value !== lastValue) { win.sessionStorage.setItem(key, value); lastValue = value; } } catch {}
  }
  function schedule() {
    clearTimeout(timer);
    if (idle !== undefined) win.cancelIdleCallback?.(idle);
    timer = setTimeout(() => {
      if (win.requestIdleCallback) idle = win.requestIdleCallback(save, { timeout:1000 });
      else save();
    }, 180);
  }
  win.addEventListener('pagehide', save);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) save(); });
  for (const event of ['click','input','change','close','toggle','scroll']) doc.addEventListener(event, schedule, true);
  return { saved, save, enable() { enabled = true; } };
}

export function capturePosition(root = document) {
  // Only inspect visible rows: elementFromPoint avoids measuring thousands of cards.
  let card;
  for (const y of [Math.min(innerHeight - 20, 160), innerHeight / 2, innerHeight - 30]) {
    card = document.elementFromPoint(innerWidth / 2, y)?.closest('.product-card');
    if (card && root.contains(card)) break;
    card = null;
  }
  return { y:window.scrollY, item:card?.dataset.item || '', offset:card?.getBoundingClientRect().top || 0 };
}

let cancelPreviousRestore;
export function restorePosition(position, root = document) {
  cancelPreviousRestore?.();
  if (!position || !Number.isFinite(position.y)) return;
  let cancelled = false, frames = 0, stable = 0;
  const events = ['pointerdown','touchstart','wheel','keydown'];
  const cancel = () => { cancelled = true; cleanup(); };
  cancelPreviousRestore = cancel;
  const cleanup = () => events.forEach(event => window.removeEventListener(event, cancel));
  events.forEach(event => window.addEventListener(event, cancel, { passive:true, once:true }));
  const card = position.item ? root.querySelector('[data-item="' + CSS.escape(position.item) + '"]') : null;
  window.scrollTo({ top:Math.max(0, position.y), behavior:'instant' });
  function settle() {
    if (cancelled) return;
    if (card?.isConnected && Number.isFinite(position.offset)) {
      const delta = card.getBoundingClientRect().top - position.offset;
      stable = Math.abs(delta) < 1 ? stable + 1 : 0;
      if (Math.abs(delta) >= 1) window.scrollBy({ top:delta, behavior:'instant' });
    }
    if (++frames < 12 && stable < 3) requestAnimationFrame(settle); else cleanup();
  }
  requestAnimationFrame(settle);
}
