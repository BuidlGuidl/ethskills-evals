# Cross-chain layer for the game token (Base ↔ OP Mainnet)

## TL;DR

- **Model:** One fixed supply, spread across two chains using **burn-and-mint**. Leaving a chain burns the balance there. Arriving on a chain mints it there. No liquidity pools, no wrapped copies, no lockbox.
- **Who carries the message:** An **established third-party messaging protocol** whose own executor network delivers messages on the destination chain. The player pays that delivery fee on the source chain, or we sponsor it. **We run no relayer.** We only run a read-only monitor.
- **What not to plan Q4 around:**
  - **Superchain native interop.** That is `SuperchainERC20` plus `L2ToL2CrossDomainMessenger`. It was designed for exactly this, but it is not fully live. Also, **Base announced in Feb 2026 that it is leaving the Superchain**, so Base being inside that interop set is no longer something to assume.
  - **The canonical rollup bridges.** Going OP → L1 → Base means the 7-day withdrawal/challenge window. That doesn't work in-game.
- **Hedge for later:** Build the token so a future native path can be plugged in without migrating the token.

---

## 1. What we deploy on each chain

The deployment is identical on Base (chain 8453) and OP Mainnet (chain 10). Every contract gets the **same address on both chains** via CREATE2: same deployer, same salt, same bytecode.

| Contract | Purpose |
|---|---|
| **`GameToken`** (ERC-20) | Plain ERC-20 plus the **ERC-7802** interface (`crosschainMint` / `crosschainBurn`). Only allowlisted bridge adapters can call these two functions. No other mint path after genesis. |
| **`BridgeAdapter`** | Our wrapper around the messaging provider, e.g. a LayerZero OFT adapter, Chainlink CCIP token pool, Wormhole NTT manager or Hyperlane warp route. It is the only address allowed to mint and burn. It holds the **peer allowlist** (the only valid counterpart is the same adapter on the other chain) and the **per-direction rate limits** (a cap per rolling window, e.g. per hour). |
| **Admin: a multisig plus a timelock** | Same signers on both chains. The timelock owns the adapter config: peers, rate limits and the verifier set. A separate **pause guardian** key can only pause; it cannot mint or re-route. |
| **Paymaster** (ERC-4337, optional but recommended) | Sponsors the player's gas and the messaging fee, so a player with zero ETH can still move a balance. |

