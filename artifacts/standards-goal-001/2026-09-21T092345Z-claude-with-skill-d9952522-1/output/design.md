# forecast.example.com — design

Sells weather forecasts to autonomous agents at **$0.35/call**, paid in **USDC on Base**.
Built from existing, deployed standards; no custom billing, identity or reviews system.

| Need | Standard | Why not build it |
| --- | --- | --- |
| Discovery + identity, no catalog we run | **ERC-8004 IdentityRegistry** (Base) | Public onchain registry anyone can index; we don't own it |
| Trust signal other agents can act on | **ERC-8004 ReputationRegistry** (Base) | Client-attested, onchain; a reviews table on our server is worthless (we control it) |
| Per-call billing, no accounts/keys | **x402** v2 (HTTP 402) | Payment is carried in the HTTP request itself |
| Caller has USDC, no ETH | **EIP-3009** `transferWithAuthorization` (USDC implements it) | Caller signs offchain; facilitator submits + pays gas |
| Caller (no ETH) posts a rating tx | **EIP-7702** + USDC-paid gas (ERC-4337 paymaster) | Rating stays attributed to the paying address |

## 1. Flow (no human anywhere)

```
Client agent                   Base (chain)                     forecast.example.com        Facilitator
 │ 1. scan IdentityRegistry ───▶ Registered events / tokenURI
 │ 2. fetch agentURI (IPFS) → registration file → services, x402Support
 │ 3. fetch /.well-known/agent-registration.json ─────────────▶ (domain ⇄ agentId binding)
 │ 4. ReputationRegistry.getSummary(agentId, trustedClients) → decide
 │ 5. GET /forecast?lat&lon ───────────────────────────────────▶ 402 + PAYMENT-REQUIRED
 │ 6. sign EIP-3009 transferWithAuthorization (offchain, no gas)
 │ 7. GET /forecast + PAYMENT-SIGNATURE ───────────────────────▶ /verify ───────────────▶ ok
 │                                                             fetch forecast upstream
 │                                                             /settle ───────────────▶ submits tx, pays gas
 │                           USDC moves payer → PAY_TO ◀──────────────────────────────────┘
 │ ◀──────────── 200 + forecast + PAYMENT-RESPONSE (tx hash) + feedback{agentId, proofOfPayment}
 │ 8. ReputationRegistry.giveFeedback(...) via 7702 + USDC paymaster
```

### Discovery (steps 1–3)
- The service is ERC-721 token `agentId` in the ERC-8004 IdentityRegistry on Base,
  addressed as `eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` + `agentId`.
  Any agent/indexer finds it by reading `Registered` events / `tokenURI` — permissionless, not our catalog.
- `tokenURI` (agentURI) → `ipfs://<CID>` registration file: name, description, `services`
  (the `/forecast` endpoint + OpenAPI schema so the agent can call it without a human reading docs),
  `x402Support: true`, `active: true`, `registrations: [{agentId, agentRegistry}]`, `supportedTrust: ["reputation"]`.
