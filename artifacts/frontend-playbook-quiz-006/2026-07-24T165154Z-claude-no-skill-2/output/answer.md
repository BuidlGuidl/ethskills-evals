# Same CID after a "rebuild" — is it a gateway cache?

**No. The teammate has it backwards.** An unchanged CID is not evidence of a
caching problem — it is proof that the fix never reached the bytes you
uploaded. Waiting it out will change nothing, because there is nothing new to
propagate.

---

## 1. What an unchanged CID proves (and what it doesn't)

IPFS is **content-addressed**. A CID is a self-describing cryptographic hash
(a multihash, plus codec/version metadata) computed *from the content itself*.
The address *is* a fingerprint of the bytes.

That gives one iron rule:

> **Different bytes → different CID. Same CID → byte-for-byte identical content.**

There is no way to upload changed content and get the old CID back — the hash
would diverge on the first differing byte. So the "new" deploy printing the
**same CID** proves exactly one thing:

- **The directory you uploaded is bit-identical to the previous deploy.**

It says *nothing* about gateways, DNS, or propagation. In fact it rules the
caching theory out: the gateway is faithfully serving the content whose hash
you asked for. If you had produced new content, you'd have a new CID, and the
old CID would keep resolving to the old content forever (immutability) — a new
CID never has a stale-cache problem, because that address has never been served
before.

**Corollary for debugging:** whenever the CID doesn't change, stop looking at
the network. The bug is upstream of the upload — in your build or in *which
directory* got uploaded.

---

## 2. Where in the pipeline it actually went wrong

The SE-2 IPFS flow is roughly:

```
edit source  →  next build (output: 'export')  →  out/ (static HTML/JS/CSS)  →  upload out/ to IPFS  →  CID
```

An identical CID means the **`out/` directory that was uploaded did not change**.
Given the fix is real in source, one of these happened:

1. **The build never re-ran / uploaded a stale export.** The deploy script
   re-uploaded an old `out/` (or an old `.next/`-derived export). This is the
   most common cause: the upload step ran against artifacts from the *previous*
   build, so of course the content — and the CID — is identical.

2. **A stale build cache masked the change.** Next.js reuses `.next/cache`. If
   the cache wasn't invalidated (or the toolchain thought the inputs were
   unchanged), the pre-rendered static output for the affected route was
   re-emitted from cache, unchanged.

3. **The build silently failed or fell back to the old output.** With SE-2's
   static export, a crash during prerender can leave the prior `out/` in place.
   (Known gotcha: SE-2's IPFS `next build` must run on **Node 20 or 22** — Node
   ≥23 exposes a global `localStorage` that crashes prerender. A failed build
   that leaves the old `out/` intact would reproduce this exact symptom.)

4. **The fix isn't where you think it is.** The change was saved to the wrong
   file/branch/workspace, edited a component that isn't actually rendered, or
   was never saved — so the source that `next build` consumed still had the bug.

In every case the resolution is the same: the *content* is identical, so make
the content actually change and **verify it locally before uploading**.

---

## 3. Build discipline that prevents a repeat

Adjust paths to your monorepo (`packages/nextjs` is the SE-2 default).

### a. Always do a clean build — never trust cached artifacts

```bash
# From repo root. Nuke prior build + export + Next cache so nothing stale survives.
rm -rf packages/nextjs/.next packages/nextjs/out

# Build the static export on a supported Node version (SE-2 IPFS: Node 20 or 22).
node -v                                   # confirm v20.x or v22.x FIRST
yarn workspace @se-2/nextjs build         # runs `next build` with output: 'export'
```

A clean build removes causes #1, #2, and #3 in one step: there is no old `out/`
to re-upload, no `.next/cache` to reuse, and a failed build produces *no*
`out/` rather than silently leaving the old one.

### b. Prove the fix is in the build *before* uploading anything

Do all three — they catch different failure modes:

**(i) Grep the emitted bytes for the change.** The static export contains the
pre-rendered markup and the compiled JS chunks. If your fix changed visible text
or a class, it must appear in `out/`:

```bash
grep -r "the new copy or identifier from my fix" packages/nextjs/out
# 0 matches = the fix is NOT in the build. Stop. Do not upload.
```

**(ii) Serve the exact export and view it in a browser (hard-refresh).**
This is what users will get — no dev server, no HMR, the real static output:

```bash
npx serve packages/nextjs/out        # or: python3 -m http.server -d packages/nextjs/out
# open the URL, Cmd/Ctrl+Shift+R, confirm the bug is gone
```

**(iii) Compute the CID locally, offline, and compare — the decisive check.**
CIDs are deterministic, so you can hash `out/` *without uploading* and know in
advance what the deploy will produce:

```bash
# Dry-run hash of the whole directory (no network, nothing added to any node):
ipfs add -rn --cid-version=1 packages/nextjs/out | tail -1
#   -r recurse, -n dry-run (compute only), --cid-version=1 to match gateways

# No local IPFS daemon? Pure-JS equivalent:
npx ipfs-only-hash -r packages/nextjs/out
```

Then compare that CID to the previous deploy's CID:

- **If it equals the old CID → the content is unchanged. The fix is not in the
  build. Abort and fix the build — uploading is pointless.**
- **If it differs → the content genuinely changed; the upload will produce that
  new CID, and users pointed at it get the fix.**

This turns the CID from a post-hoc surprise into a **pre-upload assertion**: you
never ship until the locally-computed CID has moved.

### c. After upload, point users at the new CID

A new CID is a *new immutable address*. Users only get the fix once whatever
they load resolves to it:

- If you serve via **IPNS / DNSLink / an ENS contenthash**, update that pointer
  to the new CID (this record *can* be cached — set a short TTL, and this is the
  only legitimate "propagation" wait in the whole flow).
- Ensure the new CID is **pinned** (on your node or a pinning service) so the
  gateway can actually retrieve it.
- Load the app by its **new CID** to confirm end-to-end, e.g.
  `https://<gateway>/ipfs/<new-cid>/`.

---

## TL;DR

- The teammate is wrong. **Same CID = identical bytes**, which *disproves* the
  cache theory and proves the fix never made it into the uploaded `out/`.
- The failure is in the **build/export or the upload-of-a-stale-directory**
  step, not the gateway.
- Fix it with a **clean build** (`rm -rf .next out` + build on Node 20/22), and
  **gate the upload on a local proof**: grep `out/`, serve `out/` in a browser,
  and compute the CID offline (`ipfs add -rn` / `ipfs-only-hash`) — the CID
  *must* differ from last time before you upload. Then repoint IPNS/DNSLink/ENS
  at the new CID.
