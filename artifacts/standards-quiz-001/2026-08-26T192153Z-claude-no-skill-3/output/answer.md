# Answers

## 1. Discovery and standing check without a shared directory

Neither side needs a trusted directory because the directory is a public
singleton contract on Base: the **ERC-8004 Identity Registry**, an ERC-721
contract in which every agent is a token and `agentId` is the token id.

Contract called for the discovery lookup (Base, chain id 8453):

```
0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
```

The lookup, in order:

1. `tokenURI(7311)` on that contract → URI of the weather agent's registration
   file (the agent card, conventionally served at
   `/.well-known/agent-card.json`). That file carries `name`, `description`,
   the `services[]` array with the callable endpoint, `x402Support`, the
   `supportedTrust` list, and a `registrations[]` entry that points back at
   `{agentRegistry, agentId}` — so the file and the token mutually attest, and
   a forged card that claims id 7311 fails the round-trip.
2. `getAgentWallet(7311)` / `getMetadata(7311, "agentWallet")` → the address
   that is allowed to receive payment. This is what stops payment to an
   attacker-substituted `payTo`.
3. Standing comes from the sibling singleton, the **ERC-8004 Reputation
   Registry** on Base:

   ```
   0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
   ```

   `getClients(7311)` → who has ever left feedback;
   `getSummary(7311, clients, "uptime", "")` → `(count, summaryValue,
   summaryValueDecimals)` aggregated over past payers;
   `readAllFeedback(7311, clients, "starred", "", false)` → the individual
   scores, with revoked entries excluded.

   Feedback is not free-for-all: an entry can only be written by a
   `clientAddress` the agent authorized, so the summary is a set of
   counterparty-signed claims rather than anonymous stars. The paying agent
   weights by which clients it recognizes, and can ignore the rest.

Both registries are singletons — no one operates them, they are just read at a
fixed address — which is what removes the need for a mutually trusted
directory operator.

## 2. Fully-qualified identifier for the weather agent

An agent id is only unique within one registry on one chain, so the portable
identifier is the CAIP-10-style registry string plus the token id:

- `agentRegistry` = `{namespace}:{chainId}:{identityRegistry}`
  = `eip155` + `8453` (Base) + `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- `agentId` = `7311`

So, as it appears in the registration file:

```json
"registrations": [
  {
    "agentId": 7311,
    "agentRegistry": "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
  }
]
```

and written as a single string when one is needed:

```
eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/7311
```

A caller on Ethereum, Arbitrum, or anywhere else uses exactly this string —
the `eip155:8453` prefix says the identity lives on Base regardless of where
the caller runs.

## 3. Field values for the two 30-day scores

Feedback is stored as a signed fixed-point number: an `int128 value` plus a
`uint8 valueDecimals`, with the real number being `value / 10**valueDecimals`.
Each entry is filed under free-form string tags `tag1`/`tag2`.

**99.4% uptime** — the uptime tag records the percentage itself, at two
decimals (99.4 → 99.40 → 99.40 × 10² = 9940):

```
tag1           = "uptime"
value          = 9940
valueDecimals  = 2
```

**Quality 73 out of 100** — a 0–100 quality rating is an integer, so no
scaling is needed (73 × 10⁰ = 73):

```
tag1           = "starred"
value          = 73
valueDecimals  = 0
```

Two separate `giveFeedback` calls, e.g.

```solidity
giveFeedback(7311, 9940, 2, "uptime",  "", endpoint, feedbackURI, feedbackHash);
giveFeedback(7311, 73,   0, "starred", "", endpoint, feedbackURI, feedbackHash);
```

sent to `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`. The two must not be
merged into one entry: aggregation is per-tag, and averaging a 0–100 rating
with a percentage would corrupt both summaries. The `feedbackURI` /
`feedbackHash` pair carries the off-chain evidence (the 30 days of samples,
proof of payment) and its integrity hash, so the on-chain numbers stay cheap
and the backing detail stays auditable.

## 4. Wire amount for one $0.35 call

Amounts travel in atomic units as a decimal string, never as a float. USDC has
6 decimals:

```
0.35 × 10^6 = 350000
```

so on the wire:

```json
{
  "scheme":  "exact",
  "network": "eip155:8453",
  "amount":  "350000",
  "asset":   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "payTo":   "<agentWallet resolved for agent 7311>",
  "extra":   { "name": "USDC", "version": "2" }
}
```

- amount value: **`"350000"`** (string, atomic units — `350000` also appears as
  `value` inside the signed authorization)
- token contract: **`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`** — native
  USDC on Base

Sanity check in the other direction: 350000 / 10⁶ = $0.35. Writing `"0.35"`,
or `"3500000"` (which is $3.50, 10× the price), are the two ways this goes
wrong.

## 5. Paying with zero ETH

The payer never sends a transaction, so it never needs gas. USDC implements
EIP-3009 ("transfer with authorization"), which lets a token holder *sign* a
transfer rather than *submit* one:

1. The server answers the request with **HTTP 402 Payment Required** and the
   payment requirements above.
2. The paying agent signs an EIP-712 authorization — `from`, `to`, `value`
   `"350000"`, `validAfter`, `validBefore`, and a random 32-byte `nonce`
   (EIP-3009 nonces are arbitrary and single-use, not sequential, so
   authorizations can be issued in parallel) — and retries the request with
   that signature in the `X-PAYMENT` header. This is pure signing: no chain
   interaction, no balance spent, no ETH.
3. A **facilitator** verifies the signature and then broadcasts the
   transaction, **paying the gas in ETH itself** and recouping it out of band.
   It cannot alter the amount or the recipient — both are inside the signed
   authorization — so handing it the signature is not handing it custody.

The function that ultimately moves the tokens, called by the facilitator on
the USDC contract at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`:

```
transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, signature)
```

The gas dependency is shifted to the facilitator; the trust dependency is not,
because the signature pins exactly one payment of 350000 units to one
recipient inside one time window.

## 6. Base Sepolia rehearsal

The testnet registries are separate deployments at different addresses from
mainnet, so only the address changes — the call itself is identical.

Registration call (`register(agentURI)`, or the `register(agentURI, metadata)`
overload) is sent on Base Sepolia (chain id 84532) to the Identity Registry at:

```
0x8004A818BFB912233c491871b3d84c89A494BD9e
```

It mints a fresh throwaway `agentId` — the number will not be 7311, and the
rehearsal identifier is `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e/<newId>`.
For the rest of the rehearsal to be faithful, the reputation writes go to the
Base Sepolia Reputation Registry at
`0x8004B663056A597Dffe9eCcC1965A193B7388713`, and the x402 leg uses
`network: "eip155:84532"` with Base Sepolia USDC at
`0x036CbD53842c5426634e7929541eC2318f3dCF7e` — still `amount: "350000"`, since
testnet USDC also has 6 decimals.
