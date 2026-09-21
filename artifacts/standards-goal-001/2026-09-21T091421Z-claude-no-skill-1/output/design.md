# forecast.example.com — design

Sells weather forecasts to agents. $0.35 per call, paid in USDC on Base. No accounts, keys or humans.

Three open standards cover it:

| Need | Standard | Where it lives |
|---|---|---|
| Pay per call, no account | **x402** (HTTP 402 + signed payment header) | our HTTP server |
| Payer has no ETH | **EIP-3009** `transferWithAuthorization` on USDC | USDC contract on Base; we pay the gas |
| Discovery + identity | **ERC-8004** Identity Registry | Base, contract we don't own |
| Ratings | **ERC-8004** Reputation Registry | Base, contract we don't own |

## 1. Flow

```
Client agent                         forecast.example.com                Base
────────────                         ────────────────────                ────
1. Find us: read ERC-8004 IdentityRegistry (Registered events / indexers)
   → agentId → agentURI → GET /.well-known/agent-registration.json
2. Check trust: domain in the file points back to agentId (two-way link);
   ReputationRegistry.getSummary / readAllFeedback for agentId,
   counting only raters that actually paid us (USDC Transfer → payTo)
3. GET /forecast?lat&lon&days ───────▶ 400 if params bad (not charged)
                              ◀─────── 402 + PAYMENT-REQUIRED
                                       {scheme:exact, network:eip155:8453,
                                        asset:USDC, amount:350000, payTo}
4. Sign EIP-712 TransferWithAuthorization offchain (no gas, no ETH)
5. GET /forecast + PAYMENT-SIGNATURE ─▶ verify: sig, payTo, amount, time window,
                                        nonce unused, balance
                                        fetch forecast upstream (502 → not charged)
                                        settle: transferWithAuthorization ──▶ USDC moves
                                                                               payer→payTo
                              ◀─────── 200 forecast + PAYMENT-RESPONSE {tx}
                                        + feedback hints (agentId, registry, tx)
6. Rate: ReputationRegistry.giveFeedback(agentId, value, …) ─────────────────▶ stored onchain
   gas paid in USDC via ERC-4337 paymaster (see §4)
```

Order in step 5 matters: **do the work, then charge, then reply.** If the upstream fails, we never submit the authorization; it expires and the payer loses nothing. If settlement fails, the payer gets a 402, not data.

## 2. Payment (x402 + EIP-3009)

- 402 response: x402 v2 shape, sent both as base64 `PAYMENT-REQUIRED` header and as JSON body. Contains `accepts[0]`:
  `scheme: "exact"`, `network: "eip155:8453"`, `asset: USDC`, `amount: "350000"` (6 decimals), `payTo`, `maxTimeoutSeconds: 120`, `extra: {name:"USD Coin", version:"2"}` (USDC EIP-712 domain).
- Client retries with `PAYMENT-SIGNATURE` (v2) or `X-PAYMENT` (v1): base64 JSON, `payload = {signature, authorization:{from,to,value,validAfter,validBefore,nonce}}`.
- Server checks: `to == payTo`, `value == 350000`, valid time window (and not longer than ~3 min), signature via `verifyTypedData` (EOA, ERC-1271 and ERC-6492 smart wallets), `authorizationState(from,nonce) == false`, `balanceOf(from) >= value`.
- **Settlement is self-hosted**: our settler key calls `USDC.transferWithAuthorization` directly (65-byte sig → `v,r,s` version; longer sig → `bytes` version for smart wallets). We pay ~1 cent of ETH gas per call; payer pays nothing but the $0.35.
- Replay protection: USDC itself marks each nonce used onchain; an in-memory set blocks two concurrent requests with the same nonce.
- No balances held by us: every call is one separate onchain transfer. Nothing to refund, no prepaid credit.

Why no third-party facilitator: it would add a trust + uptime dependency (and usually its own API key). Swapping in one (e.g. Coinbase CDP facilitator `/verify` + `/settle`) is a small change in `verifyPayment`/`settle` if we don't want to run a hot key.

## 3. Discovery and identity (ERC-8004)

We register as an agent in the **ERC-8004 Identity Registry on Base**. It's an ERC-721: our `agentId` is an NFT whose `agentURI` points to our registration file. Anyone can list all agents from `Registered` events or any third-party indexer — no catalog of ours is involved.

Trust signals a new client can check with no human:
1. **Domain ↔ agentId, two-way.** Onchain `agentURI` → `https://forecast.example.com/.well-known/agent-registration.json`, and that file's `registrations` names the same `agentId` + registry. Someone else can't claim our domain, and we can't fake another's.
2. **Payment address bound to identity.** `agentWallet` metadata on the agentId equals the `payTo` in our 402. `setAgentWallet` requires a signature from that wallet, so it proves we control it. A client should refuse to pay if `payTo != agentWallet`.
3. **Reputation** (§4), filtered to raters who really paid.
4. **History**: USDC transfers into `payTo` are public — volume and age of the service are visible.

Machine-readable description: registration file (`description`, `services`, `x402Support: true`), `/openapi.json` (params, responses, `x-payment`), and the 402 itself (price, asset, network, plus a `trust` block pointing to registries and agentId).

## 4. Ratings (ERC-8004 Reputation Registry)

After a paid call the 200 response includes a `feedback` block: `agentId`, registry addresses, endpoint, suggested tags (`tag1:"starred"`, `tag2:"forecast"`), and `proofOfPayment {fromAddress, toAddress, chainId, txHash}`.

