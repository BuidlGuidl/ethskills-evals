# Answers

Stack: **ERC-8004 (Trustless Agents)** handles identity and reputation. **x402** handles payment over HTTP 402, and **EIP-3009** makes the payment gasless.

---

## 1. Discovery and trust check

Neither agent needs a directory the other already trusts. The shared, neutral directory is the **ERC-8004 Identity Registry**. It is an ERC-721 contract, and every agent in it is an NFT whose `tokenId` is the `agentId`. It uses the same vanity address on every mainnet chain, including Base (chainId 8453):

**Identity Registry (Base mainnet): `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`**

Steps:
1. Call `tokenURI(7311)` on `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`. This returns the agent's registration file URI (`ipfs://…`, `https://…`, or a `data:` URI).
2. Fetch that JSON (`type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1"`). Read `services`/`endpoints` (the weather API URL, A2A/MCP, wallet), `x402Support: true`, `supportedTrust` (e.g. `"reputation"`), and `registrations[]`. The `registrations[]` entry must contain `{agentId: 7311, agentRegistry: "eip155:8453:0x8004A169…a432"}`. That closes the loop between the file and the onchain record.
3. Optional: confirm who controls the agent with `ownerOf(7311)` and `getAgentWallet(7311)`, which returns the verified payment wallet.
4. Check the agent's standing in the **ERC-8004 Reputation Registry** on Base at `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`:
   - `getClients(7311)` lists the addresses that have left feedback.
   - `getSummary(7311, clientAddresses, tag1, tag2)` returns `(count, summaryValue, summaryValueDecimals)`. Pass a non-empty `clientAddresses` list of reviewers the payer chooses to trust. This filters out Sybil spam (fake reviewers created to pump a score).
   - `readAllFeedback(...)` returns the individual entries.
5. Decide whether to pay based on that summary. If the stakes were higher, the payer could also require validator attestations from the Validation Registry.

## 2. Fully-qualified identifier

The ERC-8004 global identity is the pair `agentRegistry` + `agentId`, where `agentRegistry = {namespace}:{chainId}:{identityRegistryAddress}` (a CAIP-10-style string):

- `agentRegistry` = `eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- `agentId` = `7311`

Written together: **`eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` / agentId `7311`**

The identifier always uses chain `8453` (Base), because Base is where the agent is registered. It does not change with the caller's chain.

## 3. Stored feedback values

Feedback is recorded with `giveFeedback(agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)`. Each score is a fixed-point number: `value / 10^valueDecimals`.

| Score | Derivation | `value` | `valueDecimals` | `tag1` |
|---|---|---|---|---|
| Uptime 99.4 % | 99.4 = 994 / 10¹ | **994** | **1** | `uptime` |
| Quality 73/100 | 73 = 73 / 10⁰ | **73** | **0** | `starred` |

Both calls use `agentId = 7311`. Each score goes in a separate `giveFeedback` call. The optional `tag2` can mark the period (e.g. `30d`).

## 4. Wire amount and token

USDC has 6 decimals, so the amount in base units is:

0.35 × 10⁶ = **`350000`**

In the x402 `PaymentRequirements`, `maxAmountRequired` / `amount` is the string `"350000"`, with `network: "base"` (`eip155:8453`) and `asset`:

**USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`**

## 5. Paying with no ETH

USDC implements **EIP-3009**. The paying agent never sends a transaction. It only **signs an EIP-712 message offchain**: `TransferWithAuthorization{from, to, value: 350000, validAfter, validBefore, nonce}`. The signature goes in the `X-PAYMENT` header when the agent retries the HTTP request.

The resource server hands the signed payload to an **x402 facilitator**. The facilitator verifies it and then submits the onchain transaction, so the **facilitator pays the Base gas**, not the payer.

The function that moves the tokens is **`transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)`** on the USDC contract. The random 32-byte `nonce` and the validity window block replay.

## 6. Base Sepolia registration target

The ERC-8004 testnet deployments share a separate vanity address. The registration call (`register(agentURI)`) on Base Sepolia (chainId 84532) goes to:

**Identity Registry (Base Sepolia): `0x8004A818BFB912233c491871b3d84c89A494BD9e`**

This is different from the mainnet address `0x8004A169…a432`. The throwaway agent's identifier is therefore `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e` / its new agentId. The Reputation Registry on testnets is at `0x8004B663056A597Dffe9eCcC1965A193B7388713`.
