# Cross-Chain Layer For The Game Token

## Recommendation

Ship the Q4 version on a production third-party token messaging layer, not on native Superchain interop.

I would use Wormhole Native Token Transfers (NTT) with Wormhole Executor enabled for the Base <-> OP Mainnet route. That gives us one global supply, native ERC-20s on both chains, an in-game transfer flow, and no relayer for us to operate. It does add Wormhole security assumptions, so we should cap route exposure and keep the bridge layer replaceable.

The native OP/Superchain design is the cleaner long-term shape if Base and OP Mainnet are both in the same production interop set, but I would treat that as a bet for this launch. Base has announced a move toward a Base-operated stack, while OP interop/token bridging is still a spec/rollout dependency rather than a thing I would stake a Q4 game launch on.

## What We Deploy

Deploy the same `GAME` ERC-20 contract on Base and OP Mainnet, preferably at the same address using CREATE2. The token contract should be boring: ERC-20 metadata, fixed global cap, role-based mint/burn permissions, pause support, and no game logic.

On each chain, deploy:

- `GameToken`: the ERC-20 representation of the same token.
- `GameTokenBridgeController`: our small owner/governance contract that can configure limits, pause routes, and own bridge permissions.
- Wormhole NTT Manager for that chain.
- Wormhole Transceiver/Executor integration for the Base <-> OP Mainnet route.
- Optional game-side `DepositVault` or `InventoryEscrow` if the game needs custodial/session balances, but this should sit above the token and not become the cross-chain bridge.

Mint the total supply once. For example, mint it on Base to the treasury, then bridge whatever launch inventory is needed to OP Mainnet before launch. After that, the only routine way supply moves between chains is burn on the source and mint on the destination. Do not independently mint launch supply on both chains.

## Player Transfer Flow

When a player moves `GAME` from Base to OP Mainnet:

1. The player chooses "Move to OP Mainnet" inside the game.
2. The game quotes the destination route and relay/execution fee.
3. The player signs one source-chain transaction, or the game sponsors it through our account abstraction/paymaster flow.
4. The source NTT Manager takes the player's `GAME` and burns it.
5. The source manager emits the Wormhole message.
6. Wormhole Guardians observe and attest the message.
7. Wormhole Executor, or another open relay provider, submits the attested message on OP Mainnet.
8. The destination NTT Manager verifies the message and mints the same amount of `GAME` to the player's destination address.
9. The game watches source and destination events and updates UI state: pending, redeeming, complete, failed/retryable.

The OP Mainnet -> Base flow is symmetrical.

If automatic execution fails, the in-game client should expose a "complete transfer" retry that submits the already-attested message. That is not a bridge-site detour and it lets us recover without running a permanent relayer.

## Who Carries The Message

For the Q4 design:

- Wormhole Guardians carry the verification responsibility by observing the source-chain message and producing the signed attestation.
- Wormhole Executor/open relay providers carry the delivery responsibility by submitting the message on the destination chain.
- Our game client and backend track status, quote fees, and may sponsor user gas, but they are not part of the trust path and do not need to relay messages for correctness.

This means the bridge is not trustless in the same sense as native rollup messaging. We are trusting Wormhole's verification network and Executor path, plus the NTT contracts. For a game token, that can be acceptable if we set conservative caps.

## Controls We Should Ship

Set per-transfer and daily route limits for Base -> OP and OP -> Base.

Keep a route pause switch controlled by a multisig. Pausing should stop new sends but should not strand already-verified receives unless there is an active exploit.

Use the same decimals and metadata on both chains. Avoid fee-on-transfer, rebasing, staking wrappers, or game mechanics inside the token contract.

Make the bridge route explicit in analytics: total supply on Base, total supply on OP Mainnet, in-flight amount, daily bridged amount, failed/retryable messages.

Have a reconciliation monitor that checks:

`supply(Base) + supply(OP Mainnet) + in_flight_burned_not_minted == fixed_global_supply`

Keep bridge permissions narrow. The NTT manager should be able to mint/burn only for cross-chain transfers, and game contracts should not have arbitrary mint authority.

## What We Can Commit To For Q4

We can commit to native ERC-20 balances on both Base and OP Mainnet.

We can commit to one global supply, enforced by mint/burn accounting.

We can commit to an in-game transfer flow with no instruction to go use a separate bridge website.

We can commit to not running our own relayer as required infrastructure. Automatic completion comes from Wormhole Executor/open relay providers, with an in-app retry path as fallback.

We can commit to operational controls: rate limits, route pause, monitoring, reconciliation, and incident runbooks.

We should not commit to hard real-time settlement. The product promise should be "usually completes in minutes" with pending/retry states, not "instant and guaranteed."

## What Would Be A Bet

The bet is using native OP/Superchain interop for Base <-> OP Mainnet at launch.

In that version, `GAME` would implement the Superchain/ERC-7802 mint/burn interface and be deployed at the same address on both chains. A player transfer would call the `SuperchainTokenBridge` predeploy on the source chain. The source bridge would call `crosschainBurn`, send an L2-to-L2 message through the OP interop messenger, and the destination bridge would call `crosschainMint`.

The message would be carried by the OP interop system: the L2-to-L2 messenger, dependency-set validation, and the relay/execution machinery around the Superchain. This is the design I would prefer long term because it removes a third-party bridge network from the trust path.

I would not make it the Q4 launch dependency unless Base and OP Mainnet are both confirmed production members of the same interop set for our launch window, with stable predeploy addresses, stable tooling, and a supported relayer/executor path. Base's move toward a Base-operated stack makes that assumption too fragile for a near-term ship plan.

## Assumptions That Can Break This Design

For the Q4 Wormhole NTT design:

- Base remains EVM-compatible enough for a normal ERC-20, CREATE2 deployment, event indexing, and Wormhole's Base contracts.
- OP Mainnet remains EVM-compatible enough for the same.
- Wormhole continues to support both Base and OP Mainnet for NTT and Executor.
- Wormhole's Guardian set and Executor/open relay market remain live and secure.
- Base and OP Mainnet sequencers remain available enough that player transfers are not routinely censored or delayed.
- Ethereum L1 remains the settlement/data availability anchor for both chains' safety models.
- Our token's only meaningful mint/burn path remains the bridge-controlled path; no game contract gets emergency mint power that can violate global supply.

For the native Superchain bet:

- Base and OP Mainnet must both be in the same production interop/dependency set.
- Base must preserve the relevant OP interop semantics despite its Base-operated stack transition.
- The `SuperchainTokenBridge`, `L2ToL2CrossDomainMessenger`, and ERC-7802/SuperchainERC20 assumptions must remain stable on both chains.
- The same-address token requirement must remain practical for our deployment.
- There must be a production relayer/executor path that our app can rely on without us operating one.

## Sources Checked

- Wormhole NTT transfer flow: https://docs.wormhole.com/products/token-transfers/native-token-transfers/concepts/transfer-flow/
- Wormhole NTT Executor: https://docs.wormhole.com/protocol/infrastructure-guides/ntt-executor/
- OP Stack token bridging spec: https://specs.optimism.io/interop/token-bridging.html
- OP Stack interop predeploys spec: https://specs.optimism.io/interop/predeploys.html
- Base unified stack announcement: https://blog.base.dev/next-chapter-for-base-chain-1
