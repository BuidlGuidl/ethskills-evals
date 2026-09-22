# Same CID After an IPFS Redeploy

No, the teammate is not right. A gateway may cache content, but an unchanged CID does not prove "the gateway is still serving the old version." It proves the opposite thing you need to notice: the content-addressed object you uploaded resolved to the same bytes as the previous deploy.

Precisely: for the same IPFS import options, the same root CID means the same Merkle DAG. In normal app-deploy terms, the uploaded directory was byte-for-byte identical to the old uploaded directory. If the UI fix really changed the static output that was uploaded, the root CID would change. Waiting will not make `/ipfs/<same-cid>` become a different website.

So the failure happened before the gateway:

- the fix was not in the checkout/branch/commit used for deployment;
- the app was rebuilt from stale inputs;
- the deploy uploaded the wrong directory, usually an old `out`, `dist`, or `.next` artifact;
- the build cache or deploy script skipped the real rebuild;
- the change only existed in the dev server and never made it into the static export;
- or the public name, such as DNSLink/IPNS/ENS/custom domain, was not updated to a new CID.

For a Scaffold-ETH 2 frontend deployed to IPFS, treat the deploy artifact as `packages/nextjs/out` unless your project has intentionally changed that. IPFS docs for Next.js static deployment expect `output: "export"` and produce an `out` directory; current Scaffold-ETH 2 publishes the frontend with `yarn ipfs`, which delegates to the `@se-2/nextjs` workspace and builds with `NEXT_PUBLIC_IPFS_BUILD=true`.

## Build Discipline

Use a clean, repeatable build and verify the artifact before any upload:

```bash
# Confirm you are deploying the commit that contains the fix.
git status --short
git log -1 --oneline
git diff -- packages/nextjs

# Install exactly from the lockfile.
# Yarn v1:
yarn install --frozen-lockfile
# Yarn Berry:
yarn install --immutable

# Remove old frontend build artifacts.
rm -rf packages/nextjs/.next packages/nextjs/out

# Build the same static frontend mode used by the IPFS publish script.
NEXT_PUBLIC_IPFS_BUILD=true yarn next:build

# Prove the static export exists and was regenerated.
test -f packages/nextjs/out/index.html
find packages/nextjs/out -type f | sort | head
```

Then prove locally that the exported site contains the fix, not just that the dev server looks good:

```bash
# Text-level check when the bug/fix has a searchable marker.
rg "old broken text or class" packages/nextjs/out && exit 1
rg "new fixed text or class" packages/nextjs/out

# Serve the exact static artifact that would go to IPFS.
npx http-server packages/nextjs/out -p 8080 -c-1
```

Open `http://127.0.0.1:8080` and reproduce the user flow against that static export. Do not use `yarn start` or the Next dev server for this proof; those can show source changes that are not present in the deploy artifact.

If the bug is behavioral or minified and `rg` is not enough, add a browser assertion against the static export:

```bash
npx playwright test
```

or use a one-off check that loads `http://127.0.0.1:8080` and asserts the fixed DOM/state. The important part is that the test points at `packages/nextjs/out`, not the source tree.

Before uploading, compute the CID locally if you have the IPFS CLI. This should be treated as a preflight check; if your upload provider uses different import settings, compare with that provider's dry-run or upload result too.

```bash
ipfs add -Qr --cid-version=1 packages/nextjs/out
```

That CID should differ from the previous deploy if the exported bytes changed. If it is still the same, stop: you have not produced a new deploy artifact. Fix the build/deploy inputs before running:

```bash
yarn ipfs
# equivalent explicit workspace command:
yarn workspace @se-2/nextjs ipfs
```

For stricter discipline, separate "build" from "upload" in CI so the exact artifact you inspected is the one you publish:

```bash
rm -rf packages/nextjs/.next packages/nextjs/out
NEXT_PUBLIC_IPFS_BUILD=true yarn next:build
rg "old broken text or class" packages/nextjs/out && exit 1
rg "new fixed text or class" packages/nextjs/out
cd packages/nextjs
yarn bgipfs upload out
```

The healthy invariant is simple: source fix -> clean static build in IPFS mode -> local proof from `packages/nextjs/out` -> new CID -> update DNSLink/IPNS/ENS/custom domain if one is used. If the CID did not change, the new UI was never uploaded.

Sources checked: IPFS Next.js static deployment docs (`output: "export"` produces `out`) at <https://docs.ipfs.tech/how-to/websites-on-ipfs/static-site-generators/> and current Scaffold-ETH 2 scripts showing `yarn ipfs` / `@se-2/nextjs ipfs` at <https://github.com/scaffold-eth/scaffold-eth-2>.