- **Domain binding.** The agentURI lives on IPFS, not on forecast.example.com, so the endpoint domain
  must prove it belongs to this agent: server serves `https://forecast.example.com/.well-known/agent-registration.json`
  whose `registrations` entry matches the onchain `agentRegistry` + `agentId`. A client must check this
  before paying — otherwise anyone could register an agent pointing at our URL (or we at someone else's).

### Trust decision (step 4)
- `ReputationRegistry.getSummary(agentId, clientAddresses, tag1, tag2)` on Base.
- Clients should filter to raters they trust (own allowlist, or raters whose feedback carries a
  verifiable `proofOfPayment` — an onchain USDC transfer to our `PAY_TO`). Unfiltered totals are Sybil-able.
- Registry rejects feedback from the agent's owner/operators → we cannot rate ourselves.

### Payment (steps 5–7) — x402 v2, `exact` scheme
`PAYMENT-REQUIRED` (base64 JSON) advertises exactly one option:

```jsonc
{ "scheme": "exact", "network": "eip155:8453",
  "amount": "350000",                                   // $0.35, USDC has 6 decimals
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // native USDC on Base (not USDbC)
  "payTo": "<PAY_TO>", "maxTimeoutSeconds": 60,
  "extra": { "name": "USD Coin", "version": "2" } }     // EIP-712 domain for the signature
```

Server order, chosen so the caller never pays for nothing:
1. Validate params → `400` before any payment is requested.
2. `/verify` at facilitator, always against **our** requirements (not the client's echo).
3. Fetch forecast. Upstream failure → `502`, **no settle**, no charge (authorization just expires).
4. `/settle` → facilitator submits `transferWithAuthorization`, pays gas. Only then return data.
5. `200` + `PAYMENT-RESPONSE` (settlement tx hash).

Replay/double-spend: EIP-3009 nonces are single-use in the USDC contract; a reused
authorization fails at settle, and data is only returned after a successful settle.
We hold no balances, no accounts, no API keys for callers — each call is self-contained.

### Rating (step 8)
- Response body includes `feedback`: `agentRegistry`, `agentId`, `endpoint`, and `proofOfPayment`
  `{fromAddress, toAddress, chainId, txHash}`.
- Caller posts `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`
  to `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` on Base. Suggested: `value` 0–100, `valueDecimals=0`,
  `tag1="quality"`, `tag2="forecast"`; `feedbackURI` = IPFS JSON containing `proofOfPayment`, `feedbackHash` = its keccak256.
- **Gas problem:** `giveFeedback` is a real tx from the caller's address, and the caller has no ETH.
  EIP-3009 doesn't help here (it only moves USDC). Solution: the caller's existing EOA signs an
  **EIP-7702** authorization delegating to a smart-account implementation, then sends the call as an
  ERC-4337 UserOperation with a **USDC paymaster** (e.g. Circle Paymaster on Base) — gas paid in USDC,
  `msg.sender` to the registry is still the paying address, so the rating is linkable to the payment.
  - We deliberately do **not** make the caller depend on us sponsoring feedback gas: a sponsor can
    censor (drop bad ratings). Optional sponsorship by us would be fine as an extra, never the only path.

## 2. What we must register / publish (one-time, in order)

| # | Action | Where | Who pays |
| --- | --- | --- | --- |
| 1 | Create owner wallet (holds agent NFT) and `PAY_TO` address (receives USDC). Keep separate; `PAY_TO` needs no ETH. | Base | — |
| 2 | Fund owner wallet with a little ETH on Base | Base | us |
| 3 | `IdentityRegistry.register()` → read `agentId` from the `Registered` event / Transfer tokenId. **Registry assigns it; we don't pick it.** | Base `0x8004A169…a432` | owner (gas) |
| 4 | Build registration file with the real `agentId`, pin to IPFS (pin on ≥2 pinning services) | IPFS | us |
| 5 | `setAgentURI(agentId, "ipfs://<CID>")` (or pass the URI in step 3 if CID is known — it isn't, since the file contains `agentId`) | Base | owner (gas) |
| 6 | Deploy server with `AGENT_ID`, `AGENT_URI`, `PAY_TO`, facilitator config; serve `/.well-known/agent-registration.json` + `/openapi.json` over HTTPS | forecast.example.com | us |
| 7 | Verify end to end: resolve tokenURI → file → endpoint → well-known matches → paid call on Base with a test wallet holding only USDC | — | us ($0.35) |

Optional, not required for discovery: ENS name (add to `services`), listing in third-party
ERC-8004 explorers / x402 discovery indexes (they index the chain; not a catalog we operate).

Updates: change the file → re-pin → `setAgentURI`. To retire: set `active: false` and update.

## 3. Dependencies

### Onchain (all Base mainnet, chainId 8453)
| Dependency | Address | Role | Risk / note |
| --- | --- | --- | --- |
| ERC-8004 IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | agent NFT, agentURI | EIP still Draft; ERC-1967 proxy, upgradeable by its admin. Testnet uses a different address. |
| ERC-8004 ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | client ratings | Same as above. Validation Registry is **not** in the deployed pair — not used. |
| USDC (native, Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | payment asset, EIP-3009 | Circle can pause / blacklist addresses (incl. ours). |
| Base L2 | — | settlement | Sequencer liveness; reorg risk tiny, acceptable at $0.35. |
| EIP-7702 support on Base | — | caller rating gas path | Live since Pectra-equivalent upgrade on Base. |
| USDC paymaster + bundler (e.g. Circle Paymaster) | caller's choice | caller's feedback gas in USDC | Caller-side dependency; any compatible one works. |

### Offchain
| Dependency | Role | Risk / mitigation |
| --- | --- | --- |
| **x402 facilitator** (`FACILITATOR_URL`) | `/verify`, `/settle`, pays settle gas | Coinbase CDP facilitator supports Base mainnet but needs **our** CDP API key (`FACILITATOR_AUTH`; CDP uses short-lived JWTs — generate with `@coinbase/x402` or a sidecar). Alternative: self-host a facilitator (needs a Base RPC + ETH-funded relayer key). Callers are unaffected either way. If down → `503`, nothing charged. |
| Weather upstream (Open-Meteo commercial API, `WEATHER_URL` / `WEATHER_API_KEY`) | forecast data | Free tier is non-commercial → must use paid plan. Failure → `502`, no settle. |
| IPFS pinning | hosts agentURI file | Pin on multiple providers; content-addressed so tamper-evident. |
| DNS + TLS for forecast.example.com | endpoint + domain binding | Lose domain → binding breaks; clients should re-check well-known each time. |
| Hosting (Node ≥ 22.18) | runs `server.ts` | Stateless, scale horizontally. No DB needed. |
| Base RPC (client side) | clients read registries | Any public/own RPC. We need none at runtime. |

### Keys we hold
- **Owner key** — controls agent NFT / agentURI. Cold storage; only used for register/setAgentURI.
- **PAY_TO** — receive-only; no signing needed at runtime. Server holds **no private keys**.
- Facilitator + weather API credentials (server env).

## 4. Server (`server.ts`)

Zero dependencies (`node:http` + `fetch`), stateless. `node server.ts` (Node ≥ 22.18).

| Route | Paid | Purpose |
| --- | --- | --- |
| `GET /forecast?lat&lon[&days]` | yes, x402 | the product |
| `GET /.well-known/agent-registration.json` | no | ERC-8004 domain binding (full registration file) |
| `GET /openapi.json` | no | machine-readable API schema, linked from `services` |
| `GET /` | no | summary: price, agentId, links |

Env: `PAY_TO`, `AGENT_ID`, `AGENT_URI`, `FACILITATOR_URL`, `FACILITATOR_AUTH?`, `WEATHER_URL?`,
`WEATHER_API_KEY?`, `PUBLIC_ORIGIN?`, `PORT?`.

Implemented x402 by hand against facilitator `/verify` + `/settle` instead of `@x402/express`, to keep
the "verify → work → settle" order explicit (the SDK middleware may settle at a different point).
Switching to `@x402/core`/`@x402/evm`/`@x402/express` 2.x is straightforward if preferred.

## 5. Open questions
- Facilitator choice: CDP (needs our CDP key + JWT signing) vs self-hosted (needs ETH-funded relayer)?
- Should we optionally sponsor feedback gas ourselves, in addition to the paymaster path?
- ERC-8004 is Draft: re-check registry ABIs (`register`, `setAgentURI`, `giveFeedback`) onchain before launch.
