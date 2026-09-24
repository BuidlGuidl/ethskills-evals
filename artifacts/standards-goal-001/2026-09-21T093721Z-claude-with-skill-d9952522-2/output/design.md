# forecast.example.com — design

Sells weather forecasts to autonomous agents. $0.35 per call, USDC on Base. No accounts, no keys, no human in the loop.

Uses deployed standards; nothing custom where one exists:

| Need | Standard | Role |
| --- | --- | --- |
| Discovery + identity, no catalog we run | **ERC-8004** Identity Registry | onchain ERC-721 entry pointing to our registration file |
| Trust signal from other callers | **ERC-8004** Reputation Registry | callers post ratings onchain; we can't rate ourselves |
| Per-call billing, no accounts | **x402** v2 | HTTP 402 → signed payment → 200 |
| Caller has USDC, no ETH | **EIP-3009** `transferWithAuthorization` | caller signs offchain, facilitator submits and pays gas |
| Caller rates without ETH (optional, client side) | **EIP-7702** | caller's own EOA gets smart-account code, gas paid in USDC by a paymaster |

## 1. End-to-end flow

```
Client agent                   Base (chain 8453)                 forecast.example.com        Facilitator (CDP)
 │ 1 find agent ────────────► IdentityRegistry: tokenURI(agentId)
 │ 2 GET agentURI ───────────────────────────────────────────────► /.well-known/agent-registration.json
 │ 3 check trust ───────────► ReputationRegistry.getSummary(agentId, trustedClients, …)
 │ 4 GET /forecast?lat&lon ──────────────────────────────────────► 402 + PAYMENT-REQUIRED
 │ 5 sign EIP-3009 auth (offchain, no gas)
 │ 6 GET /forecast + PAYMENT-SIGNATURE ──────────────────────────► verify ─────────────────► /verify
 │                                                                  fetch forecast (upstream)
 │                                                                  settle ─────────────────► /settle
 │                              USDC.transferWithAuthorization ◄─────────────────────────────── (facilitator pays gas)
 │ 7 ◄──────────────────────────────────────── 200 + forecast + PAYMENT-RESPONSE(txHash) + feedback hints
 │ 8 giveFeedback(agentId, …) ► ReputationRegistry (from caller's own address)
```

