# Cross-chain token layer for Base and OP Mainnet

## Recommendation

Ship the token as a LayerZero V2 OFT on both Base and OP Mainnet.

For a new Q4 game token, use the direct OFT pattern rather than issuing a plain ERC-20 first and adapting it later. The token contract is the bridge endpoint: when a player moves tokens from one chain to the other, the source-chain token is debited by burning it and the destination-chain token is credited by minting the same amount. That gives us one global supply without a wrapped asset and without maintaining liquidity inventory.

I would not design this around Superchain native interop. Base and OP Mainnet should be treated as two independent EVM L2s for this launch. Base is no longer an OP Stack chain after its 2026 Azul/Base Stack path, and SuperchainERC20/L2-to-L2 native interop is still the wrong dependency for a committed Q4 launch plan.

## What we deploy

On Base:

- `GameTokenOFT`, an ERC-20 + LayerZero OFT contract.
- Mint/burn authority held only by the OFT logic, with initial supply minted on the launch chain or minted under a hard global cap.
- The OP Mainnet OFT set as the trusted peer for the OP destination endpoint.
- LayerZero pathway config for Base -> OP: DVN set, Executor, receive gas, enforced options, message library, rate limits, and pause switch.
- Multisig ownership/delegate for peer configuration, security config, pausing, and upgrades if the token is upgradeable.

On OP Mainnet:

- The same `GameTokenOFT` implementation, ideally deployed with CREATE2/CREATE3 for the same address if the game wants simpler indexing and allowlists. Same address is nice, not required for messaging.
- Base OFT set as the trusted peer for the Base destination endpoint.
- LayerZero pathway config for OP -> Base with the same operational controls.
- Multisig ownership/delegate mirroring Base.

In the game:

- A "move balance" action that calls the source-chain OFT `send` flow directly from the game UI or wallet flow.
- A quote step that shows the LayerZero message fee and destination gas fee before signing.
- Status tracking from the source transaction through LayerZero Scan/events to destination credit.
- Optional gas sponsorship/paymaster support for the source transaction, but the cross-chain delivery itself should be paid through the LayerZero fee path, not our own relayer.

If balances live inside a game escrow contract rather than directly in player wallets, deploy a small chain-local `GameInventoryVault` on each chain. The vault withdraws/burns from the player balance on the source side, calls the OFT transfer, and on destination either credits the player wallet or receives the token and credits the in-game balance. That is a product choice; the cross-chain supply invariant should still live in the OFT layer.

## Player transfer flow

Base -> OP example:

1. The player chooses "Move to OP Mainnet" inside the game and enters an amount.
2. The client calls the Base OFT quote function for OP Mainnet and gets the required native fee.
3. The player signs one source-chain transaction on Base.
4. The Base OFT burns the amount from the player or from the game vault.
5. The Base OFT sends a LayerZero message to the OP peer containing recipient, amount, nonce/pathway data, and any optional compose payload.
6. LayerZero DVNs verify the source-chain message according to our configured security threshold.
7. A LayerZero Executor submits the verified delivery transaction on OP Mainnet.
8. The OP OFT accepts the message only from its trusted Base peer and mints the same amount to the player or game vault.
9. The game marks the move complete after the OP credit event.

The reverse path is identical with OP as source and Base as destination.

The important invariant is:

`total supply on Base + total supply on OP Mainnet = one global token supply`

No bridge pool should be allowed to mint independently, and no admin should have unconstrained mint rights after launch.

## Who carries the message

LayerZero carries it. More precisely:

- The source OFT hands the packet to the LayerZero Endpoint on the source chain.
- The configured DVNs attest/verify that the source-chain message exists.
- The configured Executor submits the receive transaction on the destination chain.
- The destination OFT mints only after the destination LayerZero Endpoint delivers a message from the configured source peer.

So we do not run a relayer. We do trust LayerZero's configured verification and execution network for liveness and correctness of cross-chain delivery. The player pays the messaging/execution fee in the source transaction unless we sponsor that fee in the app.

