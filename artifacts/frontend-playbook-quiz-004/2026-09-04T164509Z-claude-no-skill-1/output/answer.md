# `TypeError: localStorage.getItem is not a function` on Node 25

## The 30-second version

Both teammates are wrong, in opposite directions.

* **A is wrong about Node.** Node ships Web Storage now. On Node 25 `localStorage` is a
  **global that exists by default** — no flag. So there is very much something there to call
  `.getItem` on.
* **B is wrong about the object.** The bug is not "`localStorage` is missing." It is
  "`localStorage` is present but **degraded to a plain empty `{}`**," because Node 25 enables
  Web Storage by default but has no backing file to persist it to. An empty object is truthy,
  passes every `typeof` guard, and has no `getItem`. Hence the exact error text.
* **B's fix lands in the wrong process.** `next build` prerenders routes in **spawned worker
  processes**, not in the process that ran `instrumentation.ts`. The polyfill is installed
  somewhere the prerender never looks.

The real fix is to stop reading storage during prerender. The one-line CI unblock is
`NODE_OPTIONS=--no-experimental-webstorage`, which works precisely *because* env vars
propagate into child workers and `instrumentation.ts` does not.

> Note on scope: this directory contains only `package.json` and `TASK.md` — no app source —
> so everything below about Node is verified by direct execution (commands and real output
> included), and the Scaffold-ETH-specific call sites at the end are the places to look, not
> confirmed sightings in your tree.

---

## 1. What actually changed in Node

Three distinct steps, not one:

| Node | `localStorage` global | Behaviour with no `--localstorage-file` |
|---|---|---|
| ≤ 22.3 | does not exist | — |
| 22.4 – 24 | exists **only** with `--experimental-webstorage` | **throws** `ERR_INVALID_ARG_VALUE` on access |
| 25 | **exists by default** | **warns**, then hands you a plain `{}` |

Verified on the toolchains on this machine:

```console
$ for v in v20.19.1 v22.22.2 v24.14.1 v25.9.0; do
    ~/.nvm/versions/node/$v/bin/node -p "typeof localStorage"; done
undefined      # v20.19.1
undefined      # v22.22.2   <- flag exists, but off by default
undefined      # v24.14.1   <- same
object         # v25.9.0    <- ON BY DEFAULT
```

The flag itself was renamed from experimental to opt-*out*, which is the tell that it graduated:

```console
$ node --version && node --help | grep -i webstorage
v25.9.0
  --webstorage, --no-experimental-webstorage
```

(On 22 and 24 the same grep prints `--experimental-webstorage   experimental Web Storage API`.)

### Why the failure mode is `getItem is not a function` and not `localStorage is not defined`

`sessionStorage` is in-memory, so Node can always build a real one. `localStorage` is *persistent*
— it needs a SQLite file, supplied via `--localstorage-file`. Node 25 turns Web Storage on by
default but obviously cannot invent a default path for your process, so it degrades:

```console
$ node -e "console.log(typeof localStorage, typeof localStorage.getItem)"
(node:…) Warning: `--localstorage-file` was provided without a valid path
object undefined

$ node -p "localStorage"
{}
```

Give it a file and you get the real thing:

```console
$ node --localstorage-file=/tmp/ls.db \
    -e "console.log(localStorage.constructor.name, typeof localStorage.getItem)"
Storage function
```

Compare Node 22/24, where the same situation was a hard throw rather than a silent downgrade:

```console
$ ~/.nvm/versions/node/v24.14.1/bin/node --experimental-webstorage -p "typeof localStorage"
TypeError [ERR_INVALID_ARG_VALUE]: The argument '--localstorage-file' is an invalid
localStorage location. Received ''
    at Object.get [as localStorage] (node:internal/webstorage:30:17)
```

So Node 25 changed a throw-on-access into a **warn-and-return-`{}`**. That downgrade is the
entire bug: your code's guards see an object and proceed straight into `.getItem`.

And here is the part that actually broke your build — the standard SSR feature detect inverted:

```console
$ node -e "console.log(typeof localStorage !== 'undefined', typeof window !== 'undefined')"
true false
```

Every library that decides "am I in a browser?" by sniffing `typeof localStorage !== "undefined"`
now answers **yes** inside `next build`. It then calls `getItem` on `{}` and dies. Nothing in your
app changed; the environment started lying to your feature detection.

