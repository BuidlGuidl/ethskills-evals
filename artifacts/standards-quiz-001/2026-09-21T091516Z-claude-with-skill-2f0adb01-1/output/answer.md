# Answers

## 1. Discovery + trust check

Infrastructure: **ERC-8004** (onchain agent identity/reputation registries). Neither side runs a directory — the shared, permissionless registry contract is the directory.

- **Discover:** lookup goes to the ERC-8004 **IdentityRegistry** on Base:
  `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
  - Agent 7311 is ERC-721 tokenId `7311`. `tokenURI(7311)` / agentURI → registration JSON (name, services/endpoints, `x402Support: true`, `supportedTrust`). `ownerOf(7311)` → controlling wallet.
  - Scanning for "weather" agents in bulk = read registry `Registered` events (or an indexer such as a The Graph subgraph over those events); the source of truth is still that contract.
  - Endpoint check: fetch `https://<endpoint-domain>/.well-known/agent-registration.json`, confirm `agentId = 7311`, `agentRegistry = eip155:8453:0x8004A169…a432`, and owner match → domain really controls the identity.
- **Standing:** ERC-8004 **ReputationRegistry** on Base, `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`:
  `getSummary(7311, trustedClients, "uptime", "30days")` and `getSummary(7311, trustedClients, "quality", …)` → `(count, value, decimals)`; score = `value / 10^decimals`. Filter by `trustedClients` (client address list) to resist Sybil feedback. Pay only if above threshold.

## 2. Fully-qualified identifier

Chain id Base = `8453`, namespace `eip155` (CAIP-2), registry = IdentityRegistry address, agent = tokenId.

- `agentRegistry` = `eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- `agentId` = `7311`

Combined: **`eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` + agentId `7311`** (i.e. `eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:7311`). Chain id pins it to Base, so a caller on Arbitrum, Optimism, etc. uses the same string — not its own chain id.

## 3. Feedback values

Feedback = signed fixed-point: `int128 value` + `uint8 valueDecimals`, real = `value / 10^valueDecimals`.

- Uptime 99.4% → 99.4 = 994 / 10^1 → **`value = 994`, `valueDecimals = 1`** (tag1 `"uptime"`, tag2 `"30days"`). (Equivalent 2-dp form: 9940 / 10^2.)
- Quality 73/100 → 73 / 10^0 → **`value = 73`, `valueDecimals = 0`** (tag1 `"quality"`).

Call: `giveFeedback(7311, 994, 1, "uptime", "30days", endpoint, uri, hash)` and `giveFeedback(7311, 73, 0, "quality", "30days", endpoint, uri, hash)` on ReputationRegistry `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`.

## 4. Wire amount + token

USDC has 6 decimals: 0.35 × 10^6 = **`"350000"`** (base units, string).

Token: USDC on Base, **`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`**, network `eip155:8453`, scheme `exact`.

## 5. Paying with no ETH

x402 flow: request → `402 Payment Required` (PAYMENT-REQUIRED header: amount 350000, USDC, payTo) → payer **signs off-chain** an **EIP-3009** authorization (EIP-712 typed data: from, to, value=350000, validAfter, validBefore, nonce). Signing costs no gas. Payer resends request with PAYMENT-SIGNATURE header. The server (or its facilitator) verifies and submits the onchain tx, paying Base gas itself (~fraction of a cent). USDC contract checks signature + unused nonce and moves funds from payer to payee.

Function that moves tokens: **`transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)`** on the USDC contract (EIP-3009).

## 6. Base Sepolia registration target

Testnet registries use a separate deployment from mainnet (mainnet `0x8004A169…a432` does not apply). Registration `register(agentURI, …)` goes to the Base Sepolia (chain id `84532`) IdentityRegistry:

**`0x8004A818BFB912233c491871b3d84c89A494BD9e`**

(Testnet ReputationRegistry for the rehearsal's feedback: `0x8004B663056A597Dffe9eCcC1965A193B7388713`; test agent id = `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e` + its tokenId.)
