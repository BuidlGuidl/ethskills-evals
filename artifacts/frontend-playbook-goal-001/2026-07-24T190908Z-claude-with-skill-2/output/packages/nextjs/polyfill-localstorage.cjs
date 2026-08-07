// Node 25+ ships a built-in `localStorage` that is missing the standard WebStorage
// methods (getItem/setItem/...). During `output: "export"` static prerendering,
// next-themes / RainbowKit call localStorage.getItem() and crash pages (which then
// 404 on IPFS). Injected into every build process via NODE_OPTIONS="--require ./polyfill-localstorage.cjs"
// so it also runs inside Next.js's separate prerender worker (instrumentation.ts does not).
if (typeof globalThis.localStorage !== "undefined" && typeof globalThis.localStorage.getItem !== "function") {
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