**Genesis:** The whole supply is minted once, on Base (home chain; that's where the Coinbase on-ramp and Smart Wallet users are). Minting on OP Mainnet starts at zero. After genesis, the only way to mint on either chain is the adapter reacting to a verified burn on the other chain.

**Supply invariant we monitor:**
`supply(Base) + supply(OP) + in-flight = GENESIS_SUPPLY`

In-flight means burned but not yet minted. We alert if the sum ever goes over genesis supply, or if in-flight grows for longer than the provider's normal delivery time.

**Why ERC-7802:** It is the interface `SuperchainTokenBridge` expects. If native OP↔Base interop ever exists, we add a second minter behind the timelock. The token itself never gets migrated.

**Which provider:** Choose one; don't run several in Q4. Pick based on audit coverage, how easy rate limits are to configure, and the support contract you can get. Two reasonable defaults:
- **LayerZero OFT**, configured with two required DVNs (verifiers): LayerZero's plus one independent operator. Then no single verifier can forge a mint.
- **Chainlink CCIP Cross-Chain Token (CCT)**, which has built-in rate limits and a separate risk-management network.

Before committing, confirm with the provider that **both chains are live and supported** at the time of the decision.

## 2. What happens when a player moves a balance

1. **In the game UI**, the player picks the amount and destination ("Move 500 to OP Mainnet"). The client asks the adapter for a fee quote and shows the fee, or shows it as free if we sponsor.
2. **One transaction on the source chain.** Ideally this is a sponsored user operation from the player's smart wallet. The call is `adapter.send(to, amount, dstChain)`. The adapter:
   - checks the rate limit,
   - calls `crosschainBurn`,
   - pays the provider fee,
   - emits a message with a unique ID.

   The player's balance on the source chain is gone right away. The UI shows **"in transit"** with the message ID.
3. **Verification.** The provider's verifiers wait until the source block reaches the finality depth we configured (see Assumption 2), then attest to the message.
4. **Delivery.** The provider's executor submits the message on the destination chain and pays gas there. That cost was already covered by the fee in step 2. The destination adapter checks:
   - the message came from the peer adapter,
   - it was verified,
   - it hasn't been used before,
   - it fits the inbound rate limit.

   Then it calls `crosschainMint`.
5. **The UI flips to "arrived".** It tracks this through the provider's message-status API, or through our indexer watching the mint event.

**Latency to design around:** from tens of seconds up to several minutes. It is driven by how many source confirmations we require, not by the 7-day window. The 7-day window only applies to exits to L1, which we never do.

**Failure paths. None of these needs a relayer of ours:**
- **Delivery fails on the destination** (out of gas, or rate limit hit). The message stays stored as retryable. **Anyone** can re-execute it: the player from the UI, or our ops team from a script. This uses LayerZero's retry or CCIP's manual execution.
- **Provider outage.** Transfers queue. Nothing is lost, because a burn without a matching mint is still recorded on-chain as in flight. The UI says "delayed", not "failed".
- **Suspected exploit.** The guardian pauses both adapters. The rate limits cap how much could have been minted illegitimately before that happened.

## 3. Who carries the message, and what we trust

| Option | Carrier | Speed | Trust | Q4? |
|---|---|---|---|---|
| **Third-party messaging (chosen)** | Provider's executors | Seconds to minutes | The provider's **verifier set**, not rollup proofs. This is the real added trust assumption. We limit it with multiple required verifiers and rate limits. | **Yes** |
| Canonical bridges via L1 (OP → L1 → Base) | Rollup messengers plus someone finalizing on L1 | **About 7 days** one way (withdrawal/challenge window) | Rollup security only | No. Unusable for gameplay. Could be an optional emergency exit later. |
| Superchain native interop | Protocol-level, near-trustless | Seconds (designed) | OP Stack interop | **No.** Not fully live, and Base is leaving the Superchain. |
| Intent / fast bridge (Across-style solvers) | Solvers fronting liquidity | Seconds | Solvers plus a settlement layer | No. It needs our token pooled on both sides and gives nothing burn/mint doesn't already give us. |

The requirement "we'd rather not run a relayer" is fully met. The provider's executor delivers, and retry is permissionless. What we do run: an **indexer/monitor** (supply invariant, stuck messages, rate-limit utilization) and an **on-call runbook**.

## 4. Q4 split

### Can commit to shipping in Q4
- `GameToken` with ERC-7802 hooks, same address on Base and OP Mainnet. Genesis on Base.
- Burn/mint adapter on **one** established provider: at least two required verifiers, per-direction rate limits, peer allowlist, pause guardian, timelocked admin.
- In-game "move balance" flow: fee quote, one transaction, in-transit/arrived status, player-triggered retry for stuck messages.
- Gas and messaging fees sponsored through a paymaster. Transactions on both chains cost fractions of a cent, so this is cheap at game scale.
- Supply-invariant monitoring, stuck-message alerts, incident runbook.
- An external audit of the token and adapter config. Book it now; Q4 audit slots are the real schedule risk, not the engineering.
- Stated delivery expectation to players: **"usually under a few minutes."** Not "instant."

### Bets. Don't put them on the Q4 roadmap as promises
- **Native Superchain interop between Base and OP Mainnet.** It depends on (a) interop shipping on mainnet and (b) Base taking part despite leaving the Superchain. Our ERC-7802 hook keeps this option open at zero cost. Don't schedule anything around it.
- **"Instant" (a few seconds) transfers.** This needs verifiers to act on unconfirmed sequencer blocks, which trades speed for reorg risk (Assumption 2). It could be offered as a small-amount fast lane later.
- **Multiple providers / redundant verification** (e.g. requiring 2 providers to agree). It's more robust, but doubles integration and audit work. Plan it for Q1.
- **Expanding to more chains** (Unichain, Arbitrum, etc.). Easy with this design, but it's scope growth, so not Q4.
- **Removing the third-party trust entirely.** It only happens if native interop becomes real for this pair.

## 5. Assumptions about Base and OP Mainnet this design depends on

If any of these stops holding, the design breaks or needs rework:

1. **Both stay EVM-equivalent with standard CREATE2 behavior.** Same-address deployment and one identical contract codebase depend on it.
   *If Base diverges after leaving the Superchain* (different hardfork schedule, precompiles or opcode support): the codebase splits per chain, and we re-audit per chain.
2. **Sequencer reorgs don't go deeper than our confirmation setting.** Both chains run a single centralized sequencer. We treat blocks as final after N confirmations.
   *If a source-chain block containing a burn is reorged out after the destination mint:* supply is created from nothing (a double spend). Mitigations:
   - Large transfers wait for L1-anchored "safe" blocks.
   - The rate limit caps the damage.
3. **Both sequencers stay live.** If one goes down, moves into and out of that chain stall. Forced inclusion via L1 exists but is far too slow for gameplay.
   *Result:* the UI must be able to show a long "delayed" state, and in-game logic must not assume the destination balance shows up within a fixed time.
4. **Our messaging provider keeps supporting both chains and its verifiers stay honest.** This is the design's biggest trust dependency, bigger than either rollup.
   *If the provider drops a chain:* we need a timelocked adapter swap. Because the token is ERC-7802 with an allowlist of minters, the swap is an admin action, not a token migration.
5. **Fees stay sub-cent on both chains**, so sponsoring gas and message fees is economically trivial.
   *If blob-fee or L1-fee spikes push costs up:* sponsorship needs caps or player-paid fees.
6. **ERC-4337 infrastructure keeps working on both chains** (EntryPoint, bundlers, paymasters). This is what makes "move balance" one click with no ETH needed.
   *Without it:* players must hold ETH on both chains, which is exactly the "go somewhere else first" detour we're trying to avoid.
7. **We do *not* depend on Superchain membership, the OP Stack interop predeploys, or the 7-day canonical bridge.** That is deliberate. Base leaving the Superchain, or interop slipping, only costs us a *future* upgrade path, not the Q4 launch.
   *If someone later rewires the design onto those,* this assumption flips and Base's departure becomes a launch blocker.
8. **Upgrades by each chain's security council don't change the semantics of basic ERC-20 contracts or the fee model without notice.** We watch both chains' hardfork announcements. Base's post-Superchain hardfork is the one to track most closely.
