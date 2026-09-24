# Cross-chain game token: Base ↔ OP Mainnet

## Summary

Deploy the token as a **burn-and-mint token on both chains, using a third-party messaging network that already runs its own verifiers and relayers**. My recommendation is **LayerZero OFT**, with **Chainlink CCIP (Cross-Chain Token standard, burn/mint pools)** as an equally valid second choice. Either one means we run no relayer. The player signs one transaction on the chain they're leaving, and the balance shows up on the other chain seconds to minutes later.

Two things are ruled out, and they're what people usually suggest first:

- **Superchain interop (`SuperchainERC20`, `L2ToL2CrossDomainMessenger`, `SuperchainTokenBridge`) is not live on OP Mainnet.** It is still on devnets and testnets. It also assumes both chains share the OP Stack, and **Base no longer does.** Base moved to its own Base Stack (`base-reth-node`) with the Azul upgrade in May 2026, and it now ships upgrades on its own schedule (Beryl, June 2026). So this path is blocked twice for this pair of chains, not just delayed.
- **A canonical round trip through L1 does not work as a game feature.** Leaving OP Mainnet is initiate, then prove on L1, then finalize on L1 after a challenge window of about a week. Then there's a deposit into Base on top. That is a multi-day trip with three or more transactions, and someone has to submit the L1 steps.

---

## What we deploy

### On each chain (Base, chain id 8453; OP Mainnet, chain id 10)

