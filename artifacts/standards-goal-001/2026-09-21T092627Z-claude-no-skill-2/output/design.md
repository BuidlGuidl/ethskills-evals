# forecast.example.com — design

Weather forecasts sold to autonomous agents. $0.35 per call, paid in USDC on Base.
No accounts, no API keys, no humans in the flow.

## 1. The choices, mapped to the requirements

| Requirement | How it's met |
|---|---|
| A new agent can find us and judge trust with no catalog we own | **ERC-8004 Identity Registry** on Base. It's a shared, permissionless onchain list that nobody here runs. We register there. Our registration file is served from our own domain, which proves we control both. Trust signals come from the **ERC-8004 Reputation Registry**. |
| Per-call billing, no accounts or keys or balances | **x402**. An unpaid request gets `HTTP 402` with the price. The client retries with a signed payment. Each payment covers one call. We hold nothing for the client between calls. |
| Caller has USDC but no ETH | **EIP-3009 `transferWithAuthorization`** on USDC. The caller only *signs* (no gas needed). We submit the tx and pay the gas. |
| Caller can leave a rating others can act on | **ERC-8004 Reputation Registry `giveFeedback`**. Each 200 response includes the tx hash as proof of payment, so the rating can be tied to a real paid call. The caller pays gas for it in USDC through an ERC-4337 paymaster (§5). |
| No human anywhere | Every step is HTTP + signatures + onchain reads/writes. Registration is a one-time step done by the operator before launch (§6). |

## 2. Call flow

```
Agent                                   forecast.example.com                 Base
  |  (discovery, §4)                                                           |
  |-- GET /forecast?lat&lon ------------------>|                               |
  |<- 402  PAYMENT-REQUIRED: {accepts:[exact, eip155:8453, USDC, 350000, payTo]}|
  |  sign EIP-712 TransferWithAuthorization (off-chain, no gas)                |
  |-- GET /forecast  PAYMENT-SIGNATURE: b64 --->|                               |
  |                                   check query, amount, payTo, time window  |
  |                                   check signature (EOA / 1271 / 6492) ---->|
  |                                   check nonce unused + balance ----------->|
  |                                   fetch forecast (Open-Meteo)              |
  |                                   simulate + send transferWithAuthorization>| (settler pays gas)
  |                                   wait for receipt <-----------------------|
  |<- 200 {forecast, payment:{tx}, rating:{agentId, proofOfPayment}}           |
  |       PAYMENT-RESPONSE: b64 {success, transaction, network, payer}         |
  |-- giveFeedback(agentId, score, tags, endpoint, feedbackURI, hash) ------->| (UserOp, gas paid in USDC)
```

Order is deliberate: **check → do the work → charge → reply**.
- A bad query returns 400 before any payment is looked at.
- If the upstream weather source is down, we return 503 and don't charge.
- The forecast is released only after the transfer is confirmed onchain. So the service can't be drained by unpaid calls.
- Replay protection: USDC stores each EIP-3009 nonce onchain. An in-memory set also stops the same authorization from being processed twice at once.

## 3. Onchain dependencies (all on Base mainnet, chainId 8453)

| What | Address | Used for |
|---|---|---|
| USDC (Circle FiatToken v2.2) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Payment asset. `transferWithAuthorization` (bytes-signature version, so smart wallets can sign too), `authorizationState`, `balanceOf`. EIP-712 domain `{name:"USD Coin", version:"2"}`. |
| ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` * | Our agent NFT (`agentId`). Its `agentURI` points to our registration file. Reserved `agentWallet` metadata = our `payTo`. |
| ERC-8004 Reputation Registry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` * | Clients' ratings. `giveFeedback`, `getSummary`, `readAllFeedback`. |
| ERC-4337 EntryPoint v0.7/v0.8 + a USDC paymaster (e.g. Circle Paymaster) | per their docs | Lets the caller pay gas in USDC when it posts a rating. The caller chooses this. We don't depend on it. |
| Base itself (L2 sequencer, finality through Ethereum L1) | — | Everything above. If the sequencer is down, calls fail with 402 and no charge. |

