# Cross-chain layer for the game token (Base ↔ OP Mainnet)

## TL;DR

- **One token contract, deployed at the same address on both chains, using burn-and-mint.** Nothing gets locked or wrapped. Moving a balance burns it on the source chain and mints it on the destination chain. The token's mint and burn functions can only be called by a short, rate-limited list of bridge adapters.
- **What we commit to for Q4:** a third-party messaging network carries the message. I recommend LayerZero OFT; Chainlink CCIP (Cross-Chain Token standard) is the fallback. The player signs one transaction in-game and delivery on the other chain is automatic. We don't run a relayer. The trade-off is that we rely on that provider's verifier set.
- **The bet:** native OP Superchain interop (`SuperchainTokenBridge` plus ERC-7802). That would let us drop the third party entirely. It only works if Base and OP Mainnet are both live in the **same interop dependency set** on mainnet. We should build the token so it can use this later without a migration, but we should not promise it for Q4.
- **Rejected:** the canonical L2 → L1 → L2 route through Ethereum. Withdrawals from an OP Stack chain have a roughly 7-day fault-proof window, which no in-game "move balance" button can accept.

---

## 1. What we deploy on each chain

### 1.1 `GameToken`: identical bytecode, same address on Base (8453) and OP Mainnet (10)

- **Standard ERC-20.** Add ERC-2612 `permit` if the game client needs gasless approvals.
- **Mint and burn only through registered bridges**, using ERC-7281 (xERC20) style per-bridge limits:
  - `setBridgeLimits(bridge, mintLimit, burnLimit)` sets limits that refill over a rolling window, for example "Bridge X may mint at most N tokens per 24h on this chain".
  - `mint(to, amt)` and `burn(from, amt)` can only be called by a registered bridge, within its limit.
- **ERC-7802 interface (`crosschainMint`, `crosschainBurn`, and the `CrosschainMint`/`CrosschainBurn` events)**, callable only by the Superchain token bridge predeploy `0x4200000000000000000000000000000000000028`. On chains where interop isn't active, that caller never shows up, so the functions are unused. This is what lets us "turn on" native interop later without redeploying the token.
- **No general `mint` after launch.** The whole supply is minted once, on one home chain (say Base), at TGE. OP Mainnet starts with a supply of 0.
- **Admin:** a multisig behind a timelock, holding a separate **pause** role that can act immediately. Only use a proxy if we need upgradability. If we do, the proxy and implementation addresses must also match across chains.
- **Deployment:** use CREATE2 through a factory that sits at the same address on both chains, for example the OP Stack `Create2Deployer` predeploy or CreateX. The init code must be byte-identical: no chain-specific constructor arguments. Anything chain-specific goes in a post-deploy `initialize`/config step. The same address matters because `SuperchainTokenBridge` assumes the token lives at the same address on every chain. It is also much simpler for the game client and indexers.

### 1.2 Bridge adapter for Q4: LayerZero OFT (one per chain)

