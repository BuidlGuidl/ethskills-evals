# forecast.example.com — design

Sells weather forecasts to autonomous agents. $0.35 USDC per call on Base. No accounts, no keys, no humans in the runtime flow.

Built on three public standards:

| Need | Standard | Where it lives |
|---|---|---|
| Find us + check who we are | **ERC-8004 IdentityRegistry** (an ERC-721 registry of agents) | Base, `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Pay per call, no ETH | **x402 v2** (HTTP 402 payment handshake), `exact` scheme, over **EIP-3009** `transferWithAuthorization` | HTTP headers + USDC on Base `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Rate us, read others' ratings | **ERC-8004 ReputationRegistry** | Base, `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

The registries are shared public contracts — not a catalog we own or run. Anyone can read them with any Base RPC.

## 1. End-to-end flow

```
client agent                          forecast.example.com              Base
    │ 1. scan IdentityRegistry (Registered events / public indexer) ──────────► find agentId N
    │ 2. tokenURI(N) → registration file (data: URI, fully onchain)
    │ 3. GET /.well-known/agent-registration.json ──►  names agentId N  (domain ⇄ identity binding)
    │ 4. getMetadata(N,"agentWallet") == payTo in file?                  ◄──── onchain
    │ 5. ReputationRegistry: getClients → filter paid reviewers → getSummary
    │ 6. GET /v1/forecast?lat&lon ─────────►  402 + PAYMENT-REQUIRED
    │ 7. sign EIP-3009 authorization (offchain, no gas)
    │ 8. GET again + PAYMENT-SIGNATURE ────►  verify sig, nonce, dry-run transfer
    │                                          fetch forecast from upstream
    │                                          submit transferWithAuthorization ──► USDC payer→payTo
    │ ◄──────── 200 + forecast + PAYMENT-RESPONSE(txHash) + feedback template
    │ 9. giveFeedback(N, 0..100, "starred","forecast", …, proofOfPayment) ───────► ReputationRegistry
```

Steps 1–5 are the client's trust check. Steps 6–8 are one paid call. Step 9 is the rating. No step needs a person.

## 2. Discovery and trust (client with no prior contact)

What a new agent can check using only a Base RPC and HTTPS:

1. **Identity exists and is old enough.** `ownerOf(N)` and the `Registered` event block give owner and age. A new identity is a weak signal; an old one with history is stronger.
2. **Self-description.** `tokenURI(N)` returns the registration file. We store it as a `data:application/json;base64,…` URI, so it is fully onchain — no IPFS or web host needed to read it, and every change is a visible `setAgentURI` tx.
3. **Domain binding (two-way).** The onchain file names `https://forecast.example.com`; the domain serves `/.well-known/agent-registration.json` naming `agentId N` on `eip155:8453:0x8004A169…`. TLS proves the domain side; the NFT owner's signature proves the chain side. An impostor would need both.
4. **Where money goes.** `getMetadata(N, "agentWallet")` is set with a signature from that wallet, so it is proven. The `payTo` in our 402 response and in the registration file must equal it. A client must refuse to pay any other address — this blocks a man-in-the-middle or cloned site from swapping in their own wallet.
5. **Price before paying.** The 402 response states exact amount, asset and payTo. The same values appear in the registration file and `/openapi.json`, so a client can compare them before it signs anything.
6. **Reputation.** See §4.

Machine-readable interface: `/openapi.json` (OpenAPI 3.1 with an `x-x402` block) plus the 402 body itself. A client needs nothing written for humans.

## 3. Payment (x402 v2, `exact`, EIP-3009)

- **402 response:** `PAYMENT-REQUIRED` header = base64 JSON `{x402Version:2, resource, accepts:[{scheme:"exact", network:"eip155:8453", amount:"350000", asset:USDC, payTo, maxTimeoutSeconds:120, extra:{name:"USD Coin",version:"2"}}], extensions:{erc8004:{agentRegistry, agentId}}}`. Same JSON in the body.
- **Client** signs EIP-712 `TransferWithAuthorization{from,to,value,validAfter,validBefore,nonce}` against USDC's domain and retries with `PAYMENT-SIGNATURE` = base64 `{x402Version:2, accepted, payload:{signature, authorization}}`.
- **Server checks** (`verifyPayment` in `server.ts`): version/scheme/network/asset match; `to == payTo`; `value == 350000`; time window valid with ≥10s left; signature valid (EOA or ERC-1271 smart wallet); nonce unused onchain; `eth_call` dry-run of the transfer succeeds (catches low balance, blacklisted payer, paused USDC).
- **Order:** verify → fetch forecast → settle onchain → respond. If the upstream weather API fails, we return 503 and **don't** settle, so the caller isn't charged. If settlement fails, we return 402 and no data.
- **Settlement:** our hot "settler" key calls `USDC.transferWithAuthorization(..., bytes signature)` and waits for the receipt (~2s on Base). **We pay the ETH gas (~$0.001); the payer pays none.** USDC goes straight from payer to `payTo`; the settler never holds customer funds.
- **Replay protection:** USDC marks each `(from, nonce)` used onchain. An in-memory set stops two parallel requests with one signature both getting served before the first tx lands.
- **Receipt:** `PAYMENT-RESPONSE` header = base64 `{success, transaction, network, payer}`. The tx hash is the caller's proof of purchase.

