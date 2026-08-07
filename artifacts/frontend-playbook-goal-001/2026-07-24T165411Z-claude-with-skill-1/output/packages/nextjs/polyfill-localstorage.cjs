// Node 25+ ships a built-in `localStorage` that is missing the standard WebStorage API
// methods (getItem/setItem/...). That breaks next-themes, RainbowKit, and anything that
// touches localStorage during static prerendering. Injected via NODE_OPTIONS="--require ..."
// so it runs in EVERY build worker process, not just the main one.
if (
  typeof globalThis.localStorage !== "undefined" &&
  typeof globalThis.localStorage.getItem !== "function"
) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
    clear: () => store.clear(),
    key: index => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}
