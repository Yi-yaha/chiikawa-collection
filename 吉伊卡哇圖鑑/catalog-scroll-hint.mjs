import { visibleViewport } from './dialog-viewport.mjs?v=08ff7e81c7e19075';

function lastBefore(elements, y) {
  let start = 0, end = elements.length;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    if (elements[middle].getBoundingClientRect().top <= y) start = middle + 1;
    else end = middle;
  }
  return elements[start - 1];
}

function headingAt(catalog, y) {
  // 先用外層分區縮小範圍，避免為了讀取標題而排版畫面外的商品。
  const mainHeading = ':scope > .group-heading > h3';
  let group = lastBefore(catalog.children,y);
  let title = group?.querySelector(mainHeading);
  if (!title) return null;
  if (title.getBoundingClientRect().top > y) {
    group = group.previousElementSibling;
    title = group?.querySelector(mainHeading);
  }
  const series = group?.querySelector(':scope > .catalog-series-products');
  const childTitle = series ? lastBefore(series.querySelectorAll('.catalog-series-heading > :is(h4,h5,h6)'),y) : null;
  return childTitle || title;
}

export function createCatalogScrollHint({ scroller = window, getCatalog, isActive, getTop = () => 0 }) {
  const dialog = scroller === window ? null : scroller;
  const scrollArea = dialog || document.scrollingElement;
  const thumb = document.createElement('button');
  thumb.type = 'button';
  thumb.className = 'catalog-scroll-thumb';
  thumb.hidden = true;
  thumb.setAttribute('role','scrollbar');
  thumb.setAttribute('aria-label','快速捲動圖鑑');
  thumb.setAttribute('aria-orientation','vertical');
  thumb.setAttribute('aria-valuemin','0');
  thumb.setAttribute('aria-valuemax','100');
  const label = document.createElement('div');
  label.className = 'catalog-scroll-hint';
  label.hidden = true;
  label.setAttribute('aria-hidden','true');
  (dialog || document.body).append(thumb,label);
  let frame = 0, timer, drag;
  let showing = false;

  function clearLabel() {
    clearTimeout(timer);
    showing = false;
    label.hidden = true;
  }

  function releaseDrag() {
    if (!drag) return;
    const { id } = drag;
    drag = null;
    if (thumb.hasPointerCapture(id)) thumb.releasePointerCapture(id);
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  function hide() {
    releaseDrag();
    clearLabel();
    schedule();
  }

  function reveal() {
    showing = true;
    clearTimeout(timer);
    if (!drag) timer = setTimeout(clearLabel,650);
    schedule();
  }

  function track() {
    const viewport = visibleViewport();
    const panel = dialog?.getBoundingClientRect();
    const top = Math.max(viewport.top, panel?.top ?? getTop());
    const bottom = Math.min(viewport.top + viewport.height, panel?.bottom ?? Infinity);
    return {
      top, bottom, start:top + 30, travel:bottom - top - 60,
      range:scrollArea.scrollHeight - scrollArea.clientHeight,
      right:panel ? Math.max(0,document.documentElement.clientWidth - panel.right + 1) : 0,
    };
  }

  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const scrollTo = top => scrollArea.scrollTo({top,behavior:'instant'});

  function update() {
    frame = 0;
    const catalog = getCatalog();
    const hasGroups = catalog?.firstElementChild?.classList.contains('catalog-group');
    const geometry = isActive() && hasGroups && catalog.getClientRects().length ? track() : null;
    const available = Boolean(geometry && geometry.range > 0 && geometry.travel > 0);
    scrollArea.classList.toggle('catalog-scroll-controlled',available);
    thumb.hidden = !available;
    if (!available) { releaseDrag(); clearLabel(); return; }

    const {top,bottom,start,travel,range,right} = geometry;
    if (drag?.moved) {
      drag.moved = false;
      const destination = clamp((drag.y - drag.offset - start) / travel,0,1) * range;
      scrollTo(destination);
    }
    const progress = clamp(scrollArea.scrollTop / range,0,1);
    const thumbCenter = drag ? clamp(drag.y - drag.offset,start,start + travel) : start + progress * travel;
    const inset = Math.min(34,(bottom - top) / 2);
    const labelCenter = clamp(drag?.y ?? thumbCenter,top + inset,bottom - inset);
    const bounds = showing ? catalog.getBoundingClientRect() : null;
    // 讀取與標籤同一高度的分區標題。兩個標題之間沿用上一個標題。
    const heading = bounds && bounds.top <= labelCenter && labelCenter < bounds.bottom ? headingAt(catalog,labelCenter) : null;
    const name = heading?.textContent.trim() || '';

    thumb.style.top = thumbCenter + 'px';
    thumb.style.right = right + 'px';
    thumb.setAttribute('aria-controls',catalog.id);
    thumb.setAttribute('aria-valuenow',String(Math.round(progress * 100)));
    thumb.classList.toggle('is-dragging',Boolean(drag));
    label.hidden = !name;
    if (!name) return;

    if (label.textContent !== name) label.textContent = name;
    label.style.top = labelCenter + 'px';
    label.style.right = right + 20 + 'px';
  }

  thumb.addEventListener('pointerdown',event => {
    if (!event.isPrimary || event.button !== 0 || !isActive()) return;
    event.preventDefault();
    const bounds = thumb.getBoundingClientRect();
    drag = { id:event.pointerId, y:event.clientY, offset:event.clientY - (bounds.top + bounds.height / 2), moved:false };
    thumb.setPointerCapture(event.pointerId);
    reveal();
  });
  thumb.addEventListener('pointermove',event => {
    if (drag?.id !== event.pointerId) return;
    drag.y = event.clientY;
    drag.moved = true;
    schedule();
  });
  function finishDrag(event) {
    if (drag?.id !== event.pointerId) return;
    if (event.type !== 'pointerup') return hide();
    if (drag.moved) {
      cancelAnimationFrame(frame);
      update();
    }
    releaseDrag();
    reveal();
  }
  for (const event of ['pointerup','pointercancel','lostpointercapture']) thumb.addEventListener(event,finishDrag);
  thumb.addEventListener('keydown',event => {
    const {scrollTop,clientHeight,scrollHeight} = scrollArea;
    const positions = {ArrowUp:scrollTop - 40,ArrowDown:scrollTop + 40,PageUp:scrollTop - clientHeight,PageDown:scrollTop + clientHeight,Home:0,End:scrollHeight};
    if (!Object.hasOwn(positions,event.key)) return;
    event.preventDefault();
    scrollTo(positions[event.key]);
    reveal();
  });

  scroller.addEventListener('scroll',reveal,{passive:true});
  scroller.addEventListener('pointerdown',event => { if (event.target !== thumb) clearLabel(); },{passive:true});
  window.addEventListener('resize',schedule);
  window.visualViewport?.addEventListener('resize',schedule);
  document.addEventListener('close',schedule,true);
  if (typeof ResizeObserver !== 'undefined') {
    const resize = new ResizeObserver(schedule);
    resize.observe(dialog?.firstElementChild || document.body);
    if (dialog) resize.observe(dialog);
  }
  schedule();
  return { hide };
}
