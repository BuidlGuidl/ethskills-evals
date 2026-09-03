# Agent-to-agent discovery, payment and rating

## 1. Discovery and standing check

The two agents share no directory, so the shared index is a chain: the
**ERC-8004 "Trustless Agents" registries**, deployed as singletons per chain
at the same vanity addresses everywhere.

Discovery lookup — the **Identity Registry**, an ERC-721 contract, on Base
(chainId `8453`):

```
0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
```

The paying agent calls, with `agentId = 7311` (the ERC-721 `tokenId`):

- `tokenURI(7311)` — in this standard the `tokenURI` is called the
  **agentURI**. It resolves (`ipfs://`, `https://`, or an on-chain
  `data:application/json;base64,...`) to the **agent registration file**, the
  JSON that carries `name`, `description`, `image`, a `services` array of
  endpoints (`A2A` agent card, `MCP`, `ENS`, `DID`, `web`, `email`), the
  `x402Support` flag, `active`, the `registrations` list, and `supportedTrust`.
  That file is what tells the caller where the weather endpoint actually lives
  and that it takes x402 payment.
- `ownerOf(7311)` and `getAgentWallet(7311)` — who controls the agent and which
  address to pay.
- Optionally, `getMetadata(7311, key)` for extra on-chain metadata.

Because a `services` endpoint can name a domain the owner does not control, the
caller can confirm the binding the other way round: fetch
`https://{endpoint-domain}/.well-known/agent-registration.json` and check that
it contains a `registrations` entry whose `agentRegistry` and `agentId` match
what the chain says. That check is unnecessary when the endpoint domain is the
same domain that served the `agentURI`, since serving that file already proves
control.

Standing check — the **Reputation Registry**, same deployment scheme, on Base:

```
0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
```

Read-only calls before paying:

- `getSummary(7311, clientAddresses, tag1, tag2)` → `(count, summaryValue,
  summaryValueDecimals)`; pass an empty `clientAddresses` array for "everyone",
  or a curated list of raters this agent already trusts, and a tag to summarise
  one dimension only.
- `readAllFeedback(7311, clientAddresses, tag1, tag2, includeRevoked)` → the
  individual `values`, `valueDecimals`, `tag1s`, `tag2s`, `revokedStatuses`.
- `getClients(7311)` to see who has rated it, and
  `getResponseCount(...)` to see whether ratings were disputed or answered.

Nothing here needs an account, an API key, or a directory operator: the
registry is the directory, feedback is written by paying counterparties, and
the standard forbids the agent's own owner or operators from submitting
feedback about itself.

## 2. Fully-qualified identifier

An agent is identified globally by an **agentRegistry** string plus its
**agentId**. The registry string is `{namespace}:{chainId}:{identityRegistry}`:

- `namespace` = `eip155` (EVM family)
- `chainId` = `8453` (Base)
- `identityRegistry` = `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`

So, whatever chain the caller itself sits on:

```
agentRegistry: eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
agentId:       7311
```

which is exactly the pair carried in the registration file:

```json
"registrations": [
  {
    "agentId": 7311,
    "agentRegistry": "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
  }
]
```

The chainId in that string is the chain the agent is *registered* on, not the
caller's chain — a caller on any other chain resolves the same identifier by
reading Base.

## 3. Recording 99.4% uptime and 73/100 quality

Feedback is submitted with:

```solidity
giveFeedback(
  uint256 agentId,
  int128  value,
  uint8   valueDecimals,
  string  tag1,
  string  tag2,
  string  endpoint,
  string  feedbackURI,
  bytes32 feedbackHash
)
```

The score is a signed fixed-point number: the on-chain reading is
`value / 10**valueDecimals`. `valueDecimals` must be between 0 and 18. Only
`value`, `valueDecimals`, `tag1`, `tag2` and `isRevoked` are kept in storage
(with a per-client `feedbackIndex`); `endpoint`, `feedbackURI` and
`feedbackHash` are only emitted in the event.

Each dimension is its own feedback entry, tagged so it can be filtered and
summarised separately:

**Uptime, 99.4%** — one decimal place is needed to keep the `.4`:

```
994 / 10**1 = 99.4
value         = 994
valueDecimals = 1
tag1          = "uptime"
```

**Quality, 73 out of 100** — a whole number, so no decimals:

```
73 / 10**0 = 73
value         = 73
valueDecimals = 0
tag1          = "quality"
```

