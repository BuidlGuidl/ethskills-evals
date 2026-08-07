# Why the Node 25 build breaks: `localStorage.getItem is not a function` during prerender

## TL;DR

Node **did** grow a `localStorage`. As of **Node 25 the Web Storage API (`localStorage` / `sessionStorage`) is enabled by default** — no flag required. Your SSR/prerender code has a branch that used to be dead because `localStorage` was `undefined` on the server; now that a `localStorage` global exists in the Node realm, that branch runs during `next build` and blows up.

- **Teammate A is wrong** because "Node has no `localStorage`" describes Node ≤ 24, not Node 25.
- **Teammate B's polyfill can't help** because it's registered in the wrong place: `instrumentation.ts`'s `register()` runs in the Next.js *server runtime*, but static-export prerendering runs at build time in a *separate worker process / render realm* that never executes your `register()` before the page module is evaluated.
- **The fix is in your app code:** stop keying "am I on the server?" off `localStorage` (or `navigator`/`self`), because Node now provides those. Guard on `typeof window` (Node still has **no** `window`), move storage access into effects/client-only code, and configure wagmi for SSR.

---

## 1. What actually changed in Node

For years, the reliable assumption was: *browser globals don't exist in Node*. That's how virtually every "isomorphic" library detected the server — `typeof localStorage !== 'undefined'`, `typeof navigator !== 'undefined'`, etc.

Node has been steadily backfilling web-platform globals to make browser/server code sharing possible:

- `fetch`, `Blob`, `FormData`, `WebSocket`, `navigator`, `structuredClone` — added over Node 18–22.
- **Web Storage (`localStorage` / `sessionStorage`)** — added in **Node 22.4 behind `--experimental-webstorage`**, and **turned on by default in Node 25** (still marked "experimental," but present without any flag).

So on Node 25, `globalThis.localStorage` is a real, defined value in a plain Node process. The premise that broke your build is exactly this: a global that was reliably absent is now reliably present.

> Sharp edge worth knowing: Node **25.2.0** briefly made `localStorage` *spec-compliant to the point of throwing on access* under some conditions, which broke so much tooling that **25.2.1 reverted** that behavior. The API is officially experimental and its exact runtime behavior is still in flux — another reason not to build your control flow on top of it.

### Why the specific message is `getItem is not a function`

The important part isn't the exact shape of the object bound to `localStorage` in the prerender realm — it's *that something is bound to it at all*. Your (or a dependency's) guard looked roughly like:

```js
// used to be dead code on the server, because localStorage was undefined
if (typeof localStorage !== 'undefined') {
  const raw = localStorage.getItem('wagmi.store'); // <-- now runs at build time
  // ...
}
```

Before Node 25: `typeof localStorage === 'undefined'` → the branch is skipped → prerender succeeds.
On Node 25: the global exists → the branch executes during prerender → and in that build/render realm the bound value doesn't expose a working `getItem`, so you get `TypeError: localStorage.getItem is not a function`.

The lesson: **`typeof localStorage !== 'undefined'` is no longer a valid "I'm in a browser" check.** Neither are `navigator`, `self`, or `structuredClone`. Node has them all now.

## 2. Why Teammate A's mental model is out of date

A's reasoning — "Node has no `localStorage`, so there's nothing to call `getItem` on, so this error is impossible" — was correct through Node 24 and is the reason the code worked for years. It's simply pre-25 knowledge. On Node 25 the global exists, the "impossible" call is very possible, and it's precisely the newly-present global that flipped a previously-skipped branch into a crashing one. The error isn't impossible; it's *caused by* the thing A thinks doesn't exist.

## 3. Why Teammate B's polyfill can't work — where does the prerender actually run?

B's fix is "correct" in isolation (a real Storage shim) but is installed in a place that never affects the code doing the crashing. Two things defeat it:

**a) `instrumentation.ts` runs in the server runtime, not the export worker.**
`register()` in `instrumentation.ts` is invoked once when a Next.js *server instance* boots. Static export (`output: 'export'` / `next build` prerendering) doesn't boot a server to serve your pages — it **prerenders each page to HTML at build time inside a pool of worker processes** (jest-worker child processes / worker threads). Those workers evaluate your page and provider modules in their own realm. Even where `register()` does run during build, it does not run *inside the export worker's realm before that worker imports and evaluates your page module*. The global B installs and the global the page reads are in different processes.

**b) The crash happens at module evaluation / render, which precedes any runtime hook.**
The offending access fires while the worker is importing/rendering the module graph (Scaffold-ETH's wagmi/RainbowKit providers pulled in by the root layout — which is why `/_not-found` is affected: it inherits the root layout and providers). A polyfill assigned by a runtime `register()` hook is too late and in the wrong process to be present when that module-scope/render code touches `localStorage`.

So no matter how faithful the polyfill is, it is never the object the failing line sees. Same crash, identically.

## 4. What actually fixes it

The durable fix is in your application code — don't touch `localStorage` during server render, and don't detect the server via a global Node now provides.

1. **Detect the browser with `window`, not `localStorage`.** Node 25 has `localStorage`, `navigator`, and `self`, but still has **no `window` and no `document`**. Replace guards like `typeof localStorage !== 'undefined'` with:
   ```js
   if (typeof window !== 'undefined') {
     const raw = window.localStorage.getItem('...');
   }
   ```

2. **Move storage access out of render.** Read/write `localStorage` inside `useEffect`, event handlers, or components loaded client-only:
   ```js
   const Providers = dynamic(() => import('./Providers'), { ssr: false });
   ```

3. **Configure wagmi/RainbowKit for SSR** so it doesn't reach for `localStorage` on the server. Use `ssr: true` and a server-safe storage:
   ```js
   import { createConfig, createStorage, cookieStorage } from 'wagmi';
   export const config = createConfig({
     ssr: true,
     storage: createStorage({ storage: cookieStorage }), // cookie/noop on server, localStorage in browser
     // ...chains, connectors
   });
   ```
   This is the canonical Scaffold-ETH 2 / wagmi SSR pattern and removes the unconditional `localStorage` read from the prerender path.

4. **Find the real caller.** The failing page is `/_not-found`, but the access is almost certainly in the shared root layout / Web3 providers (wagmi persistence, RainbowKit, or a zustand `persist` store). Grep the provider tree for direct `localStorage` / `sessionStorage` / `navigator` references, not the not-found page itself.

5. **Stopgap only:** pin CI back to **Node 24**, where Web Storage is off by default and the branch stays dead. Treat this as a bridge — Node is moving toward these globals being permanently on, so ship the code-side guards (steps 1–4) as the real fix rather than relying on the runtime's absence of a feature.

---

## Sources

- [Node.js 25.2.1 (Current) release notes](https://nodejs.org/en/blog/release/v25.2.1)
- [What's new in Node.js v25.2: Web Storage, V8 14.1, permissions and more — Appwrite](https://appwrite.io/blog/post/nodejs-v25-whats-new)
- [Node v25 breaks tests with Web Storage API — vitest issue #8757](https://github.com/vitest-dev/vitest/issues/8757)
- [Node.js 25: what's new, what broke in the ecosystem — PAS7 Studio](https://pas7.com.ua/blog/en/nodejs-25-whats-new)
- [Next.js — Instrumentation (`register` runs once per server instance)](https://nextjs.org/docs/app/guides/instrumentation)
- [Next.js — Static Exports (Client Components prerendered to HTML at build time)](https://nextjs.org/docs/app/guides/static-exports)
