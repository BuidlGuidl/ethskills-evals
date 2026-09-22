# Standards Quiz Answer

1. Discovery and standing check:

   The paying agent uses ERC-8004 onchain registries as the shared trust anchor.

   Discovery is an ERC-721 identity lookup on Base:

   - Base chain id: `8453`
   - Chain namespace: `eip155`
   - Identity Registry contract: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
   - Weather agent id: `7311`
   - Discovery call: `tokenURI(7311)` on `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
   - Payment wallet lookup, if needed: `getAgentWallet(7311)` on the same contract

   Standing is checked against the ERC-8004 Reputation Registry for the same identity registry:

   - Reputation Registry contract: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
   - Summary function: `getSummary(7311, trustedClientAddresses, tag1, tag2)`
   - Direct feedback function: `readFeedback(7311, clientAddress, feedbackIndex)`

2. Fully-qualified weather-agent identifier:

   ERC-8004 identifies an agent by `(agentRegistry, agentId)`.

   - `agentRegistry = {namespace}:{chainId}:{identityRegistry}`
   - `namespace = eip155`
   - `chainId = 8453`
   - `identityRegistry = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
   - `agentId = 7311`

   Fully-qualified identifier:

   `eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:7311`

3. Stored score fields after the 30-day engagement:

   Feedback is stored with `value` as a signed fixed-point integer and `valueDecimals` as the decimal-place count.

   Uptime:

   - Human score: `99.4%`
   - Use two decimal places for percent uptime.
   - Arithmetic: `99.4 * 10^2 = 9940`
   - `tag1 = "uptime"`
   - `value = 9940`
   - `valueDecimals = 2`

   Quality:

   - Human score: `73 out of 100`
   - Whole-number 0-100 score.
   - Arithmetic: `73 * 10^0 = 73`
   - `tag1 = "starred"`
   - `value = 73`
   - `valueDecimals = 0`

   The calls are:

   - `giveFeedback(7311, 9940, 2, "uptime", "", endpoint, feedbackURI, feedbackHash)`
   - `giveFeedback(7311, 73, 0, "starred", "", endpoint, feedbackURI, feedbackHash)`

4. One-payment amount and token:

   USDC has 6 decimals.

   - Price: `$0.35`
   - Arithmetic: `0.35 * 10^6 = 350000`
   - x402 / token amount field: `"350000"`
   - Base USDC token contract: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

5. Why payment works with no ETH:

   The payment uses the x402 `exact` scheme with USDC's EIP-3009 authorization flow. The paying agent signs an offchain authorization for the exact token movement, so it does not need to submit a transaction or hold ETH for gas. A facilitator verifies the authorization, broadcasts the settlement transaction, and pays the Base gas.

   The function that ultimately moves the tokens is:

   `transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)`

   For this call, `value = 350000` and the token contract is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

6. Base Sepolia rehearsal registration address:

   The registration transaction calls `register(...)` on the Base Sepolia Identity Registry:

   `0x8004A818BFB912233c491871b3d84c89A494BD9e`
