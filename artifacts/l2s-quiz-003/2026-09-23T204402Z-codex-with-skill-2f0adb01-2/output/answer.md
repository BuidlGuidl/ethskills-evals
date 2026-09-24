# Cross-chain layer for the Q4 game token

Recommendation: ship the token as a fixed-supply burn/mint omnichain ERC-20 on Base and OP Mainnet, using a third-party message/execution network for delivery. I would use LayerZero V2 OFT for the Q4 plan unless security/procurement has a stronger existing preference for Wormhole NTT. Do not make native OP Superchain interop the launch dependency for Base <-> OP Mainnet.

## What we deploy

On Base:

- `GAME`, an ERC-20 with permit support and the LayerZero OFT send/receive module.
- Mint authority locked down so normal minting is disabled after genesis. The only cross-chain supply movement is burn on source, mint on destination.
- Per-route config for Base -> OP Mainnet: selected DVN quorum, executor config, gas limit, enforced options, rate limits, and pause switch.
- A game-facing `TokenTravel` wrapper only if we want a cleaner ABI for the client. It should call the OFT send path, not custody funds.

On OP Mainnet:

- The same `GAME` implementation/config, ideally deployed with CREATE2 for the same address if practical, though OFT does not require same-address tokens the way SuperchainERC20 does.
- Per-route config for OP Mainnet -> Base.
- The same pause/rate-limit/admin model.

Admin/control plane:

- A Safe, preferably with a short timelock for config changes after launch.
- Separate emergency pause authority for bridge routes only.
- Daily/epoch transfer caps per direction.
- Monitoring that checks `totalSupply(Base) + totalSupply(OP Mainnet) == fixed supply`, message backlog, failed receives, executor delays, DVN status, and route cap usage.

Supply model:

- Pre-mint the full game-token supply once, either on the launch chain treasury or split between chain treasuries at genesis.
- Do not run inflationary mints independently on both chains in Q4. If rewards must be paid on both chains, fund reward distributor contracts from treasury balances on those chains. That keeps "one supply" real instead of relying on cross-chain accounting.

## What happens when a player moves balance

1. In the game UI, the player chooses source chain, destination chain, amount, and recipient address. The game quotes the message fee and destination execution fee through the provider/API.
2. The player signs one source-chain transaction from inside the game. If the token uses permit, the approval can be folded into the flow.
3. The source-chain token/OFT debits the player and burns the amount, then sends a cross-chain message through the LayerZero endpoint for the destination chain.
4. LayerZero DVNs observe and verify the source-chain message according to our configured quorum.
5. A LayerZero Executor submits the destination-chain transaction and calls the destination OFT receive function.
6. The destination contract mints the same amount to the player on the destination chain.
7. The game indexer marks the transfer as pending after source burn, delivered after destination mint, and recoverable/retryable if destination execution fails.

Who carries the message: LayerZero infrastructure, not us. DVNs verify the message, and the Executor pays/submits the destination transaction using the fee the player paid on the source chain. If the executor stalls, the message should remain retryable; if the verification layer is down, transfers pause or wait.

## What we can commit to shipping in Q4

We can commit to:

- Base + OP Mainnet ERC-20 deployments with one global supply and identical token semantics.
- In-game transfer UX with no bridge-site detour.
- Source-chain burn and destination-chain mint through a production cross-chain messaging provider.
- No company-run relayer for the happy path.
- Directional transfer caps, route pause, replay protection through the messaging layer, and supply invariant monitoring.
- A recovery runbook for failed destination execution, paused routes, and provider incidents.

This is a shippable Q4 scope because it uses already deployed Base/OP Mainnet EVM infrastructure and an existing message/executor network. It does introduce third-party bridge/messaging risk, so I would cap route volume at launch and increase caps only after observed stability.

## What would be a bet

Native Superchain interop for Base <-> OP Mainnet would be the elegant end-state, but I would treat it as a bet for this launch. The OP Stack interop spec has the right primitive: `SuperchainERC20` implements ERC-7802, `SuperchainTokenBridge.sendERC20` burns on the source chain, and `relayERC20` mints on the destination chain via the L2-to-L2 messenger. That gives the cleanest no-custom-relayer story when both chains are in the same interop dependency set.

The problem is the Base assumption. As of September 23, 2026, I would not assume Base and OP Mainnet are in the same native interop set merely because both descend from the OP Stack. Public OP rollout notes described mainnet interop beginning with OP Mainnet and Unichain, while other OP Stack chains join only when they move into an interop dependency set. Base has also announced a Base-operated stack direction. So native SuperchainERC20 should be an upgrade path, not the Q4 launch plan.

Other bets I would avoid for Q4:

- Building our own relayer network.
- Designing a custom bridge contract around generic message passing.
- Letting independent game minters on both chains expand supply under a shared cap.
- Promising instant finality. Cross-chain delivery can feel fast, but final settlement and provider confirmation policies are not the same thing.

## Assumptions this design depends on

- Base mainnet remains chain ID `8453` and OP Mainnet remains chain ID `10`, both EVM-compatible enough for normal ERC-20/OFT contracts.
- LayerZero V2, or the chosen equivalent, continues to support both Base and OP Mainnet with production endpoints, DVNs, and executor delivery.
- The provider's verification/execution network remains economically available for the transfer sizes players use.
- We can configure our own security stack, route caps, and pause controls, and those settings cannot be changed except by our Safe/timelock.
- Destination execution can be retried if underfunded or temporarily failing.
- The game can tolerate pending transfers during provider/chain congestion.
- We are comfortable with the provider trust model. A native OP interop path would have different trust assumptions, but it is not what I would anchor Q4 on for Base <-> OP Mainnet.

This design breaks or needs replacement if Base and OP Mainnet stop being EVM-compatible, if the messaging provider drops either chain or its executor path, if our token needs trust-minimized movement with no third-party verifier, or if native Superchain interop becomes mandatory for ecosystem/liquidity reasons before Base is actually in the relevant dependency set.

## Sources checked

- OP Stack interop overview: https://specs.optimism.io/interop/overview.html
- OP Stack token bridging / SuperchainERC20 spec: https://specs.optimism.io/interop/token-bridging.html
- OP interop rollout notice: https://github.com/ethereum-optimism/optimism/blob/develop/docs/public-docs/notices/interop-prep.mdx
- LayerZero OFT architecture: https://docs.layerzero.network/v2/developers/evm/stablecoin-oft/architecture
- LayerZero value-transfer design notes: https://docs.layerzero.network/v2/concepts/value-transfer-implementations
