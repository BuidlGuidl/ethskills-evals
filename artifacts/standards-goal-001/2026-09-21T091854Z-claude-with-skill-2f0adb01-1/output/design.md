# forecast.example.com — design

Sells weather forecasts to autonomous agents: **$0.35 per call, USDC on Base (chain 8453)**.

Stack of open standards, no component we operate acts as a gatekeeper:

| Need | Mechanism |
|---|---|
| Discovery without our own catalog | **ERC-8004 IdentityRegistry** on Base (public onchain registry) + `/.well-known/agent-registration.json` |
| Trust decision before first call | ERC-8004 identity ↔ domain binding, onchain `agentWallet` == x402 `payTo`, **ERC-8004 ReputationRegistry** summaries |
| Per-call billing, no accounts/keys | **x402 v2**, `exact` scheme, HTTP 402 |
| Caller has USDC but no ETH | **EIP-3009** `transferWithAuthorization`: caller only signs; *we* submit the tx and pay gas |
| Rating others can act on | ERC-8004 `giveFeedback` from the payer address; gas paid in USDC via **EIP-7702 + ERC-4337 USDC paymaster** |
| No human anywhere | every step is HTTP or a contract call |

## 1. End-to-end flow (client's view)

```
DISCOVER  scan IdentityRegistry `Registered` events on Base (any RPC, or any third-party indexer)
          → tokenURI(agentId) → registration JSON → description/services say "weather forecast, x402"
VERIFY    GET https://forecast.example.com/.well-known/agent-registration.json
          → its `registrations` contains the same (agentRegistry, agentId)  ⇒ domain and identity bound both ways
TRUST     ReputationRegistry.getSummary(agentId, <clients I trust>, "quality", "forecast")
          (clients to trust = addresses that provably paid our agentWallet, see §5)
CALL      GET /forecast?lat=..&lon=..&days=..  → 402 + PAYMENT-REQUIRED (base64 JSON)
          check accepts[0].payTo == IdentityRegistry.getAgentWallet(agentId), amount == 350000
PAY       sign EIP-712 TransferWithAuthorization (USDC domain "USD Coin"/"2") — off-chain, no gas
          retry with PAYMENT-SIGNATURE header
RECEIVE   200 + forecast JSON + PAYMENT-RESPONSE (settlement tx hash) + `rating` block
RATE      ReputationRegistry.giveFeedback(agentId, value, decimals, "quality", "forecast", endpoint, uri, hash)
          sent from the payer EOA, gas paid in USDC via paymaster
```

A client that already knows the URL (not the registry) gets there too: every 402/200/404 carries
`Link: </.well-known/agent-registration.json>; rel="describedby"` and the 402 body has
`extensions.erc8004 = {agentRegistry, agentId}`, which it then verifies onchain.

## 2. Server (server.ts)

Plain `node:http` + `viem`. No framework, no x402 SDK, no facilitator — settlement is ~30 lines and
self-settling removes a third-party dependency and trust hop.

Routes (all GET, CORS open):

| Route | Paid | Purpose |
|---|---|---|
| `/forecast?lat&lon&days` | $0.35 | the product |
| `/.well-known/agent-registration.json` | free | ERC-8004 registration file / domain verification |
| `/openapi.json` | free | machine-readable API description incl. `x-x402` requirements |
| `/health` | free | liveness |

`/forecast` pipeline, ordered so the caller is never charged for nothing:

1. **Validate params** → 400 *before* asking for money.
2. No `PAYMENT-SIGNATURE` → **402** with `PaymentRequired` (x402 v2) in header + body:
   `scheme=exact, network=eip155:8453, asset=USDC, amount=350000, payTo=agentWallet, maxTimeoutSeconds=120, extra={name:"USD Coin",version:"2"}`.
3. **Parse** (no RPC): v2 only, right scheme/network/asset, `to == payTo`, `value == 350000`,
   validity window sane (≥30 s left, ≤ ~3 min total).
4. **Verify onchain (reads)**: EIP-712 signature via `verifyTypedData` (EOA, ERC-1271, ERC-6492 smart
   wallets), `authorizationState(from, nonce) == false`, `balanceOf(from) ≥ value`.