No accounts, API keys, subscriptions, invoices or pre-paid balances: every call is a standalone signed transfer for exactly one response.

We settle directly with viem instead of using a hosted x402 facilitator (a service that verifies and submits payments for you). That's one fewer third party. The code follows the x402 v2 wire format, so standard x402 clients (`@x402/fetch` etc.) work unchanged. Using Coinbase's facilitator is an easy swap if we'd rather not run a gas wallet.

## 4. Ratings (ERC-8004 ReputationRegistry)

**Writing.** After the call the client sends `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`. Conventions we publish (in the registration file and in each 200 response):
- `tag1="starred"`, `tag2="forecast"`, `value` 0–100, `valueDecimals=0`, `endpoint` = forecast URL.
- `feedbackURI` points to a feedback file with `proofOfPayment {fromAddress, toAddress, chainId, txHash}`. The client can use a `data:` URI so it needs no hosting. `feedbackHash` = keccak256 of that file. The 200 response hands the client this file pre-filled.
- Agents can rate later, e.g. `tag2="accuracy-24h"` once the forecast day has passed.
- The registry rejects feedback from the agent's owner/operators. We can't rate ourselves from the owner key.

**Gas for the rater (the caller has no ETH).** `giveFeedback` is an ordinary tx and needs gas. It must come from the **same address that paid**, or the proof of payment doesn't link up. Two paths:
- **A (baseline, doesn't depend on us):** the client sends it as an ERC-4337 UserOperation (a transaction sent through a smart-account system, where a third party can pay the gas) through any bundler, with a **paymaster that takes gas payment in USDC** (e.g. Circle Paymaster on Base). A plain EOA gets the same address as a smart account through an **EIP-7702** delegation, which is live since Pectra. Gas ≈ cents of USDC.
- **B (optional, us):** we run an ERC-4337 paymaster (`FEEDBACK_PAYMASTER_URL`) that pays gas for any `giveFeedback` to our agentId from an address that paid us, **whatever the score**. It can't change the content, because the client signs the UserOp. Refusing to sponsor bad reviews is pointless, because path A always exists.

**Reading (what other agents act on).** `getSummary` needs an explicit list of client addresses, because unfiltered averages are easy to fake with fresh wallets. Recommended client procedure:
1. `getClients(N)` → read each client's feedback (`readAllFeedback` / `NewFeedback` events).
2. Keep only feedback whose `proofOfPayment.txHash` is a real Base USDC transfer `client → agentWallet` of ≥ $0.35. Also consider reviewer age/history and overlap with reviewers the client already trusts.
3. `getSummary(N, keptClients, "starred", "forecast")` → count and average. Decide.

We can post public replies with `appendResponse`; we can't delete or edit feedback.

## 5. What we must publish and register (one-time, before launch)

Setup is done once by the operator. After that the runtime flow needs no humans.

| # | Action | Where | Tool |
|---|---|---|---|
| 1 | Create keys: **owner** (cold; holds the ERC-8004 NFT), **payTo** (cold/Safe; receives USDC), **settler** (hot; ETH only) | — | any wallet |
| 2 | Fund settler with ~0.01–0.05 ETH on Base; monitor | Base | — |
| 3 | `register()` → get `agentId` | IdentityRegistry on Base | owner key |
| 4 | Deploy server with `AGENT_ID`, `PAY_TO`, `SETTLER_PRIVATE_KEY`, `BASE_RPC_URL` | our host | — |
| 5 | `npm run registration-uri` → `setAgentURI(agentId, dataUri)` | IdentityRegistry | owner key |
| 6 | `setAgentWallet(agentId, payTo, deadline, sig)` — sig from payTo proves control | IdentityRegistry | owner + payTo |
| 7 | Serve `/.well-known/agent-registration.json`, `/openapi.json` (done by `server.ts`) | forecast.example.com over HTTPS | — |
| 8 | DNS + TLS cert for forecast.example.com | registrar / CA | — |
| 9 | Optional: deploy + fund feedback paymaster (path B) | Base | — |
| 10 | Optional: list in x402 Bazaar / other agent indexers for extra reach — **not relied on** | third party | — |

At startup `server.ts` checks the chain and warns if the onchain `agentURI` is out of date, `agentWallet != PAY_TO`, or the settler has < 0.01 ETH. **Any change to price, payTo or endpoints means a new `setAgentURI`** (a few cents on Base).

## 6. Dependencies

### Onchain (Base, chainId 8453)
| Dependency | Used for | If it fails / misbehaves |
|---|---|---|
| Base L2 (sequencer run by Coinbase, security from Ethereum L1) | everything onchain | sequencer down → no settlement, we return 402 errors; reads may still work via L1 force-inclusion only (slow) |
| USDC (Circle, upgradeable proxy, FiatToken v2.2) | payment asset, EIP-3009, ERC-1271 sig support | Circle can pause or blacklist addresses; a blacklisted payTo stops all revenue |
| ERC-8004 IdentityRegistry | discovery, agentURI, agentWallet | shared contract; check its upgrade/admin setup in the erc-8004-contracts repo before relying on it |
| ERC-8004 ReputationRegistry | ratings | same as above |
| ETH on Base in settler wallet | our gas for settlement | empty → every settlement fails; must monitor and top up |
| ERC-4337 EntryPoint + bundlers + a USDC paymaster (Circle Paymaster) | caller's gasless rating (path A) | if none are available, callers with 0 ETH can't rate (payments still work) |
| EIP-7702 (protocol feature) | lets an EOA payer rate from the same address via 4337 | — |

### Offchain
| Dependency | Used for | If it fails |
|---|---|---|
| Base RPC endpoint (`BASE_RPC_URL`; use a paid provider + fallback) | verify, simulate, submit, read receipts | no sales; run ≥2 providers |
| Weather data upstream (Open-Meteo; **commercial use needs their paid plan + API key**) | the product | 503, caller not charged |
| DNS + TLS CA for forecast.example.com | reaching us; domain side of identity binding | unreachable; onchain identity still intact |
| Hosting for `server.ts` (Node 22, viem) | serving | — |
| Standards: x402 v2 wire format, EIP-712, EIP-3009, ERC-8004 registration/feedback file formats | interoperability with generic clients | spec drift → update server |
| Client-side: some Base RPC + an indexer or event scan to enumerate agents | discovery | clients can use any RPC; we don't provide it |

**Not depended on:** IPFS (registration is a `data:` URI), any x402 facilitator, any agent catalog we operate, accounts or databases (the server has no state beyond an in-memory in-flight set).

## 7. Keys and security

- **Owner key** controls identity and agentURI. Keep cold / multisig. If it's lost we can't update listings; if it's stolen, someone can repoint the agentURI and domain binding. Clients catch that through the domain check (§2.3), but reputation stays tied to the NFT.
- **payTo** never signs at runtime. A Safe is fine; its ERC-1271 proof is only needed for `setAgentWallet`.
- **Settler** key is online but holds only gas ETH. If stolen, the attacker gets the ETH, not the revenue.
- Bad params → 400 before any 402, so nobody pays for a malformed query.
- Front-running a settlement is harmless: EIP-3009 fixes `to = payTo`. Whoever submits it, we get paid; we then just serve the response once the tx exists. (Current code treats a front-run as a settlement failure. See open questions.)

## 8. Limits / honest caveats

- **Reputation isn't Sybil-proof.** Proof-of-payment makes each fake review cost $0.35, but if we pay *ourselves* from a fresh wallet the money comes back to us, so only gas is lost. Clients should weight reviewers by independence and history, not count them. The ValidationRegistry (third-party checks of an agent's work) could later check forecast accuracy against observed weather.
- The ERC-8004 addresses and ABI (`getMetadata`, `tokenURI`, `ownerOf`) were confirmed against the live Base deployment in testing. The `giveFeedback` / `getSummary` / `setAgentWallet` signatures follow the v1 spec; re-check them against the deployed contracts before launch.
- `exact` means one fixed price per call. Variable pricing (e.g. per day of forecast) would need `upto`, which is still emerging.
- The in-flight set is per process. With several instances, the onchain nonce still stops double *charging*. The worst case is that two instances both serve a response for one payment, and one of them fails to settle. Add a shared lock (Redis) if that matters.

## Open questions

1. Use a hosted facilitator (fewer ops, one more dependency), or keep self-settling (current)?
2. Run our own feedback paymaster (path B), or rely only on USDC paymasters (path A)?
3. Settlement front-run (§7): check `authorizationState` after a failure and serve anyway if the nonce was used to pay us? Small change, worth doing?
4. Open-Meteo commercial plan vs another upstream (NWS is free but US-only).
