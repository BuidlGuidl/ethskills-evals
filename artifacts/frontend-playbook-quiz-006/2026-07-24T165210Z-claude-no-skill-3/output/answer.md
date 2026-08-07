# Same CID after a "fix" — is the gateway caching it?

**No. The teammate has it backwards.** An unchanged CID is the single strongest piece of
evidence that the problem is *not* caching. It proves you re-uploaded the old bytes. Waiting
will never help, because there is nothing new on IPFS to wait for.

---

## 1. What an unchanged CID actually proves

IPFS is **content-addressed**. A CID is a cryptographic hash of the content itself — the
bytes of every file plus the shape of the directory tree (the Merkle DAG). The mapping is
deterministic and one-way:

- **Same bytes → same CID. Different bytes → different CID.** Always. There is no cache, no
  clock, and no network involved in computing it.

So a CID that is *identical* to the previous deploy proves, with cryptographic certainty:

> The directory you uploaded this time is **byte-for-byte identical** to the one you uploaded
> last time. The fix is not in it.

This also dismantles the caching theory on its own terms. A gateway caches *by CID*, and a CID
maps to immutable content forever. Requesting a given CID can **never** return anything other
than that exact content. Caching only becomes a real concern when the CID *changes* but a
**mutable pointer** to it (IPNS name, ENS `contenthash`, DNSLink `TXT` record) is still
resolving to the old CID — and that requires the CID to have changed in the first place, which
here it did not.

**Bottom line:** if the fix had been in the build, the CID would have been *forced* to change.
It didn't, so the fix isn't there. The break is upstream of the upload.

---

## 2. Where in the pipeline it went wrong

The pipeline is:

```
edit source  →  next build (+ static export)  →  out/ directory  →  upload tool hashes out/  →  CID
```

The CID is a fingerprint of the **last stage's input** (`out/`). Since that fingerprint didn't
change, the edited source never made it into `out/`. The failure is somewhere between "edit
source" and "produce the `out/` that the upload tool consumed." Concretely, one of:

- **The build was never actually re-run**, and the upload tool re-hashed a stale `out/` left
  over from the previous deploy. (Most common cause of an identical CID.)
- **The export directory was not cleaned**, so old prerendered HTML/chunks survived a partial
  rebuild.
- **The edit landed somewhere that isn't built** — wrong file, wrong workspace, unsaved buffer,
  or a different branch than the one you built.
- **The upload tool pointed at the wrong path** — e.g. an old `out/` next to the fresh one.
- **A build cache served a stale artifact** (`.next/` cache) instead of recompiling the changed
  component.

Every one of these produces exactly the symptom you saw: identical bytes, identical CID, users
still on the old UI.

---

## 3. Build discipline that prevents a repeat

Scaffold-ETH 2's frontend lives in `packages/nextjs` and produces a static export in
`packages/nextjs/out`. Two rules make same-CID deploys impossible to ship by accident:
**always build from clean**, and **never upload a build you haven't proven locally**.

### Step 0 — correct Node version
Static export prerenders pages under Node. Use **Node 20 or 22** for the IPFS build; Node ≥ 23
crashes prerender via a global `localStorage`, and a crashed/partial build is another way to end
up shipping stale output.

```bash
nvm use 20        # or 22
node -v
```

### Step 1 — clean, then build

```bash
cd packages/nextjs
rm -rf .next out        # kill the build cache AND any stale export
yarn build              # runs `next build` → regenerates packages/nextjs/out
```

Cleaning first guarantees `out/` reflects *this* source and nothing older. (The all-in-one
`yarn ipfs` builds and uploads in one shot — fine, but only run it *after* you've proven the
build with the checks below, since it hashes and uploads immediately.)

### Step 2 — prove the fix is in the build **before uploading anything**

This is the discipline that would have caught the whole problem. The `out/` directory is the
*exact* set of bytes that will be hashed into the CID, so verify against `out/`, not against
your dev server.

**(a) Serve the actual export and look at it in a browser:**

```bash
npx serve packages/nextjs/out          # or: python3 -m http.server -d packages/nextjs/out 3000
```
Open it and confirm the bug is gone. You are now looking at precisely what IPFS will serve.

**(b) Grep the built output for the change** (fast, scriptable, works on the minified chunks):

```bash
grep -rF "string introduced by the fix" packages/nextjs/out   # must find it
grep -rF "old buggy string"              packages/nextjs/out   # must find NOTHING
```

**(c) Compute the CID locally and compare it to the last deploy — the direct guardrail:**

```bash
ipfs add -rQn --cid-version=1 packages/nextjs/out
```
`-n` is a dry run: it hashes offline and pins nothing, printing the root CID. If it equals the
previous deploy's CID, **stop — the build did not change; do not upload.** If it differs, the
content genuinely changed and you're safe to proceed. This single command turns "same CID" from
a post-mortem surprise into a pre-flight check.

### Step 3 — upload, then update the pointer

Only now upload. The new CID *must* differ (Step 2c already confirmed it). Then:

- Share/test the deploy via the **new CID directly** (`https://<gateway>/ipfs/<newCID>`) to
  confirm the fix live — this path is immune to pointer/DNS caching.
- If users reach the app through a stable name (IPNS / ENS `contenthash` / DNSLink), **update
  that pointer to the new CID.** *This* is the only place gateway/DNS caching legitimately bites,
  and only after the CID has changed. Bump TTLs down ahead of releases if propagation lag hurts.

---

## TL;DR

- An unchanged CID **proves the upload is identical to before** — the fix is not in the built
  `out/`. It cannot be a caching problem, because a CID *is* the content hash; changed content
  is physically incapable of producing the same CID.
- Root cause is upstream of upload: a stale/unbuilt/wrong `out/` was hashed.
- Fix the process: `nvm use 20 && rm -rf .next out && yarn build`, then **prove it** —
  `serve out/` + `grep` for the fix + `ipfs add -rQn out` and diff the CID against last deploy —
  **before** uploading. If the local CID matches the old one, the build is stale; never ship it.
- Gateway/DNS caching is only ever a concern for the *mutable pointer* (IPNS/ENS/DNSLink) after
  the CID has legitimately changed.