## What we can commit to for Q4

We can commit to:

- One token supply live on Base and OP Mainnet using OFT burn/mint semantics.
- In-game transfers in both directions without sending players to a bridge website.
- No first-party relayer operation for the bridge path.
- Source-chain transaction plus asynchronous destination credit.
- Operational controls: per-path rate limits, pause/unpause, multisig-controlled configuration, monitoring, and a manual support runbook for stuck messages.
- A clear UX that distinguishes "source tx confirmed", "message verified/delivered", and "destination balance credited".

I would choose LayerZero OFT as the default Q4 route because LayerZero documents OFT as preserving one global supply, requires an OFT deployment on each chain, supports Base and Optimism mainnet endpoints, and uses configurable DVNs/Executors for delivery.

Chainlink CCIP CCT or Wormhole NTT could also support a burn/mint token design, but I would treat switching providers as a vendor/security review decision, not as a different architecture. The architecture remains: native token contracts on both chains, burn on source, mint on destination, third-party network verifies and executes the message.

## What is a bet

Do not commit Q4 launch to these:

- Native SuperchainERC20 between Base and OP Mainnet. It is the elegant future path if all target chains support it, but Base is not currently something I would couple to OP Mainnet through shared Superchain assumptions.
- Fully instant UX. We can make it feel first-class in-game, but destination credit is still asynchronous and depends on message verification/execution.
- Gasless everywhere. We can sponsor source transactions or use account abstraction where available, but that is separate product work and should not be required for the bridge layer to function.
- Automatic fallback across multiple bridge providers. Multi-provider redundancy sounds attractive, but it creates hard consistency problems for a single supply unless one provider is canonical and the others are disabled or carefully rate-limited.
- Cross-chain game actions bundled after receipt, such as "move and stake on destination" or "move and buy item". OFT compose can support this, but the Q4 core should ship balance movement first.

## Assumptions that must keep holding

This design depends on:

- Base mainnet remains EVM/ERC-20 compatible with chain id `8453`.
- OP Mainnet remains EVM/ERC-20 compatible with chain id `10`.
- LayerZero V2 remains deployed and supported on both chains. Current LayerZero endpoint IDs are Base `30184` and Optimism `30111`; we should confirm the exact endpoint, DVN, Executor, and library addresses again at deployment time.
- The LayerZero Base <-> OP pathway remains available with acceptable fees and liveness.
- The selected DVN/Executor configuration is not deprecated or paused, and we can rotate configuration via multisig if a provider changes.
- Neither chain undergoes an upgrade that breaks normal Solidity/ERC-20/OFT behavior, changes chain identity, or removes the endpoint contracts we depend on.
- The game is comfortable with the bridge trust model: Ethereum/Base/OP security plus LayerZero pathway security, not pure native settlement between the two L2s.
- Players can pay, or we can sponsor, source-chain gas and LayerZero message fees.

If any of those stop holding, the design does not fail into "use the OP native bridge"; it needs a migration plan: pause sends, preserve balances already minted on each chain, choose a new message provider or canonical chain, then reconnect under a new audited bridge path.

## Sources checked

- LayerZero OFT technical reference: https://docs.layerzero.network/v2/concepts/technical-reference/oft-reference
- LayerZero cross-chain asset deployment guide: https://docs.layerzero.network/crosschain/issue-asset/overview
- LayerZero Base deployment page: https://docs.layerzero.network/v2/deployments/chains/base
- LayerZero Optimism deployment page: https://docs.layerzero.network/v2/deployments/chains/optimism
- Base Azul announcement: https://blog.base.dev/introducing-base-azul
- OP interop specs: https://specs.optimism.io/interop/predeploys.html
- Chainlink CCT reference: https://docs.chain.link/ccip/concepts/cross-chain-token
- Wormhole contract/deployment reference: https://wormhole.com/docs/reference/contract-addresses/
