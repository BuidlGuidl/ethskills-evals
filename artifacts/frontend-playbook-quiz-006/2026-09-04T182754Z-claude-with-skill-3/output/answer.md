# The teammate is wrong, and the unchanged CID is the proof

## Short answer

No. The unchanged CID is not evidence *for* gateway caching — it is the single
strongest piece of evidence *against* it. Waiting it out will change nothing,
because nothing new was ever published. The fix never made it into the bytes
that were uploaded.

## What an unchanged CID actually proves

A CID is a content address: it is derived by hashing the uploaded data and the
DAG built over it. It is not a deploy ID, a version tag, or a slot that gets
overwritten. Two consequences follow directly:

1. **Same CID ⇒ same bytes.** Given the same upload tool and settings (CID
   version, chunker, hash function, wrap-in-directory), an identical CID means
   the directory you uploaded was byte-for-byte identical to the previous
   deploy — same `index.html`, same `_next/static/chunks/*.js`, same
   everything. A one-character source change that reached the build would have
   produced a different chunk, a different file hash, and therefore a different
   root CID. Content addressing has no way to hide a change.

2. **Gateway caching cannot produce this symptom.** `/ipfs/<cid>` is immutable
   and self-verifying. If the fix had been built and uploaded, it would live at
   a *new* CID, and fetching that new CID would be a cache miss everywhere in
   the world on the first request — a gateway physically cannot return the old
   HTML under a new CID without failing hash verification. Caching only creates
   staleness behind *mutable* pointers (IPNS, DNSLink, an ENS `contenthash`
   record, or a bookmarked old CID). Those are "you published something new but
   users are still pointed at the old thing" problems. This is not that: there
   is no new thing.

The one honest caveat: an identical CID proves identical *encoded content* only
if the tool genuinely re-read the directory. A buggy or caching upload tool
could reprint a stored CID without re-hashing anything. That is a different
root cause, but it lands in the same place — the problem is upstream of the
gateway, in the build-and-upload pipeline, and no amount of waiting fixes it.

## Where in the pipeline it must have gone wrong

The failure is somewhere between "editor saved the fix" and "bytes handed to
the upload tool." Ranked by how often each one actually bites:

- **Stale artifacts: the upload shipped an old `out/`.** Next.js does not clear
  the export directory reliably across configuration changes, and `.next`
  caches aggressively. If the build was skipped, short-circuited, or wrote into
  `.next` while the upload script read a leftover `out/` from the previous
  deploy, you get exactly this: a green build log and identical bytes.
- **The IPFS build flag was not set, so no static export was emitted at all.**
  The SE2 pattern only turns on `output: "export"` when
  `NEXT_PUBLIC_IPFS_BUILD=true`. Without it, `next build` produces a server
  build and never regenerates `out/` — so the upload tool picks up the previous
  export untouched.
- **The build actually failed and the pipeline continued.** A prerender crash
  (on Node 25, the classic one is a built-in `localStorage` global that exists
  without `getItem()`, which wallet/storage libraries call during static
  prerender) leaves the old `out/` in place. If the upload step is chained with
  `;` or `|| true` instead of `&&`, it happily uploads the stale directory.
- **The wrong directory or the wrong workspace was uploaded** — `.next` instead
  of `out`, a path from a sibling checkout, or a stale absolute path baked into
  the deploy script.
- **The fix was not in the tree that was built.** Uncommitted in a different
  worktree, on an unmerged branch, in a component that is not actually
  imported, or shadowed by a duplicate file. `git status` on the machine that
  ran the build settles this in seconds.

Note that "we updated the ENS/DNSLink pointer" is *not* on this list, because
the pointer still resolves to the same CID it always did. Fix the build first;
the pointer update is only meaningful once a genuinely new CID exists.

## Build discipline that prevents a repeat

Run from `packages/nextjs`. The rules are: destroy artifacts, build with the
IPFS flag and the production origin, fail hard, verify locally, and only then
upload.

