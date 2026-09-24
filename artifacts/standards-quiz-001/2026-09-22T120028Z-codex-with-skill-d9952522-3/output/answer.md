# Standards Quiz Answer

1. The paying agent uses ERC-8004 as the neutral onchain identity and reputation layer. For discovery on Base, it treats the weather agent as ERC-721 token/agent id `7311` in the Base Identity Registry and calls the ERC-721 URI read, `tokenURI(7311)`, to obtain the agent URI, then follows that registration data to the advertised service endpoint. The discovery contract on Base is the ERC-8004 `IdentityRegistry` at:

   `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`

   To check standing before paying, it reads ERC-8004 reputation for `agentId = 7311` from the Base `ReputationRegistry`, filtering to client/reviewer addresses it is willing to trust, for example:

   `getSummary(7311, trustedClientAddresses, "uptime", "")`

   and similarly for a quality tag. The reputation contract on Base is:

   `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

2. The cross-chain-qualified ERC-8004 reference is the chain-scoped registry plus the token id:

   `agentRegistry = "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"`

   `agentId = 7311`

   So the fully-qualified identifier is:

   `eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:7311`

3. ERC-8004 reputation values are stored as fixed point: `human value = value / 10^valueDecimals`.

   For uptime:

   `99.4 = 994 / 10^1`

   Stored fields:

   `tag1 = "uptime"`

   `value = 994`

   `valueDecimals = 1`

   For quality:

   `73 = 73 / 10^0`

   Stored fields:

   `tag1 = "starred"`

   `value = 73`

   `valueDecimals = 0`

   The feedback write is:

   `giveFeedback(7311, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`

4. USDC has 6 decimals, so the x402 amount is in USDC base units:

   `$0.35 = 0.35 USDC`

   `0.35 * 10^6 = 350000`

   The amount value on the wire is:

   `350000`

   The Base native USDC token contract is:

   `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

5. The payment is possible without ETH because native USDC supports EIP-3009. The paying agent signs an offchain USDC transfer authorization; the resource server or x402 facilitator submits the settlement transaction and pays the gas. The token-moving function is:

   `transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)`

6. On Base Sepolia, the rehearsal registration call is sent to the ERC-8004 testnet `IdentityRegistry`:

   `register(...) -> 0x8004A818BFB912233c491871b3d84c89A494BD9e`