### 1.1 Discovery (no catalog of ours)
- We register once in the ERC-8004 **IdentityRegistry on Base** (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`). That mints an ERC-721; its tokenId **is** our `agentId`. Full id: `agentRegistry = eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, plus `agentId`.
- Agents find us by reading the public registry directly (`Registered`/`Transfer` events, `tokenURI`) or through any third-party indexer/explorer for ERC-8004. None of these is ours; the registry is the source of truth and anyone can check it.
- `tokenURI` (the agentURI) → `https://forecast.example.com/.well-known/agent-registration.json`, which describes the service, the price model (`x402Support: true`), endpoints (`web`, `OpenAPI`) and points back to the onchain id in `registrations`.
- **Domain binding:** the agentURI is served from the **same domain** as the paid endpoint and at the `.well-known/agent-registration.json` path, with a `registrations` entry matching the onchain `agentRegistry` + `agentId`. That is the binding we rely on: a client arriving by URL fetches the well-known file and checks it against the chain; a client arriving from the chain follows the URI to the domain. A spoofed domain cannot make the chain point at it.
- Optional extra reach: CDP facilitator's x402 "Bazaar" discovery listing (a Coinbase-run index). Nice to have; not needed, since the chain is enough.

### 1.2 Trust decision (before paying)
Caller reads `ReputationRegistry.getSummary(agentId, clientAddresses, tag1, tag2)` on `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`, **filtered to raters it trusts** (e.g. addresses it knows, or raters whose feedback carries a real payment proof to our `payTo`). Unfiltered totals are Sybil bait; the design gives callers what they need to filter (see 1.5). Also cheap to check: registration file matches chain, `active: true`, price in the 402 matches what the file says.

### 1.3 Payment (x402 v2, exact scheme)
`PAYMENT-REQUIRED` (base64 JSON) advertises one option:

| field | value |
| --- | --- |
| scheme | `exact` |
| network | `eip155:8453` |
| asset | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (native USDC on Base; not USDbC, not mainnet USDC) |
| amount | `350000` ($0.35 × 10⁶, USDC has 6 decimals) |
| payTo | our receiving address (`PAY_TO`) |
| maxTimeoutSeconds | 60 |
| extra | `{ name: "USD Coin", version: "2" }` — USDC's EIP-712 domain, needed to sign |

Server order in `handleForecast` (`server.ts`):
1. Check params → `400` before any payment talk. Bad input is never charged.
2. No/invalid `PAYMENT-SIGNATURE` → `402`.
3. Payload's `accepted` must equal our requirements (scheme, network, asset, payTo, amount) — the client's copy is never trusted.
4. Facilitator `/verify` (signature, balance, window, nonce unused). No funds move.
5. Fetch forecast upstream. Failure → `502`, still not charged (authorization expires unused).
6. Facilitator `/settle` → onchain `transferWithAuthorization`. Only after success do we return `200` with `PAYMENT-RESPONSE` (tx hash).

Replay/double-spend: EIP-3009 nonces are single-use onchain; a second settle of the same authorization fails and we return `402`. No state kept by us → no DB.

### 1.4 No ETH needed to pay
USDC implements EIP-3009. Caller signs `transferWithAuthorization(from, to=payTo, value=350000, validAfter, validBefore, nonce)` offchain. The facilitator submits it and pays Base gas. Caller needs only USDC and a signing key. We hold no balances for anyone; each call is a direct transfer caller → `payTo`.

### 1.5 Rating
- 200 response body carries a `feedback` block: reputation registry, `agentRegistry`, `agentId`, endpoint, suggested tags, and `proofOfPayment {fromAddress, toAddress, chainId, txHash}`.
- Caller posts `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)` from **its own address** (e.g. `value=87, valueDecimals=0, tag1="forecast"`). `feedbackURI` can point to a JSON with the proofOfPayment so readers can confirm the rater actually paid us. The registry rejects feedback from our owner/operators, so we can't inflate our score.
- No server involvement required; nothing to approve on our side.
- **Gas for rating:** unlike payment, `giveFeedback` is a normal tx whose sender must be the caller. A caller with no ETH can use **EIP-7702**: delegate its existing EOA to a smart-account implementation and send the call via an ERC-4337 bundler with a USDC-accepting paymaster (e.g. Circle Paymaster on Base). The sender stays the caller's own address, so the rating is attributed correctly. We must **not** submit ratings on callers' behalf from our own relayer — they'd be attributed to us, not to them.

## 2. What to publish, where

| What | Where | Notes |
| --- | --- | --- |
| ERC-721 agent entry | Base IdentityRegistry `0x8004A169…a432` | `register(agentURI)`, one tx from our owner wallet |
| agentURI → registration file | `https://forecast.example.com/.well-known/agent-registration.json` | served by `server.ts`; also the domain binding |
| OpenAPI | `https://forecast.example.com/openapi.json` | machine-readable params, price, status codes |
| Price/terms | `PAYMENT-REQUIRED` header on `/forecast` | authoritative per request |
| Service index | `https://forecast.example.com/` | links to the above |
| Logo | `https://forecast.example.com/logo.png` | referenced as `image`; serve or remove |

## 3. Setup (one-time, by operator, before launch)

1. **Wallets on Base**
   - *Owner* EOA: owns the agent NFT. Needs a little ETH on Base once for `register`/`setAgentURI`. Keep it cold.
   - *PayTo* address: receives USDC. Can be different from the owner; no ETH needed.
2. **Register:** call `IdentityRegistry.register("https://forecast.example.com/.well-known/agent-registration.json")` on Base. Read the assigned tokenId from the `Registered`/`Transfer` event → that's `AGENT_ID`. (The URL is fixed in advance, so no chicken-and-egg; the file just has to be live before clients look.)
3. **Verify ABI first:** ERC-8004 is still a Draft EIP; registries are ERC-1967 proxies. Read the implementation and confirm `register`, `giveFeedback`, `getSummary` signatures before relying on them. If the implementation offers a verified payment-wallet field (e.g. `agentWallet` metadata), set it to `PAY_TO` so clients can check the 402's `payTo` onchain.
4. **Facilitator:** create CDP API key (`CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`). Server signs a short-lived JWT per `/verify`/`/settle` call.
5. **Deploy** `server.ts` behind TLS on `forecast.example.com` with env:
   `PAY_TO`, `AGENT_ID`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, optional `PORT`, `PUBLIC_URL`, `FACILITATOR_URL`.
6. **Smoke test** with a real x402 client (`@x402/fetch` + `@x402/evm`) on Base with a small USDC wallet and no ETH.

Rehearsal on Base Sepolia: network `eip155:84532`, testnet USDC, and the **testnet** ERC-8004 registries (`0x8004A818BFB912233c491871b3d84c89A494BD9e` / `0x8004B663056A597Dffe9eCcC1965A193B7388713`) — the mainnet addresses have no code there. `server.ts` hardcodes mainnet; change the constants for a rehearsal.

## 4. Dependencies

### Onchain (Base, chainId 8453)
| Dependency | Address | Why |
| --- | --- | --- |
| USDC (native, EIP-3009) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | payment asset; gasless transfer |
| ERC-8004 IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | discovery, agentId, agentURI |
| ERC-8004 ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | ratings, read before choosing |
| Base chain itself | — | liveness, finality of settlement |
| (client side, optional) EIP-7702 + 4337 paymaster | — | caller rates without ETH |

Not used: ERC-8004 Validation Registry (not in the deployed pair); ERC-2612 permit; any contract of ours. We deploy **no contracts**.

### Offchain
| Dependency | Why | Failure / fallback |
| --- | --- | --- |
| DNS + TLS for `forecast.example.com` | serves agentURI, endpoint, domain binding | loss of domain = loss of discovery path; mitigation: pin a copy of the registration file on IPFS and `setAgentURI` to it (then keep the `.well-known` file for binding) |
| x402 facilitator (Coinbase CDP, `https://api.cdp.coinbase.com/platform/v2/x402`) | verify + settle, pays gas | swap `FACILITATOR_URL` to another or self-hosted facilitator (then *we* need ETH on Base + an RPC) |
| CDP API key | auth to CDP facilitator | server-side only; callers never see keys |
| Weather source (Open-Meteo in code) | actual data | check its licence for commercial resale; swap to a licensed provider; failures return 502 uncharged |
| Base RPC | only for our one-time setup and client reads | any provider |
| `@coinbase/cdp-sdk` (`generateJwt`) | CDP JWT signing | only npm runtime dependency |

The x402 handler is hand-written (~60 lines) against the v2 wire types rather than `@x402/express`: fewer moving parts and it pins the exact behaviour (validate → verify → work → settle → respond).

## 5. Constraint check

| Constraint | Met by |
| --- | --- |
| Discover + judge trust with no human, no catalog of ours | ERC-8004 identity (public chain) + registration file + domain binding + ERC-8004 reputation |
| Per call; no accounts/keys/subs/invoices/prefund | x402 exact scheme, each call a direct USDC transfer; server is stateless |
| USDC, no ETH | EIP-3009 via facilitator |
| Rating others can act on before choosing | ERC-8004 `giveFeedback` / `getSummary`, with payment proof for filtering |
| No human in the flow | all steps machine-readable and signed by agents; human only at one-time operator setup |

## 6. Risks
- ERC-8004 is a Draft EIP on live contracts — fields may shift; recheck the ABI on upgrades.
- Reputation is Sybil-able if readers don't filter; we can only make filtering possible (payment proofs), not enforce it.
- Facilitator is a soft central point for settlement; replaceable, but an outage means 402s until switched.
- `server.ts` does upstream fetch before settle: a caller can make us do work then let the authorization expire only if settle fails — costs us one upstream call, never a free forecast.
