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
