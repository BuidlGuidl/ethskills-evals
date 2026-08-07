// Node.js 25+ ships a built-in `localStorage` that is missing the standard
// WebStorage methods (getItem/setItem/...). Libraries like next-themes and
// RainbowKit call localStorage.getItem() during server-side rendering, which
// then throws "localStorage.getItem is not a function". This shim replaces the
// broken global with a minimal in-memory implementation. Injected via
// NODE_OPTIONS="--require ./polyfill-localstorage.cjs".
if (
  typeof globalThis.localStorage === "undefined" ||
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
