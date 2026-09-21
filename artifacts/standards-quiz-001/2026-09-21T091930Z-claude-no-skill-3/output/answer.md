# Agent-to-agent paid forecast: ERC-8004 + x402 on Base

The stack:
- **ERC-8004 (Trustless Agents)** handles identity, discovery and reputation.
- **x402** with the `exact` scheme handles HTTP 402 payments.
- **EIP-3009** lets someone else submit a signed USDC transfer and pay the gas.

## 1. Discovery and trust check

Neither side has to trust a directory the other runs. Both use the ERC-8004 registries, which are the same singleton contracts on every chain (deployed with CREATE2 to the same vanity `0x8004…` addresses).

- **Identity Registry**: an ERC-721 contract with the URI-storage extension. Each agent is one NFT, and `agentId` is its tokenId.
  - Base mainnet address the lookup calls: **`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`**
  - The payer calls `tokenURI(7311)`, which returns the agent's registration file (JSON). That file lists the agent's name, description, and services/endpoints (the weather HTTP endpoint that answers with 402, plus any MCP/A2A endpoints). It also lists `x402Support` and the trust models it supports.
  - `ownerOf(7311)` and `getAgentWallet(7311)` return the owner and the payout wallet. Optionally, the payer checks that the endpoint's domain serves `/.well-known/agent-registration.json` pointing back to `agentId` 7311. That proves the domain and the onchain identity belong together.
- **Reputation Registry** (Base: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`): the payer calls `getSummary(7311, clientAddresses, tag1, tag2)`, which returns `(count, summaryValue, summaryValueDecimals)`, and/or `readAllFeedback(...)`.
  - It passes a list of reviewer addresses it already trusts. That filter is how it defends against fake reviews from throwaway accounts (Sybil attacks).
- **Optional**: the Validation Registry can hold independent re-checks of the agent's work: stake-backed re-execution, zkML proofs, or TEE attestations (proof from secure hardware).

## 2. Global identifier

The format is `{namespace}:{chainId}:{identityRegistry}` followed by the `agentId`. Here the namespace is `eip155` (EVM chains), Base's chainId is `8453`, and the registry is the address above.

- agentRegistry = `eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- agentId = `7311`

Fully qualified: **`eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:7311`**

This stays the same no matter which chain the caller runs on, because the chainId is part of the identifier.

## 3. Feedback encoding

The call is `giveFeedback(agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)`. The real score is `value / 10^valueDecimals`.

- **Uptime 99.4%**: 99.4 = 994 / 10¹, so **`value = 994`, `valueDecimals = 1`**, `tag1 = "uptime"`. Writing `9940` with decimals `2` gives the same number.
- **Quality 73/100**: this is an integer on a 0–100 scale, so **`value = 73`, `valueDecimals = 0`**, `tag1 = "starred"`.
- Both are separate `giveFeedback(7311, …)` calls sent to the Reputation Registry. `tag2` can record the period, for example `"month"` for the 30-day engagement.

## 4. Amount on the wire

USDC has 6 decimals, so 0.35 × 10⁶ = **`350000`**. x402 sends this as the string `"350000"` in `amount`/`maxAmountRequired`, in base units.

Token (`asset`): USDC on Base (chainId 8453), **`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`**.

## 5. Paying without ETH

The x402 `exact` scheme on EVM uses **EIP-3009**:

1. The payer signs an EIP-712 `TransferWithAuthorization` message offchain. The message holds from, to = the weather agent's wallet, value = 350000, validAfter, validBefore, and a random 32-byte nonce.
2. The payer sends the signed message in the `X-PAYMENT` header. Signing costs no gas.
3. The server hands it to an x402 **facilitator** (a service that submits payments onchain). The facilitator verifies it, then sends the transaction and pays the ETH gas itself.

The function that moves the tokens is **`transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)`** on the USDC contract. USDC checks the signature, marks the nonce as used so the same payment can't be replayed, and moves 350000 units from payer to payee. The payer's wallet only ever needs USDC.

## 6. Base Sepolia rehearsal

ERC-8004 testnet deployments share one set of vanity addresses. On Base Sepolia (chainId 84532), `register(agentURI)` goes to the Identity Registry at:

**`0x8004A818BFB912233c491871b3d84c89A494BD9e`**

- Testnet Reputation Registry: `0x8004B663056A597Dffe9eCcC1965A193B7388713`.
- Test token: Base Sepolia USDC, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- The throwaway agent's identifier becomes `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e:<newId>`.
