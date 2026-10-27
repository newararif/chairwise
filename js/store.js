// On-device storage (IndexedDB). Falls back to memory if the browser blocks it.
// The ledger and receipt photos never leave the phone unless the user exports them.

const DB_NAME = 'chairwise-hack';
const STORES = { entries: 'id', receipts: 'id', settings: 'key' };

let db = null;
const memory = { entries: new Map(), receipts: new Map(), settings: new Map() };

function openDB() {
  return new Promise((ok, fail) => {
    if (!('indexedDB' in window)) return fail(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath });
      }
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
}

function tx(store, mode, work) {
  return new Promise((ok, fail) => {
    const t = db.transaction(store, mode);
    const req = work(t.objectStore(store));
    let out;
    if (req) req.onsuccess = () => { out = req.result; };
    t.oncomplete = () => ok(out);
    t.onerror = t.onabort = () => fail(t.error);
  });
}

const keyOf = (store, value) => value[STORES[store]];

export const store = {
  durable: false,
  async init() {
    try { db = await openDB(); this.durable = true; } catch { db = null; }
  },
  all: (s) => (db ? tx(s, 'readonly', (o) => o.getAll()) : Promise.resolve([...memory[s].values()])),
  get: (s, k) => (db ? tx(s, 'readonly', (o) => o.get(k)) : Promise.resolve(memory[s].get(k))),
  put: (s, v) => (db ? tx(s, 'readwrite', (o) => o.put(v)) : Promise.resolve(void memory[s].set(keyOf(s, v), v))),
  remove: (s, k) => (db ? tx(s, 'readwrite', (o) => o.delete(k)) : Promise.resolve(void memory[s].delete(k))),
  clear: (s) => (db ? tx(s, 'readwrite', (o) => o.clear()) : Promise.resolve(void memory[s].clear()))
};

export function askForDurableStorage() {
  try { navigator.storage?.persist?.(); } catch { /* optional */ }
}
