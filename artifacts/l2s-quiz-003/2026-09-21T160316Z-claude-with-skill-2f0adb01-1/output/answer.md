# Cross-chain layer for the game token (Base + OP Mainnet)

## TL;DR

- **Model:** one token contract, deployed at the **same address** on Base and OP Mainnet. It uses **burn-and-mint**: burn on the chain the balance leaves, mint on the chain it arrives. There is no lockbox and no wrapped copy. Supply is fixed across both chains.
- **Who carries the message:** an existing third-party messaging network. **LayerZero (OFT)** or **Chainlink CCIP (Cross-Chain Token)** are the two I'd shortlist. Their verifiers confirm that the burn happened, and their executors deliver the message and pay destination gas. **We don't run a relayer.** We do trust their verifier set, and we limit how much damage that trust can do with rate limits.
- **What we don't build on:**
  - **The canonical OP Stack bridge through L1.** Moving from Base to OP that way means an L2→L1 withdrawal, which takes about 7 days. That is unusable inside a game.
  - **Superchain native interop** (SuperchainERC20 / L2ToL2CrossDomainMessenger). Superchain interop is not fully live. Base also announced in Feb 2026 that it is leaving the Superchain, to be finalized in a future hardfork. If we built on it, we'd be depending on a link between these two chains that is being taken apart.
- **Q4 commitment:** in-game "move balance" in both directions, typically settling in minutes, with rate limits, a pause switch, supply monitoring, and gas sponsored by us. **Bets:** seconds-level latency, fully trustless messaging, and any native Base↔OP interop.

---

## 1. What we deploy

Deploy with CREATE2 through the standard deterministic deployer, using the same salt and bytecode on both chains. Both contracts then have the same address. This makes client code, allowlists and support much simpler.

| Contract | Base | OP Mainnet | Notes |
|---|---|---|---|
| `GameToken` (ERC-20) | ✅ | ✅ | Identical bytecode and address. Implements the **ERC-7802** `crosschainMint` / `crosschainBurn` interface. Minting is restricted to an allowlist of bridge adapters, and each adapter has its own mint/burn rate limit (xERC20 / ERC-7281 style). |
| `BridgeAdapter` | ✅ | ✅ | A thin contract over the messaging protocol (OFT adapter, or CCIP token pool). It is the only minter/burner. Each adapter only accepts messages from its twin on the other chain (peer config). |
| Pause / guardian | ✅ | ✅ | A multisig that can pause the adapter and change limits. It **cannot** mint. |
| Paymaster (ERC-4337) or sponsored smart accounts | ✅ | ✅ | So players don't need ETH to move a balance (see §2). |
| Off-chain: indexer + supply monitor | — | — | Read-only. Tracks pending moves for the UI and alerts if `supply_Base + supply_OP + in_flight ≠ TOTAL`. This is monitoring, not a relayer: if it goes down, no transfer fails. |

**Genesis:** mint the whole fixed supply on one chain, probably Base since that's where our players and the Coinbase on-ramp are. OP Mainnet starts at 0. From then on, the only way to create supply on either chain is a verified burn on the other chain.

**Why the token is wrapped behind ERC-7802 and the bridge is a separate contract:** it keeps the messaging provider swappable. If the provider drops a chain, has an incident, or a better option appears, we add a new adapter as a minter with its own limit and wind the old one down. We don't have to migrate the token.

## 2. What happens when a player moves a balance (Base → OP; the reverse is symmetric)

1. **In game:** the player picks an amount and "Move to OP". The client calls `adapter.quote(amount, dstChain)` to get the messaging fee in ETH. That fee **includes prepaid destination gas**, so the player never needs ETH on OP.
2. **Source transaction (Base):** a single transaction from the player's account, with gas and the messaging fee sponsored through our paymaster or smart-account setup. The adapter checks the outbound rate limit and **burns** the amount. The messaging endpoint emits a message `{to, amount, nonce}` addressed to the OP adapter. If the limit would be exceeded, the transaction reverts here, before anything is burned.
3. **Verification:** the provider's verifiers (LayerZero DVNs, or the CCIP DON) wait for the block confirmations we configured on Base, then attest to the message.
4. **Delivery (OP Mainnet):** the provider's executor calls the OP adapter. The adapter checks that the peer is correct and that the nonce hasn't been used, checks the inbound rate limit, and **mints** to the player.
5. **UI:** the indexer shows "moving…" from step 2 until the mint event in step 4. The game treats the balance as spent on Base as soon as step 2 is included, and as available on OP only after step 4.

**Failure handling (all of these must be in the Q4 scope):**
- **Delivery fails on the destination** (gas too low, or the adapter is paused): the message stays stored and **anyone can retry it**. The funds are burned on the source and still owed on the destination, and the UI shows "pending — retry". Nothing is lost, but it can be stuck until someone retries.
- **Inbound rate limit hit:** the message queues or fails and becomes retryable after the window resets. Set limits well above normal player flow so this only triggers during an attack.
- **Latency:** expect roughly tens of seconds to a few minutes. It depends mostly on how many source confirmations we require. **Measure it on testnet before promising a number in the UI.**

