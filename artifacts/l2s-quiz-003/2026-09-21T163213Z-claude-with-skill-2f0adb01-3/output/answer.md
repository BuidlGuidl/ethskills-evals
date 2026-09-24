# Cross-chain layer for the game token (Base ↔ OP Mainnet)

## TL;DR

- **Model:** burn on the source chain, mint on the destination chain. One token contract per chain, same address on both. No lockbox, no wrapped token, and no liquidity pools.
- **Messenger for Q4:** an established third-party messaging network that already runs relayers/executors on both Base and OP Mainnet. My default is **LayerZero OFT**, with **Chainlink CCIP (CCT)** or **Hyperlane Warp Routes** as alternatives. We don't operate any off-chain service. The game client can also deliver a stuck message itself, so our liveness doesn't depend only on the provider's executor.
- **Not the Q4 plan: Superchain native interop** (`SuperchainERC20` + `L2ToL2CrossDomainMessenger`). It looks like the obvious "no relayer" answer for two OP Stack chains, but Superchain interop isn't fully live, and **Base announced in February 2026 that it is leaving the Superchain**. Treat it as a bet. The token interface is built so we could add it later without a migration.
- **Not usable for gameplay: the canonical L1 bridges.** Base → L1 → OP means a 7-day withdrawal window. That's fine as an escape hatch, but it can't be an in-game feature.

---

## 1. What we deploy

Everything goes to the **same address on both chains** using CREATE2 through the deterministic deployer (`0x4e59b44847b379578588920cA78FbF26c0B4956C`, preinstalled on OP Stack chains). Then the game, wallets and explorers see one token address.

### On Base and on OP Mainnet (identical bytecode)

| Contract | Role |
|---|---|
| `GameToken` (ERC-20 + ERC-2612 permit) | The token. It exposes `crosschainMint` / `crosschainBurn` in the **ERC-7802** style, callable only by allowlisted bridge adapters. Each adapter gets its own **mint/burn rate limits** (xERC20 / ERC-7281 pattern). A compromised adapter can then only inflate supply up to its limit, and adding or removing a messenger is an admin action, not a token migration. |
| `BridgeAdapter` (for example a LayerZero OFT adapter) | Takes the player's request, burns through `GameToken.crosschainBurn`, and sends the message. On receipt it verifies the message came from the peer adapter on the other chain and mints. It stores the peer address, and the destination gas limit is enforced in code. |
| Admin | Safe multisig plus a timelock for config changes (peers, DVNs/validators, rate limits, adding adapters). A separate **pause guardian** can pause adapters immediately without the timelock. |

### Supply model ("one supply")

- The whole supply is minted once, on **Base** (the home chain). OP Mainnet starts with a supply of zero, and tokens only appear there by being bridged.
- The invariant we monitor off-chain: `totalSupply(Base) + totalSupply(OP) + in-flight == TOTAL_SUPPLY`. Anything else means a bug or a compromise, and should page someone and trip the pause.
- Emissions and rewards in the game mint only on the home chain, or through a separate capped minter role. They never go through the bridge path.

---

## 2. What happens when a player moves a balance (Base → OP; the reverse is symmetric)

1. **Quote.** The game client calls `adapter.quoteSend(dstChain, amount)` and gets the messaging fee in ETH, which covers verification and destination gas. It's a small amount on both chains, but show it to the player.
2. **Send (one transaction on Base).** The player's wallet calls `adapter.send(dstChain, recipient, amount)` with the fee attached. The adapter:
   - checks the rate limit and pause state
   - calls `GameToken.crosschainBurn(player, amount)`. No approval is needed because the adapter is an authorised burner.
   - emits the message with a unique id (for LayerZero, the GUID).

   If the game uses smart wallets or a paymaster, this can be one click. See the bet list for gasless.
3. **Verify.** The provider's verifiers wait for the configured number of source-chain confirmations and then attest to the message. For LayerZero these are DVNs: configure **at least 2 required independent DVNs**, not the single default. For CCIP it's the DON plus the Risk Management Network, and for Hyperlane it's the validator set / ISM.
4. **Deliver.** The provider's executor calls the destination adapter's receive function on OP Mainnet. It checks the peer and mints `amount` to `recipient`.
5. **Track in game.** The client polls the provider's message-status API or scan by message id and shows `Sent → Verified → Delivered`. Expect **tens of seconds to a few minutes** end to end. Measure the real number on mainnet with our actual confirmation settings before promising anything to players.
6. **If it stalls.** Once a message is verified, delivery is permissionless. The game client (or a support tool) can submit the destination delivery transaction itself, so **the player is the fallback relayer**. We never have to run a service, but we're also never stuck waiting on someone else's executor.

Failure handling built into the adapter:
- **Destination revert** (for example, paused or over the rate limit): the message is stored as retryable, not lost, and anyone can retry it later.
- **Rate limit hit on send:** reject up front with a clear in-game error. Don't let it fail on the destination side.
- **No "refund on the source" path.** A burned amount is only ever minted on the destination. That removes a whole class of double-spend bugs.

---

## 3. Who or what carries the message