Two calls, both to the Reputation Registry at
`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` on Base:

```solidity
giveFeedback(7311, 994, 1, "uptime",  "", endpoint, feedbackURI, feedbackHash);
giveFeedback(7311,  73, 0, "quality", "", endpoint, feedbackURI, feedbackHash);
```

Writing `994` with `valueDecimals = 0` would claim 994 units, and writing `99`
with `valueDecimals = 0` would silently discard the `.4` — the decimals field
is what makes the two entries comparable on different scales. The optional
`feedbackURI`/`feedbackHash` pair points at an off-chain JSON (hashed with
KECCAK-256 so it cannot be swapped later) which is where the 30-day window, the
sample size behind the two numbers, and the proof of payment for the calls
being rated belong.

## 4. Amount on the wire

USDC has **6 decimals**, and x402 puts amounts on the wire as a string of
atomic units, never as a decimal:

```
0.35 * 10**6 = 350000
```

So the value is the string `"350000"` — it appears as `maxAmountRequired` in
the seller's payment requirements and as `authorization.value` in the buyer's
signed payload. Not `0.35`, not `350000000000000000` (that would be an
18-decimal assumption, i.e. 350 billion USDC).

Token contract — USDC on Base (chainId 8453):

```
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

which is the `asset` field of the requirements:

```json
{
  "scheme": "exact",
  "network": "base",
  "maxAmountRequired": "350000",
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "payTo": "<weather agent wallet from getAgentWallet(7311)>",
  "resource": "https://.../forecast",
  "maxTimeoutSeconds": 60
}
```

## 5. Paying with no ETH

The buyer never sends a transaction, so it never needs gas.

USDC implements **EIP-3009 (Transfer With Authorization)**. That lets the token
holder *sign* a transfer instead of *submitting* one: an EIP-712 typed-data
signature over

```
TransferWithAuthorization(address from, address to, uint256 value,
                          uint256 validAfter, uint256 validBefore,
                          bytes32 nonce)
```

Signing is a pure local operation — no chain interaction, no gas, no account
anywhere. This is what x402's `exact` scheme is built on:

1. The buyer requests the forecast, gets back **HTTP 402 Payment Required**
   with the requirements above.
2. It signs the authorization (`from` = its own wallet, `to` = the seller's
   `payTo`, `value` = `350000`, `validBefore` = now + timeout, `nonce` = a
   random 32 bytes) and retries the request with the base64-encoded payload —
   `{signature, authorization}` — in the **`X-PAYMENT`** header.
3. The seller hands that payload to a **facilitator**, which verifies it and
   then broadcasts the transaction, paying the ETH gas itself. The facilitator
   cannot alter the amount or the recipient: both are inside the signed
   message, so tampering invalidates the signature. The nonce and
   `validAfter`/`validBefore` window stop replay.
4. On success the seller returns the forecast plus an `X-PAYMENT-RESPONSE`
   header containing the settlement transaction hash — which is the proof of
   payment that can later be referenced in the feedback file from question 3.

The function that ultimately moves the tokens, called by the facilitator on the
USDC contract at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`:

```solidity
transferWithAuthorization(
  address from, address to, uint256 value,
  uint256 validAfter, uint256 validBefore, bytes32 nonce,
  uint8 v, bytes32 r, bytes32 s
)
```

(the same call is also exposed in the packed `bytes signature` form). The
buyer's ETH balance stays at zero throughout; only its USDC balance moves.

## 6. Base Sepolia rehearsal

Testnets use a different vanity address from mainnets, so the rehearsal is a
real dry run only if the registration goes to the testnet deployment. On
**Base Sepolia (chainId 84532)** the `register()` / `register(agentURI)` /
`register(agentURI, metadata)` call is sent to the Identity Registry at:

```
0x8004A818BFB912233c491871b3d84c89A494BD9e
```

It returns the throwaway agent's `agentId`, and the identifier for that
rehearsal agent is `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e`
plus that id.

To exercise the rest of the identical flow on the same network:

- Reputation Registry (`giveFeedback`, `getSummary`):
  `0x8004B663056A597Dffe9eCcC1965A193B7388713`
- USDC (`transferWithAuthorization`, 6 decimals, so `"350000"` is still the
  amount): `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- x402 `network` field: `"base-sepolia"` instead of `"base"`

Going live is then only a matter of swapping those four values for their Base
mainnet counterparts; the calls, the payload shape and the arithmetic are
unchanged.
