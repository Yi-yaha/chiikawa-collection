// Observe card boxes, whose reserved size stays available even when the browser
// skips painting their contents. No scroll handler or full-list layout reads.
export function createCatalogImageLoader(root) {
  const queued = new Set();
  const visible = new Set();
  const active = new Set();
  const registered = new Set();
  let nearbyObserver, visibleObserver, frame;
  const connection = navigator.connection;
  const concurrency = connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '') ? 2 : 4;

  function schedule() {
    if (!frame) frame = requestAnimationFrame(pump);
  }

  function pump() {
    frame = null;
    if (document.hidden) return;
    while (active.size < concurrency && queued.size) {
      const img = [...queued].find(candidate => visible.has(candidate)) || queued.values().next().value;
      queued.delete(img);
      if (!img.isConnected || !img.dataset.src) continue;
      active.add(img);
      img.loading = 'eager';
      img.fetchPriority = visible.has(img) ? 'high' : 'low';
      const loaded = new Promise(resolve => {
        const finish = () => {
          img.removeEventListener('load', finish);
          img.removeEventListener('error', finish);
          resolve();
        };
        img.addEventListener('load', finish);
        img.addEventListener('error', finish);
      });
      img.src = img.dataset.src;
      delete img.dataset.src;
      loaded.then(async () => {
        // Prepare pixels before scrolling them into view without blocking UI.
        if (img.isConnected && img.naturalWidth && img.decode) {
          try { await img.decode(); } catch { /* Existing image fallback handles errors. */ }
        }
      }).finally(() => {
        active.delete(img);
        schedule();
      });
    }
  }

  function observeCards() {
    if (!nearbyObserver) return;
    root.querySelectorAll('.product-card').forEach(card => {
      if (registered.has(card)) return;
      registered.add(card);
      nearbyObserver.observe(card);
      visibleObserver.observe(card);
    });
  }

  function refresh() {
    // Keep at most four existing downloads across filter/role changes, and
    // discard every old queued image rather than starting a second batch.
    queued.clear();
    visible.clear();
    nearbyObserver?.disconnect();
    visibleObserver?.disconnect();
    registered.clear();
    const cards = root.querySelectorAll('.product-card');
    if (typeof IntersectionObserver === 'undefined') {
      cards.forEach(card => {
        const img = card.querySelector('img[data-src]');
        if (img) { img.src = img.dataset.src; delete img.dataset.src; }
      });
      return;
    }
    const ahead = Math.ceil(window.innerHeight * 2);
    nearbyObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const img = entry.target.querySelector('.product-image img');
        if (!img) return;
        if (entry.isIntersecting && img.dataset.src) queued.add(img);
        else queued.delete(img);
      });
      schedule();
    }, { rootMargin: '0px 0px ' + ahead + 'px 0px' });
    visibleObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const img = entry.target.querySelector('.product-image img');
        if (!img) return;
        if (entry.isIntersecting) {
          visible.add(img);
          if (active.has(img)) img.fetchPriority = 'high';
        } else visible.delete(img);
      });
      schedule();
    });
    cards.forEach(card => {
      registered.add(card);
      nearbyObserver.observe(card);
      visibleObserver.observe(card);
    });
    schedule();
  }

  // Only register additions, retaining in-flight images and existing card DOM
  // when a collection is removed or restored.
  function update() {
    if (!nearbyObserver) { refresh(); return; }
    for (const img of queued) if (!img.isConnected) queued.delete(img);
    for (const img of visible) if (!img.isConnected) visible.delete(img);
    for (const card of registered) {
      if (card.isConnected) continue;
      nearbyObserver.unobserve(card);
      visibleObserver.unobserve(card);
      registered.delete(card);
    }
    observeCards();
  }

  let resizeFrame;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(refresh);
  }, { passive: true });
  document.addEventListener('visibilitychange', schedule);
  return { refresh, update };
}
