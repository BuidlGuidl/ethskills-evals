# Cross-chain layer for the game token

## Recommendation

Ship the token as a native burn/mint cross-chain token on Base and OP Mainnet, using a production messaging network so we do not operate our own relayer. My default choice for a Q4 game launch is **LayerZero OFT v2** because the pattern is simple for a new token: one token contract per chain, peer those contracts to each other, and use LayerZero's DVNs and Executor to verify and deliver the cross-chain message.

Chainlink CCIP CCT is the other reasonable shippable choice. It gives a very conservative security posture and Base/OP support, but usually has more operational ceremony around token pools, admins, and lane configuration. If the team already has Chainlink relationships or compliance/security reviewers prefer CCIP, use CCIP. Otherwise, OFT is the cleaner game-token implementation.

I would **not** make Q4 depend on OP Stack native Superchain interop / SuperchainERC20 for Base <-> OP as the primary bridge. Keep the token contract interface compatible where practical, but treat native Superchain interop as an upgrade path, not the launch path.

## What we deploy

On **Base**:

- `GameTokenOFT`: ERC-20 + OFT burn/mint bridge logic.
- LayerZero endpoint configuration for the OP Mainnet route.
- Peer mapping that says the only trusted remote token for OP Mainnet is our OP Mainnet `GameTokenOFT`.
- Owner/multisig controls for pausing sends, changing message security config, setting rate limits, and recovering mistakenly sent non-token assets.
- Optional `GameBridgeRouter`: a thin game-facing contract that quotes fees, calls `send`, emits game-friendly events, and keeps the front end from needing to know protocol internals.

On **OP Mainnet**:

- The same `GameTokenOFT` deployment and metadata.
- LayerZero endpoint configuration for the Base route.
- Peer mapping back to the Base token.
- The same admin, pause, and rate-limit controls.
- Optional matching `GameBridgeRouter`.

Supply model:

- Define one fixed max supply at launch.
- Mint initial circulating supply on the starting chain, probably Base if that is where the game launches first.
- Cross-chain movement never creates net new supply. It burns/debits on the source chain and mints/credits on the destination chain.
- If we want treasury liquidity on both chains on day one, move part of the treasury supply through the same bridge path before launch, instead of independently minting on both chains.

## Player flow

When a player moves `GAME` from Base to OP Mainnet:

1. The in-game UI shows "Move to OP Mainnet", gets a LayerZero fee quote, and asks the player to sign one transaction on Base.
2. The player calls `send` directly on `GameTokenOFT`, or calls our `GameBridgeRouter`, which calls `send`.
3. The Base token burns/debits the amount from the player.
4. The Base LayerZero Endpoint emits the cross-chain packet.
5. LayerZero DVNs verify the packet according to our configured security policy.
6. The LayerZero Executor submits the destination transaction on OP Mainnet.
7. The OP Mainnet token receives the message from its trusted Base peer and mints/credits the same amount to the player.
8. The game watches message status and updates the balance after destination execution.

The reverse OP Mainnet -> Base flow is identical.

The message carrier is **LayerZero**, specifically the configured DVNs for verification and the LayerZero Executor for destination execution. We do not run a game relayer. The player, or our paymaster/sponsorship layer, pays the messaging and destination gas fee from the source-chain transaction.

## Q4 commit

We can commit to shipping:

- A single-supply `GAME` token live on Base and OP Mainnet.
- In-game balance movement between the two chains without sending players to an external bridge site.
- No self-operated relayer for ordinary transfers.
- Burn/mint accounting with no liquidity-pool dependency.
- Transfer status tracking in the game UI.
- Admin pause and per-route rate limits.
- A documented recovery path for stuck LayerZero messages.
- Testnet rehearsals on Base Sepolia and OP Sepolia, then mainnet deployment with small initial transfer limits that we raise after monitoring.

This is a real Q4 plan because it depends on already-available cross-chain messaging infrastructure, not on a new protocol feature becoming production-ready on our schedule.

## Q4 bets

These are bets, not commitments:

- Using OP Stack native interop / SuperchainERC20 as the primary Base <-> OP transport.
- Assuming Base and OP Mainnet will remain in the same native interop dependency set with stable production tooling by our launch date.
- Same-block or near-instant game UX. We should design for "usually fast, sometimes delayed", with clear pending states.
- Full gas abstraction for every player on both chains. We can sponsor source transactions or destination gas, but the first shippable version should still work when the player pays normal chain gas.
- Composable destination actions, such as "bridge and immediately stake/equip/spend", in the first release. Add after plain bridge transfers are boring and reliable.

## Assumptions that can break this design

- Base and OP Mainnet continue to support standard EVM ERC-20 contracts and normal contract deployment.
- LayerZero continues to support both Base and OP Mainnet with production endpoints, DVNs, and Executor service.
- Source-chain transactions on Base and OP Mainnet remain cheap enough that in-game transfers are acceptable for players.
- Both chains continue to have reliable RPC/indexing access so the game can quote fees, submit transactions, and track message status.
- Cross-chain messages between Base and OP Mainnet remain available without allowlisting that would block our token route.
- The token supply fits LayerZero OFT decimal/shared-decimal limits. For a game token, that means choosing decimals and max supply deliberately before deployment.
- We are comfortable inheriting LayerZero's security assumptions: endpoint contracts, configured DVNs, executor delivery, and our own peer/configuration correctness.

If LayerZero support for either chain went away, or if we lost confidence in its message security, the design would need to migrate to another carrier such as CCIP. If Base and OP Mainnet stopped being cheap EVM L2s, the game UX and fee sponsorship model would need to be redesigned. If native Superchain interop became clearly production-ready and Base/OP stayed aligned around it, we could add that route later, but it should not be the critical path for Q4.
