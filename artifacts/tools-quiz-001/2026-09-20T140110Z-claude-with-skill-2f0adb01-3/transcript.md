# Executor transcript — 2026-09-20T140110Z-claude-with-skill-2f0adb01-3

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-20T140110Z-claude-with-skill-2f0adb01-3/tools-quiz-001

## assistant
I'll pull up the Ethereum tooling skill and verify package availability in parallel.

## assistant
- **Skill** `{"skill":"tools","args":"x402 HTTP 402 inline agent payments on Base"}`

  > Launching skill: tools

## assistant
- **Bash** `for p in x402 x402-axios x402-fetch x402-express x402-next x402-hono viem; do echo "=== $p ==="; npm view $p version time.modified dist-tags --json 2>&1 | head -20; done`

  > === x402 ===
  > {
  >   "version": "1.2.0",
  >   "time.modified": "2026-04-16T06:27:18.106Z",
  >   "dist-tags": {
  >     "latest": "1.2.0"
  >   }
  > }
  > === x402-axios ===
  > {
  >   "version": "1.2.1",
  >   "time.modified": "2026-05-29T17:36:34.938Z",
  >   "dist-tags": {
  >     "placeholder": "0.0.0",
  >     "latest": "1.2.1"
  >   }
  > }
  > === x402-fetch ===
  > {
  >   "version": "1.2.0",
  >   "time.modified": "2026-04-16T06:30:13.924Z",
  >   "dist-tags": {
  >   … [703 more chars]

## assistant
The skill recommends `@x402/*` scoped packages — let me verify those actually resolve before I write them down.

## assistant
- **Bash** `cd /tmp && for p in "@x402/fetch" "@x402/core" "@x402/evm" "@x402/express" "@coinbase/x402" "x402-fetch" "x402-axios"; do echo "=== $p ==="; npm view "$p" version 2>&1 | head -4; done`

  > === @x402/fetch ===
  > 2.26.0
  > === @x402/core ===
  > 2.26.0
  > === @x402/evm ===
  > 2.26.0
  > === @x402/express ===
  > 2.26.0
  > === @coinbase/x402 ===
  > 2.1.0
  > === x402-fetch ===
  > 1.2.0
  > === x402-axios ===
  > 1.2.1
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T140110Z-claude-with-skill-2f0adb01-3/tools-quiz-001

## assistant
Both families resolve. Let me check which is current and verify the actual exported API rather than trusting the skill's sample code.

## assistant
- **Bash** `cd /tmp && for p in "@x402/fetch" "x402-fetch" "@x402/express" "x402-express"; do echo "=== $p ==="; npm view "$p" time.modified deprecated --json 2>&1|head -6; done; echo "---- all @x402 versions (ta … [63 more chars]`

  > === @x402/fetch ===
  > "2026-09-15T18:26:58.436Z"
  > === x402-fetch ===
  > "2026-04-16T06:30:13.924Z"
  > === @x402/express ===
  > "2026-09-15T18:27:30.412Z"
  > === x402-express ===
  > "2026-04-16T18:10:00.746Z"
  > ---- all @x402 versions (tail) ----
  >   "2.20.0",
  >   "2.21.0",
  >   "2.22.0",
  >   "2.23.0",
  >   "2.24.0",
  >   "2.25.0",
  >   "2.26.0"
  > ]
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T140110Z-claude-with-s … [30 more chars]

## assistant
Scoped packages are actively maintained (5 days ago) vs. the unscoped ones (April). Now let me install and inspect the real exports.

## assistant
- **Bash** `mkdir -p /tmp/x402probe && cd /tmp/x402probe && npm init -y >/dev/null 2>&1 && npm i @x402/fetch @x402/core @x402/evm @x402/express viem 2>&1 | tail -5; echo "=== installed ==="; npm ls --depth=0 2>&1`

  > 43 packages are looking for funding
  >   run `npm fund` for details
  > 
  > found 0 vulnerabilities
  > === installed ===
  > x402probe@1.0.0 /tmp/x402probe
  > ├── @x402/core@2.26.0
  > ├── @x402/evm@2.26.0
  > ├── @x402/express@2.26.0
  > ├── @x402/fetch@2.26.0
  > └── viem@2.56.8
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T140110Z-claude-with-skill-2f0adb01-3/tools-quiz-001

## assistant
All install cleanly. Now let me verify the actual exported names — the skill's sample used `x402Fetch` and `createWallet`.

## assistant
- **Bash** `cd /tmp/x402probe && for p in @x402/fetch @x402/evm @x402/express @x402/core; do echo "=== $p ==="; node -e "const m=require('$p');console.log(Object.keys(m).join(', '))" 2>&1 | head -5; done`

  > === @x402/fetch ===
  > /ssd/workspace/buidlguidl/ethskills-evals-test/.pnp.cjs:6509
  >     throw firstError;
  >     ^
  > 
  > Error: The locator that owns the "/tmp/x402probe/node_modules/@x402/fetch/dist/cjs/index.js" path can't be found inside the dependency tree (this is probably an internal error)
  > === @x402/evm ===
  > /ssd/workspace/buidlguidl/ethskills-evals-test/.pnp.cjs:6509
  >     throw firstError;
  >     ^
  > 
  > Error … [865 more chars]

## assistant
A stray Yarn PnP loader is hijacking `require`. Let me disable it and read the type declarations directly.

## assistant
- **Bash** `cd /tmp/x402probe && env -u NODE_OPTIONS for p in fetch evm express core; do :; done 2>/dev/null; for p in fetch evm express core; do echo "=== @x402/$p ==="; env -u NODE_OPTIONS node -e "const m=requ … [74 more chars]`

  > Exit code 2
  > /bin/bash: eval: line 1: syntax error near unexpected token `do'
  > /bin/bash: eval: line 1: `cd /tmp/x402probe && env -u NODE_OPTIONS for p in fetch evm express core; do :; done 2>/dev/null; for p in fetch evm express core; do echo "=== @x402/$p ==="; env -u NODE_OPTIONS node -e "const m=require('@x402/$p');console.log(Object.keys(m).join(', '))" 2>&1|head -4; done'

## assistant
- **Bash** `cd /tmp/x402probe && for p in fetch evm express core; do echo "=== @x402/$p ==="; env -u NODE_OPTIONS node -e "const m=require('@x402/$p');console.log(Object.keys(m).join(', '))" 2>&1|head -4; done`

  > === @x402/fetch ===
  > decodePaymentResponseHeader, wrapFetchWithPayment, wrapFetchWithPaymentFromConfig, x402Client, x402HTTPClient
  > === @x402/evm ===
  > AUTH_CAPTURE_ESCROW_ADDRESS, AUTH_CAPTURE_ESCROW_V1_0_ADDRESS, AUTH_CAPTURE_ESCROW_V1_1_ADDRESS, AUTH_CAPTURE_SCHEME, AuthCaptureEvmScheme, BATCH_SETTLEMENT_ADDRESS, BATCH_SETTLEMENT_DOMAIN, BATCH_SETTLEMENT_SCHEME, BUILDER_CODE_KEY, BatchSettlementEvm … [1646 more chars]

## assistant
The skill's sample code (`x402Fetch`, `createWallet`) doesn't exist. Let me read the real type signatures.

## assistant
- **Bash** `cd /tmp/x402probe/node_modules/@x402 && echo "##### fetch/wrapFetchWithPayment #####"; find fetch/dist -name "*.d.ts" | xargs grep -l "wrapFetchWithPayment" | head -2 | xargs -I{} sh -c 'echo "--{}--" … [20 more chars]`

  > ##### fetch/wrapFetchWithPayment #####
  > --fetch/dist/cjs/index.d.ts--
  > import { x402Client, x402HTTPClient, x402ClientConfig } from '@x402/core/client';
  > export { HTTPResourceResponse, PaymentPolicy, SchemeRegistration, SelectPaymentRequirements, x402Client, x402ClientConfig, x402HTTPClient } from '@x402/core/client';
  > export { decodePaymentResponseHeader } from '@x402/core/http';
  > export { Network, Pa … [2533 more chars]

## assistant
Now the server side and the signer helper.

## assistant
- **Bash** `cd /tmp/x402probe/node_modules/@x402 && echo "##### paymentMiddleware #####"; grep -A40 "declare function paymentMiddleware" express/dist/cjs/index.d.ts | head -55; echo; echo "##### toClientEvmSigner … [90 more chars]`

  > ##### paymentMiddleware #####
  > declare function paymentMiddlewareFromHTTPServer(httpServer: x402HTTPResourceServer, paywallConfig?: PaywallConfig, paywall?: PaywallProvider, syncFacilitatorOnStart?: boolean): (req: Request, res: Response, next: NextFunction) => Promise<void>;
  > /**
  >  * Express payment middleware for x402 protocol (direct server instance).
  >  *
  >  * Use this when you want to pass a pre-con … [2784 more chars]

## assistant
Need the facilitator piece and route config shape. Let me check those.

## assistant
- **Bash** `cd /tmp/x402probe/node_modules/@x402 && echo "### toClientEvmSigner ###"; grep -rh "toClientEvmSigner" evm/dist/cjs/*.d.ts | head -5; echo; echo "### RoutesConfig / RouteConfig ###"; grep -rhA12 "type … [230 more chars]`

  > ### toClientEvmSigner ###
  > export { C as ClientEvmSigner, t as toClientEvmSigner, a as toFacilitatorEvmSigner } from './signer-CJuc15ii.js';
  >  * Or composed via `toClientEvmSigner(account, publicClient)`.
  >  * const signer = toClientEvmSigner(account, publicClient);
  >  * const signer = toClientEvmSigner(account, publicClient);
  > declare function toClientEvmSigner(signer: Omit<ClientEvmSigner, "readContrac … [719 more chars]

## assistant
- **Bash** `cd /tmp/x402probe && npm i @coinbase/x402 2>&1|tail -2; echo "### @coinbase/x402 exports ###"; env -u NODE_OPTIONS node -e "console.log(Object.keys(require('@coinbase/x402')).join(', '))" 2>&1|head -4 … [126 more chars]`

  > found 0 vulnerabilities
  > ### @coinbase/x402 exports ###
  > createAuthHeader, createCdpAuthHeaders, createCorrelationHeader, createFacilitatorConfig, facilitator
  > 
  > ### PaymentOption ###
  > interface PaymentOption {
  >     scheme: string;
  >     payTo: string | DynamicPayTo;
  >     price: Price | DynamicPrice;
  >     network: Network;
  >     maxTimeoutSeconds?: number;
  >     extra?: Record<string, unknown>;
  > }
  > /**
  >  * Route c … [337 more chars]

## assistant
Let me find how to wire the facilitator client, then typecheck real code.

## assistant
- **Bash** `cd /tmp/x402probe && grep -rh "FacilitatorClient" node_modules/@x402/core/dist/cjs/server.d.ts | head -12; echo "=== server exports ==="; env -u NODE_OPTIONS node -e "console.log(Object.keys(require(' … [46 more chars]`

  > ugrep: warning: node_modules/@x402/core/dist/cjs/server.d.ts: No such file or directory
  > === server exports ===
  > FacilitatorCapabilityError, FacilitatorResponseError, FacilitatorTimeoutError, HTTPFacilitatorClient, PAYMENT_FLOWS, PAYMENT_REQUIRED_CACHE_CONTROL, RouteConfigurationError, SDK_DEFAULT_ASSET_TRANSFER_METHOD, SETTLEMENT_OVERRIDES_HEADER, applyPaymentFlowWireExtra, assertAcceptsAdditiveExt … [615 more chars]

## assistant
Now let me write both sides as real files and typecheck them against the installed packages.

## assistant
- **Bash** `cd /tmp/x402probe && npm i -D typescript @types/node @types/express >/dev/null 2>&1 && npm i express >/dev/null 2>&1 && cat > client.ts <<'EOF'
import { privateKeyToAccount } from "viem/accounts";
imp … [1607 more chars]`

  > client.ts(14,13): error TS1309: The current file is a CommonJS module and cannot use 'await' at the top level.
  > client.ts(15,13): error TS1309: The current file is a CommonJS module and cannot use 'await' at the top level.
  > server.ts(9,28): error TS2345: Argument of type 'ExactEvmScheme' is not assignable to parameter of type 'SchemeNetworkServer'.
  >   Type 'ExactEvmScheme' is missing the following pr … [319 more chars]

## assistant
Real errors caught. The server needs a distinct server-side scheme class — let me find it.

## assistant
- **Bash** `cd /tmp/x402probe && echo "### evm subpaths ###"; env -u NODE_OPTIONS node -e "console.log(Object.keys(require('./node_modules/@x402/evm/package.json').exports).join(' '))"; for s in server client fac … [179 more chars]`

  > ### evm subpaths ###
  > . ./v1 ./exact/client ./exact/server ./exact/facilitator ./exact/v1/client ./exact/v1/facilitator ./upto/client ./upto/server ./upto/facilitator ./batch-settlement/client ./batch-settlement/client/file-storage ./batch-settlement/server ./batch-settlement/server/file-storage ./batch-settlement/server/redis-storage ./batch-settlement/facilitator ./auth-capture/client
  > --- @x402/e … [368 more chars]

## assistant
- **Bash** `cd /tmp/x402probe && for s in exact/client exact/server; do echo "--- @x402/evm/$s ---"; env -u NODE_OPTIONS node -e "console.log(Object.keys(require('@x402/evm/$s')).join(', '))" 2>&1|head -3; done`

  > --- @x402/evm/exact/client ---
  > ExactEvmScheme, createPermit2ApprovalTx, erc20AllowanceAbi, getPermit2AllowanceReadParams, registerExactEvmScheme
  > --- @x402/evm/exact/server ---
  > ExactEvmScheme, registerExactEvmScheme
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T140110Z-claude-with-skill-2f0adb01-3/tools-quiz-001

## assistant
Two distinct `ExactEvmScheme` classes. Let me check the server one's constructor and re-typecheck.

## assistant
- **Bash** `cd /tmp/x402probe && grep -rhB6 "constructor" node_modules/@x402/evm/dist/cjs/exact/server.d.ts 2>/dev/null | head -20; ls node_modules/@x402/evm/dist/cjs/exact/ 2>/dev/null | head`

  > client
  > facilitator
  > server
  > v1
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T140110Z-claude-with-skill-2f0adb01-3/tools-quiz-001

## assistant
- **Bash** `cd /tmp/x402probe && f=$(find node_modules/@x402/evm/dist/cjs/exact/server -name "*.d.ts"|head -1); echo "FILE=$f"; grep -B12 "constructor" $f | head -30`

  > FILE=node_modules/@x402/evm/dist/cjs/exact/server/index.d.ts
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T140110Z-claude-with-skill-2f0adb01-3/tools-quiz-001

## assistant
- **Bash** `cd /tmp/x402probe && cat node_modules/@x402/evm/dist/cjs/exact/server/index.d.ts | head -20; echo "=== chase ==="; grep -rhB8 "constructor" node_modules/@x402/evm/dist/cjs/exact-server-*.d.ts 2>/dev/n … [14 more chars]`

  > import { SchemeNetworkServer, MoneyParser, Network, Price, AssetAmount, PaymentRequirements } from '@x402/core/types';
  > import { A as AssetTransferMethod } from '../../types-BBC1mC8d.js';
  > import { x402ResourceServer } from '@x402/core/server';
  > 
  > /**
  >  * EVM server implementation for the Exact payment scheme.
  >  */
  > declare class ExactEvmScheme implements SchemeNetworkServer {
  >     readonly scheme = "exac … [549 more chars]

## assistant
- **Bash** `cd /tmp/x402probe && grep -A6 "constructor" node_modules/@x402/evm/dist/cjs/exact/server/index.d.ts | head -12`

  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T140110Z-claude-with-skill-2f0adb01-3/tools-quiz-001

## assistant
The earlier arity error was from resolving the *client* class. Let me fix imports and re-typecheck.

## assistant
- **Bash** `cd /tmp/x402probe && sed -i 's#import { ExactEvmScheme } from "@x402/evm";#import { ExactEvmScheme } from "@x402/evm/exact/server";#' server.ts && sed -i 's#import { ExactEvmScheme, toClientEvmSigner  … [351 more chars]`

  > EXIT=0
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T140110Z-claude-with-skill-2f0adb01-3/tools-quiz-001

## assistant
Clean typecheck. Let me remove the `as never` cast I used as a crutch and get the signer wiring honest.

## assistant
- **Bash** `cd /tmp/x402probe && f=$(ls node_modules/@x402/evm/dist/cjs/signer-*.d.ts|head -1); grep -B30 "declare function toClientEvmSigner" $f | head -45`

  >         address: `0x${string}`;
  >     }): Promise<`0x${string}` | undefined>;
  > };
  > /**
  >  * Composes a ClientEvmSigner from a local account and a public client.
  >  *
  >  * Use this when your signer (e.g., `privateKeyToAccount`) doesn't have
  >  * `readContract`. The `publicClient` provides the on-chain read capability.
  >  *
  >  * Alternatively, use a local account with an explicit public client:
  >  * ```typescript
  >  *  … [1154 more chars]

## assistant
It takes two separate args, not a merged object. Let me correct that and re-verify cast-free.

## assistant
- **Bash** `cd /tmp/x402probe && sed -i 's#const signer = toClientEvmSigner({ ...account, publicClient } as never);#const signer = toClientEvmSigner(account, publicClient);#' client.ts && env -u NODE_OPTIONS npx  … [127 more chars]`

  > client.ts(10,43): error TS2345: Argument of type '{ account: { address: undefined; type: "json-rpc"; }; batch?: { multicall?: boolean | { batchSize?: number; deployless?: boolean; wait?: number; }; }; cacheTime: number; ccipRead?: false | { request?: (parameters: CcipRequestParameters) => Promise<...>; }; ... 73 more ...; extend: <const client extends { ...; } & Ex...' is not assignable to paramet … [2121 more chars]

## assistant
A genuine viem-2.56/x402 generic variance mismatch. Let me find the minimal honest workaround.

## assistant
- **Bash** `cd /tmp/x402probe && cp client.ts t1.ts && sed -i 's#toClientEvmSigner(account, publicClient)#toClientEvmSigner(account, { readContract: (a) => publicClient.readContract(a as never) })#' t1.ts && env  … [144 more chars]`

  > T1_DONE
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T140110Z-claude-with-skill-2f0adb01-3/tools-quiz-001

## assistant
That resolves it. Let me apply it and run a real runtime smoke test that the server actually returns 402.

## assistant
- **Bash** `cd /tmp/x402probe && sed -i 's#toClientEvmSigner(account, publicClient)#toClientEvmSigner(account, { readContract: (a) => publicClient.readContract(a as never) })#' client.ts && env -u NODE_OPTIONS np … [45 more chars]`

  > FINAL_TSC_EXIT=0
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T140110Z-claude-with-skill-2f0adb01-3/tools-quiz-001

## assistant
Both typecheck clean. Now a runtime smoke test that the gate actually emits a 402 with payment requirements.

## assistant
- **Bash** `cd /tmp/x402probe && cat > smoke.ts <<'EOF'
import express from "express";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/serv … [862 more chars]`

  > Error: Facilitator does not support exact on eip155:8453. Make sure to call initialize() to fetch supported kinds from facilitators.
  >     at x402ResourceServer.buildPaymentRequirements (/tmp/x402probe/node_modules/@x402/core/src/server/x402ResourceServer.ts:787:13)
  >     at x402ResourceServer.buildPaymentRequirementsFromOptions (/tmp/x402probe/node_modules/@x402/core/src/server/x402ResourceServer.ts: … [829 more chars]

## assistant
Caught a real gotcha — I disabled facilitator sync. Let me re-run with the default.

## assistant
- **Bash** `cd /tmp/x402probe && sed -i 's#}, server, undefined, undefined, false));#}, server));#' smoke.ts && timeout 90 env -u NODE_OPTIONS npx tsx smoke.ts 2>&1 | tail -30`

  > Failed to fetch supported kinds from facilitator: Error: Facilitator getSupported failed (401): Unauthorized
  > Error: Failed to initialize: no supported payment kinds loaded from any facilitator.
  >     at x402ResourceServer.initialize (/tmp/x402probe/node_modules/@x402/core/src/server/x402ResourceServer.ts:699:11)
  >     at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
  >     a … [1088 more chars]

## assistant
Reached the facilitator but it needs CDP credentials for mainnet. Let me confirm the keyless testnet facilitator produces a real 402.

## assistant
- **Bash** `cd /tmp/x402probe && cat > smoke2.ts <<'EOF'
import express from "express";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/ser … [886 more chars]`

  > STATUS: 402
  > BODY: {}
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T140110Z-claude-with-skill-2f0adb01-3/tools-quiz-001

## assistant
Real 402 end-to-end. Let me confirm where the payment requirements are carried.

## assistant
- **Bash** `cd /tmp/x402probe && sed -i 's#console.log("BODY:", JSON.stringify(await r.json()).slice(0, 600));#console.log("HDRS:", JSON.stringify(Object.fromEntries(r.headers)).slice(0,400)); console.log("TEXT:" … [113 more chars]`

  > STATUS: 402
  > HDRS: {"cache-control":"no-store","connection":"keep-alive","content-length":"2","content-type":"application/json; charset=utf-8","date":"Sun, 20 Sep 2026 14:03:57 GMT","etag":"W/\"2-vyGp6PvFo4RvsFtPoIWeCReyIC8\"","keep-alive":"timeout=5","payment-required":"eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkIiwicmVzb3VyY2UiOnsidXJsIjoiaHR0cDovL2xvY2FsaG9zdDozMTEyL3BhaWQiLCJkZXNjc … [147 more chars]

## assistant
- **Bash** `cd /tmp/x402probe && sed -i 's#console.log("HDRS:.*#console.log("DECODED:", Buffer.from(r.headers.get("payment-required")||"","base64").toString());#' smoke2.ts && timeout 90 env -u NODE_OPTIONS npx t … [27 more chars]`

  > STATUS: 402
  > DECODED: {"x402Version":2,"error":"Payment required","resource":{"url":"http://localhost:3112/paid","description":"","mimeType":""},"accepts":[{"scheme":"exact","network":"eip155:84532","amount":"10000","asset":"0x036CbD53842c5426634e7929541eC2318f3dCF7e","payTo":"0x0000000000000000000000000000000000000001","maxTimeoutSeconds":300,"extra":{"name":"USDC","version":"2"}}]}
  > Shell cwd was  … [105 more chars]

## assistant
Fully verified: `$0.01` → `10000` units of the correct Base Sepolia USDC. Writing the answer.

## assistant
- **Bash** `cat > answer.md <<'MDEOF'
# Paid API for AI agents: x402 on Base

The standard answer today is **x402** — an open protocol that revives HTTP `402 Payment Required`.
Your server answers unpaid requests … [6507 more chars]`

  > written: 153 lines

## assistant
I asserted three packages at the end without checking them. Verifying now.

## assistant
- **Bash** `cd /tmp && for p in "@x402/next" "@x402/hono" "@x402/axios"; do printf "%-14s " "$p"; npm view "$p" version 2>&1|head -1; done`

  > @x402/next     2.26.0
  > @x402/hono     2.26.0
  > @x402/axios    2.26.0
  > Shell cwd was reset to /home/damu/.cache/ethskills-evals/2026-09-20T140110Z-claude-with-skill-2f0adb01-3/tools-quiz-001

## assistant
All three resolve at 2.26.0. Written to `answer.md`.

## The answer

**x402** — the HTTP `402 Payment Required` protocol. Your server 402s an unpaid request with its terms; the agent signs an EIP-3009/Permit2 USDC authorization, retries with an `X-PAYMENT` header, and a *facilitator* settles on-chain. The agent needs **no gas** (the facilitator submits settlement), which is what makes cent-sized calls viable.

```bash
# Server                                    # Agent client
npm i express @x402/express @x402/core \    npm i @x402/fetch @x402/core \
      @x402/evm @coinbase/x402                    @x402/evm viem
```

Client side is a drop-in `fetch` — `wrapFetchWithPayment(fetch, client)` — so your call sites don't change. Server side is one `paymentMiddleware` with `price: "$0.01"`; no token math.

## What verification changed

I checked everything against npm and a compiler rather than trusting the guidance I started from, and several things it suggested were wrong:

- **`x402Fetch()` and `createWallet()` don't exist.** The real exports are `wrapFetchWithPayment` and `toClientEvmSigner`.
- **Two generations on npm.** Unscoped `x402-fetch`/`x402-express` are v1.x, last published April. Scoped `@x402/*` are 2.26.0, published 5 days ago. Not compatible — the wire protocol differs (`x402Version: 2`).
- **`ExactEvmScheme` exists twice** with different constructors. Bare `@x402/evm` re-exports the *client* one, so using it server-side fails to typecheck. Both sides need explicit subpaths.
- **viem 2.56's `readContract` doesn't structurally match** the signer interface; passing `publicClient` whole fails `tsc`.

Both files typecheck clean, and I ran the server: against the keyless testnet facilitator it returns a real 402, with `$0.01` correctly converted to `amount: "10000"` against the genuine Base Sepolia USDC contract.

## Two things that will bite you

1. **The Coinbase facilitator needs CDP credentials** — Base mainnet returned `401 Unauthorized`. Develop against `https://x402.org/facilitator` on Base Sepolia (no key) first.
2. **Don't set `syncFacilitatorOnStart` to `false`.** I tried it; every request failed with a **500**, not a 402. Startup is async, so the first request after boot can race it.

One detail worth flagging since it's easy to lose an hour on: in v2 the payment requirements arrive in a base64 **`payment-required` response header**, not the body — the body is `{}`.

## run stats
- turns: 34
- duration: 223s
- cost: $1.2204149999999998
- tokens in/out: 1047343/14038
- of which cache write/read: 36369/1010910
