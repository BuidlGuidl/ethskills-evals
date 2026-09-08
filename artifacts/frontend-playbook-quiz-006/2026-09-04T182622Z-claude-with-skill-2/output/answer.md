# Same CID after a rebuild: the teammate has it backwards

## Short answer

No. The identical CID is the one piece of evidence that *rules out* gateway
caching as the cause. Waiting will change nothing, because there is no newer
version anywhere for the gateway to eventually pick up.

## What an unchanged CID actually proves

A CID is a content address: it is derived by hashing the DAG built from the
bytes of the directory you uploaded. It is not a version counter, a timestamp,
or an upload receipt. So, with the same upload tool and settings on both
deploys:

- **Identical CID ⇒ identical bytes.** The directory handed to the uploader on
  the second deploy was byte-for-byte the directory handed to it on the first.
  The fix is not in the uploaded artifact.
- The gateway is therefore serving exactly what you asked for. Users seeing the
  old UI is the *correct* behaviour for that CID — the old UI is what that CID
  is. Cache expiry would re-fetch the same immutable content.
- The failure is upstream of IPFS entirely: somewhere between "we edited the
  source" and "the uploader read a directory off disk."

Two caveats worth stating precisely, so the rule isn't over-applied:

- The implication only holds when both deploys used the same tool and the same
  chunking/CID parameters. Different tools (or `--cid-version`, chunker, or
  raw-leaves settings) can produce different CIDs for identical content. Same
  tool, same flags, same CID ⇒ same content.
- The converse is *not* true. A CID that *did* change would only prove the bytes
  changed — not that they changed to include your fix. A stale timestamp, a
  different env var, or a rebuilt-but-unfixed bundle all move the CID. That is
  why the local proof below checks for the fix itself, not just for "something
  changed."

If it *were* gateway caching, the symptom would look different: a new CID would
exist, `/ipfs/<new-cid>/` would serve the fix on a direct fetch, and only a
mutable pointer (an ENS content hash, a DNSLink, or an `/ipns/` path) would lag.
Immutable `/ipfs/<cid>` paths are safe to cache forever precisely because their
content cannot change.

## Where in the pipeline it must have gone wrong

The build never produced new bytes, or the uploader never read the ones it
produced. Ordered roughly by how often each one is the culprit in a
Scaffold-ETH 2 IPFS deploy:

1. **`out/` was never regenerated.** Without `NEXT_PUBLIC_IPFS_BUILD=true`, the
   IPFS branch in `next.config.ts` never sets `output: "export"`, so the build
   writes `.next/` and emits no `out/` at all. A previous run's `out/` is still
   sitting on disk, and the uploader happily re-uploads it.
2. **The build failed but the old artifact survived.** Because `out/` is not
   cleaned first, a build that dies partway leaves the previous export fully
   intact. If the upload step runs in the same script without `set -e`, or in a
   CI job whose failure was not gating, you upload last week's release. On Node
   25 the common crash here is a library calling `localStorage.getItem()` during
   static prerender, against a built-in `localStorage` global that exists but
   lacks the Web Storage methods.
3. **Stale build cache.** A retained `.next/` can serve up previously compiled
   output for pages the toolchain believes are unchanged.
4. **The fix was never in the built tree.** Edited on another branch, in another
   worktree, left unstaged while CI built from the remote, or applied to a
   component that the rendered route does not actually use.
5. **The uploader pointed at the wrong directory.** A hardcoded or relative path
   in the upload script resolving to a different package, or to a copy of `out/`
   from an earlier layout.

Diagnosis is quick: look at the modification times of the artifact. If
`packages/nextjs/out/` predates the fix, causes 1–3 apply; if it is fresh but
lacks the fix, cause 4; if it is fresh and contains the fix, cause 5.

```bash
cd packages/nextjs
ls -ld out .next
find out -newer ../../package.json -name '*.html' | head   # anything rebuilt?
```

## Build discipline that prevents a repeat

Treat "the build succeeded" and "the upload succeeded" as meaningless on their
own. The artifact is the only thing that counts, and it must be proven before it
leaves the machine.

### 1. Configure the static export

In `packages/nextjs/next.config.ts`:

```typescript
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}
```

### 2. Always destroy the old artifact before building

This single habit makes failure mode 2 impossible: a failed build then leaves
*no* `out/`, and the upload step cannot silently re-ship the old release.

```bash
cd packages/nextjs
rm -rf .next out
```

### 3. Build with the production origin and the IPFS flag set

```bash
cd packages/nextjs
rm -rf .next out
NODE_OPTIONS="--localstorage-file=.node-localstorage" \
  NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

`NEXT_PUBLIC_PRODUCTION_URL` must be set *at build time* or Open Graph URLs and
images bake in `localhost`. The `NODE_OPTIONS` entry is the Node 25 remedy: set
it as a process-level environment variable so build workers inherit it —
patching `instrumentation.ts` or `next.config.ts` alone does not reach them.
`--no-experimental-webstorage` is the alternative if the app never wants the
built-in global.

Chain the upload so a build failure can never reach it:

```bash
rm -rf .next out && NEXT_PUBLIC_IPFS_BUILD=true yarn build && yarn ipfs
```

### 4. Prove locally that the new build contains the fix — before uploading

Four checks, all offline, all before any upload:

```bash
cd packages/nextjs

# a. The export actually happened, and every route emitted its own directory.
ls out/*/index.html

# b. The fix itself is present in the shipped bytes. Grep for a string the fix
#    introduced (new label, new class, new function name). Search the JS
#    chunks too — most SE2 UI lives there, not in the HTML.
grep -rl "<string-the-fix-introduced>" out/ | head
grep -rl "<string-the-bug-used-to-render>" out/ | head   # expect no hits

# c. Metadata carries the production origin, not localhost.
grep -r "og:url\|og:image" out/index.html

# d. Run the exported bundle and look at it — this is what users will get,
#    which `yarn dev` is not.
npx serve out    # then open the buggy route and confirm the fix renders
```

Check (b) is the one that would have caught this deploy: the old bug's string
would still have been in `out/`, and the fix's string absent.

### 5. Predict the CID before you upload

You can compute the CID locally without publishing anything. Compare it to the
previous deploy's CID; if they match, stop — you have reproduced the bug on your
own machine and saved a wasted deploy.

```bash
ipfs add -rQ --only-hash out    # prints the CID without uploading
```

Use the same CID version and chunker settings your upload tool uses, or the
comparison is not apples-to-apples. Record every deploy's CID alongside its
commit SHA so "same CID as last time" is caught automatically rather than
noticed later.

### 6. Verify after uploading

```bash
# Root, and at least one non-home exported route. Root succeeding does not
# prove route directories resolve.
curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/"
curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/debug/"   # expect 200, not 404

# The fix is live in what the gateway serves.
curl -s -L "https://<gateway>/ipfs/<cid>/" | grep -c "<string-the-fix-introduced>"
```

Confirm the OG image and URL use the production origin. Only once the deployed
CID has been reviewed and approved should you update the ENS content hash — then
confirm the resolver and a public gateway both serve that CID. The ENS/DNSLink
pointer is the one place where a genuine propagation delay can occur, and it is
the only part of this pipeline where "wait it out" is ever the right advice.

## What to tell the team

The gateway is not the problem, and no amount of waiting will fix it. The same
CID means we uploaded the same bytes: the fix never made it into
`packages/nextjs/out/`. Rebuild with `rm -rf .next out` first and
`NEXT_PUBLIC_IPFS_BUILD=true` set, grep `out/` for the fix, and confirm
`ipfs add -rQ --only-hash out` prints a *different* CID than last deploy — then
upload.