---

## 2. Why A's mental model is out of date

"Node has no localStorage" was true through Node 24 *by default* and is simply false on 25. A is
reasoning from `window`-vs-Node, which is the right instinct applied to a runtime that moved
underneath them. Node has been steadily absorbing web globals — `fetch`, `WebSocket`,
`Blob`, `crypto.subtle`, `navigator`, and now Web Storage. "It's Node, so browser API X can't
exist" is no longer a safe inference for any specific X.

The stronger reason A should drop the position: the error message itself refutes it.
`localStorage.getItem is not a function` can only be thrown if evaluating `localStorage`
**succeeded** and produced an object. Had the global been absent, the message would have been
`ReferenceError: localStorage is not defined`. The error text is evidence about which of the two
worlds you are in, and it says A's world is not this one.

---

## 3. Why B's polyfill cannot work, however correct it is

Two independent reasons. Either alone sinks it.

### 3a. The prerender does not run in the process that ran `instrumentation.ts`

`next build` does not render your routes in the main build process. It spawns a pool of **static
render worker processes** (jest-worker children) and renders routes there, several at a time. Each
worker is a fresh V8 isolate with a fresh `globalThis`.

`instrumentation.ts` is a *server-lifecycle* hook — its contract is "called once when a new
Next.js server instance is bootstrapped." Whether any given Next version also invokes it inside
build-time render workers is version-dependent, and you do not need to settle that question,
because **your build already answered it**: the failure is *identical* after B's change.

That identity is the proof. A correctly written polyfill assigned onto the global *does* take
effect when it runs — verified:

```console
$ node -e "globalThis.localStorage = { getItem: () => 'poly' }; \
           console.log(localStorage.getItem('x'))"
poly
```

So if B's polyfill had executed in the worker rendering `/_not-found`, `getItem` would have
resolved and the page would have prerendered (returning `null`, harmlessly). Same error, same
line ⇒ the code never ran in that process. The polyfill is not wrong; it is **not there**.

Contrast with the flag, which *does* reach the workers, because the OS copies the environment
into every child:

```console
$ NODE_OPTIONS="--no-experimental-webstorage" node -e "
    require('child_process').execFileSync(process.execPath,
      ['-p','\"child: \"+typeof localStorage'],{stdio:'inherit'})"
child: undefined
```

That is the structural difference between the two approaches: `instrumentation.ts` patches one
process, `NODE_OPTIONS` patches the whole process tree.

### 3b. Even in the right process, the timing and the mutation style both fail

* **Timing.** The `localStorage` read that kills you happens at **module-evaluation** time — a
  wagmi/RainbowKit config, a zustand `persist` store, or a connector created at import scope,
  not inside a component body. ES module evaluation of the route's import graph is not
  sequenced after a framework hook you registered elsewhere. A `register()` that runs "before
  rendering" is still too late for a store that initialised while the module graph was being
  linked.
* **Mutation style.** If B's polyfill *patches* the existing global instead of replacing it, it
  silently no-ops on Node 25. The degraded fallback discards property writes — even through a
  saved reference:

  ```console
  $ node -e "
      localStorage.getItem = () => null;
      console.log('after mutate:', typeof localStorage.getItem);
      const ref = localStorage; ref.getItem = () => null;
      console.log('via ref:', typeof ref.getItem);
      globalThis.localStorage = { getItem: () => null };
      console.log('after replace:', typeof localStorage.getItem);"
  after mutate: undefined
  via ref:      undefined
  after replace: function
  ```

  Only whole-global **replacement** sticks. `Object.defineProperty` on the object reports
  success and still does not stick. A "correct" polyfill written as `localStorage.getItem = …`
  is a no-op that fails silently on this exact runtime.

And the framing point: even a working polyfill is the wrong goal. It would make the build pass by
letting a browser-only code path run during prerender and quietly return `null` — baking a
logged-out, wrong-network, default-state HTML snapshot into your static export, then hydrating to
something different in the browser. You would trade a loud build failure for a silent hydration
mismatch. Fix the call site, not the global.

---

## 4. What actually fixes it

### Immediate: unblock CI (one line)

```yaml
env:
  NODE_OPTIONS: --no-experimental-webstorage
```

