# forecast.example.com — design

Sells weather forecasts to agents, $0.35/call, USDC on Base. No accounts, no keys, no humans.

Built on deployed standards, nothing hand-rolled:

| Need | Standard |
| --- | --- |
| Discovery + identity, no catalog we run | **ERC-8004** IdentityRegistry (onchain ERC-721) |
| Trust / ratings other agents can act on | **ERC-8004** ReputationRegistry (client-attested) |
| Per-call billing, no accounts/keys | **x402** v2 (`exact` scheme) over HTTP 402 |
| Caller has USDC, no ETH | **EIP-3009** `transferWithAuthorization` on USDC; facilitator pays gas |
| Caller has no ETH but must post a rating tx | **EIP-7702** on caller's existing EOA + paymaster (caller-side, see §5) |

## 1. Architecture

```
 client agent                         Base (8453)                         forecast.example.com
 ────────────                         ───────────                         ────────────────────
 1 discover ──► IdentityRegistry (Registered events / tokenURI)
            ──► agentURI (ipfs://…) registration file
            ──► GET /.well-known/agent-registration.json  ────────────────► server.ts (domain binding)
 2 trust    ──► ReputationRegistry.getSummary(agentId, trustedClients, …)
 3 GET /forecast?lat&lon ──────────────────────────────────────────────────► 402 + PAYMENT-REQUIRED
 4 sign EIP-3009 transferWithAuthorization (offchain, no gas)
 5 GET /forecast + PAYMENT-SIGNATURE ──────────────────────────────────────► server.ts
                                                  facilitator /verify ◄──── (no funds move)
                                                  upstream weather   ◄──── fetch forecast
                                     USDC.transferWithAuthorization ◄──── facilitator /settle (pays gas)
   ◄──────────────────────────────────── 200 + forecast + PAYMENT-RESPONSE (tx hash) + feedback hints
 6 rate     ──► ReputationRegistry.giveFeedback(...)  (7702 + paymaster, gas paid in USDC or sponsored)
```

Server is stateless: no DB, no user table, no balances. Only state is onchain.

## 2. Payment flow (x402 v2) — `server.ts`

- `GET /forecast?lat=&lon=&days=` — input validated **before** 402, so bad requests are never charged.
- No `PAYMENT-SIGNATURE` → `402`, body + `PAYMENT-REQUIRED` header (base64 JSON):
  `scheme: exact`, `network: eip155:8453`, `asset: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (native USDC on Base),
  `amount: "350000"` (6 decimals → $0.35), `payTo: PAY_TO`, `extra: {name: "USD Coin", version: "2"}` (USDC EIP-712 domain).
- With payment: local sanity check (network/asset/payTo/amount) → facilitator `/verify` → fetch forecast →
  facilitator `/settle` → `200` with `PAYMENT-RESPONSE` (settle result incl. tx hash).
- Order matters: settle only after the forecast is in hand. Upstream failure → 502, auth never submitted, caller not charged.
  Unused auth expires at `validBefore`.
- Replay: EIP-3009 nonce is consumed onchain on settle; second settle of same payload fails → no second forecast.
- Why caller needs no ETH: it only signs an EIP-712 message. Facilitator submits `transferWithAuthorization` and pays Base gas.

## 3. Discovery — no catalog we own

Source of truth is the ERC-8004 IdentityRegistry on Base, a public contract nobody here operates.
Any agent (or any third-party indexer/subgraph/explorer it prefers) finds us by reading `Registered` events
and `tokenURI(agentId)`. The x402 Bazaar (facilitator discovery list) is an optional extra channel, not relied on.

A client can then check, fully mechanically:
1. `tokenURI(agentId)` → registration file lists `https://forecast.example.com/` and `x402Support: true`.
2. `https://forecast.example.com/.well-known/agent-registration.json` has `registrations[]` with the same
   `agentRegistry` + `agentId` → domain is controlled by the agent owner.
3. The 402's `payTo` equals the agent's onchain `agentWallet` → money goes to the registered agent, not a MITM.
4. `getSummary` from clients it trusts (§5) → worth paying?

## 4. What to publish and where

| Artifact | Where | Notes |
| --- | --- | --- |
| Registration file (agentURI) | IPFS, pinned (≥2 pinning providers), `ipfs://<cid>` | `type: …eip-8004#registration-v1`, name, description, image, `services` (web, OpenAPI), `x402Support: true`, `active: true`, `registrations: [{agentId, agentRegistry: "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"}]`, `supportedTrust: ["reputation"]` |
| Domain binding | `https://forecast.example.com/.well-known/agent-registration.json` (served by `server.ts`) | Required because agentURI is on IPFS, not on this domain. This is what we rely on for endpoint-domain proof. |
| API description | `https://forecast.example.com/openapi.json` | Lets agents build the call without reading prose. |
| Price/terms | the `402` response itself | Self-describing; nothing else needed to pay. |
| TLS cert + DNS | `forecast.example.com` | Domain binding is only as strong as DNS/TLS. |
| Image | `https://forecast.example.com/logo.png` (or IPFS) | Referenced by registration file. |

## 5. Registration (one-time, before the service can be found)