| Option | Who relays | Why / why not |
|---|---|---|
| **LayerZero OFT (recommended)** | The LayerZero executor. Verification comes from DVNs we choose. | The most widely used burn/mint token standard, supported on Base and OP, audited reference code, a status API, and permissionless delivery. The trust assumption is the DVN set we configure, so it's our decision. |
| Chainlink CCIP (CCT) | The Chainlink DON | A strong alternative. The security model is fixed rather than configurable, and it has built-in rate limits. Pick this if the team or legal side prefers Chainlink. |
| Hyperlane Warp Route | The Hyperlane relayer, permissionless | Most self-sovereign, since we can choose our own ISM. The default validator set is weaker than the other two unless we harden it. |
| Superchain native interop | Anyone who calls `relayMessage` on the destination; the security is the chains themselves | Would be the ideal: no third-party trust and no fees beyond gas. **It isn't available Base↔OP and isn't going to be (see assumptions).** |
| Canonical L1 bridges | The L1 contracts | Trust-minimized, but Base→OP means a 7-day withdrawal plus a deposit. Not an in-game feature. |
| Intent bridges (Across, etc.) | Solvers fronting inventory | Built for assets that already have liquidity. For our own token we'd have to fund the solvers, and that's a relayer by another name. |

Pick **one** provider for Q4. Running two providers from launch doubles audit scope and the ways config can go wrong. The ERC-7802 / rate-limit token design is what keeps the choice reversible.

---

## 4. Q4 split

### Commit (well-trodden, can be audited in time)

- `GameToken` on Base and OP at the same CREATE2 address, with ERC-7802-style mint/burn, per-adapter rate limits, and pause.
- One bridge adapter (LayerZero OFT by default) wired between Base and OP, with a hardened verifier config (≥2 required DVNs, explicit confirmation counts, explicit destination gas).
- In-game transfer flow: fee quote, one transaction to send, status tracking by message id, and **client-side self-delivery** as a fallback.
- Multisig + timelock admin, a pause guardian, and a supply-invariant monitor with alerting.
- A focused audit of the token and adapter config. Start booking now: from late September, audit lead times are the critical path for a Q4 launch.
- Conservative launch rate limits, loosened after a few weeks of clean operation.

### Bet (don't put it on the roadmap as a promise)

- **Superchain native interop between Base and OP.** It isn't fully live, and Base is leaving the Superchain, which is the big reason. At most we keep the ERC-7802 interface so a `SuperchainERC20` path could be added *if* that changes, or for other OP Stack chains we add later.
- **Near-instant transfers (a few seconds).** This means minting on the destination against unsafe or unconfirmed source blocks, so we'd take the reorg risk ourselves (for example, fronting from a treasury buffer). It's a real product and risk decision, not a config flag.
- **Fully gasless cross-chain moves.** A paymaster covering source gas *and* the messaging fee on both chains is doable, but it's extra infrastructure and an abuse surface. Maybe gasless on one chain first.
- **Multi-provider redundancy** (for example LayerZero + CCIP, both required or either allowed). Stronger security or liveness, but double the integration and audit work.
- **Expanding past Base + OP** in the same quarter.

---

## 5. Assumptions about Base and OP Mainnet (what breaks if they stop holding)

1. **Both stay EVM-equivalent and keep the same CREATE2 deployer preinstall.** The same address on both chains, and identical bytecode behaving identically, depend on it. Base leaving the Superchain means its hardfork schedule can **diverge** from OP's. Test on both chains after every upgrade of either one; don't assume a fork on one tells you anything about the other.
2. **Our messaging provider keeps first-class support for both chains** (endpoints, DVNs/validators, executors, status API). If the provider deprecates either chain, or the DVNs we require stop serving it, transfers stop. Then we'd need to switch adapters, which the token design allows but which is still an operational event.
3. **Source-chain reorgs stay shallower than our confirmation setting.** OP Stack unsafe blocks *can* reorg if the sequencer's batches don't land on L1 as expected. If a Base or OP block containing a burn is reorged out *after* the destination mint, supply is inflated. We assume the unsafe→safe window stays short and sequencer behaviour stays sane. If that changes (for example, batch posting delays or sequencer misbehaviour), raise confirmations, which makes transfers slower.
4. **Sequencer liveness.** Both chains have one centralized sequencer each. If one is down, players can't send from it, and messages to it can't be delivered until it recovers. Forced inclusion through L1 exists but is slow (hours), so it's no help for gameplay. We assume outages are rare and short. The UI has to handle "chain unavailable".
5. **Gas and messaging fees stay at cents or less.** This covers L2 gas, L1 data (blob) costs passed through, and the provider's fee. If blob fees spike or a chain's fee model changes, the per-transfer cost changes and a sponsored-gas plan could get expensive.
6. **Base ↔ OP native interop is *not* coming.** The design is built on this. Base announced its Superchain exit in February 2026, to be finalized in a future hardfork, and Superchain interop isn't fully live anyway. If that reverses, the design doesn't break, but we'd want to add a native adapter and possibly retire the third party. Re-check this status before committing, because it's the single fact that most changes the recommendation.
7. **Chain governance doesn't act against us.** Both chains are upgradeable by their operators or security councils. An upgrade that changes precompiles, gas accounting or `block.*` semantics could break the adapters. We use `block.timestamp`, never `block.number`, for any timing logic. We accept this the same way every app on these chains does.
8. **Admin keys and verifier config are ours and are watched.** Not a chain assumption, but it's the real security boundary. Whoever controls peers, DVNs or rate limits controls the supply. That's why the timelock and invariant monitor are "commit" items and not nice-to-haves.