\* These are the ERC-8004 v1 addresses (the same on every chain). They are configurable
(`IDENTITY_REGISTRY`, `REPUTATION_REGISTRY`). **Check them against the ERC / reference repo
before launch.** Base Sepolia uses different addresses for testing.

**Wallets we control**
- `PAY_TO`: receives the USDC. Should be a cold wallet or a Safe, never a server key. It's also set as the ERC-8004 `agentWallet`, so clients can check the money goes to the registered agent.
- Settler hot key (`SETTLER_PRIVATE_KEY`): only sends settlement txs and holds a small amount of ETH for gas. It never holds USDC. `transferWithAuthorization` moves funds `from → PAY_TO` directly. If this key leaks, the attacker gets only its gas ETH.
- Agent owner key: owns the ERC-8004 identity NFT. Used only when registering or changing the registration. Keep it offline or in a Safe.

Gas cost: one `transferWithAuthorization` on Base costs well under $0.01. The $0.35 price covers it easily.
Watch the settler's ETH balance and top it up automatically (e.g. swap part of the USDC earnings).

## 4. Offchain dependencies

| What | Why | If it's down |
|---|---|---|
| DNS + TLS for `forecast.example.com` | Endpoint, and the domain half of identity verification | Service unreachable |
| Base JSON-RPC (`BASE_RPC_URL`) | Signature/balance checks, simulation, sending txs, receipts | 402s, nobody charged. Use a paid provider plus a fallback. |
| Open-Meteo API (`api.open-meteo.com`) | Weather data. No API key needed. **Commercial use needs their paid plan** (or swap in another source). | 503, nobody charged |
| Server host | Runs `server.ts` (Node 22, `viem`) | — |
| No x402 facilitator | We verify and settle ourselves with viem, so there's one less third party. Coinbase's CDP facilitator could be used instead (it needs a CDP key on *our* side only). | — |

The client needs nothing from us except HTTP. It needs a Base RPC to read the registries.

## 5. Discovery and trust (client's side, no human)

**Finding us** (any one of these is enough, and none of them is run by us):
1. Read the ERC-8004 Identity Registry on Base: `Registered` / `URIUpdated` events → `tokenURI(agentId)` → registration file. Filter by `x402Support`, service description, `services`. Any indexer or subgraph works, or the agent can scan the logs itself.
2. The agent already has the URL (link, another agent, search). It fetches `/.well-known/agent-registration.json` and gets back to the same onchain record.
3. Optional third-party lists (x402 Bazaar, 8004scan, etc.) pick us up from the 402's `extensions.bazaar` data and the registry. Nice to have, not required.

**Judging trust**, all checkable by machine:
1. **Domain ↔ chain link**: onchain `tokenURI(agentId)` points to `https://forecast.example.com/...`. And the file there lists the same `{agentRegistry, agentId}` in `registrations`. So whoever controls the domain controls the agent.
2. **Payment goes to the agent**: `payTo` in the 402 equals `getAgentWallet(agentId)` (the `agentWallet` value). Setting that value requires a signature from the wallet, so nobody else can claim it.
3. **Reputation**: `getSummary(agentId, clients, "forecast", "")` over clients the caller trusts, and `readAllFeedback` for the details. The caller can give more weight to ratings whose `feedbackURI` file has a `proofOfPayment` that matches a real USDC `Transfer` to our `agentWallet`. That makes fake ratings cost real money.
4. **Risk is small anyway**: the payment is exactly 350000 units to one address, valid for ≤ 2 min, and only settled after the forecast is ready. The worst case is losing $0.35.
5. Agent age and history: when the agentId was minted, and how many distinct payers have rated it.

## 6. What to publish and register (one-time, in this order)

