# Why the Node 25 static export fails

Teammate A's model was true for older Node releases: `localStorage` was normally an
undeclared browser-only global, so server-side feature detection such as
`typeof localStorage !== "undefined"` returned false.

Recent Node versions added an experimental Web Storage implementation. On Node 25,
`globalThis.localStorage` can therefore exist even when Node was started without a
storage backing file. In that configuration the exposed value may not provide the
normal Web Storage methods. A dependency sees that `localStorage` exists, assumes it
is browser-compatible, and calls `localStorage.getItem(...)`; the result is the
counterintuitive `TypeError: localStorage.getItem is not a function`. The failing
`/_not-found` route is merely where that dependency is evaluated during export, not
evidence that the route itself uses storage.

## Why `instrumentation.ts` does not fix it

Next's build command does not do all of its work in the process/runtime where the
application instrumentation hook runs. Static page generation and prerendering run
in a separate Next build worker (a child process). That worker starts its own Node
runtime and gets Node's problematic built-in global before application-level
instrumentation in another runtime could replace it. Consequently, even a perfect
polyfill registered in `instrumentation.ts` cannot repair the global in the process
that is actually throwing. The same process-boundary issue makes assigning a shim
from `next.config.ts` unreliable: mutating the build coordinator's global does not
mutate a child worker's global.

## The fix

Configure Node itself at process startup so the setting is inherited by every Next
build worker. Either give Node's Web Storage implementation a backing file:

```sh
NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
```

or disable Node's experimental Web Storage global so browser-oriented libraries
take their normal server-side fallback path:

```sh
NODE_OPTIONS="--no-experimental-webstorage" yarn build
```

For an SE2 static/IPFS build, apply the option to the same command that invokes the
build, for example:

```sh
NEXT_PUBLIC_IPFS_BUILD=true \
NEXT_PUBLIC_PRODUCTION_URL="https://example.org" \
NODE_OPTIONS="--no-experimental-webstorage" \
yarn build
```

Putting the chosen flag in the CI build environment or package script is the
durable fix. `NODE_OPTIONS` is inherited by the prerender child process, which is
the property the application-level polyfill lacks.