5. **Fetch forecast upstream**. Fails → 502, *not charged* (authorization simply expires).
6. **Settle**: simulate, then `USDC.transferWithAuthorization(..., bytes signature)` from the settler key;
   wait 1 confirmation (~2 s on Base). Fails → 402.
7. **200** with forecast, `payment` {tx, payer}, `rating` hints; `PAYMENT-RESPONSE` header
   `{success, transaction, network, payer}`.

Replay/double-spend: USDC's per-authorizer nonce makes each authorization single-use onchain. Server
also keeps an in-flight set (concurrent duplicates → 409) and a 10-min cache of settled responses, so a
caller that lost the response can resend the same payment header and get the same body without paying twice.

Startup check: reads `ownerOf`, `tokenURI`, `getAgentWallet` for `AGENT_ID`; refuses to start if
the onchain agentWallet ≠ `PAY_TO` (a client would reject us anyway).

Config (env): `PAY_TO`, `SETTLER_PRIVATE_KEY`, `BASE_RPC_URL`, `AGENT_ID`, `PUBLIC_URL`, `PORT`,
`WEATHER_API_BASE`, `WEATHER_API_KEY`.

## 3. Keys and wallets (ours)

| Key | Holds | Used for | Exposure |
|---|---|---|---|
| **Owner** | the ERC-8004 NFT, a little ETH | `register`, `setAgentURI`, `setAgentWallet` | cold / hardware, never on server |
| **agentWallet = payTo** | revenue USDC | receiving only; signs once for `setAgentWallet` | cold, never on server |
| **Settler** | ETH only (gas) | submitting `transferWithAuthorization` | hot, on server; cannot move USDC — compromise loses only gas ETH |

Settler needs ETH on Base topped up (≈ $0.001–0.01 per settlement vs $0.35 revenue). Automatable: a
cron that swaps a slice of revenue USDC→ETH; alert when balance < N settlements.

## 4. What to publish / register, in order

1. **Deploy server** at `https://forecast.example.com` (TLS required; the domain *is* part of the trust chain).
2. **Register identity** on Base: `IdentityRegistry(0x8004A169FB4a3325136EB29fA0ceB6D2e539a432).register(agentURI)`
   from the owner key → returns `agentId` (ERC-721 tokenId). (`agentId` isn't known until this tx, so the
   first URI can be a placeholder.)
3. **Bind payout wallet**: `setAgentWallet(agentId, PAY_TO, deadline, sig)` — sig is EIP-712 from `PAY_TO`,
   proving we control it. Clients compare this to the 402 `payTo`.
4. **Publish registration file**: set `AGENT_ID`, run `npx tsx server.ts --print-registration`, pin
   the output to **IPFS** (≥2 independent pinning providers), then `setAgentURI(agentId, "ipfs://<CID>")`.
   Same JSON is served live at `/.well-known/agent-registration.json` (domain verification: its
   `registrations` lists `eip155:8453:0x8004A169…a432` + our agentId).
5. **Restart server with `AGENT_ID`** (startup check confirms steps 2–4 onchain).
6. Optional reach (not relied on): ENS name pointing at the agent, listing in third-party ERC-8004
   explorers/indexers, x402 "Bazaar" discovery. None are needed: the onchain registry is the catalog,
   and nobody — including us — controls it.

Things we deliberately **do not** publish: API keys, account signup, price sheets outside the 402
(the 402 response is the authoritative price).

## 5. Ratings others can act on

- Caller, after the call, sends `ReputationRegistry(0x8004BAa17C55a88189AE136b182e5fdA19dE9b63)
  .giveFeedback(agentId, value, decimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`.
  The 200 response hands it `agentId`, registry, endpoint and suggested tags (`quality`/`forecast`,
  `latency`/`forecast`). `feedbackURI` optional: an off-chain JSON can carry `proofOfPayment` = our
  settlement tx hash.
- We **cannot** write feedback about ourselves (the registry rejects the agent owner/operators), and
  we don't relay it — so we can't censor or forge it.
