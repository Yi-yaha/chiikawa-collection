import { capturePosition, restorePosition } from './view-state.mjs?v=d4bf080ee23ef785';

// 商品資訊有自己的捲動範圍；輸入、鍵盤及滑到邊界都不能帶動後方清單。
export function createDetailScrollGuard(dialog, catalog) {
  const page = document.documentElement;
  let locked = null, lastTouch = null, stopSettling = () => {};
  const properties = ['--detail-page-top','--detail-page-left','--detail-page-width'];

  function sizePage() {
    if (locked) document.body.style.setProperty('--detail-page-width', (innerWidth - locked.scrollbar) + 'px');
  }
  function keepBackground(event) {
    if (!locked) return;
    if (event.target === document && (scrollX || scrollY)) window.scrollTo({ left:0, top:0, behavior:'instant' });
    for (const background of locked.dialogs) {
      if (event.target === background.dialog && background.dialog.open && background.dialog.scrollTop !== background.y) background.dialog.scrollTop = background.y;
    }
  }
  function canScroll(target, x, y, delta) {
    const modal = target?.closest?.('dialog[open]');
    if (!modal) return false;
    const bounds = modal.getBoundingClientRect();
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return false;
    for (let element = target; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1) {
        if (delta > 0 && element.scrollTop > 1 || delta < 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 1) return true;
      }
      if (element === modal) break;
    }
    return false;
  }
  function touchStart(event) {
    lastTouch = event.touches.length === 1 ? { x:event.touches[0].clientX, y:event.touches[0].clientY } : null;
  }
  function touchMove(event) {
    if (!locked || !lastTouch || event.touches.length !== 1) return;
    const touch = event.touches[0], delta = touch.clientY - lastTouch.y;
    lastTouch = { x:touch.clientX, y:touch.clientY };
    if (delta && !canScroll(event.target, touch.clientX, touch.clientY, delta) && event.cancelable) event.preventDefault();
  }
  function wheel(event) {
    if (locked && event.deltaY && !canScroll(event.target, event.clientX, event.clientY, -event.deltaY) && event.cancelable) event.preventDefault();
  }
  function listen(active) {
    const method = active ? 'addEventListener' : 'removeEventListener';
    document[method]('touchstart', touchStart, { capture:true, passive:true });
    document[method]('touchmove', touchMove, { capture:true, passive:false });
    document[method]('wheel', wheel, { capture:true, passive:false });
    document[method]('scroll', keepBackground, true);
    window[method]('resize', sizePage);
  }
  function unlock() {
    if (!locked || dialog.open) return;
    const previous = locked;
    if (dialog.contains(document.activeElement)) document.activeElement.blur();
    locked = null;
    lastTouch = null;
    listen(false);
    page.classList.remove('detail-page-locked');
    for (const [name,value,priority] of previous.styles) {
      if (value) document.body.style.setProperty(name,value,priority);
      else document.body.style.removeProperty(name);
    }
    for (const background of previous.dialogs) if (background.dialog.open) background.dialog.scrollTop = background.y;
    window.scrollTo({ left:previous.x, top:previous.position.y, behavior:'instant' });
    void restorePosition(previous.position, catalog);

    // iPhone 的鍵盤可能在視窗關閉後才完成收合；僅接續校正這段變化，
    // 使用者開始下一次操作時立即停止，避免把清單拉回舊位置。
    const viewport = window.visualViewport;
    const events = ['pointerdown','touchstart','wheel','keydown'];
    let timer;
    const settle = () => { void restorePosition(previous.position, catalog); };
    stopSettling = () => {
      clearTimeout(timer);
      viewport?.removeEventListener('resize',settle);
      viewport?.removeEventListener('scroll',settle);
      events.forEach(event => window.removeEventListener(event,stopSettling,true));
      stopSettling = () => {};
    };
    viewport?.addEventListener('resize',settle);
    viewport?.addEventListener('scroll',settle);
    events.forEach(event => window.addEventListener(event,stopSettling,{ capture:true, passive:true, once:true }));
    timer = setTimeout(stopSettling,800);
  }
  dialog.addEventListener('close',unlock);
  return {
    get position() { return locked?.position || null; },
    open() {
      if (dialog.open) return;
      stopSettling();
      locked = {
        position:capturePosition(catalog), x:scrollX,
        scrollbar:innerWidth - page.clientWidth,
        styles:properties.map(name => [name,document.body.style.getPropertyValue(name),document.body.style.getPropertyPriority(name)]),
        dialogs:[...document.querySelectorAll('dialog[open]')].map(background => ({ dialog:background, y:background.scrollTop })),
      };
      document.body.style.setProperty('--detail-page-top', -locked.position.y + 'px');
      document.body.style.setProperty('--detail-page-left', -locked.x + 'px');
      sizePage();
      page.classList.add('detail-page-locked');
      window.scrollTo({ left:0, top:0, behavior:'instant' });
      listen(true);
      try { dialog.showModal(); } catch (error) { unlock(); throw error; }
    },
  };
}
