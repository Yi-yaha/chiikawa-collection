import { measureTextCaret } from './text-control.mjs?v=1c9eee9eeb75c170';

const EDITABLE = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]),textarea,select,[contenteditable="true"]';
const GEOMETRY = ['top', 'bottom', 'margin-top', 'margin-bottom', 'max-height'];

// 只管理目前最上層視窗的可見範圍；不移動整頁、不改輸入值或選取範圍。
export function createDialogViewport(dialog) {
  const viewport = window.visualViewport;
  const original = GEOMETRY.map(name => [name, dialog.style.getPropertyValue(name), dialog.style.getPropertyPriority(name)]);
  let active = false, constrained = false, frame = 0, anchorTop = 0;
  const observer = new ResizeObserver(schedule);
  function set(name, value) {
    if (dialog.style.getPropertyValue(name) !== value) dialog.style.setProperty(name, value);
  }
  function restoreGeometry() {
    if (!constrained) return;
    for (const [name, value, priority] of original) {
      if (value) dialog.style.setProperty(name, value, priority);
      else dialog.style.removeProperty(name);
    }
    constrained = false;
  }
  function revealFocusedControl() {
    const control = document.activeElement;
    if (!control?.matches(EDITABLE) || !dialog.contains(control)) return;
    const panel = dialog.getBoundingClientRect();
    let field = control.getBoundingClientRect();
    const top = panel.top + dialog.clientTop + 12;
    const bottom = panel.top + dialog.clientTop + dialog.clientHeight - 12;
    // 長備註只顯示目前的原生游標，不把整欄的兩端硬拉進畫面。
    if (field.height > bottom - top) {
      if (control.tagName !== 'TEXTAREA') return;
      field = measureTextCaret(control);
    }
    if (field.bottom > bottom) dialog.scrollTop += field.bottom - bottom;
    else if (field.top < top) dialog.scrollTop += field.top - top;
  }
  function layout() {
    frame = 0;
    if (!active || !dialog.open) return;
    const height = viewport?.height ?? innerHeight, top = viewport?.offsetTop ?? 0;
    // 鍵盤會縮小可見範圍，卻不一定改變100dvh；手動縮放仍由瀏覽器處理。
    const needsBounds = (!viewport || viewport.scale <= 1.05) && (height < innerHeight - 1 || top > 1);
    if (needsBounds) {
      if (!constrained) anchorTop = dialog.getBoundingClientRect().top;
      constrained = true;
      set('max-height', Math.max(1, height - 24) + 'px');
      set('margin-top', '0px');
      set('margin-bottom', '0px');
      set('bottom', 'auto');
      const panelHeight = dialog.getBoundingClientRect().height;
      const position = Math.max(top + 12, Math.min(anchorTop, top + height - 12 - panelHeight));
      set('top', position + 'px');
    } else restoreGeometry();
    revealFocusedControl();
  }
  function schedule() {
    if (active && !frame) frame = requestAnimationFrame(layout);
  }
  function listen(enabled) {
    const method = enabled ? 'addEventListener' : 'removeEventListener';
    viewport?.[method]('resize', schedule);
    viewport?.[method]('scroll', schedule);
    window[method]('resize', schedule);
    dialog[method]('focusin', schedule);
    dialog[method]('input', schedule);
    document[method]('selectionchange', schedule);
  }
  return {
    activate() {
      if (active) return;
      active = true;
      listen(true);
      observer.observe(dialog);
      layout();
    },
    pause() {
      active = false;
      listen(false);
      observer.disconnect();
      cancelAnimationFrame(frame);
      frame = 0;
    },
    close() {
      this.pause();
      restoreGeometry();
    },
  };
}
