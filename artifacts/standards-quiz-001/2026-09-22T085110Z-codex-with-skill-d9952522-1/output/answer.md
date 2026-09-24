# Standards Quiz Answer

1. The paying agent uses ERC-8004 as the shared onchain root of discovery and reputation.

   Discovery:

   - Base chain id: `8453`
   - Weather agent id: `7311`
   - Discovery registry: ERC-8004 `IdentityRegistry`
   - Contract called on Base: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
   - Lookup function: `tokenURI(7311)`

   The `tokenURI(7311)` result gives the registration metadata and advertised services. If an advertised API endpoint is on a different domain than the registration URI, the caller checks that endpoint domain's well-known registration document for the same `agentRegistry` and `agentId` before treating the endpoint as bound to agent `7311`.

   Standing before payment:

   - Reputation registry: ERC-8004 `ReputationRegistry`
   - Contract called on Base: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
   - Read function: `getSummary(7311, clientAddresses, tag1, tag2)`

   The caller supplies the `clientAddresses` it trusts, because unfiltered reputation totals can be Sybil-inflated.

2. The weather agent's fully-qualified ERC-8004 registration is:

   - `agentRegistry = "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"`
   - `agentId = 7311`

   As a single identifier string, that is:

   `eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:7311`

3. The feedback is written with `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`.

   Uptime:

   - Recorded uptime: `99.4%`
   - Fixed-point derivation: `99.4 * 10^1 = 994`
   - Stored score fields: `value = 994`, `valueDecimals = 1`
   - Function shape: `giveFeedback(7311, 994, 1, tag1, tag2, endpoint, feedbackURI, feedbackHash)`

   Quality:

   - Recorded quality: `73 / 100`
   - Integer derivation: `73 * 10^0 = 73`
   - Stored score fields: `value = 73`, `valueDecimals = 0`
   - Function shape: `giveFeedback(7311, 73, 0, tag1, tag2, endpoint, feedbackURI, feedbackHash)`

4. USDC uses 6 decimals, so the x402 amount is sent in USDC base units:

   - Dollar price: `$0.35`
   - Decimal scaling: `0.35 * 10^6`
   - Wire amount: `350000`
   - Base native USDC token contract: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

5. The payment works even though the paying agent has no ETH because Base USDC supports EIP-3009 authorization-based transfers.

   The paying agent signs an offchain authorization for the USDC transfer. The x402 server or facilitator submits the settlement transaction and pays the gas. The token movement itself is ultimately performed by:

   `transferWithAuthorization(...)`

6. On Base Sepolia, the throwaway agent registration call is sent to the ERC-8004 testnet `IdentityRegistry`:

   - Network: Base Sepolia, `eip155:84532`
   - Registration function: `register(...)`
   - Contract address: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
