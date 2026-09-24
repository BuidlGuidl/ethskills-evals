# forecast.example.com — design

Sells weather forecasts to autonomous agents, $0.35 per call, paid in USDC on Base.
Everything uses open standards, so a client that has never seen us can do the whole flow with no human:
**find us → check us → pay → get data → rate us**.

| Need | Standard used |
|---|---|
| Find the service without a catalog we run | **ERC-8004 Identity Registry** (public contract on Base) + `/.well-known/agent-registration.json` |
| Decide whether to trust it | ERC-8004 identity (who owns it, which wallet gets paid) + **ERC-8004 Reputation Registry** (ratings) + USDC transfer history onchain |
| Pay per call, no account or API key | **x402 v2** (HTTP 402), `exact` scheme |
| Payer has USDC but no ETH | **EIP-3009** `transferWithAuthorization`: payer only signs, we submit the tx and pay the gas |
| Rate after the call | ERC-8004 `giveFeedback`, sent as an **ERC-4337** UserOperation with a **USDC paymaster** (gas paid in USDC) |

---

## 1. Architecture

```
 client agent                         forecast.example.com (server.ts)            Base (chain 8453)
 ────────────                         ─────────────────────────────────           ─────────────────
 (A) discover ─ read logs/indexer ──────────────────────────────────────────────▶ IdentityRegistry
     GET /.well-known/agent-registration.json ─▶ registration file
 (B) trust ──── ownerOf / tokenURI / agentWallet / feedback ───────────────────▶ Identity + Reputation
 (C) GET /forecast?lat&lon&days ────▶ 400 if bad input
                                     402 + PAYMENT-REQUIRED (price, payTo, asset)
     sign EIP-3009 (off-chain, no gas)
     GET /forecast + PAYMENT-SIGNATURE ─▶ check payload, check sig, simulate ─────▶ USDC (eth_call)
                                     fetch forecast (Open-Meteo)
                                     settle: transferWithAuthorization ─────────▶ USDC (tx, we pay gas)
                                ◀─── 200 forecast + PAYMENT-RESPONSE (txHash) + feedback hints
 (D) rate ───── UserOp giveFeedback(agentId, value, tags, …) via bundler + USDC paymaster ─▶ ReputationRegistry
```

The server (`server.ts`, Node + viem, no web framework) stores nothing between requests:
no users, no sessions, no balances. The only lasting records are onchain.

### Routes

| Route | Purpose |
|---|---|
| `GET /forecast?lat=&lon=&days=` | Paid resource. Returns 402 without payment, 200 with a settled payment |
| `GET /.well-known/agent-registration.json` | ERC-8004 registration file (the onchain `agentURI` points here) |
| `GET /openapi.json` | Machine-readable API description, including x402 requirements and ERC-8004 ids |
| `GET /` | Pointers to the above |
| `GET /health` | Liveness check |

Every response has a `Link: <…/agent-registration.json>; rel="describedby"` header. So a client that only knows the URL can still find our identity.

### Request lifecycle for `/forecast`

1. **Check the input first.** Bad `lat`/`lon`/`days` returns 400, with no charge.
2. **No `PAYMENT-SIGNATURE` header** → return 402. The body and the base64 `PAYMENT-REQUIRED` header hold:
   `scheme: exact`, `network: eip155:8453`, `asset: USDC`, `amount: 350000`, `payTo`, `maxTimeoutSeconds`,
   `extra: {name:"USD Coin", version:"2"}` (EIP-712 domain), and `extensions.erc8004` (registry, agentId, registration URL).
   This lets the client check us before it signs anything.
