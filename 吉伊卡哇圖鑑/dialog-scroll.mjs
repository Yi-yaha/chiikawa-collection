import { capturePosition, restorePosition } from './view-state.mjs?v=7676b76ad38fd376';
import { createDialogViewport } from './dialog-viewport.mjs?v=7676b76ad38fd376';

// 全站彈出視窗共用一個操作層級。背景僅保存位置，原生dialog負責焦點與互動隔離。
export function createDialogController(catalog, { getPosition = () => capturePosition(catalog) } = {}) {
  const page = document.documentElement;
  const properties = ['--detail-page-top','--detail-page-left','--detail-page-width','--detail-heading-offset'];
  let locked = null;
  function sizePage() {
    if (locked) document.body.style.setProperty('--detail-page-width', (innerWidth - locked.scrollbar) + 'px');
  }
  function keepBackground(event) {
    if (!locked) return;
    // 不攔截整頁的原生鍵盤定位，也不改最上層視窗、輸入框或游標的捲動。
    for (const background of locked.layers.at(-1)?.dialogs || []) {
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
    for (const [name,value,priority] of previous.styles) {
      if (value) document.body.style.setProperty(name,value,priority);
      else document.body.style.removeProperty(name);
    }
    window.scrollTo({ left:previous.x, top:previous.position.y, behavior:'instant' });
    void restorePosition(previous.position, catalog);
  }
  return {
    get position() { return locked?.position || null; },
    open(modal) {
      if (modal.open) return;
      if (!locked) {
        locked = {
          position:{ ...getPosition() }, x:scrollX,
          scrollbar:innerWidth - page.clientWidth,
          styles:properties.map(name => [name,document.body.style.getPropertyValue(name),document.body.style.getPropertyPriority(name)]),
          layers:[],
        };
        const heading = document.querySelector('.catalog-heading');
        let headingTop = heading?.getBoundingClientRect().top;
        if (heading && locked.position.y !== scrollY) {
          headingTop -= locked.position.y - scrollY;
          const style = getComputedStyle(heading);
          if (style.position === 'sticky') headingTop = Math.max(parseFloat(style.top) || 0, headingTop);
        }
        document.body.style.setProperty('--detail-page-top', -locked.position.y + 'px');
        document.body.style.setProperty('--detail-page-left', -locked.x + 'px');
        sizePage();
        document.body.style.setProperty('--detail-heading-offset', '0px');
        page.classList.add('detail-page-locked');
        window.scrollTo({ left:0, top:0, behavior:'instant' });
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
        modal.showModal();
        layer.viewport.activate();
      } catch (error) { unlock(); throw error; }
    },
  };
}
