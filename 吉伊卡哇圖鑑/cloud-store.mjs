import { STORAGE_KEY } from './model.mjs?v=cc79b8b54b995770';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const valueOf = row => ({ quantity:row?.quantity || 0, wished:row?.quantity > 0 ? false : Boolean(row?.wished) });
const preferences = saved => ({ characterOrder:saved.characterOrder, groupBy:saved.groupBy, includedTypes:saved.includedTypes });
export const accountStorageKey = uid => uid ? STORAGE_KEY + '-account-' + uid : STORAGE_KEY;

/** Local pending edits survive reloads. Server versions prevent stale devices overwriting edits. */
export function createCloudStore({ client, storage, normalize, onApply = () => {}, onScope = () => {}, onStatus = () => {}, online = () => true }) {
  let uid = null, generation = 0, canWrite = false, hydrated = false, data;
  let running = null, timer, editId = 0, failures = 0, storageOK = true;
  let inFlightItems = new Set(), inFlightSettings = false;
  const empty = () => ({ rows:{}, pending:{}, settings:{ value:{}, version:0 }, pendingSettings:null, conflicts:{ items:{}, settings:null }, view:normalize(null), syncedAt:null });
  const key = () => accountStorageKey(uid) + '-sync';
  const pendingCount = () => Object.keys(data?.pending || {}).length + Number(Boolean(data?.pendingSettings));
  function status(state, error = null) {
    if (!uid) { onStatus({ state:'guest', pending:0, conflicts:[], storageOK }); return; }
    const conflicts = Object.entries(data.conflicts.items).filter(([id]) => data.pending[id]).map(([id, remote]) => ({ id, local:valueOf(data.pending[id]), remote:valueOf(remote) }));
    if (data.conflicts.settings && data.pendingSettings) conflicts.push({ id:'__settings', local:data.pendingSettings.value, remote:data.conflicts.settings.settings });
    onStatus({ state:state || (conflicts.length ? 'conflict' : !hydrated ? 'loading' : pendingCount() ? 'pending' : 'saved'), pending:pendingCount(), conflicts, syncedAt:data.syncedAt, storageOK, error });
  }
  function save() {
    if (!uid) return;
    try {
      storage.setItem(key(), JSON.stringify(data));
      storage.setItem(accountStorageKey(uid), JSON.stringify(data.view));
      storageOK = true;
    } catch { storageOK = false; }
  }
  function apply() {
    const entries = { ...data.rows, ...data.pending };
    const quantities = {}, wishlist = [];
    for (const [id, row] of Object.entries(entries)) {
      if (row.quantity > 0) quantities[id] = row.quantity;
      else if (row.wished) wishlist.push(id);
    }
    const next = normalize({ ...data.settings.value, ...data.pendingSettings?.value, quantities, wishlist, owned:[] });
    const changed = !same(data.view, next);
    data.view = next;
    save();
    // Keep the comparison snapshot private when the interface edits its copy.
    if (changed) onApply(normalize(next));
  }
  function schedule(delay = 0) {
    clearTimeout(timer);
    if (uid) timer = setTimeout(() => { void sync(); }, delay);
  }
  function reconcile() {
    for (const [id, pending] of Object.entries(data.pending)) {
      const remote = data.rows[id] || { quantity:0, wished:false, version:0 };
      if (same(valueOf(pending), valueOf(remote)) && !inFlightItems.has(id)) {
        delete data.pending[id]; delete data.conflicts.items[id];
      } else if (remote.version !== pending.base_version) data.conflicts.items[id] = remote;
      else delete data.conflicts.items[id];
    }
    if (data.pendingSettings) {
      if (same(data.pendingSettings.value, preferences(normalize(data.settings.value))) && !inFlightSettings) {
        data.pendingSettings = null; data.conflicts.settings = null;
      } else if (data.pendingSettings.base_version !== data.settings.version) {
        data.conflicts.settings = { settings:data.settings.value, version:data.settings.version };
      } else data.conflicts.settings = null;
    }
  }
  async function sync() {
    if (!uid) return;
    if (running) return running;
    if (!online()) { status('pending'); return; }
    const activeGeneration = generation, activeUid = uid;
    status('syncing');
    const work = async () => {
      try {
        const [itemsResult, settingsResult] = await Promise.all([
          client.from('collection_items').select('item_id,quantity,wished,version').eq('user_id', activeUid),
          client.from('collection_settings').select('settings,version').eq('user_id', activeUid).maybeSingle(),
        ]);
        if (generation !== activeGeneration) return;
        if (itemsResult.error) throw itemsResult.error;
        if (settingsResult.error) throw settingsResult.error;
        data.rows = Object.fromEntries((itemsResult.data || []).map(row => [row.item_id, row]));
        data.settings = { value:settingsResult.data?.settings || {}, version:settingsResult.data?.version || 0 };
        hydrated = true;
        reconcile(); apply();
        if (canWrite) {
          const batch = Object.entries(data.pending).filter(([id]) => !data.conflicts.items[id]).slice(0, 5000).map(([item_id, row]) => ({ item_id, ...row }));
          if (batch.length) {
            inFlightItems = new Set(batch.map(row => row.item_id));
            const result = await client.rpc('save_collection_changes', { p_changes:batch.map(({ editId:ignored, ...row }) => row) });
            if (generation !== activeGeneration) return;
            if (result.error) throw result.error;
            for (const row of result.data.applied || []) {
              data.rows[row.item_id] = row;
              const sent = batch.find(entry => entry.item_id === row.item_id);
              const pending = data.pending[row.item_id];
              if (pending?.editId === sent?.editId) delete data.pending[row.item_id];
              else if (pending) pending.base_version = row.version;
              delete data.conflicts.items[row.item_id];
            }
            for (const row of result.data.conflicts || []) {
              data.rows[row.item_id] = row;
              if (data.pending[row.item_id]) data.conflicts.items[row.item_id] = row;
            }
            inFlightItems.clear(); reconcile(); apply();
          }
          const settings = data.pendingSettings && !data.conflicts.settings ? { ...data.pendingSettings } : null;
          if (settings) {
            inFlightSettings = true;
            const result = await client.rpc('save_collection_settings', { p_settings:settings.value, p_base_version:settings.base_version });
            if (generation !== activeGeneration) return;
            if (result.error) throw result.error;
            data.settings = { value:result.data.settings, version:result.data.version };
            if (result.data.conflict) data.conflicts.settings = result.data;
            else if (data.pendingSettings?.editId === settings.editId) data.pendingSettings = null;
            else if (data.pendingSettings) data.pendingSettings.base_version = result.data.version;
            inFlightSettings = false; reconcile(); apply();
          }
        }
        data.syncedAt = new Date().toISOString();
        failures = 0; save(); status();
        if (canWrite && pendingCount() && (!Object.keys(data.conflicts.items).length && !data.conflicts.settings)) schedule();
      } catch (error) {
        if (generation !== activeGeneration) return;
        inFlightItems.clear(); inFlightSettings = false;
        failures++; save(); status('error', error.message || '暫時無法同步');
        schedule(Math.min(30000, 1500 * 2 ** Math.min(failures, 4)));
      }
    };
    const promise = work();
    running = promise;
    try { await promise; } finally { if (running === promise) running = null; }
  }
  return {
    get userId() { return uid; },
    get saved() { return data ? normalize(data.view) : undefined; },
    get ready() { return hydrated; },
    get pending() { return pendingCount(); },
    async open(userId, writable = true) {
      generation++; clearTimeout(timer); running = null; inFlightItems = new Set(); inFlightSettings = false;
      uid = userId; canWrite = writable; hydrated = false; data = empty();
      try {
        const cached = JSON.parse(storage.getItem(key()) || 'null');
        if (cached?.rows && cached?.pending && cached?.settings && cached?.conflicts) {
          data = { ...data, ...cached, view:normalize(cached.view) };
          editId = Math.max(editId, ...Object.values(data.pending).map(row => row.editId || 0), data.pendingSettings?.editId || 0);
        } else data.view = normalize(JSON.parse(storage.getItem(accountStorageKey(uid)) || 'null'));
      } catch { storageOK = false; }
      onScope(uid); onApply(normalize(data.view)); status('loading');
      await sync();
    },
    close() {
      generation++; clearTimeout(timer); running = null; inFlightItems = new Set(); inFlightSettings = false;
      uid = null; hydrated = false; data = null; canWrite = false;
      onScope(null);
      let guest;
      try { guest = JSON.parse(storage.getItem(STORAGE_KEY) || 'null'); } catch {}
      onApply(normalize(guest)); status();
    },
    enableWrites() { canWrite = true; schedule(0); },
    capture(next) {
      if (!uid) return;
      next = normalize(next);
      const previous = data.view;
      const ids = new Set([...Object.keys(previous.quantities), ...previous.wishlist, ...Object.keys(next.quantities), ...next.wishlist]);
      for (const id of ids) {
        const before = { quantity:previous.quantities[id] || 0, wished:previous.wishlist.includes(id) };
        const after = { quantity:next.quantities[id] || 0, wished:next.wishlist.includes(id) };
        if (same(before, after)) continue;
        data.pending[id] = { ...after, base_version:data.pending[id]?.base_version ?? data.rows[id]?.version ?? 0, editId:++editId };
      }
      if (!same(preferences(previous), preferences(next))) {
        data.pendingSettings = { value:preferences(next), base_version:data.pendingSettings?.base_version ?? data.settings.version, editId:++editId };
      }
      data.view = next; reconcile(); save(); status(); schedule();
    },
    resolve(id, choice) {
      if (!uid) return;
      if (id === '__settings' && data.conflicts.settings) {
        if (choice === 'remote') data.pendingSettings = null;
        else data.pendingSettings.base_version = data.conflicts.settings.version;
        data.conflicts.settings = null;
      } else if (data.conflicts.items[id]) {
        if (choice === 'remote') delete data.pending[id];
        else data.pending[id].base_version = data.conflicts.items[id].version;
        delete data.conflicts.items[id];
      }
      apply(); status(); schedule(0);
    },
    sync,
    destroy() { generation++; clearTimeout(timer); uid = null; running = null; },
  };
}
