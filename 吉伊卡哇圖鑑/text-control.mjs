// 讀取原生多行輸入框的游標位置，只用獨立的排版量測，不修改輸入框或選取範圍。
export function measureTextCaret(control) {
  const style = getComputedStyle(control);
  const mirror = document.createElement('div');
  const marker = document.createElement('span');
  mirror.setAttribute('aria-hidden', 'true');
  Object.assign(mirror.style, {
    position:'fixed', top:'0', left:'0', visibility:'hidden', pointerEvents:'none',
    contain:'layout style paint', boxSizing:'border-box', margin:'0', height:'auto',
    width:(control.clientWidth + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth))+'px',
  });
  for (const name of ['fontFamily','fontSize','fontWeight','fontStyle','fontStretch','fontVariant','lineHeight',
    'letterSpacing','wordSpacing','textIndent','textTransform','textAlign','direction','tabSize',
    'whiteSpace','wordBreak','overflowWrap','paddingTop','paddingRight','paddingBottom','paddingLeft',
    'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderStyle']) mirror.style[name] = style[name];
  const position = control.selectionDirection === 'backward' ? control.selectionStart : control.selectionEnd;
  mirror.textContent = control.value.slice(0, position);
  marker.textContent = control.value.slice(position) || '\u200b';
  mirror.append(marker);
  document.body.append(mirror);
  const measured = marker.getClientRects()[0];
  const top = control.getBoundingClientRect().top + measured.top - mirror.getBoundingClientRect().top - control.scrollTop;
  const height = measured.height;
  mirror.remove();
  return { top, bottom:top + height };
}

// 長備註的捲動只由所屬的最上層視窗處理，與視窗置中排版分開。
// 僅在單一游標超出可見區時捲動內容；不改輸入值、選取或欄位高度。
export function createTextCaretVisibility(dialog) {
  let active = false, frame = 0;
  function reveal() {
    frame = 0;
    const control = document.activeElement;
    if (!active || !dialog.open || control?.tagName !== 'TEXTAREA' || !dialog.contains(control)
      || control.selectionStart !== control.selectionEnd) return;
    const panel = dialog.getBoundingClientRect();
    const top = panel.top + dialog.clientTop + 12;
    const bottom = panel.top + dialog.clientTop + dialog.clientHeight - 12;
    if (control.getBoundingClientRect().height <= bottom - top) return;
    const caret = measureTextCaret(control);
    if (caret.bottom > bottom) dialog.scrollTop += caret.bottom - bottom;
    else if (caret.top < top) dialog.scrollTop += caret.top - top;
  }
  function schedule() {
    if (active && !frame) frame = requestAnimationFrame(reveal);
  }
  const events = ['input','select','selectionchange','keyup'];
  return {
    schedule,
    activate() {
      if (active) return;
      active = true;
      for (const event of events) dialog.addEventListener(event,schedule,true);
    },
    pause() {
      active = false;
      for (const event of events) dialog.removeEventListener(event,schedule,true);
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
