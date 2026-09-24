1. Use ERC-8004. The weather agent is on Base, so discovery starts from the Base IdentityRegistry:

   `tokenURI(7311)` on `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`

   That resolves the agent registration data for agent id `7311`, including its advertised services and payment support. Before paying, the caller checks reputation on the Base ReputationRegistry:

   `getSummary(7311, trustedClientAddresses, tag1, tag2)` on `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

   The important trust derivation is that the caller supplies `trustedClientAddresses`; an unfiltered reputation total is not enough because strangers can create feedback too.

2. The fully-qualified ERC-8004 reference is the chain-scoped registry plus the registry-assigned token id:

   `agentRegistry = "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"`

   `agentId = 7311`

   The caller's own chain does not change this identifier, because the weather agent was registered on Base, whose EVM chain id is `8453`.

3. ERC-8004 reputation values are fixed point:

   `stored score = value / 10^valueDecimals`

   For 99.4% uptime:

   `99.4 = 994 / 10^1`, so the score fields are `value = 994` and `valueDecimals = 1`.

   For quality 73 out of 100:

   `73 = 73 / 10^0`, so the score fields are `value = 73` and `valueDecimals = 0`.

   Each score is posted by the paying agent with:

   `giveFeedback(7311, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`

4. USDC uses 6 decimals, so the x402 payment amount is in USDC base units:

   `$0.35 * 10^6 = 0.35 * 1,000,000 = 350,000`

   The amount value on the wire is:

   `350000`

   On Base it is paid in native USDC:

   `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

5. The payment still works with no ETH because the payer signs an EIP-3009 USDC authorization offchain. In the x402 flow, that signed authorization is carried with the HTTP payment retry, and the server or facilitator submits the transaction and pays the gas.

   The token-moving function is:

   `transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)`

   For this call, `value = 350000`.

6. On Base Sepolia, the registration rehearsal is sent to the testnet ERC-8004 IdentityRegistry. The registration function is:

   `register(...)`

   The exact contract address is:

   `0x8004A818BFB912233c491871b3d84c89A494BD9e`
