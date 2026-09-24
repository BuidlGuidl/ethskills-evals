# Cross-chain layer for the game token

Use a direct mint/burn omnichain token design, not a liquidity bridge and not Superchain-native interop.

My recommended Q4 design is a LayerZero V2 OFT deployment on Base and OP Mainnet:

- Deploy the game token as an ERC-20 + LayerZero OFT on Base.
- Deploy the same ERC-20 + LayerZero OFT on OP Mainnet.
- Configure each OFT as the trusted peer of the other with LayerZero `setPeer`.
- Configure the Base -> OP and OP -> Base pathways with production DVNs, receive/send libraries, executor settings, confirmation counts, enforced gas options, and a conservative transfer rate limit.
- Put ownership of both deployments behind the same multisig/timelock, with narrowly scoped roles for pausing, pathway configuration, and rate-limit changes.
- Add a small in-game `BridgeRouter` or backend-assisted transaction builder, but not a relayer. Its job is to quote the LayerZero fee, build the player transaction, surface status, and optionally use `permit` so approve + send can be one user action where the wallet supports it.

For a new token, prefer burn/mint OFT over lock/unlock adapters. When a player moves 1,000 GAME from Base to OP Mainnet, the 1,000 GAME is burned on Base and 1,000 GAME is minted on OP Mainnet after the message is verified and executed. There is no pool to rebalance and no destination-side inventory problem. The invariant is:

`totalSupply(Base) + totalSupply(OP Mainnet) == global GAME supply`

## Player Transfer Flow

1. The player opens the in-game transfer UI and chooses source chain, destination chain, amount, and destination wallet or game account.
2. The game client calls the source-chain OFT quote function to estimate the LayerZero message fee. The player pays this in source-chain native gas/fee, unless we separately sponsor it with account abstraction or a paymaster.
3. The player submits one source-chain transaction. That transaction calls the OFT `send` path, debits the player on the source chain by burning the amount, and emits/sends the cross-chain message through the LayerZero endpoint.
4. LayerZero DVNs observe and verify the source-chain message according to our configured security threshold.
5. LayerZero's Executor submits the destination-chain transaction and calls the destination OFT receive path.
6. The destination OFT checks that the message came from its configured peer and mints the same amount to the player or to the player's game vault.
7. The game UI tracks the source transaction, LayerZero message GUID, destination execution, and final balance update.

The message carrier is LayerZero: DVNs verify the message and the LayerZero Executor delivers it on the destination chain for the fee paid during `send`. We do not run the relayer. We do still depend on the configured DVN/executor set, so this is not the same trust model as a canonical Ethereum L1 withdrawal.

Operationally, transfers should have:

- Per-pathway daily and per-transaction limits at launch.
- A global pause and per-pathway pause.
- A failed-message/status page in the game client.
- Monitoring for pending messages, executor failures, DVN config drift, and unusual one-way flow.
- A runbook for raising gas options and retrying stuck destination execution.
- A second reviewed provider option, such as Chainlink CCIP CCT, kept as a contingency rather than co-shipped in the same token mesh.

## What We Can Commit To For Q4

We can commit to an in-game Base <-> OP Mainnet transfer using a third-party cross-chain messaging/token standard that is already deployed on both chains. LayerZero OFT is the concrete plan.

The Q4 commitment should be:

- One GAME supply across Base and OP Mainnet.
- ERC-20 GAME usable natively on both chains.
- In-game transfer UI; no separate bridge site.
- No self-run relayer.
- Burn on source, mint on destination.
- Transfer status and retry/status support inside the game.
- Launch caps, pausing, monitoring, and audited configuration.
- A documented trust model: GAME bridging relies on LayerZero DVNs and Executor, plus Base and OP Mainnet continuing to function.

We should not promise instant finality. We can target a game-friendly transfer time, but the actual completion time depends on source-chain inclusion, our configured confirmations, DVN verification, destination gas conditions, and executor delivery.

## What Would Be A Bet

Do not make Q4 depend on Superchain-native interop, `SuperchainERC20`, `L2ToL2CrossDomainMessenger`, `CrossL2Inbox`, or the `SuperchainTokenBridge`. Those are the right shape of future primitive, but not a production dependency I would put under a Q4 game-token launch. This is especially important because Base should not be treated as sharing OP Mainnet's stack/governance assumptions.

The practical premise is: Base and OP Mainnet are both Ethereum L2s we can deploy EVM contracts to, but I am not assuming they are one shared OP Stack/Superchain execution environment.

Also treat these as bets:

- A fully gasless bridge UX unless we separately build and fund a paymaster/account-abstraction path.
- Same token address on both chains. We can attempt deterministic deployment, but the bridge design does not require it.
- Canonical L1 round trips. They are too slow for the stated in-game UX and require extra user/operator steps.
- Intent/liquidity bridges for the game token at launch. They can improve speed later, but they add liquidity and market-maker dependencies that are fragile for a new asset.
- Zero third-party trust. Any Q4 design that avoids our own relayer by using an external message network inherits that network's security model.

## Assumptions This Design Relies On

This design breaks, or at least needs a redesign, if any of these stop holding:

- Base and OP Mainnet remain live EVM-compatible L2s where standard ERC-20/OFT contracts can be deployed and called.
- LayerZero V2 continues to support both Base Mainnet and Optimism Mainnet with production endpoints, DVNs, and executor service.
- The Base <-> OP Mainnet LayerZero pathway remains available, configurable, and economically reasonable for game-sized transfers.
- Players can submit source-chain transactions on whichever chain their balance is on, or we have a separate sponsorship system for that source-chain transaction.
- Reorgs/finality delays on either chain stay within the confirmation assumptions we configure for the pathway.
- We are comfortable with a third-party messaging trust model for GAME movement, rather than requiring canonical Ethereum settlement for every transfer.

Just as important: this design does not assume Base and OP Mainnet share a native interop layer, a shared upgrade schedule, or a Superchain token standard. If native OP/Base interop becomes production-ready later, we can evaluate a migration or new route, but it should not be the Q4 launch dependency.

## References Checked

- LayerZero OFT technical reference: https://docs.layerzero.network/v2/concepts/technical-reference/oft-reference
- LayerZero EVM protocol overview: https://docs.layerzero.network/v2/developers/evm/protocol-contracts-overview
- LayerZero Base Mainnet deployment page: https://docs.layerzero.network/v2/deployments/chains/base
- LayerZero Optimism Mainnet deployment page: https://docs.layerzero.network/v2/deployments/chains/optimism