Done by the operator wallet (`OWNER`, holds a little ETH on Base; this is our cost, not the caller's):

1. `IdentityRegistry.register()` on Base `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` → read the minted **tokenId = agentId**
   from the event. Never pick our own ID.
2. Build registration file with that `agentId`, pin to IPFS → `ipfs://<cid>`.
3. `setAgentURI(agentId, "ipfs://<cid>")`.
4. Set `agentWallet` = `PAY_TO` (EIP-712 signature from `PAY_TO` proving control) so callers can match the 402 `payTo`.
5. Deploy `server.ts` with `AGENT_ID`, `PAY_TO`, `AGENT_URI`; confirm `/.well-known/agent-registration.json` matches onchain.
6. Get facilitator credentials (CDP API key for the Coinbase mainnet facilitator) — server-side only.

Keep `OWNER` separate from `PAY_TO` and cold; it controls the identity and URI.
Also note: the registry rejects feedback from owner/operators, so we cannot rate ourselves.

## 6. Ratings

After a paid call, the `200` body includes a `feedback` block: reputation registry, `agentRegistry`, `agentId`,
endpoint, suggested tags, and `proofOfPayment {fromAddress, toAddress, chainId, txHash}`.

Caller posts:
```
ReputationRegistry(0x8004BAa17C55a88189AE136b182e5fdA19dE9b63).giveFeedback(
  agentId, value, valueDecimals, tag1="forecast", tag2="quality",
  endpoint="https://forecast.example.com/forecast", feedbackURI, feedbackHash)
```
- Values are fixed point: 87/100 → `value=87, valueDecimals=0`.
- `feedbackURI` (IPFS JSON, hash in `feedbackHash`) carries `proofOfPayment` → readers can verify on Base that the
  rater actually paid us 350000 USDC in that tx. Paid-for ratings are expensive to Sybil.
- **Gas for the rating tx:** `giveFeedback` is a real tx with `msg.sender` = rater, so it needs gas, and the rater has no ETH.
  The rater upgrades its **existing** EOA with **EIP-7702** (same address, so ratings stay tied to the address that paid)
  and uses a paymaster that takes gas in USDC (e.g. Circle Paymaster on Base) or a sponsoring paymaster.
  A fresh ERC-4337 account is wrong here — new address, loses the link to the payment.
  Optional: we could sponsor rating gas; sponsorship doesn't let us write or edit the content (caller signs it).
- How others act on it: `getSummary(agentId, clientAddresses, "forecast", "")` filtered to clients they trust
  (e.g. addresses with matching `proofOfPayment`, or their own peer set). Unfiltered totals are Sybil bait.

## 7. Dependencies

**Onchain (Base, chainId 8453)**
- USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` — EIP-3009 `transferWithAuthorization`, EIP-712 domain `USD Coin` / `2`.
  (Not mainnet USDC `0xA0b8…eB48`, not bridged USDbC `0xd9aA…b6CA`.)
- ERC-8004 IdentityRegistry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (ERC-1967 proxy).
- ERC-8004 ReputationRegistry `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` (ERC-1967 proxy).
- Base itself (sequencer liveness, EIP-7702 support — Base has Pectra-equivalent upgrade).
- Caller side: 7702 delegate implementation + paymaster for the rating tx.
- Not used: ERC-8004 Validation Registry (not in the deployed pair).

**Offchain**
- x402 facilitator (`/verify`, `/settle`): Coinbase CDP by default, configurable via `FACILITATOR_URL`. Pays settle gas.
  Swap-out: self-host a facilitator (then we need a Base RPC + an ETH-funded relayer key — still our cost, not caller's).
- Weather upstream: Open-Meteo (free, no key), `UPSTREAM_URL`.
- IPFS pinning for agentURI and (caller-side) feedback files.
- DNS + TLS for `forecast.example.com`.
- Base RPC / indexer — used by clients for discovery and reputation reads; server needs none.
- Runtime: Node ≥ 22.18 (runs `.ts` directly), zero npm deps.

## 8. Risks / caveats

- ERC-8004 EIP is still **Draft**; contracts live but signatures (`setAgentURI`, `agentWallet` setter, `giveFeedback`)
  must be checked against the deployed implementation (read ERC-1967 slot) before registering.
- Facilitator is a liveness dependency; outage → 502, nobody is charged. Mitigate with a second facilitator / self-hosted one.
- Verify-then-settle window: payer can drain balance between verify and settle → settle fails → no forecast returned (we only lose an upstream call).
- CDP facilitator auth is a short-lived JWT signed with the CDP key (`@coinbase/x402` builds it); a static
  `FACILITATOR_AUTH` only suits a self-hosted/static-token facilitator. Production: mint the JWT per request.
- Reputation is only as good as the reader's client filter; we can't and shouldn't curate it.

## 9. Config (`server.ts` env)

| Var | Required | Meaning |
| --- | --- | --- |
| `AGENT_ID` | yes | tokenId from `register()` |
| `PAY_TO` | yes | USDC receiver, = onchain `agentWallet` |
| `AGENT_URI` | no | `ipfs://<cid>` shown at `/` |
| `FACILITATOR_URL` | no | default CDP x402 facilitator |
| `FACILITATOR_AUTH` | mainnet CDP: yes | `Authorization` header value |
| `UPSTREAM_URL` | no | default Open-Meteo |
| `PUBLIC_ORIGIN`, `PORT` | no | default `https://forecast.example.com`, `8080` |