- An `OFTAdapter`-style contract that calls `GameToken.burn` and `GameToken.mint`. We could also make the token itself an OFT, but a separate adapter keeps the token clean and lets us swap bridges.
- Peers point at each other: Base endpoint ID 30184 ↔ Optimism endpoint ID 30111.
- **Explicit security config. Don't rely on the defaults:**
  - Required DVNs (the provider's independent message verifiers): at least two independent ones, for example LayerZero Labs plus Google Cloud, Polyhedra or Nethermind.
  - Block confirmations: see the reorg assumption in §5.
  - An executor for automatic delivery.
- Register the adapter in `GameToken` with mint limits sized to realistic daily flow, not to total supply. **The rate limit is our blast-radius cap:** if the messaging layer is compromised, the most an attacker can mint is roughly one window's limit.

If we choose CCIP instead, the shape is the same. A burn/mint `TokenPool` replaces the OFT adapter, the pool's rate limits sit alongside our own, and Chainlink's DON (its decentralized oracle network) is the trusted party instead of the DVNs.

### 1.3 Later, the native path (no extra contracts from us)

`SuperchainTokenBridge` (`0x4200…0028`) and `L2ToL2CrossDomainMessenger` (`0x4200…0023`) are predeploys on interop-enabled OP Stack chains. Our token already implements ERC-7802, so enabling this path is: interop goes live on both chains, and we update the game client. The xERC20 limits don't cover this path, because ERC-7802 calls come from the predeploy. If we want a cap there too, enforce it inside `crosschainMint`.

### 1.4 Off-chain (ours, but not a relayer)

- **Indexer:** watches `Transfer`, `OFTSent`/`OFTReceived` (or `CrosschainBurn`/`CrosschainMint`) on both chains. It shows the player one unified balance plus an "in transit" line.
- **Monitoring and alerting:** the supply invariant, limit usage, stuck messages, and DVN health. Wire alerts to the pause role.

---

## 2. What happens when a player moves a balance

### Q4 path (LayerZero OFT)

1. The player taps "Move 500 to OP Mainnet" in-game.
2. The client calls `adapter.quoteSend(...)` on the source chain to get the messaging fee, which is paid in ETH on the source chain. At current L2 gas prices this is usually cents.
3. **The player signs one transaction on the source chain:** `adapter.send(...)` with `msg.value = fee`.
   - The adapter calls `GameToken.burn(player, 500)`. Source supply drops by 500.
   - The LayerZero endpoint emits the packet.
4. After the configured confirmations, the DVNs attest to the packet on OP Mainnet.
5. LayerZero's executor, already paid by the fee in step 3, calls `lzReceive` on the OP adapter. That calls `GameToken.mint(player, 500)`. **The player needs no ETH on the destination chain and signs nothing there.**
6. The indexer shows "in transit" and then the credited balance. Expect end-to-end latency on the order of a minute or two, mostly set by the confirmation count we choose.

**Failure handling:**
- If the destination mint reverts (for example the rate limit is exhausted or the token is paused), the message is stored on the endpoint and can be retried once the cause is cleared. Funds are delayed, not lost.
- The game UI needs a "pending, retry" state.
- Keep the receive path trivial so it basically can't revert for any other reason.

**Gas UX:** if players use smart wallets (for example Coinbase Smart Wallet on Base, or any ERC-4337 wallet), a paymaster can sponsor the source-chain transaction and the messaging fee. The player then needs no ETH at all. That is optional polish for Q4 and doesn't change the architecture.

### Native path (the bet)

1. On the source chain, the player calls `SuperchainTokenBridge.sendERC20(token, to, amount, destChainId)`. This calls `crosschainBurn` and sends a message through `L2ToL2CrossDomainMessenger`.
2. **Someone must submit the executing message on the destination chain**, by calling `L2ToL2CrossDomainMessenger.relayMessage(id, payload)`. That call goes through `CrossL2Inbox` and ends in `crosschainMint`. **Native interop does not deliver the message automatically. It only makes the message valid on the destination chain.** Options:
   - **(a) The player self-relays.** A second transaction, signed in-game, on the destination chain. We run nothing, but the player needs destination gas or a paymaster, and the UX is two signatures.
   - **(b) An ecosystem or third-party autorelayer** (OP Labs and others have built these). We run nothing, and we depend on it for liveness only, not safety.
   - **(c) Our own relayer.** Easy, since it is stateless and permissionless, but the brief says to avoid this.

   Option (a) with (b) as a fallback is the honest way to "not run a relayer". The important improvement over the Q4 path is that **no third party can forge a mint**. Validity comes from the chains' own derivation and fault proofs, not from an external verifier set.

---

## 3. Who or what carries the message

| Path | Carries the message | Trust for *safety* (can someone forge a mint?) | Trust for *liveness* | We run infra? |
|---|---|---|---|---|
| **Q4: LayerZero OFT** | LZ DVNs verify, LZ executor delivers | The DVN set we configure (e.g. 2 of 2 required) | Executor (anyone can also execute manually) | No |
| Q4 alt: CCIP | Chainlink DON + Risk Management Network | Chainlink | Chainlink | No |
| **Bet: Superchain interop** | Protocol validates. Player, autorelayer or anyone delivers | Base + OP Mainnet derivation and fault proofs, and shared Superchain governance | Whoever submits `relayMessage` | No, if players self-relay or a public autorelayer exists |
| Rejected: L1 canonical bridges | OptimismPortal / L1 bridges | Ethereum + fault proofs | Prover/finalizer | Would need finalization tooling; ~7 days |

Also rejected: having players prove the source burn themselves with storage proofs against L1-anchored output roots. It is relayer-free, but you either wait for dispute-game finality (days) or trust unresolved output proposals. It's a lot of bespoke, audit-heavy code for a Q4 date.

---

## 4. What we can commit to for Q4 vs. what is a bet

Today is 2026-09-21, so Q4 starts in ten days. Everything below the "commit" line has to fit around an **audit slot**. Book it now.

### Commit (Q4)

- `GameToken`: ERC-20 + xERC20-style limits + ERC-7802 hooks + pause. We deploy it at the same address on Base and OP Mainnet via CREATE2, and mint the full supply once on Base.
- One third-party burn/mint bridge, LayerZero OFT (or CCIP), with an explicit DVN config, conservative confirmation counts, and per-chain rate limits.
- An in-game "move balance" flow: one signature, automatic delivery, in-transit and retry states.
- An indexer showing a unified balance, plus monitoring of the cross-chain supply invariant, with alerts wired to pause.
- **A runbook:** pause, lower limits, retry a stuck message, rotate DVNs, remove a bridge.

Why this is committable:
- Mostly audited, off-the-shelf code (OFT, xERC20 patterns).
- Both chains are already supported by the provider.
- There's no dependency on any upcoming protocol upgrade.
- Our custom code is small: the token plus its limits.

### Bet (don't promise it; design so it's cheap to adopt)

- **Native Superchain interop between Base and OP Mainnet in Q4.** This needs three things to happen on schedule:
  - Interop activated on OP Mainnet mainnet.
  - Base adopting the same hardfork.
  - Both chains in each other's dependency set.

  None of that is under our control. Base's stated direction in 2026 toward a Base-maintained stack makes the "same dependency set" part especially uncertain. **Verify current status before planning around it.** If it lands, we turn it on through the client and retire or tighten the LayerZero limits. No token migration.
- **Truly relayer-free *and* single-signature.** With native interop, "we run nothing" relies on players self-relaying (two signatures) or on someone else's autorelayer. Treat an ecosystem autorelayer as a nice-to-have.
- **Fully gasless moves for players without smart wallets.** This depends on the wallet mix; paymaster coverage is uneven for EOAs.
- **Emissions on both chains.** If the game mints rewards over time, mint only on the home chain and bridge them out. **A global cap can't be enforced atomically across two chains.** Minting on both is a bet on off-chain accounting.

---

## 5. Assumptions about Base and OP Mainnet (and what breaks if they fail)

1. **Both are EVM-equivalent OP Stack chains, and the same CREATE2 factory exists at the same address on each.**
   - Breaks: the same-address deployment, and with it compatibility with `SuperchainTokenBridge`.
   - Q4 fallback: LayerZero peers can point at different addresses, so only the native path dies.
2. **Base stays an OP Stack / Superchain chain and joins OP Mainnet's interop dependency set, on the same hardfork cadence and under shared upgrade governance.**
   - This is the single biggest assumption behind the bet.
   - Breaks: native interop between these two chains never arrives, and the third-party bridge becomes permanent. The Q4 design is unaffected, which is why it's the commit.
3. **Predeploy addresses and interfaces stay as specified:** `SuperchainTokenBridge` at `0x4200…0028`, `L2ToL2CrossDomainMessenger` at `0x4200…0023`, and the ERC-7802 function signatures.
   - Breaks: our ERC-7802 hooks trust the wrong caller, or the wrong interface. The hooks are gated on the address, so a changed address means a token upgrade or a new bridge registration. That's another reason to keep an upgrade or bridge-registry path.
4. **Unsafe-head reorgs are rare, and we set confirmations to match.**
   - The source burn is observed on L2 blocks from a single sequencer. If the batcher fails to post within the sequencing window, or the sequencer misbehaves, an "unsafe" block can be reorged away. That could undo a burn *after* the destination has already minted, which means **double supply**.
   - Mitigations:
     - Confirmation counts high enough that we're effectively waiting for the block to be posted to L1 ("safe"), or an explicitly accepted risk sized by the rate limits.
     - Invariant monitoring.
     - Pause.
   - Native interop handles this at the protocol level. Destination blocks that depend on invalidated messages get replaced, so the third-party path is the one where it's *our* problem.
5. **Both sequencers stay live and censorship-resistant enough.**
   - If either sequencer halts, moves stall in transit, but nothing is lost.
   - Forced inclusion via L1 exists but takes up to the sequencing window (~12h). That's acceptable for liveness but must show up in the UI.
6. **L2 fees stay low (cents),** so a move plus the messaging fee is trivially cheap.
   - Breaks: the UX economics (sponsoring and small transfers), not correctness.
7. **The messaging provider keeps supporting both chains, and the DVNs we picked stay honest and live.**
   - Breaks:
     - Safety, if the DVNs collude or are compromised. Bounded by the rate limits.
     - Liveness, if support is dropped. Mitigated by the multi-bridge token design: register a second provider and deregister the first.
8. **Fault proofs keep working on both chains.**
   - The Q4 path doesn't touch L1 at all, so it doesn't depend on this.
   - The native interop path does: each chain accepting the other's messages rests on both chains' state being provable.

---

## 6. Invariants to test and monitor

- `supply(Base) + supply(OP) + inFlight == TOTAL_SUPPLY`. `inFlight` means messages sent but not yet delivered, taken from the indexer.
- Per-bridge net mints per window never exceed the configured limit.
- Only the registered adapters and `0x4200…0028` ever appear as the mint caller.
- A burn with no matching mint older than N minutes triggers an alert. The same goes for a mint with no matching burn, which should page immediately and pause.
