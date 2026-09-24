# Cross-chain layer for the game token

## Recommendation

Ship the token as a burn/mint cross-chain token on Base and OP Mainnet using a production cross-chain messaging provider for Q4, and make the token Superchain-ready so we can switch the transfer route to native OP interop once Base and OP Mainnet are in the same live interop dependency set.

My default Q4 provider choice is Chainlink CCIP CCT. The reason is not that it is philosophically perfect; it is that it gives us the thing the product needs: the player starts the move inside the game, the source-chain balance is burned/locked, the destination-chain balance is minted/released, and Chainlink's network carries and executes the message. We do not run a bridge UI and we do not run the relayer.

LayerZero OFT or Wormhole NTT are viable alternates with similar product shape. I would keep the app contract behind a small `BridgeAdapter` interface so the game code is not married to one bridge forever.

## What we deploy on each chain

On both Base and OP Mainnet:

1. `GameToken`
   - ERC-20 with `permit`.
   - Same name, symbol, decimals, and preferably the same address on both chains via CREATE2.
   - Hard cap or explicit supply accounting so `totalSupply(Base) + totalSupply(OP)` is the real circulating supply.
   - Mint/burn roles limited to approved bridge components and controlled by a Safe plus timelock.
   - Implement `IERC7802` / `crosschainMint` / `crosschainBurn` from day one, even if Q4 uses CCIP. That keeps the token compatible with SuperchainERC20-style movement later.

2. Provider token pool / manager
   - For CCIP CCT this is a Burn/Mint token pool on both chains.
   - Configure only the Base <-> OP Mainnet lane.
   - Set conservative per-lane rate limits and daily caps.
   - Give the pool only the minimum token burn/mint authority it needs.

3. `GameBridgeAdapter`
   - A tiny app-facing router used by the game client.
   - Functions like `quoteMove(destinationChain, amount)` and `move(destinationChain, recipient, amount, feeToken)`.
   - Pulls tokens from the player, pays/forwards the CCIP fee, calls the provider router, and emits our own `MoveStarted` event.
   - Allowlists destination chain selectors and destination receivers.
   - Has pause switches per direction: Base -> OP and OP -> Base.

4. Optional `GameBridgeReceiver`
   - Only needed if a transfer should also call game logic on arrival, for example auto-staking or depositing into an inventory contract.
   - For the basic "move my token balance" flow, minting directly to the player's address is cleaner.

5. Indexing and UX
   - The game client shows balances on both chains and a "move" control.
   - After the source transaction lands, we track provider message ID plus `MoveStarted`, provider delivery, and destination token mint events.
   - The player never leaves the game. They may need source-chain gas unless we add account abstraction/paymaster support.

## Player move flow

For Base -> OP Mainnet, OP -> Base is symmetric:

1. Player opens the in-game move panel and chooses amount and destination.
2. Client quotes the cross-chain fee from `GameBridgeAdapter` / provider SDK.
3. Player signs a permit plus the source-chain transaction.
4. `GameBridgeAdapter` calls the provider router/token pool.
5. The source-chain pool burns the player's tokens, or the adapter transfers tokens to the pool and the pool burns them.
6. The provider's offchain network observes the source event, reaches consensus, commits the message on the destination chain, and executes it.
7. The destination-chain pool mints the same amount of `GameToken` to the player.
8. The game UI marks the move complete once the destination mint is indexed.

The invariant is simple: a finalized move mints exactly what was burned. An in-flight move temporarily reduces visible circulating supply by the burned amount until the destination mint completes.

## Who carries the message

For the Q4 path, Chainlink CCIP carries it. In CCIP v1.6, the Role DON runs commit and execution OCR plugins: the commit side coordinates source-chain observations into merkle roots, and the execution side validates source events and executes messages on the destination chain. That is the relayer/executor we are paying for through the CCIP fee.

We do not run custom relayer infrastructure. We do run monitoring: message stuck alerts, per-lane rate-limit alerts, bridge pause alerts, and a supply reconciliation job.

## What we can commit to shipping in Q4

Commit to this:

