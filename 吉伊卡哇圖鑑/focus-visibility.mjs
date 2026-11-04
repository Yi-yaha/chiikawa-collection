// 觸控、滑鼠與自動移焦不加外框；使用 Tab 導覽後才顯示鍵盤位置提示。
const root = document.documentElement;
const pointerFocus = () => { root.dataset.focusMode = 'pointer'; };
pointerFocus();
for (const event of ['pointerdown', 'touchstart', 'mousedown']) {
  document.addEventListener(event, pointerFocus, { capture:true, passive:true });
}
document.addEventListener('keydown', event => {
  if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
    root.dataset.focusMode = 'keyboard';
  }
}, true);
