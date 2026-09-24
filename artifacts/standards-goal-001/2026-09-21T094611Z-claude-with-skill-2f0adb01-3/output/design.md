# forecast.example.com — design

Sells weather forecasts to autonomous agents. $0.35 per call, USDC on Base.
Stack: **ERC-8004** (find it, trust it, rate it) + **x402 v2** (pay per HTTP call) + **EIP-3009** (USDC transfer without gas).

## 1. Flow (no human anywhere)

```
Client agent                         Base (onchain)                    forecast.example.com
------------                         --------------                    --------------------
1 DISCOVER  read Registered/URIUpdated events on IdentityRegistry
            (own RPC, or any third-party indexer) → tokenURI(agentId)
            → registration file (IPFS) → services[], x402Support
2 VERIFY    GET /.well-known/agent-registration.json ─────────────────────────────▶ same agentId + registry
            ownerOf(agentId), agentWallet metadata ◀──
3 TRUST     ReputationRegistry.getSummary(agentId, clients, "forecast", …)
            clients = addresses that paid our agentWallet (USDC Transfer logs)
4 CALL      GET /v1/forecast?lat&lon ─────────────────────────────────────────────▶ 402 + PAYMENT-REQUIRED
5 PAY       sign EIP-3009 TransferWithAuthorization (offchain, no gas)
            GET again + PAYMENT-SIGNATURE ─────────────────────────────────────────▶ facilitator /verify
                                                                                   upstream forecast
                                     transferWithAuthorization ◀── facilitator /settle (pays gas)
6 RECEIVE   200 + forecast + PAYMENT-RESPONSE (tx hash) ◀──────────────────────────
7 RATE      ReputationRegistry.giveFeedback(agentId, 0-100, …, feedbackURI w/ txHash)
            gas paid in USDC via paymaster (see §4)
```

## 2. How each constraint is met

| Constraint | Mechanism |
|---|---|
| Discovery without our catalog | Onchain ERC-8004 IdentityRegistry on Base. Anyone can scan its events from any RPC. Nothing we run is needed to *find* us; our domain only serves what the onchain record points to. |
| Judge trust with no human | Machine-readable checks: (a) domain ↔ agentId match via `/.well-known/agent-registration.json`, (b) 402 `payTo` == onchain `agentWallet`, (c) reputation from ReputationRegistry, filtered to clients that verifiably paid. |
| Per call, no accounts/keys/balances | x402 `exact` scheme: each request carries its own signed $0.35 authorization. Nothing stored per client. Server has no user table. |
| Caller has USDC, no ETH | Payment: EIP-3009 signature is offchain; facilitator submits the tx and pays gas. Rating: client pays gas in USDC via ERC-4337 paymaster (§4). |
| Rating other agents can act on | ERC-8004 `giveFeedback`, public onchain, readable by `getSummary`/`readAllFeedback`. Response includes a `feedback` hint + tx hash for proof of payment. |
| No human step | Every step is HTTP or a signed tx. Invalid/missing payment → machine-readable 402; bad params → 400 with JSON Schema, before any charge. |

## 3. Server (server.ts)

Node ≥22.6, zero npm deps (`npm start`). Endpoints:

| Route | Paid | Purpose |
|---|---|---|
| `GET /.well-known/agent-registration.json` | no | ERC-8004 registration file incl. `registrations[{agentId, agentRegistry}]` → domain proof |
| `GET /.well-known/agent-card.json` | no | A2A agent card: skill, input JSON Schema, x402 terms, ERC-8004 ids, feedback hint |
| `GET /v1/forecast?lat&lon&days` | $0.35 | forecast |
| `GET /health` | no | liveness |