| Contract | Purpose |
| --- | --- |
| `GameToken` (an OFT: ERC-20 plus LayerZero OApp) | The token itself. `send()` burns on the source chain; `lzReceive()` mints on the destination. The same bytecode goes on both chains. |
| Peer wiring (`setPeer`) | Each chain's token accepts messages only from its counterpart's address, keyed by LayerZero endpoint id. Look the eids up in LayerZero's deployment list; don't take them from memory. |
| DVN / executor config (`setConfig` on the endpoint) | Sets who has to attest a message before it can be delivered. See "Who carries the message" below. |
| Outbound rate limit | A per-direction cap per time window (the LayerZero devtools `RateLimiter` pattern, or CCIP's built-in token-pool rate limits). This caps how much a verifier or config compromise can do. |
| Owner / delegate = Safe multisig + timelock | The owner can change peers, DVNs and limits. That is the real trust root of the whole design, so it can't be a hot key. |

We use **CREATE2/CREATE3 through one factory so the token has the same address on both chains.** That's for wallets, UI and support; the messaging doesn't need it, because peers are set explicitly.

### Where supply lives

- **Mint the full supply once, on a single home chain** (Base, for its consumer and on-ramp reach). OP Mainnet starts at 0 and only ever mints in response to verified messages.
- If the game mints rewards over time, **only the home chain gets a minter role.** Minting on both chains can't be capped atomically, and "one supply" stops being checkable.
- The invariant we monitor is `totalSupply(Base) + totalSupply(OP) + in-flight = issued supply`. Alert on any drift. "In-flight" means burned on the source but not yet minted on the destination.
- OFT watch-out: amounts go over the wire in **`sharedDecimals` (default 6)**. So an 18-decimal balance is trimmed to 6 decimals when bridged (`removeDust`), and the most you can move in one transfer is about 1.8e13 tokens (uint64 limit). The UI should show the trimmed amount, and we should confirm the supply design fits.

### In-game UX

- Player-held balances have to be in the player's own address, or be withdrawable from a game escrow into it, before bridging. If the game contracts hold balances, the escrow contract calls `send()` on the player's behalf.
- The client calls `quoteSend()` to get the message fee, which is paid in ETH on the source chain along with gas. Both chains use ETH for gas, so the player needs a small amount of ETH on the source chain and nothing on the destination. The executor's destination gas is prepaid through the `options` field.

---

## What happens when a player moves a balance (Base → OP; the reverse is symmetric)

1. **Quote.** The game calls `GameToken.quoteSend(dstEid=OP, to, amount, options)` on Base and shows the player the fee plus the dust-trimmed amount.
2. **Send, one signature.** The player signs `send{value: fee}(...)` on Base. The OFT checks the rate limit, **burns** `amount` from the player, and emits the packet through the LayerZero Endpoint on Base.
3. **Verify.** The configured DVNs wait the configured number of Base block confirmations, then each writes an attestation of the packet hash on OP Mainnet. When the required set has attested, the message becomes committable.
4. **Deliver.** LayerZero's executor, which is paid out of the fee from step 2, calls `lzReceive` on the OP token, and the OP token **mints** `amount` to the player.
5. **Track.** The game shows "pending" until the destination mint confirms. It polls the destination chain for the `OFTReceived` event, keyed by the GUID from step 2. LayerZero Scan's API is a convenient view on top of that; it's read-only, not a relayer.

**Failure modes the UI has to handle:**

- **Delivery reverts on the destination**, for example because the executor gas was set too low. The message stays stored and verified, and **anyone can retry it**. The game can offer a "retry" button that the player signs; nothing is lost.
- **Destination sequencer is down.** The burn has happened and the mint waits. The funds are delayed, not lost, and delivery completes when the chain resumes.
- **Rate limit reached.** `send()` reverts on the source before anything is burned. Show "bridge busy, try later".

---

## Who carries the message, and what we trust

**Chosen setup: LayerZero v2 OFT.**

- **Verification:** a DVN set that **we choose**. Use at least 2 required DVNs from independent operators, for example LayerZero Labs plus one of Google Cloud, Nethermind, Polyhedra or Horizen, with optional DVNs on top if we want more. A forged mint requires every required DVN to be compromised or colluding.
- **Execution/relay:** LayerZero's default executor, paid per message from the fee. **We run no relayer.** Anyone, including our own backend, *can* deliver a verified message if the executor stalls. That's a fallback we can use, not infrastructure we have to run.
- **Other trust surfaces:** the LayerZero Endpoint contracts, which are immutable, plus **our own owner multisig**, which can re-point peers or DVNs. Timelock that, and watch its events.

**Alternative: Chainlink CCIP with CCT burn/mint pools.** Chainlink's DON commits and executes, and the Risk Management Network can halt traffic. Rate limits are built into the token pools. We'd run no relayer here either. The difference is that we can't pick our own verifier set, and in exchange we get a more opinionated stack with rate limits out of the box. Choose on commercial terms and on which one your auditors know better. **Moving between the two later is a painful supply migration, so pick once.**

Wormhole NTT and Hyperlane would also work. Hyperlane's permissionless model tends to push relaying and security configuration onto the deployer, and you said you'd rather not take that on.

---

## Q4: what we can commit to vs. what's a bet

### Commit (uses only things that are live on mainnet today)

- An OFT (or CCT) token on Base and OP Mainnet, burn-and-mint, with supply minted on Base.
- Messages carried by LayerZero's DVNs and executor. No relayer operated by us.
- In-game bridge flow: quote → one signature → pending → arrived, including the retry path for failed deliveries.
- A 2-required DVN config, per-direction rate limits, and a Safe multisig with a timelock as owner.
- Supply-invariant monitoring across both chains.
- An end-to-end run on Base Sepolia ↔ OP Sepolia, then a guarded mainnet launch with low rate limits that get raised over time.
- An audit of our changes to the stock OFT: minter role, rate limiter, any escrow integration.

**Precondition for committing:** before the plan is locked, confirm that the Endpoint, both chosen DVNs and the executor are **currently listed as live on both Base and OP Mainnet** in LayerZero's deployment docs (or that CCIP lists the Base ↔ OP lane). Read it off the docs that week, not from this document.

### Bet (don't promise these for Q4)

- **Superchain native interop / `SuperchainERC20`.** It isn't live on OP Mainnet, and Base has left the shared stack, so a Base ↔ OP path through it may never exist. Don't design the token around `crosschainMint`/`crosschainBurn` expecting to switch later.
- **Gasless bridging for players with no ETH.** This needs a paymaster (ERC-4337) or an EIP-7702 sponsor flow. Either means a sponsoring service that we run or pay for, which works against the "no infra" goal. It's fine as a later add-on.
- **Bridge-and-act in one step** (arrive on OP and immediately stake or spend, via `lzCompose`). It works, but it's extra attack surface and extra gas tuning. Ship it after the plain transfer is stable.
- **Near-instant arrival marketed as a feature.** Latency depends on DVN confirmation settings and executor behavior, not on anything we control. Promise "usually under a few minutes", and measure it on mainnet before saying anything tighter.
- **More chains in Q4.** The design extends with `setPeer` and DVN config per chain, but every chain added is another item on the live-feature checklist and another set of assumptions.

---

## Assumptions about Base and OP Mainnet that would break this if they stopped holding

1. **Both stay EVM-equivalent enough to run the same OFT bytecode unmodified.** Base now runs its own client (`base-reth-node`) and upgrades on its own schedule, so there's no guarantee it tracks OP Mainnet's EVM changes. **Re-run the test suite against each Base hardfork and each OP hardfork before it activates.** A divergence in opcodes, precompiles, gas pricing or `block.*` semantics would affect one chain and not the other.
2. **The messaging network stays deployed and supported on both chains:** the endpoint, *both* of our required DVNs, and the executor. If a required DVN drops Base, for example because its verification relied on OP-Stack-specific infrastructure that no longer applies, traffic stops until we reconfigure. That is an owner-multisig action, which is why the timelock can't be so long that we can't respond.
3. **Nothing in the design relies on Base and OP sharing a stack, a governance process, an upgrade schedule or a native bridge.** This is deliberate. If a future simplification brings in Superchain interop, the OP canonical bridge or shared-sequencer assumptions, it would rebuild exactly the coupling that Base's move away from the OP Stack broke.
4. **Reorg depth stays inside our confirmation setting.** DVNs wait a number of *blocks*. If either chain changes its block time or finality behavior, which Base now does independently, that block count means a different amount of time and a different amount of safety. Retune it after any block-production change, and base timing logic on `block.timestamp`, not block counts.
5. **Both sequencers stay live, and censorship resistance stays available through L1.** A long outage on the destination chain leaves tokens burned but not minted for the duration of the outage. The funds are delayed, not lost, but support has to know what that looks like.
6. **Both chains keep ETH as the gas token and keep fees low.** The player-facing cost is source-chain gas plus the message fee, and that fee includes destination gas priced by the executor. A change in gas asset, or a sustained fee spike (for example from L1 data costs), changes the UX and possibly the in-game economics of small transfers.
7. **Chain ids 8453 and 10 and the messaging layer's endpoint ids for them stay stable.** Peers are keyed by those ids. The migration off the OP Stack left Base's chain id, addresses and canonical bridge unchanged, and the design assumes it stays that way.
