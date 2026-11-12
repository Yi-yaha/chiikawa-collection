import { capturePosition } from './view-state.mjs?v=a81b8e1c6b961f81';
import { createDialogViewport } from './dialog-viewport.mjs?v=a81b8e1c6b961f81';

// 全站彈出視窗共用一個操作層級。背景僅保存位置，原生dialog負責焦點與互動隔離。
export function createDialogController(catalog, { getPosition = () => capturePosition(catalog) } = {}) {
  const page = document.documentElement;
  const properties = ['--detail-page-top','--detail-page-left','--detail-page-width','--detail-heading-offset','--detail-header-top','--detail-header-height'];
  const documentHeight = '--detail-document-height';
  let locked = null;
  let backdropPress = null;
  const topLayer = () => locked?.layers.findLast(layer => layer.modal.open);
  function outside(modal, event) {
    const rect = modal.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  }
  // 關閉政策、遮罩點擊與最上層判定集中管理；各功能只處理自己的資料。
  document.addEventListener('pointerdown', event => {
    const modal = topLayer()?.modal;
    backdropPress = modal && event.target === modal && outside(modal,event) ? modal : null;
  }, true);
  document.addEventListener('pointercancel', () => { backdropPress = null; }, true);
  document.addEventListener('click', event => {
    const modal = topLayer()?.modal;
    const startedOutside = backdropPress === modal;
    backdropPress = null;
    if (!modal || !startedOutside || modal.dataset.dialogDismiss === 'explicit' || event.target !== modal || !outside(modal,event)) return;
    if (typeof modal.requestClose === 'function') modal.requestClose();
    else if (modal.dispatchEvent(new Event('cancel',{ cancelable:true }))) modal.close();
  });
  function sizePage() {
    if (locked) document.body.style.setProperty('--detail-page-width', (innerWidth - locked.scrollbar) + 'px');
  }
  function keepBackground(event) {
    if (!locked) return;
    // 不攔截整頁的原生鍵盤定位，也不改最上層視窗、輸入框或游標的捲動。
    for (const background of topLayer()?.dialogs || []) {
      if (event.target === background.dialog && background.dialog.open && background.dialog.scrollTop !== background.y) background.dialog.scrollTop = background.y;
    }
  }
  function unlock() {
    if (!locked) return;
    for (const layer of locked.layers) if (!layer.modal.open) {
      layer.viewport.close();
      for (const background of layer.dialogs) if (background.dialog.open) background.dialog.scrollTop = background.y;
    }
    locked.layers = locked.layers.filter(layer => layer.modal.open);
    if (locked.layers.length) {
      locked.layers.at(-1).viewport.activate();
      return;
    }
    const previous = locked;
    const focusedModal = document.activeElement?.closest?.('dialog');
    if (focusedModal && !focusedModal.open) document.activeElement.blur();
    locked = null;
    document.removeEventListener('scroll', keepBackground, true);
    window.removeEventListener('resize', sizePage);
    page.classList.remove('detail-page-locked');
    if (previous.documentStyle[0]) page.style.setProperty(documentHeight, ...previous.documentStyle);
    else page.style.removeProperty(documentHeight);
    for (const [name,value,priority] of previous.styles) {
      if (value) document.body.style.setProperty(name,value,priority);
      else document.body.style.removeProperty(name);
    }
    const card = previous.position.item && catalog.querySelector('[data-item="' + CSS.escape(previous.position.item) + '"]');
    const y = card ? card.getBoundingClientRect().top + scrollY - previous.position.offset : previous.position.y;
    // 解除固定後一次還原背景，不再於後續畫面逐次拉回頁面。
    window.scrollTo({ left:previous.x, top:Math.max(0,y), behavior:'instant' });
  }
  return {
    get position() { return locked?.position || null; },
    get top() { return topLayer()?.modal || null; },
    open(modal) {
      if (modal.open) return;
      if (!locked) {
        locked = {
          position:{ ...getPosition() }, x:scrollX,
          scrollbar:innerWidth - page.clientWidth,
          styles:properties.map(name => [name,document.body.style.getPropertyValue(name),document.body.style.getPropertyPriority(name)]),
          documentStyle:[page.style.getPropertyValue(documentHeight),page.style.getPropertyPriority(documentHeight)],
          layers:[],
        };
        const header = document.querySelector('.site-header')?.getBoundingClientRect();
        const heading = document.querySelector('.catalog-heading');
        let headingTop = heading?.getBoundingClientRect().top;
        if (heading && locked.position.y !== scrollY) {
          headingTop -= locked.position.y - scrollY;
          const style = getComputedStyle(heading);
          if (style.position === 'sticky') headingTop = Math.max(parseFloat(style.top) || 0, headingTop);
        }
        document.body.style.setProperty('--detail-page-top', -locked.position.y + 'px');
        document.body.style.setProperty('--detail-page-left', -locked.x + 'px');
        document.body.style.setProperty('--detail-header-top', (header?.top || 0) + 'px');
        document.body.style.setProperty('--detail-header-height', (header?.height || 0) + 'px');
        // 固定背景時仍保留文件高度，避免捲動歸零讓手機頂端列跳動。
        page.style.setProperty(documentHeight, Math.max(page.scrollHeight, locked.position.y + innerHeight) + 'px');
        sizePage();
        document.body.style.setProperty('--detail-heading-offset', '0px');
        page.classList.add('detail-page-locked');
        if (heading) document.body.style.setProperty('--detail-heading-offset', (headingTop - heading.getBoundingClientRect().top) + 'px');
        document.addEventListener('scroll', keepBackground, true);
        window.addEventListener('resize', sizePage);
      }
      locked.layers.at(-1)?.viewport.pause();
      const layer = {
        modal, viewport:createDialogViewport(modal),
        dialogs:[...document.querySelectorAll('dialog[open]')].map(dialog => ({ dialog, y:dialog.scrollTop })),
      };
      locked.layers.push(layer);
      modal.addEventListener('close', unlock, { once:true });
      try {
        layer.viewport.prepare();
        modal.showModal();
        layer.viewport.activate();
      } catch (error) { unlock(); throw error; }
    },
  };
}