**Choosing confirmations:** this is where speed trades off against security. On OP Stack chains, a block is "unsafe" when the sequencer produces it (2s), "safe" once its batch is posted to L1, and "finalized" once that L1 block is final (about 15 min). Waiting only for unsafe blocks, or for **Flashblocks preconfirmations on Base**, is fast. But if the sequencer reorgs, that could produce a mint on OP without a burn surviving on Base. For a game token with rate limits, a few unsafe confirmations is a reasonable risk. For large transfers, route through a "safe head" setting. We should pick this deliberately. The provider's default is not a decision.

## 3. Who carries the message, and what we're trusting

The **messaging provider's off-chain network** carries it: its verifiers attest, and its executor delivers and pays gas. We don't operate anything that has to be online for a transfer to complete. That's the "no relayer" requirement met.

The cost is trust. **If the provider's verifier set is compromised or misconfigured, it can mint unbacked tokens on either chain.** Mitigations, in order of how cheap they are:
1. **Per-chain mint rate limits** in the token or adapter. This caps the damage per window, and it's the most important mitigation.
2. **Require at least 2 independent verifiers** (for example, LayerZero with two DVNs from different operators). Don't accept the single default.
3. **The guardian can pause** within minutes, triggered by the supply monitor alert.
4. Optionally, add **our own verifier as a required signer**. That is the strongest option, but it means running infrastructure that must stay up, which is exactly what you wanted to avoid. I'd treat it as a later decision, not a Q4 item.

**Rejected carriers:**
- **OP Stack Standard Bridge through L1:** trustless, but the Base→L1 leg is a roughly 7-day withdrawal, followed by an L1→OP deposit. Not an in-game experience.
- **Superchain interop / SuperchainERC20:** no Base↔OP path we can rely on (see TL;DR).
- **Intent / fast bridges** (Across, etc.): fast, but a solver has to hold inventory of *our* token on both chains. That liquidity won't exist for a new game token, and we'd end up paying market makers to provide it.

## 4. Q4: commit vs. bet

### Commit (established infrastructure, only our own integration work)
- `GameToken` plus adapters on both chains at the same CREATE2 address, with burn/mint and a fixed total supply.
- One messaging provider (LayerZero OFT **or** CCIP CCT). **Before committing,** confirm on their docs that both Base (8453) and OP Mainnet (10) endpoints are live, and check their verifier options.
- An in-game move flow with fee quoting, one sponsored signature, a pending state, and retry for stuck messages.
- Per-chain rate limits, a guardian pause, and a supply-invariant monitor with alerting.
- ≥2-verifier configuration and a written confirmation policy.
- An external audit of the token and adapter (small surface area, mostly reviewed patterns). Book it now, because Q4 audit slots fill up.

### Bet (don't put these on the roadmap as promises)
- **"Instant" moves (a few seconds).** This needs aggressive confirmation settings or preconfirmations, and that means accepting reorg risk. We can tune toward it after launch using real data.
- **Native Base↔OP interop with no third party.** Superchain interop isn't fully live, and Base is leaving the Superchain. If it ever becomes available between these two chains, the ERC-7802 token can add it as another minter. That's upside, not a dependency.
- **Trustless messaging** (ZK light-client or storage-proof bridges between the two chains). Promising, but not something to stake a Q4 launch on.
- **Multi-provider quorum** (mint only when two providers agree). More security, roughly double the fees and integration work. Better as a v2 hardening step.
- **Chain-abstracted balances** (the player never sees which chain their tokens are on, and the game moves them automatically). This depends on everything above working smoothly first.

## 5. Assumptions about Base and OP Mainnet — if any of these stop holding, the design breaks

1. **Both chains stay EVM-equivalent and deployable with the same bytecode at the same address.** Specifically: the CREATE2 deterministic deployer exists on both, and there are no opcode or precompile differences that affect our contracts. *Watch item:* Base leaving the Superchain means its stack may diverge from OP's over future hardforks. We re-check at each Base hardfork.
2. **Our messaging provider keeps supporting both chains** (endpoints live, verifiers and executors running on both). If it drops one, moves stall. There's no loss, because burned funds are retryable, but they stay stuck until the provider comes back or we move to a new adapter. That's why the ERC-7802 swappable design exists.
3. **Source-chain blocks at our confirmation depth don't reorg.** If the Base or OP sequencer reorgs deeper than our setting, a mint can be backed by a burn that no longer exists. That breaks the supply invariant, and rate limits are the only thing bounding it.
4. **The sequencers are live.** If one goes down, moves out of that chain stop. Forced inclusion through L1 exists, but it's slow (hours). Players can't move balances during an outage. We need an in-game banner for this, not a fix.
5. **Gas stays cheap** (sub-cent L2 execution). Sponsoring every move only makes sense while a move costs a fraction of a cent in L2 gas plus the messaging fee. A large fee spike on either chain makes sponsorship expensive, and we'd need per-player caps.
6. **We are *not* assuming native Base↔OP interop.** If we had built on SuperchainERC20, Base leaving would break us. This design deliberately doesn't depend on it.
7. **Chain upgrades don't change message semantics under us.** Both chains are upgradeable by their governance or security councils. A chain-level upgrade that changes fee or gas accounting, or block timing, could affect the destination gas limits we prepay. Use `block.timestamp`, never `block.number`, for rate-limit windows.