Paid request order:
1. Validate params → 400 (never charge for unservable input).
2. No `PAYMENT-SIGNATURE` → 402, body + base64 `PAYMENT-REQUIRED` header: `{scheme:"exact", network:"eip155:8453", amount:"350000", asset:USDC, payTo, maxTimeoutSeconds:60, extra:{name:"USD Coin",version:"2"}}`.
3. Facilitator `/verify` with **our** requirements (client's copy ignored).
4. Fetch upstream forecast. Fails → 503, not settled, caller keeps money.
5. Facilitator `/settle`. Fails → 402. Only after success is data returned, so no free data and no double spend (EIP-3009 nonce is single-use onchain).
6. 200 + `PAYMENT-RESPONSE` (base64 settle result) + `receipt` + `feedback` hint.

Env: `PAY_TO`, `AGENT_ID`, `AGENT_OWNER`, `FACILITATOR_URL`, optional `FACILITATOR_AUTH`, `UPSTREAM_URL`, `UPSTREAM_API_KEY`, `PUBLIC_URL`, `PORT`.

Stateless → scale horizontally. Supports x402 v2 headers only (v1 `X-PAYMENT` clients not handled).

## 4. Rating without ETH

`giveFeedback` is a normal tx; `msg.sender` is the rater. A USDC-only client does it one of two ways, both independent of us:
- **EIP-7702 (preferred)**: client EOA delegates to an ERC-4337-compatible smart account impl, submits a UserOperation through a public bundler, gas paid in USDC by a USDC paymaster (e.g. Circle Paymaster on Base). Same address that paid is the address that rates → proof of payment links cleanly.
- **Native ERC-4337 smart account**: same, but the account address pays USDC too (USDC on Base accepts ERC-1271 signatures for EIP-3009 — verify for the facilitator in use).

Optional, ours: run a sponsoring paymaster that only covers `giveFeedback(ourAgentId, …)` from addresses that paid us. Rater still signs the content, so we can't alter it, but it's an extra cost/dependency; not required.

What makes a rating useful to others: `tag1="forecast"`, `tag2="quality"` (value 0–100, decimals 0), `endpoint=https://forecast.example.com/v1/forecast`, `feedbackURI` = JSON with `proofOfPayment {fromAddress, toAddress, chainId, txHash}`. Readers can check that tx on Base.

Anti-Sybil (reader side): `getSummary` takes a client-address list. Recommended: only addresses with a USDC transfer ≥0.35 to our `agentWallet`, further weighted by the rater's activity with *other* agents. Paying ourselves via sockpuppets costs only gas (money returns to us), so "paid" alone is not proof of honesty — say so in reputation logic, don't hide it.

## 5. What to publish, where, and register (one-time, by operator)

Order matters because agentId is only known after registering.

1. **Wallets.** `OWNER` (holds agent NFT, needs a little ETH on Base for setup txs) and `PAY_TO` (receives USDC; can be same or separate, ideally cold/multisig).
2. **Register** on Base: `IdentityRegistry(0x8004A169FB4a3325136EB29fA0ceB6D2e539a432).register(agentURI)` → `agentId` (ERC-721 tokenId). Initial URI can be a placeholder.
3. **Build registration file** (exact JSON served by server.ts) with `registrations:[{agentId, agentRegistry:"eip155:8453:0x8004A169…a432"}]`, `services`, `x402Support:true`, `active:true`, `supportedTrust:["reputation"]`.
4. **Publish it**: pin to IPFS (content-addressed, survives our domain going down; pin with ≥2 providers) → `setAgentURI(agentId, "ipfs://<cid>")`. Also served at `https://forecast.example.com/.well-known/agent-registration.json`.
5. **Bind payment wallet**: `setAgentWallet(agentId, PAY_TO, deadline, sig)` (sig from PAY_TO proves control). Clients compare with 402 `payTo`.
6. **Deploy server** with `AGENT_ID`, `PAY_TO`, `AGENT_OWNER`. Serve `/.well-known/agent-card.json`.
7. **DNS + TLS** for forecast.example.com (DNSSEC recommended; domain proof relies on HTTPS).
8. Optional extra discovery surfaces (not required, not ours): x402 Bazaar listing via the CDP facilitator, ENS name with text record pointing at agentId, third-party ERC-8004 explorers/subgraphs (they index automatically).

Any change to endpoints/price → new registration file → new CID → `setAgentURI`. Retiring: set `active:false`.

## 6. Dependencies

### Onchain (Base, chainId 8453)
| Item | Address / detail | Risk |
|---|---|---|
| USDC (native, Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, EIP-3009, EIP-712 domain `USD Coin`/`2` | Circle can pause/blacklist; upgradeable proxy |
| ERC-8004 IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | young standard (Jan 2026); check ABI of deployed version (`register` overloads, `setAgentWallet`) before scripting |
| ERC-8004 ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | open write → spam; readers must filter |
| ERC-8004 ValidationRegistry | not used | — |
| Base L2 itself | sequencer (Coinbase), Ethereum L1 for finality | sequencer downtime halts settlement → we return 402/5xx, no free data |
| EntryPoint + bundler + USDC paymaster | client-side, for rating only | not our dependency, but rating UX depends on them existing |

### Offchain
| Item | Why | Notes |
|---|---|---|
| x402 facilitator | `/verify` + `/settle`, pays settlement gas | Options: Coinbase CDP (needs our CDP key — server-side only, fine; short-lived JWT, so set via a small auth wrapper or proxy) or **self-hosted** x402 reference facilitator with an ETH-funded relayer wallet on Base (fewer third parties; recommended). Set `FACILITATOR_URL`. |
| Base RPC | facilitator + setup scripts | 2 providers for failover |
| Weather upstream | the actual data | Default Open-Meteo. Free tier is **non-commercial** → need their paid plan (`UPSTREAM_API_KEY`) or another provider. Our margin = $0.35 − upstream cost − facilitator cost. |
| IPFS pinning | registration file | ≥2 pinning services |
| DNS + TLS CA | domain proof, HTTPS | |
| Hosting | server.ts | stateless |
| Standards | x402 v2 spec, ERC-8004, EIP-3009, EIP-712, A2A 0.3.0 | headers `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE` |

## 7. Failure cases

| Case | Result |
|---|---|
| Bad params | 400 + schema, no charge |
| Bad/expired/short/underfunded signature | 402 with reason |
| Upstream down | 503 after verify, before settle → no charge |
| Settle fails (nonce used, balance drained in between, chain issue) | 402, no data |
| Replayed payload | settle fails (nonce used) → 402 |
| Facilitator down | 502, no charge |
| Crash after settle, before response | caller paid, got nothing. Rare; the tx hash is onchain, the caller can rate us down with proof. Acceptable vs. adding state. |

## Unresolved
- Facilitator: self-host (needs ETH ops) or CDP (needs auth wrapper)?
- Weather provider + commercial license.
- Run a feedback-sponsoring paymaster, or rely on clients' own USDC paymasters?
- Also support x402 v1 clients?
