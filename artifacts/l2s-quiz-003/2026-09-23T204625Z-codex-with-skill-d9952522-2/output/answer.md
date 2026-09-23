# Cross-chain token layer for Base and OP Mainnet

Use a burn/mint omnichain token design, not a liquidity bridge and not the OP/Superchain native token path.

For Q4, I would ship this on LayerZero V2 OFT:

- Deploy `GameTokenOFT` on Base Mainnet and OP Mainnet.
- Configure each token contract as the trusted peer of the other.
- Give mint authority only to the OFT receive path, plus a launch/admin Safe for the initial allocation period.
- Put the admin Safe behind pause, per-transfer caps, daily caps, and LayerZero config ownership.
- After launch allocation, either remove general mint authority entirely or constrain it to a fixed vesting/distribution contract so the cross-chain invariant stays simple.

The supply invariant is:

`total supply on Base + total supply on OP Mainnet + in-flight burned messages = fixed game token supply`

For a new token, do not independently mint "the same token" on both chains and hope accounting stays aligned. Mint the initial supply once, or mint split allocations through a supply controller that enforces the global cap. After that, movement between chains is burn on source and mint on destination.

## What we deploy

On Base:

- `GameTokenOFT`, an ERC-20 + LayerZero OFT implementation.
- LayerZero peer config pointing only to the OP Mainnet token contract.
- Rate limits and emergency pause controlled by the game treasury/security Safe.
- Optional game-side `BridgeRouter` wrapper if we want a stable app ABI and room to swap providers later.

On OP Mainnet:

- The same `GameTokenOFT` implementation.
- LayerZero peer config pointing only to the Base token contract.
- The same caps, pause controls, and Safe ownership pattern.
- Optional matching `BridgeRouter`.

In the game client/backend:

- A chain selector for Base and OP Mainnet.
- Balance reads from both chains.
- A "move balance" flow that calls the source-chain token/router directly from inside the game.
- Pending transfer state keyed by the LayerZero message id / emitted events.
- Destination balance refresh once the receive event lands.

## Player transfer flow

Example: player moves 1,000 GAME from Base to OP Mainnet.

1. The game asks the Base token contract for a fee quote for a Base -> OP Mainnet OFT send.
2. The player submits one transaction from the game UI on Base, paying Base gas plus the LayerZero message/execution fee.
3. The Base `GameTokenOFT` debits the player and burns 1,000 GAME.
4. The Base LayerZero endpoint emits the cross-chain message.
5. The configured LayerZero DVNs verify the source-chain message.
6. A LayerZero executor submits the verified message to the OP Mainnet endpoint.
7. The OP Mainnet `GameTokenOFT` accepts the message only from its configured Base peer and mints 1,000 GAME to the player's OP Mainnet address.
8. The game marks the transfer complete and updates balances.

The reverse path is identical: OP Mainnet burns, Base mints.

If destination execution fails because the gas option was too low, the message is not "lost"; it becomes a retry/recovery case. The game should surface that as pending/retryable, and our ops runbook should include executor retry instructions.

## Who carries the message

LayerZero carries it. More precisely:

- The source token calls the local LayerZero endpoint.
- The configured DVNs attest to the cross-chain message.
- The executor delivers the verified packet to the destination chain.
- Our contracts decide whether to accept the packet by checking endpoint, source endpoint id, trusted peer, nonce/path, and payload format.

We do not run our own relayer for the core bridge path. We are trusting LayerZero's configured security stack and executor liveness, not Ethereum-native canonical bridge finality.

Chainlink CCIP could satisfy the same product shape with a CCT/burn-mint token pool model, and it is a reasonable fallback if procurement, security review, or fees point that way. I would still keep the game integration behind a small bridge adapter so the game does not care whether the implementation is LayerZero or CCIP.

## What we can commit to for Q4

We can commit to:

- A single GAME supply live on Base Mainnet and OP Mainnet.
- In-game transfers between Base and OP Mainnet without sending players to a separate bridge website.
- No self-operated relayer for normal transfers.
- Burn/mint accounting rather than wrapped IOUs or AMM liquidity.
- A pending-transfer UI with source tx, destination status, and retryable failure handling.
- A security envelope with peer allowlists, DVN/executor config owned by Safe, rate limits, pause, monitoring, and tests for cross-chain supply conservation.

This is shippable because Base and OP Mainnet are EVM chains today, and production cross-chain messaging providers already support both.

## What would be a bet

Do not commit Q4 launch to native Superchain interop.

That would mean betting on production-ready OP/Mainnet-to-Base native L2-to-L2 messaging and a live token standard that both chains share. That is not the right dependency for this product: Base is now on its own Base stack cadence, and the Superchain token/messenger path is not something I would treat as a Q4 launch primitive for Base <-> OP Mainnet.

Also treat these as bets, not commitments:

- Fully gasless bridging from both chains unless we choose and integrate an account-abstraction/paymaster provider. The bridge avoids an external website, but the source transaction still needs gas and message fees.
- Instant destination credit. We can make the UX feel smooth, but final credit arrives when the message is verified and executed. Instant credit would require us or a third party to front liquidity/risk.
- Provider portability without extra audit work. A bridge adapter helps, but replacing LayerZero with CCIP or another network changes trust assumptions and contract code.
- Future native Base/OP interop replacing the OFT path. Worth watching, not worth blocking launch on.

## Assumptions that would break this design

This design assumes:

- Base Mainnet remains chain id `8453`, OP Mainnet remains chain id `10`, and both remain EVM-compatible enough for the same ERC-20/OFT contract family.
- Both chains continue to support normal contract deployment, public event indexing, and ETH-paid transactions.
- LayerZero V2 endpoints, DVNs, and executors continue to support Base Mainnet and OP Mainnet in both directions.
- The LayerZero route has acceptable uptime, latency, fee levels, and message limits for our transfer sizes.
- We are comfortable with LayerZero's trust model: configured DVNs plus endpoint/executor liveness, rather than canonical L1 bridge security only.
- Base and OP Mainnet do not introduce chain-level changes that prevent third-party messaging endpoints from verifying or executing messages.
- The game token does not require synchronous cross-chain composability. A move is an asynchronous burn/message/mint flow.

If any of those stop holding, the fallback is either a different production messaging network such as CCIP, or a canonical L1 route. The canonical route is slower and worse for game UX, so it is a contingency, not the launch design.

## Sources checked

- Base chain id docs: https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId
- Base Azul / Base stack upgrade: https://blog.base.dev/introducing-base-azul
- LayerZero OFT reference: https://docs.layerzero.network/v2/concepts/technical-reference/oft-reference
- LayerZero asset issuance overview: https://docs.layerzero.network/crosschain/issue-asset/overview
- LayerZero Optimism deployment docs: https://docs.layerzero.network/v2/deployments/chains/optimism
- Chainlink CCIP CCT docs: https://docs.chain.link/ccip/concepts/cross-chain-token
