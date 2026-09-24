# Cross-chain game token design

## Recommendation

Ship the token as a Chainlink CCIP Cross-Chain Token (CCT) using burn/mint pools on Base and OP Mainnet.

That gives us one global supply, token balances live directly on both chains, an in-game transfer flow, and no game-operated relayer. The trade is that CCIP becomes part of the trust and availability surface. I would not make OP Stack native interop / SuperchainERC20 the Q4 launch path yet; I would keep it as the migration bet if Base and OP Mainnet are both in the same production interop set with stable app tooling by then.

## What we deploy

On Base:

- `GameToken`: ERC-20, same name/symbol/decimals as OP, with capped/controlled minting.
- `BurnMintTokenPool` or current CCIP CCT burn/mint pool for `GameToken`.
- `GameBridgeFacade`: a small app-owned contract the game client calls. It validates destination chain, recipient, amount, fee token, and optional destination call data, then calls CCIP.
- Optional `GameCCIPReceiver` if a transfer should do more than mint to the player's wallet, such as stake, deposit into an in-game vault, or notify game state.

On OP Mainnet:

- The same `GameToken` interface and metadata.
- Matching CCIP CCT burn/mint pool.
- Matching `GameBridgeFacade`.
- Optional `GameCCIPReceiver`.

Admin/security setup:

- Use a Safe or equivalent smart account as token owner and CCIP token administrator on each chain.
- Give mint/burn authority only to the local CCIP token pool and tightly scoped issuance/vesting contracts.
- If launch supply is split across chains, mint fixed initial allocations on Base and OP before renouncing or restricting general issuance. After that, cross-chain movement burns on the source and mints on the destination, so `supply(Base) + supply(OP)` remains constant except for explicitly governed emissions.
- Configure per-lane rate limits on both token pools. Start conservative for launch, raise only after observed volume and monitoring are healthy.

## Player move flow

Example: player moves 1,000 GAME from Base to OP Mainnet.

1. The player stays in the game UI and chooses "Move to OP".
2. The game client quotes the CCIP fee from the Base router and shows amount, destination, fee, and estimated status. The player signs an approval if needed and then one source-chain transaction to `GameBridgeFacade`.
3. `GameBridgeFacade` checks that the destination is OP's CCIP chain selector, the token is `GameToken`, the recipient is the player's OP address or game smart account, and the amount is within our limits.
4. The facade submits a CCIP token transfer. On Base, the CCT pool burns the player's 1,000 GAME.
5. Chainlink CCIP carries the message: CCIP offchain networks observe the Base event, verify it, pass through CCIP's risk controls, and execute through the OP off-ramp/router.
6. On OP Mainnet, the paired token pool mints exactly 1,000 GAME to the recipient or to `GameCCIPReceiver` if we attach a destination action.
7. The game tracks the CCIP message id and shows `pending -> delivered` in the player's inventory. The balance is spendable on OP once the destination transaction executes.

The reverse path is identical with OP as source and Base as destination.

The player never visits a bridge site. They do still submit a source-chain transaction and pay, or have sponsored, the source gas and CCIP fee. If we want gasless UX, use account abstraction/paymaster infrastructure; do not build that as a bespoke cross-chain relayer.

## Who carries the message

For the shippable path, Chainlink CCIP carries and executes the cross-chain message. Our contracts initiate and receive; our backend indexes and displays status; we do not run a relayer.

The trust model is therefore:

- We trust Base and OP Mainnet for local execution and finality.
- We trust CCIP's router/on-ramp/off-ramp contracts, token pools, offchain oracle networks, and risk management network for cross-chain delivery.
- We trust our own token admin keys only for bounded admin operations, with rate limits and emergency pause controls to reduce blast radius.

## What I would commit to for Q4

Commit:

- A production Base <-> OP Mainnet GAME token using CCIP CCT burn/mint pools.
- In-game transfer UI with no bridge-site detour.
- Message tracking in the game using the CCIP message id.
- Conservative per-lane rate limits, pause controls, monitoring, and an operator runbook for delayed or failed messages.
- A single global supply policy documented in token launch materials: global supply is the sum of canonical GAME on Base and OP, and bridging preserves that sum by burn/mint.
- Source-chain fee handling in the game. Minimum version: user pays native gas/CCIP fee. Better version: game sponsors via an external paymaster provider.

Do not commit:

- Sub-second cross-chain movement.
- Protocol-native Superchain transfers.
- Delivery with no dependency on third-party cross-chain infrastructure.
- Supporting additional chains without a new security and liquidity review.

## What would be a bet

Bet 1: OP Stack native interop / SuperchainERC20.

This is the best long-term direction if Base and OP Mainnet are in the same production interop dependency set. The model is cleaner: SuperchainERC20 burns on the source, native interop proves/validates the message, and the Superchain token bridge mints on the destination. It should be faster and more trust-minimized for Superchain chains than a general bridge.

I would not anchor Q4 launch on it because, as of this design, mainnet interop rollout is still staged and Base has publicly said it is moving away from the OP Stack distribution while maintaining compatibility. That does not kill Superchain interop, but it makes "Base + OP native interop is ready, stable, and supported for our launch window" a bet.

Bet 2: LayerZero OFT as the cross-chain standard instead of CCIP CCT.

LayerZero OFT is also a viable no-self-relayer design: OFT burns/locks on the source, LayerZero DVNs verify, the Executor delivers, and the destination OFT mints/unlocks. I would keep it as a vendor fallback if CCIP commercial/support constraints become a blocker. Switching is not free because the token contracts, admin model, fee quoting, and monitoring all change.

Bet 3: Fully gasless player bridging.

The token bridge does not require our relayer, but polished gasless UX still needs someone to pay source-chain gas and CCIP fees. We can buy this from account-abstraction/paymaster infrastructure, but Q4 should not depend on a custom sponsored-bridge stack unless it is already integrated in the game wallet.

## Assumptions that would break this design

- Base and OP Mainnet remain supported CCIP mainnet networks with an operational lane between them.
- CCIP CCT burn/mint pools remain available for self-service token deployments on both chains.
- Base and OP Mainnet remain EVM-compatible enough for the same ERC-20, Safe/admin, and game wallet tooling.
- Both chains continue to expose reliable RPC/indexing and have acceptable fees for player transfers.
- The token's legal/economic model allows canonical supply to be represented as the sum of balances across two chain deployments.
- We can grant mint/burn roles to third-party bridge pool contracts after audit/legal review.
- Base's move away from the OP Stack distribution does not remove the EVM or break standard contract behavior we rely on.
- OP Mainnet and Base do not make a breaking chain-id, finality, fee-token, or predeploy change that invalidates CCIP's deployed routers/pools or our game wallet assumptions.

## References checked

- Chainlink CCT overview: https://docs.chain.link/ccip/concepts/cross-chain-token/overview
- Chainlink CCIP Base mainnet directory: https://docs.chain.link/ccip/directory/mainnet/chain/ethereum-mainnet-base-1
- Chainlink CCIP OP mainnet directory: https://docs.chain.link/ccip/directory/mainnet/chain/ethereum-mainnet-optimism-1
- LayerZero OFT technical reference: https://docs.layerzero.network/v2/concepts/technical-reference/oft-reference
- OP Stack interop specification: https://specs.optimism.io/interop/overview.html
- OP Stack SuperchainERC20 predeploy spec: https://specs.optimism.io/interop/predeploys.html
- Optimism interop rollout notice: https://github.com/ethereum-optimism/optimism/blob/develop/docs/public-docs/notices/interop-prep.mdx
- Base unified stack roadmap: https://blog.base.dev/next-chapter-for-base-chain-1
