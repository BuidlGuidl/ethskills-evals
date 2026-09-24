# Executor transcript — 2026-09-20T132646Z-claude-with-skill-2f0adb01-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-20T132646Z-claude-with-skill-2f0adb01-1/tools-quiz-001

## assistant
I'll check the Ethereum tooling skill and verify packages resolve on npm.

## assistant
- **Skill** `{"skill":"tools"}`

  > Launching skill: tools

## assistant
- **Bash** `cd /tmp && for p in x402 x402-express x402-fetch x402-axios x402-next x402-hono @coinbase/x402 viem; do echo "=== $p ==="; npm view $p version dist-tags --json 2>&1 | head -20; done`

  > === x402 ===
  > {
  >   "version": "1.2.0",
  >   "dist-tags": {
  >     "latest": "1.2.0"
  >   }
  > }
  > === x402-express ===
  > {
  >   "version": "1.2.0",
  >   "dist-tags": {
  >     "placeholder": "0.0.0",
  >     "latest": "1.2.0"
  >   }
  > }
  > === x402-fetch ===
  > {
  >   "version": "1.2.0",
  >   "dist-tags": {
  >     "placeholder": "0.0.0",
  >     "latest": "1.2.0"
  >   }
  > }
  > === x402-axios ===
  > {
  >   "version": "1.2.1",
  >   "dist-tags": {
  >     "placeholder": "0.0. … [614 more chars]

## assistant
The skill's snippet names `@x402/*` scoped packages — let me verify those actually resolve before I put them in the answer.

## assistant
- **Bash** `cd /tmp && for p in @x402/fetch @x402/core @x402/evm @x402/express; do echo "=== $p ==="; npm view $p version 2>&1 | head -5; done`

## assistant
- **Bash** `cd /tmp && npm view x402-fetch --json 2>&1 | head -60`

  > === @x402/fetch ===
  > 2.26.0
  > === @x402/core ===
  > 2.26.0
  > === @x402/evm ===
  > 2.26.0
  > === @x402/express ===
  > 2.26.0
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T132646Z-claude-with-skill-2f0adb01-1/tools-quiz-001

  > {
  >   "_id": "x402-fetch@1.2.0",
  >   "_rev": "25-bd80d6ed06a0d3c65e8570db17f2e346",
  >   "name": "x402-fetch",
  >   "dist-tags": {
  >     "placeholder": "0.0.0",
  >     "latest": "1.2.0"
  >   },
  >   "versions": [
  >     "0.0.0",
  >     "0.1.0",
  >     "0.3.0",
  >     "0.3.1",
  >     "0.3.2",
  >     "0.3.3",
  >     "0.4.0",
  >     "0.4.1",
  >     "0.4.2",
  >     "0.5.0",
  >     "0.5.1",
  >     "0.6.0",
  >     "0.6.6",
  >     "0.7.0",
  >     "0.7.2",
  >     "0.7.3",
  >  … [1297 more chars]

## assistant
Both naming schemes exist — scoped at v2.26.0, unscoped at v1.2.0. Let me determine which is current and read the real API surface.

## assistant
- **Bash** `cd /tmp && rm -rf x402probe && mkdir x402probe && cd x402probe && npm view @x402/fetch --json 2>&1 | head -80`

## assistant
- **Bash** `cd /tmp && npm view x402-express deprecated repository homepage 2>&1; echo "--- scoped express ---"; npm view @x402/express deprecated repository homepage time.modified 2>&1`

  > {
  >   "_id": "@x402/fetch@2.26.0",
  >   "_rev": "28-a2737e4b1d3649f072c6a675dade134c",
  >   "name": "@x402/fetch",
  >   "dist-tags": {
  >     "latest": "2.26.0"
  >   },
  >   "versions": [
  >     "0.0.1",
  >     "2.0.0",
  >     "2.1.0",
  >     "2.2.0",
  >     "2.3.0",
  >     "2.4.0",
  >     "2.5.0",
  >     "2.6.0",
  >     "2.7.0",
  >     "2.8.0",
  >     "2.9.0",
  >     "2.10.0",
  >     "2.11.0",
  >     "2.12.0",
  >     "2.13.0",
  >     "2.14.0",
  >     "2.15.0",
  >     " … [1901 more chars]

  > repository = { type: 'git', url: 'git+https://github.com/x402-foundation/x402.git' }
  > homepage = 'https://github.com/x402-foundation/x402#readme'
  > --- scoped express ---
  > repository = 'https://github.com/x402-foundation/x402'
  > time.modified = '2026-09-15T18:27:30.412Z'
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T132646Z-claude-with-skill-2f0adb01-1/tools-quiz-001

## assistant
Scoped `@x402/*` is the live line (published 5 days ago); unscoped is the stale v1. Now let me install and read the real API rather than trusting the skill's snippet.

## assistant
- **Bash** `cd /tmp/x402probe && npm init -y >/dev/null 2>&1 && npm install @x402/core @x402/evm @x402/fetch @x402/express viem 2>&1 | tail -20`

  > added 99 packages, and audited 100 packages in 6s
  > 
  > 43 packages are looking for funding
  >   run `npm fund` for details
  > 
  > found 0 vulnerabilities
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T132646Z-claude-with-skill-2f0adb01-1/tools-quiz-001

## assistant
- **Bash** `cd /tmp/x402probe && for p in core evm fetch express; do echo "════ @x402/$p ════"; node -e "const m=require('@x402/$p');console.log(Object.keys(m).join('\n'))" 2>&1 | head -30; done`

  > ════ @x402/core ════
  > /ssd/workspace/buidlguidl/ethskills-evals-test/.pnp.cjs:6509
  >     throw firstError;
  >     ^
  > 
  > Error: The locator that owns the "/tmp/x402probe/node_modules/@x402/core/dist/cjs/index.js" path can't be found inside the dependency tree (this is probably an internal error)
  > Require stack:
  > - /tmp/x402probe/[eval]
  >     at require$$0.Module._resolveFilename (/ssd/workspace/buidlguidl/ethsk … [3841 more chars]

## assistant
- **Bash** `cd /tmp/x402probe/node_modules/@x402 && for p in fetch evm express; do echo "════ $p README ════"; ls $p; sed -n '1,90p' $p/README.md 2>/dev/null; done`

  > ════ fetch README ════
  > dist
  > package.json
  > README.md
  > # `@x402/fetch` [![npm version](https://img.shields.io/npm/v/%40x402%2Ffetch.svg)](https://www.npmjs.com/package/@x402/fetch)
  > 
  > A utility package that extends the native `fetch` API to automatically handle 402 Payment Required responses using the x402 payment protocol v2. This package enables seamless integration of payment functionality into your  … [8247 more chars]

## assistant
The skill's `x402Fetch`/`createWallet` snippet doesn't match the real API. Let me pin down exact export names — the READMEs disagree on `ExactEvmScheme` vs `ExactEvmClient`.

## assistant
- **Bash** `cd /tmp/x402probe/node_modules/@x402 && echo "══ evm dist tree ══"; find evm/dist -name "*.d.ts" | head -30; echo; echo "══ evm root index.d.ts ══"; cat evm/dist/types/index.d.ts 2>/dev/null || find e … [49 more chars]`

  > ══ evm dist tree ══
  > evm/dist/cjs/storage-BFpn16ZW.d.ts
  > evm/dist/cjs/rpc-BBJ9foT3.d.ts
  > evm/dist/cjs/scheme-BA7jjdgP.d.ts
  > evm/dist/cjs/permit2-jPkNwLHo.d.ts
  > evm/dist/cjs/defaultAssets-39aDn897.d.ts
  > evm/dist/cjs/storage-xgzm9G4m.d.ts
  > evm/dist/cjs/scheme-SQlQ-IUJ.d.ts
  > evm/dist/cjs/types-B4ib_1f_.d.ts
  > evm/dist/cjs/signer-CJuc15ii.d.ts
  > evm/dist/cjs/constants-CEiC_81n.d.ts
  > evm/dist/cjs/index.d.ts
  > evm/dis … [872 more chars]

## assistant
- **Bash** `cd /tmp/x402probe/node_modules/@x402 && echo "══ evm package.json exports ══"; node -e "console.log(JSON.stringify(require('/tmp/x402probe/node_modules/@x402/evm/package.json').exports,null,1))" 2>/de … [109 more chars]`

  > ══ evm package.json exports ══
  > {
  >  ".": {
  >   "import": {
  >    "types": "./dist/esm/index.d.mts",
  >    "default": "./dist/esm/index.mjs"
  >   },
  >   "require": {
  >    "types": "./dist/cjs/index.d.ts",
  >    "default": "./dist/cjs/index.js"
  >   }
  >  },
  >  "./v1": {
  >   "import": {
  >    "types": "./dist/esm/v1/index.d.mts",
  >    "default": "./dist/esm/v1/index.mjs"
  >   },
  >   "require": {
  >    "types": "./dist/cjs/v1/index.d.ts",
  >     … [4717 more chars]

## assistant
- **Bash** `cd /tmp/x402probe/node_modules/@x402 && echo "══ evm ROOT ══"; grep -oE "export \{[^}]*\}" evm/dist/cjs/index.d.ts | tr ',' '\n' | head -40; echo; echo "══ evm exact/client ══"; grep -oE "export \{[^} … [173 more chars]`

  > ══ evm ROOT ══
  > export { E as ExactEvmScheme }
  > export { C as ClientEvmSigner
  >  t as toClientEvmSigner
  >  a as toFacilitatorEvmSigner }
  > export { P as Permit2AllowanceParams
  >  c as createPermit2ApprovalTx
  >  g as getPermit2AllowanceReadParams }
  > export { P as PERMIT2_ADDRESS
  >  c as authorizationTypes
  >  d as eip3009ABI
  >  e as erc20AllowanceAbi
  >  p as permit2WitnessTypes
  >  u as uptoPermit2WitnessTypes
  >  f as x402Ex … [1421 more chars]

## assistant
- **Bash** `cd /tmp/x402probe/node_modules/@x402 && echo "══ fetch ══"; grep -oE "export \{[^}]*\}" fetch/dist/cjs/index.d.ts | tr ',' '\n'; echo; echo "══ express ══"; grep -oE "export \{[^}]*\}" express/dist/cj … [164 more chars]`

  > ══ fetch ══
  > export { HTTPResourceResponse
  >  PaymentPolicy
  >  SchemeRegistration
  >  SelectPaymentRequirements
  >  x402Client
  >  x402ClientConfig
  >  x402HTTPClient }
  > export { decodePaymentResponseHeader }
  > export { Network
  >  PaymentPayload
  >  PaymentRequired
  >  PaymentRequirements
  >  SchemeNetworkClient }
  > export { wrapFetchWithPayment
  >  wrapFetchWithPaymentFromConfig }
  > 
  > ══ express ══
  > export { PaywallConfig
  >  PaywallProvi … [653 more chars]

## assistant
Let me confirm `HTTPFacilitatorClient` and then typecheck the actual code I plan to publish.

## assistant
- **Bash** `cd /tmp/x402probe/node_modules/@x402 && echo "══ core/server ══"; grep -oE "export \{[^}]*\}" core/dist/cjs/server/index.d.ts | tr ',' '\n' | grep -iE "facilit|server|Scheme" | head -20; echo; echo "═ … [108 more chars]`

  > ══ core/server ══
  >  E as FacilitatorCapabilityError
  >  F as FacilitatorClient
  >  z as FacilitatorConfig
  >  A as FacilitatorResponseError
  >  B as FacilitatorTimeoutError
  >  y as HTTPFacilitatorClient
  >  ak as SchemeEnrichPaymentRequiredResponseHook
  >  am as SchemeEnrichSettlementPayloadHook
  >  an as SchemeEnrichSettlementResponseHook
  >  al as SchemePaymentRequiredContext
  >  G as getFacilitatorResponseError
  >  x as x402HT … [1399 more chars]

## assistant
- **Bash** `cd /tmp/x402probe && npm install --save-dev typescript @types/node @types/express 2>&1 | tail -3; npm install express @coinbase/x402 2>&1 | tail -3; echo "══ @coinbase/x402 ══"; grep -oE "export \{[^} … [146 more chars]`

  > Exit code 1
  >   run `npm fund` for details
  > 
  > found 0 vulnerabilities
  > npm warn tar TAR_ENTRY_ERROR ENOSPC: no space left on device, write
  > npm error A complete log of this run can be found in: /home/damu/.npm/_logs/2026-09-20T13_28_09_516Z-debug-0.log
  > ══ @coinbase/x402 ══
  > export { createAuthHeader
  >  createCdpAuthHeaders
  >  createCorrelationHeader
  >  createFacilitatorConfig
  >  facilitator }
  > node_modules/@coinb … [89 more chars]

## assistant
Disk filled up. Let me clear space and continue.

## assistant
- **Bash** `df -h /tmp /home 2>&1 | head; npm cache clean --force 2>&1 | tail -2; df -h /home 2>&1 | tail -2`

  > Exit code 1
  > Command output was lost: the temp filesystem at /tmp/claude-1000/-home-damu--cache-ethskills-evals-2026-09-20T132646Z-claude-with-skill-2f0adb01-1-tools-quiz-001/843c2d84-ac28-4a03-a74b-a2d988ebaf02/tasks is full (0MB free). The child process's stdout/stderr writes failed with ENOSPC. Free up space or set CLAUDE_CODE_TMPDIR to a directory on a filesystem with room.

## assistant
- **Bash** `export CLAUDE_CODE_TMPDIR=/home/damu/.cache/tmpwork; mkdir -p $CLAUDE_CODE_TMPDIR; df -h /tmp /home | head -5`

  > Filesystem      Size  Used Avail Use% Mounted on
  > /dev/nvme0n1p1  225G  213G  395M 100% /
  > /dev/nvme0n1p1  225G  213G  395M 100% /

## assistant
- **Bash** `du -sh /home/damu/.npm/_cacache 2>/dev/null; npm cache clean --force >/dev/null 2>&1; df -h / | tail -1`

  > 8,3G	/home/damu/.npm/_cacache
  > /dev/nvme0n1p1  225G  204G  9,7G  96% /

## assistant
Reclaimed 9.7G. Now installing toolchain and typechecking the real code.

## assistant
- **Bash** `cd /tmp/x402probe && npm install express @coinbase/x402 2>&1 | tail -3 && npm install --save-dev typescript @types/node @types/express 2>&1 | tail -3`

  >   run `npm fund` for details
  > 
  > found 0 vulnerabilities
  >   run `npm fund` for details
  > 
  > found 0 vulnerabilities
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T132646Z-claude-with-skill-2f0adb01-1/tools-quiz-001

## assistant
- **Bash** `cd /tmp/x402probe && cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
 … [978 more chars]`

  > src/client.ts(6,37): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
  > src/client.ts(17,13): error TS1309: The current file is a CommonJS module and cannot use 'await' at the top level.
  > src/client.ts(18,14): error TS1309: The current file is a CommonJS module and ca … [161 more chars]

## assistant
Imports and export names all resolved. Fixing the module config and adding the server side.

## assistant
- **Bash** `cd /tmp/x402probe && python3 - <<'EOF'
import json
p=json.load(open('package.json')); p['type']='module'; json.dump(p,open('package.json','w'),indent=2)
EOF
cat > src/server.ts <<'EOF'
import express  … [922 more chars]`

  > EXIT:0
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T132646Z-claude-with-skill-2f0adb01-1/tools-quiz-001

## assistant
Both typecheck clean. Now verifying the Base **mainnet** facilitator path, since `x402.org/facilitator` is testnet-oriented.

## assistant
- **Bash** `cd /tmp/x402probe && sed -n '1,60p' node_modules/@coinbase/x402/dist/cjs/index.d.ts; echo "══ README ══"; sed -n '1,60p' node_modules/@coinbase/x402/README.md 2>/dev/null`

  > import { FacilitatorConfig } from '@x402/core/http';
  > 
  > /**
  >  * Creates an authorization header for a request to the Coinbase API.
  >  *
  >  * @param apiKeyId - The api key ID
  >  * @param apiKeySecret - The api key secret
  >  * @param requestMethod - The method for the request (e.g. 'POST')
  >  * @param requestHost - The host for the request (e.g. 'https://x402.org/facilitator')
  >  * @param requestPath - The path fo … [3409 more chars]

## assistant
- **Bash** `cd /tmp/x402probe && cat > src/server-mainnet.ts <<'EOF'
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm … [695 more chars]`

  > EXIT:0
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T132646Z-claude-with-skill-2f0adb01-1/tools-quiz-001

## assistant
All three typecheck. Let me do a runtime smoke test that the paywall actually returns a 402 with payment requirements.

## assistant
- **Bash** `cd /tmp/x402probe && npm install --save-dev tsx 2>&1 | tail -2 && sed -i 's/0xYourReceivingAddress/0x857f1ac8Ff0c0FBfC5B4c34b0Cc0A1B0eF63D4f7/' src/server.ts && (npx tsx src/server.ts > /tmp/x402probe … [171 more chars]`

  > found 0 vulnerabilities
  > ── curl ──
  > HTTP/1.1 404 Not Found
  > Cache-Control: no-store, must-revalidate
  > Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
  > link: </_next/static/media/26392a2588351579-s.p.woff2>; rel=preload; as="font"; crossorigin=""; type="font/woff2", </_next/static/media/3703c28dcda155b1-s.p.woff2>; rel=preload; as="font"; crossorig … [3030 more chars]

## assistant
Port 3000 is taken by an unrelated app. Retrying on a free port.

## assistant
- **Bash** `cd /tmp/x402probe && sed -i 's/app.listen(3000)/app.listen(4021)/' src/server.ts && (npx tsx src/server.ts > /tmp/x402probe/srv.log 2>&1 &) && sleep 7 && echo "── curl no payment ──" && curl -s -i htt … [92 more chars]`

  > ── curl no payment ──
  > 
  > ── log ──
  > RouteConfigurationError: x402 Route Configuration Errors:
  >   - Route "GET /quote": Facilitator does not support scheme "exact" on network "eip155:8453"
  >     at x402HTTPResourceServer.initialize (/tmp/x402probe/node_modules/@x402/core/src/http/x402HTTPResourceServer.ts:492:13)
  >     at process.processTicksAndRejections (node:internal/process/task_queues:103:5) {
  >   error … [372 more chars]

## assistant
Real finding: the public `x402.org` facilitator rejects Base **mainnet** at startup. Let me confirm what it does support.

## assistant
- **Bash** `curl -s https://x402.org/facilitator/supported | head -c 2000; echo`

  > {"kinds":[{"x402Version":2,"scheme":"exact","network":"eip155:84532"},{"x402Version":2,"scheme":"upto","network":"eip155:84532","extra":{"facilitatorAddress":"0xd407e409E34E0b9afb99EcCeb609bDbcD5e7f1bf"}},{"x402Version":2,"scheme":"batch-settlement","network":"eip155:84532"},{"x402Version":2,"scheme":"exact","network":"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1","extra":{"feePayer":"CKPKJWNdJEqa81x7C … [1401 more chars]

## assistant
Confirmed testnet-only. Let me verify the full 402 handshake on Base Sepolia.

## assistant
- **Bash** `cd /tmp/x402probe && sed -i 's/eip155:8453"/eip155:84532"/g' src/server.ts && (npx tsx src/server.ts > /tmp/x402probe/srv.log 2>&1 &) && sleep 8 && echo "── unpaid request ──" && curl -s -i -H "Accept … [115 more chars]`

  > ── unpaid request ──
  > HTTP/1.1 402 Payment Required
  > X-Powered-By: Express
  > Content-Type: application/json; charset=utf-8
  > PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkIiwicmVzb3VyY2UiOnsidXJsIjoiaHR0cDovL2xvY2FsaG9zdDo0MDIxL3F1b3RlIiwiZGVzY3JpcHRpb24iOiJPbmUgbWFya2V0IHF1b3RlIiwibWltZVR5cGUiOiIifSwiYWNjZXB0cyI6W3sic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoiZWlwMTU1Ojg0NTMyIiwiYW1 … [542 more chars]

## assistant
Full handshake works. Let me capture exact installed versions and clean up.

## assistant
- **Bash** `cd /tmp/x402probe && echo "── decoded PAYMENT-REQUIRED ──" && curl -s -D- -o/dev/null http://localhost:4021/quote | grep -i '^payment-required' | cut -d' ' -f2 | tr -d '\r' | base64 -d | python3 -m js … [106 more chars]`

  > Exit code 144
  > ── decoded PAYMENT-REQUIRED ──
  > {
  >     "x402Version": 2,
  >     "error": "Payment required",
  >     "resource": {
  >         "url": "http://localhost:4021/quote",
  >         "description": "One market quote",
  >         "mimeType": ""
  >     },
  >     "accepts": [
  >         {
  >             "scheme": "exact",
  >             "network": "eip155:84532",
  >             "amount": "20000",
  >             "asset": "0x036CbD538 … [256 more chars]

## assistant
- **Bash** `cd /tmp/x402probe && npm ls --depth=0 2>/dev/null; echo "── viem resolved ──"; python3 -c "import json;print(json.load(open('node_modules/viem/package.json'))['version'])"`

  > x402probe@1.0.0 /tmp/x402probe
  > ├── @coinbase/x402@2.1.0
  > ├── @types/express@5.0.6
  > ├── @types/node@26.6.2
  > ├── @x402/core@2.26.0
  > ├── @x402/evm@2.26.0
  > ├── @x402/express@2.26.0
  > ├── @x402/fetch@2.26.0
  > ├── express@5.2.1
  > ├── tsx@4.23.15
  > ├── typescript@7.0.2
  > └── viem@2.56.8
  > 
  > ── viem resolved ──
  > 2.56.8
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T132646Z-claude-with-skill-2f0adb01-1/t … [13 more chars]

## assistant
Now writing the answer.

## assistant
- **Bash** `cat > answer.md <<'MDEOF'
# Paid API for AI agents: x402 on Base

## The short answer

The standard is **x402** — an open payment protocol built on the long-dormant HTTP `402 Payment Required` status  … [7220 more chars]`

  > 194 answer.md

## assistant
- **Bash** `rm -rf /tmp/x402probe && df -h / | tail -1`

  > /dev/nvme0n1p1  225G  206G  7,2G  97% /

## assistant
Written to `answer.md`.

## The answer

**x402** is the standard — it revives the HTTP `402 Payment Required` status code. Your server returns 402 with payment requirements; the client signs an EIP-3009 `transferWithAuthorization` for USDC and retries with an `X-PAYMENT` header; a *facilitator* verifies and settles on-chain. No accounts, no keys, and the agent needs no gas (the facilitator submits the tx).

```bash
# server
npm install @x402/express @x402/evm @x402/core express
# agent
npm install @x402/fetch @x402/evm viem
# Base mainnet facilitator
npm install @coinbase/x402
```

Client side is a drop-in `fetch` wrapper — `wrapFetchWithPaymentFromConfig(fetch, {schemes: [...]})` — and the pay/retry happens invisibly inside the call.

## Two things worth flagging

**Package naming.** There are two live generations on npm. The scoped `@x402/*` v2.26.0 line is current (published 5 days ago); the unscoped `x402-fetch`/`x402-express` v1.2.0 line is the older generation, last touched in April. Most tutorials you'll find reference the unscoped v1 packages. They're not interchangeable — v1 uses `"base"`, v2 uses CAIP-2 `"eip155:8453"`. I went with v2.

I also want to correct something in the tooling reference I consulted: it gave the API as `x402Fetch()` with `createWallet()` from `@x402/evm`. Those symbols don't exist. The real exports are `wrapFetchWithPaymentFromConfig` and `toClientEvmSigner`, with the account coming from viem's `privateKeyToAccount`. The code in `answer.md` uses the verified names.

**The facilitator gotcha.** The free public facilitator at `x402.org/facilitator` **does not support Base mainnet** — it's testnet-only. I found this by booting the server, not from docs:

```
RouteConfigurationError: Facilitator does not support scheme "exact" on network "eip155:8453"
```

Its `/supported` endpoint lists `eip155:84532` (Base Sepolia) only. For mainnet you need `@coinbase/x402` with CDP API credentials. Helpfully, the middleware validates routes at startup, so this crashes on boot rather than on a customer's first call.

## Verification

Beyond checking that the packages resolve: both files typecheck clean under TypeScript 7.0.2 with `strict` + `NodeNext`, and I ran the server against the live facilitator on Base Sepolia. An unpaid request returned a real `402` whose decoded header showed `"$0.02"` correctly converted to `amount: "20000"` against Base Sepolia USDC. That decoded payload is in the answer.

Going to mainnet is two changes: the network string and the facilitator.

One caveat on my test — I verified the server half end-to-end, but not an actual settled payment, since that needs a funded wallet and (on mainnet) CDP credentials. The client code is typecheck-verified against the real type definitions rather than executed.

## run stats
- turns: 33
- duration: 290s
- cost: $1.284578
- tokens in/out: 1034026/13613
- of which cache write/read: 44948/989026