- **Sybil resistance for readers**: `getSummary` takes a list of client addresses. A reader should
  filter to addresses that actually paid us — i.e. `from` of USDC `Transfer`s to our agentWallet
  (or `AuthorizationUsed` events settled by us), which is public onchain data. Faking a rating then
  costs ≥ $0.35 + gas per fake address, and it's still the reader's policy, not ours. Readers can
  further weight by payer history elsewhere.

### Gas for the rating (caller has no ETH)

Paying uses no gas from the caller (EIP-3009). Rating is an onchain write, so it needs gas. Solution
with no ETH and no human:

- Caller's EOA uses **EIP-7702** to delegate to an ERC-4337-compatible smart-account implementation
  (keeps the same address — important, so the rater == the payer).
- UserOperation for `giveFeedback` goes to a **public bundler** with a **USDC paymaster** (e.g. Circle
  Paymaster, permissionless, pulls USDC via EIP-2612 permit to cover gas). Cost on Base: cents.
- Smart-account callers (ERC-1271) do the same natively; our settlement already accepts their signatures.

This is client-side tooling; the service doesn't depend on it, but ratings do. If the caller skips
rating, nothing breaks.

## 6. Dependency inventory

### Onchain (Base, chain 8453)

| Dependency | Address | Role | Risk if broken |
|---|---|---|---|
| USDC (Circle FiatTokenV2_2) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | payment asset, EIP-3009, ERC-1271 signatures | Circle can pause/blacklist; payments stop |
| ERC-8004 IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | discovery, owner, agentURI, agentWallet | no discovery for new clients |
| ERC-8004 ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | ratings | no ratings; service still sells |
| Base L2 itself (sequencer, L1 settlement) | — | everything onchain | sequencer outage ⇒ can't settle ⇒ return 402/503, never serve unpaid |
| EIP-7702 + ERC-4337 EntryPoint + USDC paymaster | client's choice | rating gas in USDC | rating only |

ETH is needed only by us (settler + owner txs).

### Offchain

| Dependency | Role | Mitigation |
|---|---|---|
| Base RPC (`BASE_RPC_URL`) | reads + tx submission | own node or ≥2 providers; client uses any RPC |
| Forecast upstream: Open-Meteo | data | commercial resale needs Open-Meteo commercial plan (`WEATHER_API_KEY`, `customer-api` host); upstream fail ⇒ 502 not charged. Could add a second source (e.g. NOAA NWS for US) |
| DNS + TLS for forecast.example.com | endpoint, domain half of trust binding | DNSSEC, CAA, HSTS; domain loss ⇒ registry still points to us, update `setAgentURI` |
| IPFS pinning | availability of agentURI JSON | ≥2 pinning services; content-addressed so tamper-evident |
| Specs clients must speak | x402 v2, EIP-712, EIP-3009, ERC-8004 | server speaks only x402 v2 (`PAYMENT-SIGNATURE`/`PAYMENT-REQUIRED`/`PAYMENT-RESPONSE`) |
| Hosting (process, clock) | server | clock matters for validBefore checks — NTP |

Not dependencies (by design): x402 facilitator, any catalog/marketplace, accounts DB, API-key service.

## 7. Known limits

- Settled-response cache is in-memory: if the server crashes between settlement and response, the
  caller paid without data. Fix for production: persist `(from, nonce) → response` before replying
  (Redis/SQLite) and share across instances; also share the in-flight lock.
- Settlement waits ~2 s for a Base confirmation per call; fine for this price point. Higher volume:
  pipeline submissions (viem nonce manager already serializes nonces) or batch.
- Only `exact` scheme, only USDC on Base. Adding chains = more `accepts` entries.
- Reputation is only as good as the reader's client-filter policy; we give data to filter on, not a score.
- ERC-8004 ABI details (e.g. `getAgentWallet`, `giveFeedback` params) follow the v1 spec as deployed
  Jan 2026 — re-check against the verified contracts before mainnet launch; paymaster/bundler
  addresses are client-side and should be taken from their providers' docs.