```bash
cd packages/nextjs

# 0. Confirm you are building the tree that contains the fix.
git status --short
git log --oneline -1

# 1. Never build on top of previous artifacts.
rm -rf .next out

# 2. Build for static export, with the production origin set at build time
#    so Open Graph URLs/images do not bake in localhost.
#    NODE_OPTIONS is process-level so build workers inherit it (a fix only in
#    instrumentation.ts or next.config.ts does not reach them).
NODE_OPTIONS="--localstorage-file=.node-localstorage" \
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

(If the app's crash is better served by disabling the global outright, use
`NODE_OPTIONS="--no-experimental-webstorage"` instead.)

Chain the upload with `&&`, never `;` or `|| true`, so a failed build can never
be followed by an upload:

```bash
rm -rf .next out && NEXT_PUBLIC_IPFS_BUILD=true yarn build && yarn ipfs
```

## How to prove locally that the new build contains the fix — before uploading

Do all four. The first three are cheap; the fourth is the one that would have
caught this exact incident before anyone touched a gateway.

**1. The export exists and is fresh.**

```bash
ls -la out/index.html          # mtime must be from *this* build, not last week
ls out/*/index.html            # one directory with an index.html per route
```

**2. The fix is physically present in the emitted bytes.** Grep the export for
a string that only exists in the fixed version — new label text, a new CSS
class, a renamed prop:

```bash
grep -r "<string-introduced-by-the-fix>" out/ | head
grep -rl "<string-the-bug-used-to-render>" out/   # expect no output
```

If the fix has no greppable string, add a temporary build marker or grep for
the surrounding chunk and diff it against the previous export.

**3. Run the export the way a gateway will serve it.** Static export with
`trailingSlash` behaves differently from `yarn dev`:

```bash
npx serve out
```

Open the root *and* at least one non-home route (e.g. `/debug/`), and confirm
the bug is gone in the browser. Root-loads-fine proves nothing about exported
routes.

**4. Compute the CID locally and compare it to the last deploy — before
uploading.** This is the decisive check, and it turns the post-hoc surprise
into a pre-flight gate:

```bash
ipfs add --only-hash -r -Q out
```

`--only-hash` computes the CID without storing or publishing anything. If it
equals the previous deploy's CID, **stop** — your build produced nothing new,
and uploading is pointless. Only proceed when it differs.

For this comparison to be meaningful, the local hashing settings must match the
upload tool's (CID version, chunker, wrap). If you can't guarantee that, use a
tool-agnostic fingerprint instead and record it alongside each release:

```bash
find out -type f | sort | xargs sha256sum | sha256sum
```

Same fingerprint as last deploy ⇒ same content ⇒ do not upload.

## After uploading

1. **Record the new CID** and confirm it differs from the previous one. If it
   doesn't, the release did not happen — go back to the build, do not blame the
   gateway.
2. **Fetch the root and a non-home route through the gateway:**

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/"
   curl -s -o /dev/null -w "%{http_code}\n" -L "https://<gateway>/ipfs/<cid>/debug/"
   ```

   Expect `200` on both; a `404` on the second means routes were not exported as
   directories.
3. **Confirm the fix is served,** not just that the page loads:

   ```bash
   curl -s -L "https://<gateway>/ipfs/<cid>/" | grep "<string-introduced-by-the-fix>"
   ```

4. **Check the Open Graph image and URL** resolve to the production origin, not
   localhost.
5. **Only then update the ENS `contenthash`** to the reviewed, approved CID, and
   verify the resolver and a public gateway both serve that CID. *This* is the
   step where propagation delay and pointer caching are a legitimate
   explanation for users seeing stale content — and it is the only one.

## The one-line takeaway for the team

An unchanged CID is a build failure notification, not a caching symptom. Gate
every deploy on `ipfs add --only-hash -r -Q out` differing from the last
release, and this class of bug cannot ship again.
