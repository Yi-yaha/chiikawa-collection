import { createTextCaretVisibility } from './text-control.mjs?v=72b4edb3da004c3e';

const EDITABLE = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]),textarea,select,[contenteditable="true"]';
const BOUNDS = ['--dialog-top', '--dialog-height'];

export function visibleViewport() {
  const viewport = window.visualViewport;
  // 手動放大時保留瀏覽器原生的平移與縮放，不把放大誤認成鍵盤。
  return viewport && viewport.scale <= 1.05
    ? { top:viewport.offsetTop, height:viewport.height }
    : { top:0, height:innerHeight };
}

// 開啟前提供可見範圍，視窗的位置與高度全部交由同一套 CSS 排版。
// 不量測視窗後再搬動；輸入／文字選取不參與視窗排版。
export function createDialogViewport(dialog) {
  const viewport = window.visualViewport;
  const caret = createTextCaretVisibility(dialog);
  const original = BOUNDS.map(name => [name, dialog.style.getPropertyValue(name), dialog.style.getPropertyPriority(name)]);
  let active = false, frame = 0;
  function prepare() {
    if (active && viewport?.scale > 1.05) return;
    const bounds = visibleViewport();
    for (const [name,value] of [['--dialog-top',bounds.top],['--dialog-height',bounds.height]]) {
      const next = Math.max(0, value) + 'px';
      if (dialog.style.getPropertyValue(name) !== next) dialog.style.setProperty(name, next);
    }
  }
  function revealFocusedControl() {
    frame = 0;
    if (!active || !dialog.open) return;
    const control = document.activeElement;
    if (!control?.matches(EDITABLE) || !dialog.contains(control)) return;
    const panel = dialog.getBoundingClientRect(), field = control.getBoundingClientRect();
    const top = panel.top + dialog.clientTop + 12;
    const bottom = panel.top + dialog.clientTop + dialog.clientHeight - 12;
    // 長備註的游標可見性由獨立的文字操作層處理，不影響視窗排版。
    if (field.height > bottom - top) return;
    if (field.bottom > bottom) dialog.scrollTop += field.bottom - bottom;
    else if (field.top < top) dialog.scrollTop += field.top - top;
  }
  function scheduleReveal() {
    if (active && !frame) frame = requestAnimationFrame(revealFocusedControl);
    caret.schedule();
  }
  function resized() {
    if (viewport?.scale > 1.05) return;
    prepare();
    scheduleReveal();
  }
  function listen(enabled) {
    const method = enabled ? 'addEventListener' : 'removeEventListener';
    viewport?.[method]('resize', resized);
    viewport?.[method]('scroll', resized);
    window[method]('resize', resized);
    dialog[method]('focusin', scheduleReveal);
  }
  return {
    prepare,
    activate() {
      if (active) return;
      prepare();
      active = true;
      caret.activate();
      listen(true);
      scheduleReveal();
    },
    pause() {
      active = false;
      caret.pause();
      listen(false);
      cancelAnimationFrame(frame);
      frame = 0;
    },
    close() {
      this.pause();
      for (const [name,value,priority] of original) {
        if (value) dialog.style.setProperty(name,value,priority);
        else dialog.style.removeProperty(name);
      }
    },
  };
}