Client calls `ReputationRegistry.giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)` — e.g. `value=87, decimals=0` on a 0–100 scale. `feedbackURI`/hash are optional (a JSON file on IPFS with `proofOfPayment`); client can `revokeFeedback`; we can `appendResponse` but **cannot edit or delete** a rating.

Anti-Sybil (fake ratings): the rater's onchain address is `msg.sender`. Readers call `getClients(agentId)`, keep only addresses that sent USDC to `payTo` (the rater should rate from the same address that paid), then `getSummary(agentId, thoseClients, "starred", "")`. Fake raters then have to pay $0.35 each, which is what honest raters paid anyway.

**Rating without ETH.** `giveFeedback` is an onchain tx, so it needs gas. Options for a USDC-only agent, none involving us:
- **EIP-7702 + ERC-4337 + USDC paymaster (recommended).** The agent's EOA delegates to a smart-account implementation, sends a UserOperation through a public bundler, and a paymaster that takes USDC for gas (e.g. **Circle Paymaster** on Base) pays the ETH. Same address that paid → rating counts under the filter above.
- A smart-account wallet from the start (also pays us via ERC-1271 signatures, supported by USDC v2.2 and by `server.ts`).
- We could sponsor gas for `giveFeedback` on our own agentId, but we'd be able to drop bad ratings, so it's at best a convenience, not the guarantee.

## 5. Dependencies

### Onchain (Base mainnet, chainId 8453)
| What | Address | Used for |
|---|---|---|
| USDC (FiatToken v2.2) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | payment asset; EIP-3009; nonce tracking |
| ERC-8004 IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`* | agentId, agentURI, agentWallet |
| ERC-8004 ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`* | ratings |
| ERC-4337 EntryPoint + a USDC paymaster (e.g. Circle Paymaster) + a public bundler | per their docs | client-side only: rating without ETH |
| Base itself (sequencer, finality) | — | all of the above |

\* The official ERC-8004 deployment addresses on Base; check against the `erc-8004-contracts` repo before registering. Both are env-configurable in `server.ts`.

### Offchain
| What | Why | If it fails |
|---|---|---|
| DNS + TLS for `forecast.example.com` | agentURI, domain proof, API | service unreachable / unverifiable |
| Base JSON-RPC (`BASE_RPC_URL`; use a paid provider + fallback in prod) | verify, simulate, settle | returns 402 `settlement_failed`; no charge |
| Weather source: Open-Meteo (`api.open-meteo.com`; commercial use needs their paid plan → `WEATHER_API` = customer endpoint) | the product | 502, no charge |
| Hosting for Node server (`viem`, Node ≥ 20) | runtime | — |
| Optional: IPFS pinning for an immutable copy of the registration file | tamper-evident agentURI | fall back to HTTPS URI |

### Keys we hold
| Key | Holds | Hot? |
|---|---|---|
| **Owner** of the agentId NFT | nothing; controls agentURI / agentWallet | cold (hardware wallet) |
| **payTo** (= `agentWallet`) | revenue in USDC | cold or multisig; never on server |
| **Settler** (`SETTLER_PRIVATE_KEY`) | small ETH float on Base for gas | hot; can only submit already-signed transfers, can't redirect funds (the payer signed `to = payTo`) |

Owner and payTo must differ from any address used to rate us — ERC-8004 rejects self-feedback from owner/operators anyway.

## 6. What to publish and register (one time, before launch)

1. **Deploy** `server.ts` at `https://forecast.example.com` with `PAY_TO`, `SETTLER_PRIVATE_KEY`, `BASE_RPC_URL`. Fund settler with ~0.01 ETH on Base.
2. **Register onchain**: from owner key, `IdentityRegistry.register("https://forecast.example.com/.well-known/agent-registration.json")` → emits `Registered(agentId, …)`.
3. **Bind payment address**: `setAgentWallet(agentId, PAY_TO, deadline, signatureFromPayTo)`.
4. **Close the loop**: set `AGENT_ID=<agentId>` and redeploy, so the registration file lists `{agentId, agentRegistry: "eip155:8453:0x8004A169…"}`.
5. **Verify** as a stranger would: read `tokenURI(agentId)`, fetch it, check `registrations` matches, check `getAgentWallet`/metadata == `payTo` in the 402.
6. Optional, not required: pin the file on IPFS and switch `agentURI` to `ipfs://…` (`setAgentURI`); list in third-party x402 / ERC-8004 indexers for reach.

Published by the server:
| Path | Content |
|---|---|
| `/.well-known/agent-registration.json` | ERC-8004 registration file (domain proof) |
| `/openapi.json` | API schema + `x-payment` pricing |
| `/` | registration file + price + trust pointers |
| `/forecast` | paid endpoint (400 / 402 / 200 / 502) |
| `/health` | liveness |

## 7. Limits / known risks

- **Fair exchange isn't perfect.** We settle before replying; if the connection drops after settlement, the client paid and got nothing. The tx hash is in logs; the client's only recourse is a negative rating with `proofOfPayment`. Acceptable at $0.35.
- **Settle latency** adds ~2–4 s (one Base block + receipt). Could answer after submit instead of after receipt, at the risk of a rare revert-after-delivery.
- In-memory nonce lock is per process; multiple instances rely on the onchain nonce check (a duplicate just reverts in simulation, so no double-charge).
- Reputation is only as good as the reader's filter; raw averages over all raters are gameable.
- Settler hot key compromise loses only its ETH float.