3. **Decode the payment and check it cheaply:** x402 version 2, scheme/network/asset, `to == payTo`, `value == 350000`,
   time window valid and short (so a signed authorization can't sit unused for long).
4. **Check the signature** with `publicClient.verifyTypedData`. This handles plain wallets (EOAs), EIP-7702 wallets and ERC-1271 smart-account signatures.
5. **Simulate** `transferWithAuthorization` with `eth_call`. The USDC contract itself then checks balance,
   whether the nonce was already used, the time window and the signature. If the call would fail, return 402 with the reason.
6. **Fetch the forecast** from upstream. If that fails, return 502 and settle nothing, so the caller is not charged.
7. **Settle:** send `transferWithAuthorization` from our settler key and wait for the receipt (about 2 s on Base).
   Sends go through one at a time so the settler's tx nonce never collides.
8. **Return 200** with the forecast, the `PAYMENT-RESPONSE` header (`{success, transaction, network, payer}`), and a
   `feedback` object: registry, agentId, function signature, suggested tags, and `proofOfPayment` (the tx hash).

Replay: each authorization carries a random 32-byte nonce. USDC stores used nonces onchain, so the same one can
never pay twice. An in-memory set also rejects the same authorization arriving twice at the same moment.
We settle before sending any data, so a failed or replayed payment never gets a forecast.

---

## 2. Onchain dependencies (all on Base mainnet, chain id 8453)

| Dependency | Address / id | Used for | Trust assumption |
|---|---|---|---|
| Base L2 | chain 8453 | Everything below | Base sequencer is live (it is a single operator today). Finality comes from Ethereum L1 |
| USDC (Circle FiatToken v2.2) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Payment asset. EIP-3009 `transferWithAuthorization(…, bytes signature)`, EIP-712 domain `{name:"USD Coin", version:"2"}` | Circle can freeze addresses or pause the token. v2.2 is needed for ERC-1271 smart-account signatures |
| ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Our agent NFT (`agentId`), `agentURI`, `agentWallet` | Shared public contract; nobody's catalog. **Check the address against the ERC-8004 deployments list before launch** |
| ERC-8004 Reputation Registry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | Ratings: `giveFeedback`, `readAllFeedback`, `getSummary`, `appendResponse` | Same as above. The contract blocks the agent's owner/operators from rating themselves. It does **not** stop fake accounts from rating (see §6) |
| ERC-4337 EntryPoint (v0.7/v0.8) | canonical addresses | Client's gasless `giveFeedback` | Client side only. Needs a bundler |
| USDC paymaster (e.g. Circle Paymaster) | Circle's published Base address | Lets the client pay feedback gas in USDC | Client side only. Circle runs it; any other USDC paymaster works too |
| EIP-7702 | Base protocol feature (Pectra) | Lets a plain wallet (EOA) act as a smart account for the UserOp, keeping the same address it paid from | Client side only |

What we hold onchain:
- **Owner wallet**: owns the ERC-8004 agent NFT. Cold storage; used only to register or update.
- **`payTo` wallet**: receives the USDC and is set as `agentWallet`. Can be cold, because it never signs per request.
- **Settler key**: hot key on the server. It needs a small ETH balance on Base, because it pays gas for every settlement
  (~$0.001–0.01 per call, a small cost against $0.35). It holds no customer money, because USDC moves straight from the payer to `payTo`.

## 3. Offchain dependencies

| Dependency | Used for | Notes / what fails if it's down |
|---|---|---|
| DNS + TLS for `forecast.example.com` | Reaching the server, and checking the domain named in the registration file | If the domain is taken over, an attacker can serve fake data. They still can't redirect payments unless they also change `payTo`, which clients check against the onchain `agentWallet` |
| Base JSON-RPC (`BASE_RPC_URL`) | Signature check, simulate, send, receipt | Down → we can't take payments (402/500). Use a paid provider plus a fallback |
| Open-Meteo forecast API | The actual weather data | **Selling data is commercial use: needs the paid `customer-api` plan (`OPEN_METEO_API_KEY`)**. Down → 502, no charge |
| Hosting for `server.ts` | Running the service | Node ≥ 20, `viem` |
| Chain indexers / explorers (8004scan, subgraphs, Basescan, or the client's own log scan) | How clients *find* agents and read ratings | Not ours and not needed: anyone can rebuild the same data from contract events |
| Bundler (client side) | Submitting the client's feedback UserOp | Any public ERC-4337 bundler on Base |
| x402 facilitator | **Not used.** We verify and settle ourselves | Removes a third party that could block or censor payments. Switching to one (e.g. Coinbase CDP) would remove the need for the settler hot key and ETH |

---

## 4. What to publish, and where

| What | Where | Content |
|---|---|---|
| Agent NFT + `agentURI` | ERC-8004 Identity Registry on Base | `agentURI = https://forecast.example.com/.well-known/agent-registration.json` |
| `agentWallet` | Identity Registry (`setAgentWallet`, proven by an EIP-712 signature from `payTo`) | The `payTo` address. Clients compare it with `payTo` in the 402 response |
| Registration file | `https://forecast.example.com/.well-known/agent-registration.json` (served by `server.ts`) | `type` (ERC-8004 registration-v1), name, description, `services` (web, OpenAPI, agentWallet), `x402Support: true`, `active: true`, `registrations: [{agentId, agentRegistry: "eip155:8453:0x8004A169…"}]`, `supportedTrust: ["reputation"]` |
| API description | `https://forecast.example.com/openapi.json` | Parameters, responses, `x-x402` requirements, `x-erc8004` ids |
| x402 payment requirements | Every 402 response (`PAYMENT-REQUIRED` header + body) | Price, asset, network, payTo, EIP-712 domain, ERC-8004 ids |
| Responses to ratings (optional) | Reputation Registry `appendResponse` | Our answers to disputed ratings, readable by everyone |

The registration file is served from the same domain as the endpoint. That is the ERC-8004 way to prove "this onchain agent controls this domain":
the file on the domain names the agentId, and the agentId's `agentURI` points back to the domain. Both directions must match.

## 5. One-time setup (before anyone can find us)

1. Deploy `server.ts` at `https://forecast.example.com` (DNS + TLS). Buy the Open-Meteo commercial plan.
2. Create three wallets: owner (cold), `payTo` (cold), settler (hot). Put ~0.01 ETH on Base in the owner and settler wallets.
3. From the owner wallet: `IdentityRegistry.register("https://forecast.example.com/.well-known/agent-registration.json")`.
   Read `agentId` from the `Registered` / `Transfer` event.
4. `setAgentWallet(agentId, payTo, deadline, sig)`, where `sig` is `payTo`'s EIP-712 consent.
5. Start the server with `AGENT_ID`, `PAY_TO`, `SETTLER_PRIVATE_KEY`, `BASE_RPC_URL`, `OPEN_METEO_API_KEY`.
   The registration file now holds the right `agentId`.
6. Check: `tokenURI(agentId)` resolves to our file, the file's `registrations[0]` matches, and the agentWallet equals `PAY_TO`.
   Make one paid call from a test wallet that has only USDC.
7. Optional, for more reach but not required: listing in x402 "Bazaar"-style discovery lists and ERC-8004 explorers. These only copy public onchain data.

There is **no** step where a client signs up, gets a key, or tops up a balance.

---

## 6. Client flow, and how each constraint is met

**Discover (no catalog we own).** The client either
(a) scans `Registered` events on the public Identity Registry, or uses any third-party indexer, then fetches each `agentURI` and
filters for weather/forecast services with `x402Support`; or
(b) already has the URL, calls it, and follows the `Link` header / 402 `extensions.erc8004` to the registration.
Both paths end at the same onchain record, which no one but the chain controls.

**Judge trust (no human).**
1. `ownerOf(agentId)` exists, and `tokenURI(agentId)` equals the URL of the file it read. The file's `registrations` names this agentId → the domain and the identity are linked.
2. The onchain `agentWallet` equals `payTo` in the 402 → payment goes to the registered identity, not to whoever controls the web server.
3. Price = 350000 USDC base units, the asset is real USDC, network is Base → the client knows the exact, fixed cost, and a bad call costs at most $0.35.
4. Reputation: `readAllFeedback` / `getSummary(agentId, clients, "starred", "forecast")`. Ratings from fake accounts are free to create,
   so a careful client only counts reviewers who can be **shown to have paid**: look for a USDC `Transfer` from the reviewer to `payTo`
   (the `proofOfPayment` tx hash we hand out makes this a single lookup). It can also weight by the reviewer's own history, and look at
   our `appendResponse` answers. The contract already blocks us from rating ourselves.
5. Age of the identity, number of distinct paying reviewers, and total USDC received are all readable onchain.

**Pay per call (no accounts, no ETH).** The client signs an EIP-712 `TransferWithAuthorization` for exactly 0.35 USDC to `payTo`,
with a short expiry and a random nonce, and resends the request with `PAYMENT-SIGNATURE`. It sends no transaction and needs no ETH.
We submit the transfer and pay the gas. The USDC goes straight from the client to `payTo`: we never hold a balance for anyone.

**Rate (no ETH, usable by others).** From the 200 response the client has `agentId`, the registry, suggested tags and `proofOfPayment`. It calls
`giveFeedback(agentId, value, 0, "starred", "forecast", endpoint, feedbackURI, feedbackHash)`. `feedbackURI` is optional; it can point to a JSON file
with the `proofOfPayment`, the input and the result. Without ETH, the client sends this as an ERC-4337 UserOperation:
- plain wallet: EIP-7702-delegate it to a 4337 smart account, so the rating comes **from the same address that paid**, which keeps the proof-of-payment link;
- gas paid in USDC through a USDC paymaster (Circle Paymaster on Base takes an EIP-2612 permit).
The rating is written onchain at once. Any agent can read it before choosing us.

We deliberately do **not** send ratings on the client's behalf. `giveFeedback` records `msg.sender` as the reviewer, so a relay run by us
would make every rating look like it came from us, which is useless and would also be blocked if the relayer were our operator.

**No human anywhere.** Setup (§5) is done once by the operator. Every per-call step (discover, check, pay, settle, rate) is HTTP plus signatures plus contract calls.

---

## 7. Failure modes and security notes

| Case | Behaviour |
|---|---|
| Bad query | 400 before payment |
| Wrong amount / recipient / asset / network, expired, bad signature, not enough USDC, nonce already used | 402 with `error`. Nothing moves |
| Upstream weather down | 502. We never settle, so the client can reuse the same authorization until it expires |
| Settlement tx reverts (e.g. the payer spent the USDC between simulate and send) | 402, no data |
| Settlement ok but connection drops before the client gets the 200 | Client paid and got nothing. The tx hash is onchain. Accepted risk at $0.35. A future fix: cache responses by `(payer, nonce)` for a few minutes so the client can fetch it again |
| Settler out of ETH | Settlements fail → 402. Monitor the balance and alert below a threshold |
| Settler key stolen | The attacker can only spend its ETH. It can't take USDC (that goes to `payTo`) and can't change the identity (that needs the owner key) |
| Someone front-runs our settlement tx with the same authorization | Payment still goes to `payTo`, our tx reverts → the client gets 402 despite paying. Rare on Base, where one sequencer orders transactions privately. Fix if needed: switch to `receiveWithAuthorization` (only the payee can submit it). That needs a different x402 scheme, so it is not done now |
| Latency | +1 Base block (~2 s) per call, because we wait for settlement before answering |

---

## 8. Open questions

- The ERC-8004 registry addresses and the `giveFeedback` / `setAgentWallet` signatures should be checked against the final deployed ABI before launch.
  `server.ts` only uses them as pointers; it never calls these contracts.
- Settle before answering (safer for us, +2 s) or answer first and settle after (faster, but risks unpaid calls)? This design picks the first.
- Should we also accept older x402 v1 clients (`X-PAYMENT` header, `network: "base"`)? Right now only v2 is supported.
- Should we also add an ERC-8004 Validation Registry entry (e.g. a third party re-checking forecast accuracy)? Out of scope for now.
