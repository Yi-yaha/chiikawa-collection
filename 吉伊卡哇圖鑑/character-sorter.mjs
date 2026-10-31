// Keep taps and scrolling available; only a deliberate drag changes the order.
export function createCharacterSorter(tabs, { enabled, getOrder, onCommit }) {
  let gesture = null;
  let frame = 0;
  let suppressClickUntil = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const buttons = () => [...tabs.querySelectorAll('[data-scope]')].filter(button => getOrder().includes(button.dataset.scope));
  const sameOrder = (a, b) => a.every((name, index) => name === b[index]);

  function arrange(order, animate = false) {
    const nodes = buttons();
    const before = new Map(nodes.map(node => [node, node.getBoundingClientRect()]));
    nodes.forEach(node => node.getAnimations().forEach(animation => animation.cancel()));
    const byName = new Map(nodes.map(node => [node.dataset.scope, node]));
    order.forEach(name => tabs.append(byName.get(name)));
    if (!animate || reducedMotion.matches) return;
    nodes.forEach(node => {
      if (node === gesture?.button) return;
      const previous = before.get(node), next = node.getBoundingClientRect();
      const x = previous.left - next.left, y = previous.top - next.top;
      if (x || y) node.animate([{ transform: 'translate(' + x + 'px,' + y + 'px)' }, { transform: 'none' }], { duration: 160, easing: 'ease-out' });
    });
  }

  function moveOverPointer() {
    const area = tabs.getBoundingClientRect();
    const { x, y, button, order } = gesture;
    if (x < area.left || x > area.right || y < area.top || y > area.bottom) return;
    const hit = document.elementFromPoint(x, y)?.closest('[data-scope]');
    if (hit && !order.includes(hit.dataset.scope)) return;
    let closest, distance = Infinity;
    buttons().forEach(node => {
      // Read layout positions, independent of the short settling animation.
      const cx = area.left + tabs.clientLeft + node.offsetLeft + node.offsetWidth / 2 - tabs.scrollLeft;
      const cy = area.top + tabs.clientTop + node.offsetTop + node.offsetHeight / 2 - tabs.scrollTop;
      const nextDistance = (cx - x) ** 2 + (cy - y) ** 2;
      if (nextDistance < distance) { closest = node; distance = nextDistance; }
    });
    if (!closest || closest === button) return;
    const from = order.indexOf(button.dataset.scope), to = order.indexOf(closest.dataset.scope);
    order.splice(from, 1);
    order.splice(to, 0, button.dataset.scope);
    arrange(order, true);
  }

  function tick() {
    if (!gesture?.active) return;
    const area = tabs.getBoundingClientRect();
    const y = gesture.y;
    const edge = Math.min(40, area.height / 4);
    let speed = 0;
    if (gesture.x >= area.left && gesture.x <= area.right && y >= area.top - edge && y <= area.bottom + edge) {
      if (y < area.top + edge) speed = -Math.min(1, (area.top + edge - y) / edge);
      else if (y > area.bottom - edge) speed = Math.min(1, (y - area.bottom + edge) / edge);
    }
    const now = performance.now();
    const elapsed = Math.min(now - gesture.lastFrame, 32);
    gesture.lastFrame = now;
    const previous = tabs.scrollTop;
    tabs.scrollTop += speed * elapsed * .45;
    if (tabs.scrollTop !== previous) moveOverPointer();
    frame = requestAnimationFrame(tick);
  }

  function start() {
    if (!gesture || !enabled()) return;
    clearTimeout(gesture.timer);
    const rect = gesture.button.getBoundingClientRect();
    gesture.active = true;
    gesture.lastFrame = performance.now();
    gesture.ghost = gesture.button.cloneNode(true);
    gesture.ghost.classList.add('character-drag-preview');
    gesture.ghost.classList.remove('active');
    gesture.ghost.removeAttribute('aria-describedby');
    gesture.ghost.setAttribute('aria-hidden', 'true');
    gesture.ghost.tabIndex = -1;
    Object.assign(gesture.ghost.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    document.body.append(gesture.ghost);
    gesture.button.classList.add('is-drag-source');
    tabs.classList.add('is-sorting');
    try { tabs.setPointerCapture(gesture.pointerId); } catch {}
    updatePreview();
    frame = requestAnimationFrame(tick);
  }

  function updatePreview() {
    gesture.ghost.style.transform = 'translate3d(' + (gesture.x - gesture.startX) + 'px,' + (gesture.y - gesture.startY) + 'px,0)';
    moveOverPointer();
  }

  function finish(commit = false) {
    if (!gesture) return;
    const current = gesture;
    gesture = null;
    clearTimeout(current.timer);
    cancelAnimationFrame(frame);
    if (!current.active) return;
    suppressClickUntil = performance.now() + 500;
    current.ghost.remove();
    current.button.classList.remove('is-drag-source');
    tabs.classList.remove('is-sorting');
    if (!commit) arrange(current.original);
    try { if (tabs.hasPointerCapture(current.pointerId)) tabs.releasePointerCapture(current.pointerId); } catch {}
    current.button.focus({ preventScroll: true });
    if (commit && !sameOrder(current.order, current.original)) onCommit([...current.order], current.button.dataset.scope);
  }

  tabs.addEventListener('pointerdown', event => {
    suppressClickUntil = 0;
    if (gesture) { finish(false); return; }
    if (!enabled() || !event.isPrimary || event.button !== 0) return;
    const button = event.target.closest('[data-scope]');
    if (!button || !getOrder().includes(button.dataset.scope)) return;
    gesture = { button, pointerId: event.pointerId, pointerType: event.pointerType, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, original: [...getOrder()], order: [...getOrder()], active: false };
    if (event.pointerType !== 'mouse') gesture.timer = setTimeout(start, 280);
  });
  window.addEventListener('pointermove', event => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    if (!gesture.active) {
      const distance = Math.hypot(gesture.x - gesture.startX, gesture.y - gesture.startY);
      if (gesture.pointerType === 'mouse' && distance > 6) start();
      else if (distance > 10) finish(false);
    }
    if (!gesture?.active) return;
    event.preventDefault();
    updatePreview();
  }, { passive: false });
  window.addEventListener('pointerup', event => { if (gesture?.pointerId === event.pointerId) finish(true); });
  window.addEventListener('pointercancel', event => { if (gesture?.pointerId === event.pointerId) finish(false); });
  tabs.addEventListener('lostpointercapture', () => finish(false));
  tabs.addEventListener('scroll', () => { if (gesture && !gesture.active) finish(false); });
  // Safari needs a non-passive touch listener to keep a held drag from scrolling.
  tabs.addEventListener('touchmove', event => { if (gesture?.active) event.preventDefault(); }, { passive: false });
  tabs.addEventListener('touchstart', event => { if (event.touches.length > 1) finish(false); }, { passive: true });
  tabs.addEventListener('contextmenu', event => { if (enabled() && event.target.closest('[data-scope]')) event.preventDefault(); });
  tabs.addEventListener('dragstart', event => event.preventDefault());
  tabs.addEventListener('click', event => {
    if (performance.now() >= suppressClickUntil) return;
    suppressClickUntil = 0;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  tabs.addEventListener('keydown', event => {
    if (!enabled() || !event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const button = event.target.closest('[data-scope]');
    const order = [...getOrder()], from = order.indexOf(button?.dataset.scope);
    if (from < 0) return;
    event.preventDefault();
    finish(false);
    const columnCount = getComputedStyle(tabs).gridTemplateColumns.split(' ').length;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columnCount, ArrowDown: columnCount }[event.key];
    const to = Math.max(0, Math.min(order.length - 1, from + delta));
    if (from === to) return;
    order.splice(from, 1);
    order.splice(to, 0, button.dataset.scope);
    arrange(order, true);
    button.focus({ preventScroll: true });
    button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    onCommit(order, button.dataset.scope);
  });
  window.addEventListener('blur', () => finish(false));
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(false); });
  return { cancel: () => finish(false) };
}
