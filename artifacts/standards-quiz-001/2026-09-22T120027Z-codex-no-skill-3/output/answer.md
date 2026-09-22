1. The paying agent uses the shared onchain ERC-8004 registries instead of a
   directory controlled by either party. The weather agent is on Base, so the
   discovery lookup is against the Base ERC-8004 Identity Registry:

   - Base chain id: `8453`
   - ERC-8004 Identity Registry on Base:
     `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
   - Weather agent id: `7311`
   - Discovery call: `tokenURI(7311)` on
     `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`

   That resolves the registration data for the agent and its advertised
   service/payment endpoints. Before paying, the caller checks public trust
   signals for the same `agentId` in the ERC-8004 Reputation Registry on Base:

   - ERC-8004 Reputation Registry on Base:
     `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
   - Standing/read functions: for example
     `getSummary(7311, clientAddresses, tag1, tag2)`,
     `readFeedback(7311, clientAddress, feedbackIndex)`, or
     `readAllFeedback(7311, clientAddresses, tag1, tag2, false)`

2. The cross-chain identifier is the ERC-8004 `agentRegistry` plus the
   registry-local `agentId`:

   - `agentRegistry = "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"`
   - `agentId = 7311`

   Fully qualified as a pair:

   ```json
   {
     "agentRegistry": "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
     "agentId": 7311
   }
   ```

3. ERC-8004 feedback stores decimal quantities as `value` plus
   `valueDecimals`.

   For 99.4% uptime:

   - Standard tag: `tag1 = "uptime"`
   - Two decimal places are used for uptime percentages.
   - `99.4% = 99.40`
   - `99.40 * 10^2 = 9940`
   - Stored fields: `value = 9940`, `valueDecimals = 2`

   For a quality score of 73 out of 100:

   - Standard tag: `tag1 = "starred"`
   - Whole-number score, so zero decimal places.
   - `73 * 10^0 = 73`
   - Stored fields: `value = 73`, `valueDecimals = 0`

   The rating calls are therefore:

   ```solidity
   giveFeedback(7311, 9940, 2, "uptime", "", endpoint, feedbackURI, feedbackHash)
   giveFeedback(7311, 73, 0, "starred", "", endpoint, feedbackURI, feedbackHash)
   ```

4. The payment is made in native USDC on Base:

   - Token contract:
     `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
   - USDC decimals: `6`
   - Price: `$0.35 = 0.35 USDC`
   - Atomic amount: `0.35 * 10^6 = 350000`

   The x402 exact payment therefore carries:

   ```json
   {
     "network": "eip155:8453",
     "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
     "amount": "350000"
   }
   ```

   In the signed EIP-3009 authorization, the token-transfer value is also
   `"350000"`.

5. The paying agent can pay without ETH because x402 exact payments on EVM use
   a signed token authorization. The payer signs the USDC authorization
   offchain; a facilitator or the resource server submits the transaction and
   pays the Base gas. The signed authorization fixes the payer, recipient,
   amount, validity window, nonce, token contract, and chain, so the submitter
   cannot change the payment.

   The token-moving function is:

   ```solidity
   transferWithAuthorization(
     from,
     to,
     value,
     validAfter,
     validBefore,
     nonce,
     v,
     r,
     s
   )
   ```

   For this call, `value = 350000` and the contract called is Base USDC at
   `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

6. On Base Sepolia, the registration call is sent to the ERC-8004 Identity
   Registry for that network:

   - Base Sepolia chain id: `84532`
   - Function: `register(...)`
   - Contract:
     `0x8004A818BFB912233c491871b3d84c89A494BD9e`
