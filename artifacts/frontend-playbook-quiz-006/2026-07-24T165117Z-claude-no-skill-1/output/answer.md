# Same CID after a "rebuild" — is it a gateway cache?

**Short answer: no, the teammate is wrong, and waiting will fix nothing.**
An identical CID is not a symptom of caching — it is proof that the bytes you
uploaded are the *same bytes as last time*. The fix never reached the folder you
uploaded. This is a build/upload problem, not a network problem.

---

## 1. What an unchanged CID actually proves

A CID (Content Identifier) is a **cryptographic hash of the content itself**.
IPFS is *content-addressed*: the address is derived deterministically from the
bytes. Two properties follow directly:

- **Different content ⇒ different CID.** Even a single changed byte in a single
  file inside the uploaded directory produces a different root CID.
- **Same CID ⇒ byte-for-byte identical content.** There is no collision to worry
  about at this scale; a matching CID means the DAG (every file, in every
  subfolder, plus the directory structure) hashes to exactly the same thing.

So the unchanged CID **proves the directory you uploaded is identical to the
previous deploy.** Your UI fix is simply *not in it*.

### Why "the gateway is caching it" is a category error
Caching an immutable CID is not just harmless — it's the *entire point* of
content addressing. A gateway can cache `bafy…abc` forever because that CID can
*only ever* return one set of bytes. Caching cannot make a fixed build look
broken; the fixed build would have a **new CID**, which no cache has ever seen.

The *only* place stale-serving legitimately arises with IPFS is a **mutable
pointer** — an IPNS name, a DNSLink `TXT` record, or an ENS `contenthash` — that
still points at the old CID. But that's not caching either: it means nobody
re-pointed the name at a new CID. And here it's moot, because **no new CID was
ever produced to point at.** (Separately, an aggressive browser cache or a Next.js
service worker can pin an old page in *one user's* browser — but that produces a
*new* CID upstream and is fixed by a hard reload, not by "waiting it out" across
all users.)

---

## 2. Where in the pipeline it went wrong

The failure is *upstream of the upload*: the artifact directory (`out/` from the
Next.js static export) was never regenerated with your change, or the wrong
directory was uploaded. Concretely, one of these happened:

1. **You edited source but never rebuilt.** The upload script pointed at a stale
   `out/` from a previous `next build`. Most common cause.
2. **A stale build cache.** `.next/` cache served old compiled output, so even a
   "build" produced identical bytes. (Also possible: the edit didn't actually
   change the emitted output — e.g. you edited a file that isn't imported, or the
   change was tree-shaken/dead-code away.)
3. **Rebuilt, but uploaded the wrong path.** The build wrote to a fresh location
   while the upload command still targeted the old folder (or a cached tarball).
4. **The edit was never saved / on a different branch** than the one built.

The diagnostic signature — *identical CID* — collapses all of these to one fact:
**the bytes handed to IPFS did not change.** Fix the build, and the CID *must*
change.

---

## 3. Build discipline that prevents a repeat

The core rule: **never upload without first proving the fix is in the artifact,
and never trust "I rebuilt" — trust the hash.**

Scaffold-ETH 2 is a monorepo; the frontend lives in `packages/nextjs` and the
IPFS deploy builds a static export into `packages/nextjs/out`. Adjust the script
name to your version (`yarn ipfs`, `yarn next:build`, etc.).

### Step 0 — clean, so no stale artifact can survive
```bash
cd packages/nextjs
rm -rf .next out          # nuke build cache AND the export dir
```

### Step 1 — rebuild from clean source
```bash
# from repo root, or the nextjs workspace:
yarn install --immutable          # ensure deps match lockfile
yarn next:build                   # produces packages/nextjs/out (static export)
# (In SE-2, `yarn ipfs` typically does build + upload in one step —
#  run the build half explicitly first so you can verify before uploading.)
```

### Step 2 — PROVE the fix is in the built output *before uploading*

**(a) Grep the compiled artifact for a marker from your fix.** Use a string that
only exists because of the fix (new button label, new class name, a temporary
`data-fix="<ticket-id>"` marker):
```bash
grep -r "Corrected Label Text" packages/nextjs/out   # must return hits
```
If it returns nothing, the fix isn't in the build — stop here.

**(b) Serve the exact export locally and click the bug through.** Don't test
`yarn dev` (that's the source, not the artifact) — serve `out/` itself:
```bash
npx serve packages/nextjs/out -l 3000
# open http://localhost:3000, reproduce the original bug steps, confirm it's gone
```
This is the highest-confidence check: it's the same static files IPFS will host.

**(c) Pre-compute the CID offline and compare to the last deploy.** `--only-hash`
(`-n`) hashes without uploading or needing a daemon. Match the settings your
upload tool uses (CIDv1 is standard for web deploys):
```bash
ipfs add --only-hash -r --cid-version 1 -Q packages/nextjs/out
# -Q prints just the root CID
```
- If this CID **equals** the previous deploy's CID → **the content did not
  change. Do not upload. Go fix the build.** This is the exact check that would
  have caught today's failure *before* wasting an upload.
- If it **differs** → the content genuinely changed; proceed.

### Step 3 — upload, and expect a new CID
```bash
yarn ipfs        # or your bgipfs / upload command
```
The printed CID **must differ** from the previous deploy and **must match** the
CID you pre-computed in Step 2(c). If the tool prints the old CID again, the
upload is stale/misconfigured — investigate the tool, don't re-run and hope.

### Step 4 — repoint the mutable name (if you use one)
A new CID is invisible to users until the pointer they resolve is updated:
```bash
# ENS contenthash → set to ipfs://<new-cid> in the ENS app / via ethers
# or IPNS: ipfs name publish /ipfs/<new-cid>
# or DNSLink: update the _dnslink TXT record to dnslink=/ipfs/<new-cid>
```
Then verify a gateway serves the new root: open
`https://<gateway>/ipfs/<new-cid>/` (the CID directly, bypassing any name) and
confirm the fix.

---

## TL;DR

- An unchanged CID **proves the uploaded bytes are identical** — content
  addressing makes "same CID, different content" impossible. Caching is a
  red herring; there's nothing new to cache.
- The fix never made it into `out/` (stale build/cache or wrong dir uploaded).
- Discipline: **clean → rebuild → prove (grep + `serve out/` + `ipfs add
  --only-hash` and compare CIDs) → upload → confirm the CID changed → repoint the
  ENS/IPNS/DNSLink pointer.** If the pre-upload hash equals the old CID, stop —
  you have nothing new to deploy.
