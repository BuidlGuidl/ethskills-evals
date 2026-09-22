# Is the unchanged CID a gateway cache issue?

No. The teammate is not right.

An IPFS CID is content-addressed. If the upload tool printed the same CID as the previous deploy, it proves that the content you uploaded resolved to the same IPFS object as before. For a static Next.js export, that means the uploaded `out/` directory was byte-for-byte equivalent for IPFS purposes: same files, paths, and content graph. A real frontend change that makes it into the exported site produces a different CID.

Gateway caching can explain users seeing an old deployment when a mutable pointer such as ENS, DNS, or a gateway URL has recently been updated to a different CID. It does not explain an upload producing the same CID. If the CID did not change, there is no new IPFS version for the gateway to fetch.

# Where the pipeline went wrong

The failure happened before or at the upload input, not after upload.

The source code may have been fixed, but the uploaded static artifact did not contain the fix. Common causes are:

- `out/` was not rebuilt after the UI change.
- `.next` or `out` contained stale artifacts.
- The build ran from the wrong package, branch, or working tree.
- The build failed or partially skipped static output and an old `out/` directory was uploaded anyway.
- The upload command pointed at the previous `out/` directory.
- The fix only existed in the dev server state, not in saved source used by the production build.

So the bug is in the build discipline: the team uploaded the old static export again.

# Build discipline that prevents this

From the repo root, treat production IPFS deploys as clean-room builds:

```bash
git status --short

cd packages/nextjs
rm -rf .next out

NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

Before uploading, prove that the build output contains the fix.

First, verify the source contains the intended change and the old buggy text or code path is gone:

```bash
rg "EXPECTED_FIXED_TEXT_OR_CODE" app components
rg "OLD_BUGGY_TEXT_OR_CODE" app components
```

Then verify the exported static site contains the fix:

```bash
rg "EXPECTED_FIXED_TEXT_OR_CODE" out
rg "OLD_BUGGY_TEXT_OR_CODE" out
```

For minified bundles, search the generated app chunks directly:

```bash
rg "EXPECTED_FIXED_TEXT_OR_CODE" out/_next/static/chunks
rg "OLD_BUGGY_TEXT_OR_CODE" out/_next/static/chunks
```

Also check that the output is newer than the source you changed:

```bash
stat -f '%Sm %N' app/page.tsx
stat -f '%Sm %N' out
```

If the source is newer than `out/`, the build is stale. Do not upload it.

Finally, run the exported site locally and test the actual behavior:

```bash
python3 -m http.server 4173 -d out
```

Open `http://localhost:4173/` and reproduce the fixed flow against the static export, not `yarn start`. If routes matter, verify they exist as IPFS-friendly directory indexes:

```bash
ls out/*/index.html
curl -s -o /dev/null -w "%{http_code}\n" -L "http://localhost:4173/debug/"
```

Only after the local exported `out/` directory visibly contains the fix should you upload:

```bash
yarn bgipfs upload out
```

The new upload should produce a new CID. If it prints the old CID again, stop. That means the content being uploaded is still the old content, regardless of what the source code or dev server appears to show.