Restores `typeof localStorage === "undefined"`, so every existing browser check behaves as it did
on Node 24, and it propagates into the render workers (verified above). Do **not** "fix" it with
`--localstorage-file=…`: that gives the prerender a real, writable Storage, which makes the build
pass while letting SSR read and write a SQLite file on your CI runner — the silent-wrong-output
scenario above, made durable.

Pinning CI back to Node 24 also works and buys the same time. Both are stopgaps: Web Storage is
on by default from here forward, so the code has to be corrected regardless.

### The real fix: never let storage access reach the prerender

**Detect the browser with `window`, not with `localStorage`.** `window` is the one global Node
still does not define, and the check above shows the two detects now disagree.

```diff
- if (typeof localStorage !== "undefined") { … }        // true in Node 25. broken.
+ if (typeof window !== "undefined") { … }              // false in Node 25. correct.

- const raw = localStorage.getItem("theme");
+ const raw = window.localStorage.getItem("theme");     // throws early & obviously if wrong
```

Grep for the broken shape across the app, including anything vendored:

```bash
rg -n "typeof (localStorage|sessionStorage)\s*[!=]==?\s*[\"']undefined[\"']" packages/nextjs
rg -n "(?<!window\.)\blocalStorage\.(get|set|remove)Item" packages/nextjs
```

**Move the read out of module scope and out of render.** Storage is a side effect; it belongs in
an effect:

```ts
const [value, setValue] = useState<string | null>(null);   // SSR-safe default
useEffect(() => { setValue(window.localStorage.getItem("key")); }, []);
```

**For zustand `persist`,** hand it a storage that degrades to a no-op on the server and defer
rehydration so the server and first client render agree:

```ts
import { createJSONStorage, persist } from "zustand/middleware";

const noopStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

persist(storeInitializer, {
  name: "scaffold-eth",
  storage: createJSONStorage(() =>
    typeof window !== "undefined" ? window.localStorage : noopStorage
  ),
  skipHydration: true,   // then call store.persist.rehydrate() from a useEffect
});
```

**For a subtree that genuinely cannot render without the browser,** keep it off the server
entirely:

```ts
const WalletBits = dynamic(() => import("./WalletBits"), { ssr: false });
```

### Where to look in a Scaffold-ETH 2 app

`/_not-found` is the giveaway, and it is worth understanding why it named itself. You almost
certainly do not have a `not-found.tsx` that touches storage. Next.js prerenders its built-in
not-found page **wrapped in your root layout**, so the whole provider tree mounts: it is the
minimal route that still drags in every global provider. `/_not-found` failing means "your
providers cannot survive prerendering," not "your 404 page is broken." Expect the other static
routes to fail the same way once this one is fixed.

Prime suspects, in the order I would check them:

1. **The burner wallet connector** — reads the private key out of `localStorage` at
   connector-construction time, which is module scope.
2. **wagmi / RainbowKit config and `WagmiProvider`** storage — wagmi's default storage is
   `createStorage({ storage: localStorage })` guarded by exactly the feature detect that just
   inverted.
3. **WalletConnect / Web3Modal session restore**, same pattern.
4. **Your own zustand stores** (`useGlobalState`, target-network / theme state) using `persist`.
5. **`next-themes`** and any theme-flash script reading storage during render.

Check them under the broken runtime directly — `node --version && node -p "typeof localStorage"`
inside the CI image will tell you in one line which world your build is running in.

---

## Summary for the thread

* Node 25 turned Web Storage on by default (22.4–24: `--experimental-webstorage`, off).
* With no `--localstorage-file`, Node 25 warns and gives you `{}` instead of throwing as 22/24
  did — an object with no methods. That is the `TypeError`, verbatim.
* A: the error message is itself proof the global exists; absence would read
  `ReferenceError: localStorage is not defined`.
* B: the polyfill is fine, its location is not. `next build` prerenders in spawned worker
  processes; the identical failure after the change proves the code never ran there. It would
  also be too late for module-scope reads, and a no-op if written as a mutation rather than a
  replacement.
* Unblock with `NODE_OPTIONS=--no-experimental-webstorage` (reaches the workers; `instrumentation.ts`
  does not). Then fix it properly: detect with `typeof window`, call `window.localStorage`, and
  read storage in `useEffect` / `skipHydration` / `ssr: false` — never during prerender.