1. **Deploy** `server.ts` behind TLS at `https://forecast.example.com`. Env: `PAY_TO`, `SETTLER_PRIVATE_KEY`, `BASE_RPC_URL`, `PUBLIC_URL`. Fund the settler with a little ETH on Base.
2. **Register the identity**: from the owner key, call `IdentityRegistry.register("https://forecast.example.com/.well-known/agent-registration.json")` → emits `Registered(agentId, …)`. This is the only onchain "registration". There is no fee beyond gas.
3. **Bind the payment wallet**: `setAgentWallet(agentId, PAY_TO, deadline, sig)`. `sig` is an EIP-712 signature by `PAY_TO` (or ERC-1271 if it's a Safe).
4. **Set `AGENT_ID`** in the server's env and restart. The registration file now lists `registrations: [{agentId, agentRegistry: "eip155:8453:0x8004A169…"}]`, which completes the domain ↔ chain link.
5. **Published endpoints** (all served by `server.ts`):
   - `/.well-known/agent-registration.json`: ERC-8004 registration file (the agentURI *and* the domain proof)
   - `/openapi.json`: machine-readable API, with the price attached to the operation (`x-x402`)
   - `/forecast`: the paid endpoint. Its 402 lists the price, the input/output schema, and a pointer to the ERC-8004 identity
   - `/`: short JSON index
6. Optional: pin the registration file on IPFS and use `ipfs://…` as the agentURI (it can't change, but every update needs a `setAgentURI` tx). Add an ENS name. Nothing else needs to be registered with anyone.

## 7. Rating flow (client, no ETH)

The 200 body has a `rating` block: `agentRegistry`, `agentId`, `reputationRegistry`, `endpoint`, suggested tags, and `proofOfPayment {fromAddress, toAddress, chainId, txHash}`.

The client:
1. Writes a feedback JSON file (ERC-8004 feedback format: `agentRegistry`, `agentId`, `clientAddress`, `value`, `tag1`, `proofOfPayment`, …). It hosts the file at IPFS or any URL and keeps its keccak256 hash.
2. Calls `ReputationRegistry.giveFeedback(agentId, value, valueDecimals, "forecast", "accuracy", endpoint, feedbackURI, feedbackHash)`.

**The gas problem**: this is a normal tx, and the caller has no ETH. The answer is an **ERC-4337 account with a USDC paymaster** (e.g. Circle Paymaster on Base). Gas gets paid in USDC. If the caller is an EOA, it first uses **EIP-7702** to give itself smart-account code. That way the *same address* that paid for the call is the `clientAddress` of the rating, so reviewers can match the two. We deliberately **don't** relay ratings for clients: the registry records `msg.sender` as the rater, so if we relayed, every rating would appear to come from us, and the registry blocks the agent's owner from rating itself anyway.

The feedback lives onchain. Anyone can read it with `getSummary`/`readAllFeedback` before picking us. We can publish a reply with `appendResponse` but can't delete anything.

## 8. Known limits and risks

- **ERC-8004 is new.** The field names in the registration file (`services` vs the older `endpoints`), the feedback-file fields, and the addresses have changed between drafts. Pin a version and check it before launch.
- **Old x402 clients.** The 402 follows x402 v2 (`PAYMENT-REQUIRED` header, CAIP-2 network). We also *accept* the v1 `X-PAYMENT` header and `network: "base"`, but a v1-only client may not read the v2 402.
- **Smart-wallet payers** work only if their signature passes USDC's ERC-1271 check. Counterfactual (ERC-6492) wallets pass our check, but USDC will reject the transfer until the wallet is deployed. In that case settlement fails and we return 402 without charging.
- **Waiting for the receipt adds ~2 s to each call.** Serving before the tx confirms would be faster but lets a client race a second use of the same USDC. Not worth it at $0.35.
- **No rate limiting yet.** Put a basic per-IP limit in front, because unpaid 402s and signature checks cost RPC calls.
- **Single process.** The `inFlight` set is per process. With multiple instances, the onchain nonce still stops double charges, but the loser burns gas on a reverted tx. Use a shared lock (Redis) at that point.