- A single game token represented natively on Base and OP Mainnet with one supply invariant.
- In-game movement between Base and OP Mainnet using CCIP CCT burn/mint pools.
- No external bridge-site detour.
- No first-party relayer.
- A provider-abstracted bridge adapter so we can migrate routes later.
- Admin safety: Safe ownership, timelock for normal changes, emergency pause, per-lane rate limits, and no arbitrary open cross-chain execution.
- Operational monitoring for stuck messages and supply drift.

Do not promise instant/atomic movement. Promise an in-game pending state with an expected delivery window based on the provider's current lane behavior. Also do not promise bridge-provider neutrality; Q4 depends on the selected provider's Base/OP support, fees, limits, and uptime.

## What would be a bet

The bet is native Superchain interop between Base and OP Mainnet using `SuperchainTokenBridge` and `L2ToL2CrossDomainMessenger`.

The native version would look like this:

1. Deploy `GameToken` as a SuperchainERC20-compatible token on both chains, ideally at the same address.
2. Grant mint/burn only to the `SuperchainTokenBridge` predeploy at `0x4200000000000000000000000000000000000028`.
3. The in-game adapter calls `SuperchainTokenBridge.sendERC20(token, to, amount, destinationChainId)`.
4. The source bridge calls `crosschainBurn`.
5. The source messenger emits the initiating message.
6. A destination transaction calls `relayMessage` / `relayERC20`.
7. The destination bridge calls `crosschainMint`.

This is the cleaner long-term design because the OP Stack interop protocol verifies cross-L2 messages at the protocol layer, and the SuperchainTokenBridge spec is explicitly designed to conserve token supply across chains. But for Q4 I would treat it as a migration target, not the launch dependency, unless Base and OP Mainnet are demonstrably live in the same dependency set with reliable public execution infrastructure before our audit freeze.

The subtle product catch: native interop still needs an executing transaction on the destination chain. It removes the need for a trusted app relayer, but the message does not arrive by magic. We would need a reliable public executor, wallet-driven second transaction, or our own fallback executor. If we have to operate that fallback ourselves, it violates the product preference.

## Assumptions that would break this design

For the Q4 provider-backed path:

- Base and OP Mainnet remain EVM chains with normal ERC-20 semantics, stable RPC access, and ETH gas.
- The selected provider continues to support Base <-> OP Mainnet in production through Q4.
- Provider routers, token pools, lane limits, and fee assets remain available at acceptable cost and latency.
- We are willing to accept the provider's security model for cross-chain mint authority.
- Our token has no transfer tax/rebase mechanics; bridgeable game balances need exact burn/mint accounting.
- Governance keys for token and bridge configuration are secured, because a compromised bridge role can inflate supply.

For the Superchain-native bet:

- Base and OP Mainnet are both in a live interop dependency set that accepts each other as message sources.
- Both chains expose compatible interop predeploys, especially `L2ToL2CrossDomainMessenger` and `SuperchainTokenBridge`.
- Base's move toward a Base-operated stack remains compatible with OP interop semantics.
- The token is deployed at the same address or otherwise follows the SuperchainERC20 requirements.
- Messages are relayed before the OP interop expiry window, currently specified as seven days.
- The public relayer/executor ecosystem is reliable enough that we do not need to run one.

## Sources checked

- Chainlink CCT overview: https://docs.chain.link/ccip/concepts/cross-chain-token/overview
- Chainlink CCIP offchain architecture: https://docs.chain.link/ccip/concepts/architecture/offchain/overview
- OP Stack interop dependency set: https://specs.optimism.io/interop/dependency-set.html
- OP Stack interop messaging: https://specs.optimism.io/interop/messaging.html
- OP Stack interop predeploys and `SuperchainTokenBridge`: https://specs.optimism.io/interop/predeploys.html
- OP interop rollout notice showing mainnet rollout sequencing: https://github.com/ethereum-optimism/optimism/blob/develop/docs/public-docs/notices/interop-prep.mdx
- Base stack direction: https://blog.base.dev/next-chapter-for-base-chain-1
