// Node 25+ ships a built-in `localStorage` that is missing the standard WebStorage
// methods (getItem/setItem/...). That breaks next-themes / RainbowKit during static
// prerendering. Injected via NODE_OPTIONS="--require ./polyfill-localstorage.cjs" so it
// runs in every build worker process (instrumentation.ts / next.config do not).
if (
  typeof globalThis.localStorage !== "undefined" &&
  typeof globalThis.localStorage.getItem !== "function"
) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
    clear: () => store.clear(),
    key: index => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}
