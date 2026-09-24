# Answers

Stack: **ERC-8004** (Trustless Agents: identity + reputation registries) for discovery/trust, **x402** (HTTP 402 payments) for paying, **EIP-3009** (signed USDC transfers) so payer needs no gas.

## 1. Discovery + trust check

- Shared, neutral directory = ERC-8004 **Identity Registry**, an onchain ERC-721 contract. Each agent = one NFT; `agentId` = token id. Nobody "runs" it, so neither side must trust the other's directory.
- Same address on every chain (deployed deterministically). On Base it is:
  **`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`**
- Lookup: call `tokenURI(7311)` (also `ownerOf(7311)`) on that contract → returns agent's registration file (JSON: name, description, `services`/endpoints incl. the x402 weather endpoint, `supportedTrust`, and a `registrations` entry pointing back to `agentId 7311` + this registry, so the file and onchain record confirm each other). Optional: `getAgentWallet(7311)` → verified payment address.
- Standing check before paying: ERC-8004 **Reputation Registry** on Base (`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`):
  - `getClients(7311)` → who gave feedback;
  - `getSummary(7311, clientAddresses, tag1, tag2)` → count + aggregate value, filtered to reviewers the payer chooses to trust (defends against fake/sybil reviews);
  - `readAllFeedback(...)` for detail. Optional Validation Registry for stronger checks (re-execution, TEE, zk) if the stakes justify it.
- Decide: pay if summary from trusted reviewers passes threshold.

## 2. Fully-qualified identifier

Format: `{namespace}:{chainId}:{identityRegistry}` + `agentId`.
- namespace `eip155` (EVM), Base chainId `8453`, registry above, token id `7311`:

**`eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:7311`**

(i.e. `agentRegistry = eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, `agentId = 7311`). The chainId in it is where the agent is registered (Base), not where the caller runs, so it is the same for every caller.

## 3. Feedback field values

Feedback = `giveFeedback(agentId, int128 value, uint8 valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`. Score = `value / 10^valueDecimals`.

| Metric | tag1 | value | valueDecimals | Check |
|---|---|---|---|---|
| Uptime 99.4% | `"uptime"` | **994** | **1** | 994 / 10¹ = 99.4 |
| Quality 73/100 | `"starred"` | **73** | **0** | 73 / 10⁰ = 73 |

Both calls use `agentId = 7311`, sent to the Base Reputation Registry. Optional: `tag2` for the period (e.g. `"30d"`), `endpoint` = the weather endpoint, `feedbackURI`/`feedbackHash` → off-chain detail file + its keccak256 hash. Caller = paying agent (not the agent's owner/operator, since agents can't rate themselves).

## 4. Amount on the wire + token

- USDC has 6 decimals → 0.35 × 10⁶ = **`350000`** (atomic units, sent as string `"350000"` in x402 `maxAmountRequired` / authorization `value`).
- Token: USDC on Base, **`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`** (network `eip155:8453` / `base`).

## 5. Paying with no ETH

- USDC supports **EIP-3009**: holder signs an off-chain EIP-712 message (`from`, `to` = weather agent's payTo, `value` = 350000, `validAfter`, `validBefore`, random 32-byte `nonce`). Signing costs no gas.
- x402 flow: GET → server replies `402` with payment requirements → payer retries with signature in `X-PAYMENT` header → server/**facilitator** verifies and submits the tx, **facilitator pays the ETH gas**.
- Function that moves the tokens: **`transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)`** on the USDC contract. Nonce + time window stop replay; only exact amount to exact recipient can move.

## 6. Base Sepolia registration address

Testnets use a separate deterministic Identity Registry address (same on all testnets). Registration (`register(agentURI)`) goes to:

**`0x8004A818BFB912233c491871b3d84c89A494BD9e`** (Base Sepolia, chainId `84532`)

Testnet Reputation Registry for rehearsing feedback: `0x8004B663056A597Dffe9eCcC1965A193B7388713`. Testnet USDC (Base Sepolia): `0x036CbD53842c5426634e7929541eC2318f3dCF7e` → rehearsal identifier `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e:<new id>`.
