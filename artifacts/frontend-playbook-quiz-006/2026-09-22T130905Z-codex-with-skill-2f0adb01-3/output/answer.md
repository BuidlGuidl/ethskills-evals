# Is the teammate right?

No. An unchanged IPFS CID does **not** prove that the gateway is caching an old version that will eventually update.

An IPFS CID is content-addressed. If the upload tool printed the same CID as the previous deploy, it means the uploaded IPFS DAG was the same content as before: same exported files, same bytes, same directory structure. A gateway may cache content for a CID, but it cannot make a new build appear at that same CID. If the UI fix changed the deployed static site, the CID should change.

# What the unchanged CID proves

An unchanged CID proves that the thing uploaded to IPFS was identical to the previous upload.

More precisely, it proves one of these happened:

- the app was not rebuilt after the fix;
- the old `out/` directory was uploaded again;
- the build ran from the wrong branch, wrong checkout, or wrong package;
- the fix did not affect the exported static assets;
- the build failed or skipped the relevant page and the stale output remained;
- the upload command targeted stale artifacts instead of the newly built `out/`.

It does **not** prove a gateway cache problem. Waiting will not turn one CID into different content.

# Where the pipeline went wrong

The failure happened before or at upload time, in the build artifact pipeline. The source change may have been correct, but the exported static site that was uploaded did not contain it.

For a Scaffold-ETH 2 IPFS deploy, the critical artifact is:

```bash
packages/nextjs/out
```

If that directory has the old UI, IPFS will faithfully publish the old UI. The gateway is downstream of the problem.

# Build discipline that prevents this

Always clean the Next.js artifacts before rebuilding:

```bash
cd packages/nextjs
rm -rf .next out
```

Then run the full IPFS production build:

```bash
NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

Before uploading anything, prove that the exported build contains the fix.

Use a unique string from the fix, or add a temporary recognizable string while testing:

```bash
grep -R "YOUR_FIXED_UI_STRING" out
```

For bundled app chunks specifically:

```bash
grep -R "YOUR_FIXED_UI_STRING" out/_next/static/chunks/app
```

Check that the build output is newer than the edited source:

```bash
stat -f '%Sm' app/page.tsx
stat -f '%Sm' out
```

If the source file is newer than `out/`, the build is stale. Rebuild before uploading.

Also verify that the static export has the routes IPFS needs:

```bash
ls out/*/index.html
```

Then serve the exported site locally and test the actual static build, not the dev server:

```bash
npx serve out
```

Open the local URL it prints and confirm the bug is fixed there. You can also use `curl` for a specific static page:

```bash
curl -s -L http://localhost:3000/ | grep "YOUR_FIXED_UI_STRING"
```

Only after the local exported `out/` directory is proven correct should you upload:

```bash
yarn bgipfs upload out
```

The expected result after a real deployed-content change is a new CID. If the CID is still unchanged, stop: you are still uploading identical output.
