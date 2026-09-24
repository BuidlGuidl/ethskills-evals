# Weather agent flow: answers

## 1. Discovery and trust check

The two agents don't need a shared directory. They both use the same public, permissionless contracts from **ERC-8004** (an onchain registry for agent identity, reputation and validation).

- **Discovery:** the paying agent looks up the agent in the ERC-8004 **IdentityRegistry**. That contract is an ERC-721 (NFT) collection, and each agent is one token. On Base it lives at
  **`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`**.
  - For agent 7311, the paying agent calls `tokenURI(7311)` / reads its `agentURI` on that contract. It can also scan the registration events, or use an index built from them.
  - That gives it the registration JSON: name, `services` endpoints (A2A/MCP/HTTP), `x402Support: true`, `active: true` and `supportedTrust`.
  - It also gets the owner address from `ownerOf(7311)`.
  - Domain check: the endpoint's domain must serve `/.well-known/agent-registration.json`. That file must contain `agentId: 7311`, the same `agentRegistry` string (see Q2) and the same owner. If it matches, the domain really belongs to this onchain identity.
- **Standing:** the paying agent then asks the ERC-8004 **ReputationRegistry** on Base (`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`):
  `getSummary(7311, trustedClients, "uptime", "30days")` and `getSummary(7311, trustedClients, "quality", ...)`.
  - Each call returns `(count, value, decimals)`, and the score is `value / 10^decimals`.
  - The agent only pays if the score is above its own threshold.
  - `trustedClients` limits the result to raters it chooses to count. Anyone can post a rating, so this filter is what blocks fake reviewers (Sybil protection).

## 2. Fully-qualified identifier

The identifier has two parts: `agentRegistry` = `eip155:{chainId}:{IdentityRegistry address}`, plus `agentId` = the ERC-721 token id.

- The agent was registered on Base, and Base's chain id is `8453`.
- A caller always uses the chain where the agent was registered, not its own chain.

```
agentRegistry = eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
agentId       = 7311
→ eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:7311
```

A caller on Arbitrum, Optimism or anywhere else still uses `eip155:8453:…`.

## 3. Feedback field values

ERC-8004 stores a rating as a signed fixed-point number: `int128 value` + `uint8 valueDecimals`, where the score is `value / 10^valueDecimals`.

| Metric | Derivation | `value` | `valueDecimals` | tag1 / tag2 |
|---|---|---|---|---|
| Uptime 99.4 % | 99.4 = 994 / 10¹ | **994** | **1** | `"uptime"` / `"30days"` |
| Quality 73/100 | 73 = 73 / 10⁰ | **73** | **0** | `"quality"` / `"30days"` |

`value=9940, valueDecimals=2` also means 99.4%. `994, 1` is the smallest exact form.

The calls:
```
giveFeedback(7311, 994, 1, "uptime",  "30days", endpoint, feedbackURI, feedbackHash)
giveFeedback(7311, 73,  0, "quality", "30days", endpoint, feedbackURI, feedbackHash)
```

## 4. Amount on the wire and token

USDC has 6 decimals, so the amount is sent in the token's smallest unit as a string:

$0.35 × 10⁶ = **`"350000"`**

- Token: native USDC on Base, **`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`**
- Network: `eip155:8453`
- Scheme: `exact`

## 5. Paying with no ETH

The payment uses the **x402** protocol (payments carried over HTTP), on top of **EIP-3009** (signed transfer authorizations, which USDC supports).

1. The client requests the forecast and gets `402 Payment Required`. The `PAYMENT-REQUIRED` header says: 350000 units of USDC on Base, sent to the weather agent's address.
2. The paying agent signs an EIP-712 typed message offline: `from`, `to`, `value=350000`, `validAfter`, `validBefore`, and a random 32-byte `nonce`. Signing costs no gas and sends no transaction.
3. It sends the request again with the signature in the `PAYMENT-SIGNATURE` header.
4. The server, or a facilitator (a helper service that submits the transaction and pays the gas), checks the signature and balance. Then it submits the transaction and pays the ETH gas on Base (about $0.001) itself.
5. The server returns `200` with the data and a `PAYMENT-RESPONSE` header that includes the transaction hash.

The function that ultimately moves the tokens is **`transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)`** on the USDC contract. USDC checks the signature from `from`, marks the nonce as used so the payment can't be replayed, and moves the 350000 units.

## 6. Base Sepolia registration target

ERC-8004 testnets use a separate deployment. The mainnet address is not used there.

- Base Sepolia chain id: `84532`
- `register(agentURI, …)` is sent to the IdentityRegistry at **`0x8004A818BFB912233c491871b3d84c89A494BD9e`**
- The matching ReputationRegistry is at `0x8004B663056A597Dffe9eCcC1965A193B7388713`
- The rehearsal agent's registry string is `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e`
