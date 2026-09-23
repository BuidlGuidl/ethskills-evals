# Cross-chain layer for the game token

## Recommendation

Use a single burn/mint token standard across both chains, with the native
Superchain path as the preferred transport when Base and OP Mainnet can actually
talk to each other through OP Stack interop.

Concretely:

- Deploy the game token on Base and OP Mainnet at the same deterministic address.
- Make the token an ERC-20 that also implements ERC-7802 / `IERC7802`:
  - `crosschainBurn(address from, uint256 amount)`
  - `crosschainMint(address to, uint256 amount)`
- Mint the total token supply exactly once, on the chosen home chain. The same
  bytecode and constructor args are used on both chains; the constructor only
  mints when `block.chainid == initialSupplyChainId`.
- Give mint/burn authority only to the approved cross-chain bridge path on each
  chain. For the native path, that is the Superchain token bridge predeploy.
- Put a small in-game `TokenRouter` / `GameBridge` facade in front of the bridge
  only if we need game-specific UX, limits, telemetry, or pausing. The facade
  should not custody funds long-term.

This keeps "one supply" true by construction: moving tokens burns on the source
chain and mints the same amount on the destination chain. There is no lockbox
with liquidity risk and no second wrapped token.

## What we deploy

On Base:

- `GameToken`, deployed with CREATE2 at the canonical token address.
- Optional `GameBridgeFacade`, with a `moveToOP(amount, recipient)` function
  that calls the canonical bridge.
- Frontend/game client support for Base as source or destination.

On OP Mainnet:

- The same `GameToken` bytecode at the same address.
- Optional `GameBridgeFacade`, with a `moveToBase(amount, recipient)` function.
- Frontend/game client support for OP Mainnet as source or destination.

Shared offchain pieces:

- An indexer that watches source-chain `SentERC20` / token burn events and
  destination-chain `RelayedERC20` / token mint events.
- UI state for `pending`, `ready to relay`, `complete`, and `failed/expired`.
- A route registry in the client: Base chain ID `8453`, OP Mainnet chain ID
  `10`, token address, bridge address, destination chain IDs.

The indexer is not trusted for supply. It only helps the game show progress.

## Player flow

1. Player clicks "Move to Base" or "Move to OP" inside the game.
2. The game asks the wallet to submit a source-chain transaction.
3. The source bridge calls `crosschainBurn(player, amount)` on `GameToken`.
4. The source bridge emits/sends the cross-chain message for the destination
   bridge.
5. A relaying actor submits the message on the destination chain.
6. The destination bridge verifies the message through the interop message layer.
7. The destination bridge calls `crosschainMint(recipient, amount)`.
8. The game updates the player's visible balance after the destination mint.

The UX should treat the move as asynchronous. We should show the source burn
immediately, show a pending transfer, and only credit gameplay balance on the
destination after the mint is final enough for our risk tolerance.

## Who carries the message

Preferred/native design:

- The message is carried through OP Stack interop: `SuperchainTokenBridge` uses
  `L2ToL2CrossDomainMessenger`; the destination validates through the interop
  inbox/message rules.
- The actual relay transaction can be submitted by an OP/Base-operated
  autorelayer if available, by any third-party relayer, or by the player/client
  from inside the game.
- We do not need to run a trusted relayer. If we run anything, it should be an
  unprivileged convenience relayer that can be replaced by anyone.

Fallback if native Base-to-OP interop is not usable in Q4:

- Use the same ERC-7802 token surface, but authorize a third-party messaging
  adapter on both chains instead of, or in addition to, the Superchain bridge.
- Good candidates are mature vendor transports that already support Base and OP
  Mainnet and operate their own message verification/relayer network.
- The game still embeds the bridge flow directly, so players do not leave for a
  bridge site.
- This is less elegant than native interop because the security model becomes
  the vendor's oracle/DVN/relayer model, not the OP/Base shared message layer.

I would keep the token contract transport-agnostic: `crosschainMint` and
`crosschainBurn` are guarded by roles for approved bridge adapters. Start with
one approved adapter. Adding another adapter later should be a governance action
with rate limits, monitoring, and a pause.

## What we can commit to shipping in Q4

Commit to shipping:

- A single-supply burn/mint token design.
- The same token address on Base and OP Mainnet using deterministic deployment.
- ERC-7802 compatibility so the token can plug into the native Superchain bridge
  if the route is live.
- In-game transfer UX: source transaction, pending transfer screen, event-based
  tracking, destination credit once minted.
- A no-self-operated-relayer path if we choose a production third-party message
  provider for the Q4 release.
- A circuit breaker:
  - pause cross-chain mint/burn separately from normal ERC-20 transfers;
  - per-route mint/burn limits;
  - monitoring that total supply across Base plus OP Mainnet never exceeds the
    intended supply.

The conservative Q4 launch plan is:

1. Implement the token as ERC-7802 / SuperchainERC20-compatible.
2. Deploy it at the same address on both chains.
3. Integrate the native Superchain bridge only if Base and OP Mainnet are in the
   same active interop dependency set and the bridge path is production-ready.
4. Otherwise ship the in-game bridge using a production third-party transport,
   while preserving the same token interface so we can migrate to native interop
   later.

## What would be a bet

Bet:

- Counting on native Base-to-OP Mainnet Superchain interop being available,
  production-ready, and operationally supported by Q4.
- Counting on an autorelayer to make the user flow one-transaction without our
  own fallback. Native interop still has an executing transaction on the
  destination side; someone or something has to submit it.
- Counting on Base to stay close enough to OP Stack interop semantics as it
  moves its own stack forward. Base has publicly described a move toward a
  Base-operated stack while preserving compatibility, but our design should not
  assume every OP predeploy/interop feature remains identical forever.
- Counting on wallets to make a cross-chain transfer feel atomic. The protocol
  is asynchronous; the UI must handle pending and relayable states.

## Assumptions this design relies on

This design breaks, or at least needs a different bridge adapter, if any of
these stop holding:

- Base and OP Mainnet remain EVM-compatible chains where the same token bytecode
  can be deployed deterministically at the same address.
- Base chain ID remains `8453` and OP Mainnet chain ID remains `10`.
- Both chains support the token standard we deploy: normal ERC-20 behavior plus
  ERC-7802-style `crosschainMint` / `crosschainBurn`.
- If using the native path: Base and OP Mainnet are in the same active interop
  dependency set, and the Superchain bridge/messenger predeploys exist at the
  expected addresses on both chains.
- If using the native path: destination-chain message validation remains
  permissionless enough that we do not need to operate a trusted relayer.
- If using a third-party transport: that provider continues to support both Base
  and OP Mainnet with acceptable fees, latency, uptime, and security.
- Neither chain changes finality, replay protection, chain IDs, message expiry,
  or bridge predeploy semantics in a way that invalidates in-flight transfers.
- The game can tolerate asynchronous settlement. If gameplay requires instant
  cross-chain credit, we need a separate credit/liquidity layer, which is a
  different risk profile.

## Sources checked

- OP Stack token bridging spec:
  https://specs.optimism.io/interop/token-bridging.html
- OP Stack interop messaging spec:
  https://specs.optimism.io/interop/messaging.html
- Optimism SuperchainERC20 starter:
  https://github.com/ethereum-optimism/superchain-starter-superchainerc20
- Base unified stack note:
  https://blog.base.dev/next-chapter-for-base-chain-1
- Base chain ID docs:
  https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId
- Superchain registry chain list:
  https://github.com/ethereum-optimism/superchain-registry/blob/main/chainList.toml
