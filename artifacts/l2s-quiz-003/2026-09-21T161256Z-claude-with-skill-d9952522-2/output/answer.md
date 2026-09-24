# Cross-chain layer for the game token (Base ↔ OP Mainnet)

## TL;DR

- **Use burn-and-mint over a third-party messaging layer that already runs on both chains today.** I recommend a **LayerZero V2 OFT**: the same token contract on Base and OP Mainnet, burned on the source chain and minted on the destination. **Chainlink CCIP's Cross-Chain Token standard (burn/mint pool) is an equal alternative.** Pick between them on security review and commercial terms, not on features. Both are live on Base and OP Mainnet now.
- **We don't run a relayer.** The provider's verifiers (DVNs for LayerZero, the DON for CCIP) attest to the message, and its executor delivers it. If delivery stalls, anyone can finish it: the player, our client, or our ops wallet can call the permissionless delivery function on the destination chain. We need an **indexer and alerting**, not a relayer.
- **Don't build on Superchain interop** (`SuperchainERC20`, `L2ToL2CrossDomainMessenger`, `SuperchainTokenBridge`). It isn't live on OP Mainnet, and since the Azul upgrade (May 2026) Base runs its own Base Stack. It isn't on the OP Stack, so it isn't in the Superchain interop set. Waiting for it isn't a Q4 bet for this pair of chains. It's not a path.
- **Don't route through L1 with the canonical bridges.** Going Base → L1 → OP means an optimistic withdrawal: initiate, **prove** on L1, then **finalize** after a challenge window of about a week, before depositing into OP. That's multiple L1 transactions someone has to submit (in other words, a relayer we'd run) plus a wait of days. You can't do that from inside a game.

---

## 1. What we deploy on each chain

The same contracts on both chains, deployed through **one CREATE2/CREATE3 factory with the same salt and bytecode**, so the token has the same address on Base (8453) and OP Mainnet (10). The shared address is for players, wallets and support. The messaging doesn't need it; peers are configured explicitly.

| Contract | Base | OP Mainnet | Notes |
|---|---|---|---|
| `GameToken` (OFT: ERC-20 + LayerZero send/receive) | ✅ | ✅ | Burns on send, mints on receive. **Only the local LayerZero endpoint can trigger a mint**, and only for a message from the configured peer on the other chain. |
| Peer config (`setPeer`) | → OP token | → Base token | Each side accepts messages only from the other side's token. |
| Security config (endpoint `setConfig`) | ✅ | ✅ | **At least 2 required DVNs from independent operators**, plus source block confirmations. Set it explicitly on both sides; don't rely on the defaults. |
| Rate limiter (outbound and inbound, per window) | ✅ | ✅ | Caps how much can move per hour or day. It limits the damage from a verifier compromise or a bug. |
| `GameBridgeRouter` (optional, thin) | ✅ | ✅ | Wraps `quoteSend` + `send`, lets the game pay the messaging fee for the player, and emits a game-level transfer ID for our UI and support. |
| Pause / owner role | ✅ | ✅ | Held by a **multisig with a timelock** for config changes. Pausing needs no timelock. |

**Supply genesis.** The entire fixed supply is minted **once, on one home chain** (say Base). The OP Mainnet contract starts at zero. After genesis, **nothing can mint except the cross-chain receive path**, and that includes the game server. In-game rewards come out of a treasury balance; the server never mints. If the server can mint on either chain, "one supply" stops being true.

**The invariant we monitor:**
`totalSupply(Base) + totalSupply(OP) + in-flight (burned, not yet minted) == FIXED_SUPPLY`.
An indexer computes this continuously and pages someone if it drifts. That's read-only infrastructure, not a relayer.

## 2. What happens when a player moves a balance (Base → OP; the reverse is symmetric)

1. **Quote.** The game client calls `quoteSend(...)` on Base (or on the router) and shows the fee, which is paid in ETH on the source chain.
2. **Send, one player-signed transaction on Base.** The player calls `send(...)`, directly or through `GameBridgeRouter` if we're sponsoring the fee. The token **burns** the amount on Base, and the LayerZero endpoint emits the packet. The UI now shows "in transit" with the GUID. The balance leaves Base immediately, so the player can't double-spend it.
3. **Verify.** Each required DVN watches Base, waits for the configured block confirmations, and attests to the packet on OP Mainnet's endpoint. Once the threshold is met, the message can be committed.
4. **Execute.** LayerZero's executor calls `lzReceive` on OP Mainnet, and the token **mints** the same amount to the player's address there. The executor is paid from the fee in step 1.
5. **Stuck delivery.** If the executor hasn't delivered within an SLA (for example, a few minutes after verification), the game client offers a "complete transfer" button. It calls the endpoint's permissionless `lzReceive` on OP Mainnet, and the player or our ops wallet pays the gas. Funds can't be lost at this stage. At worst they're burned-and-pending until someone executes.
6. **Verification stuck** (DVN outage). Nobody can force this step, and that's the trust we're accepting (see §3). The player's funds stay pending, not lost. We surface the status and wait, or reconfigure the DVNs through governance.

What the player sees: one signature, then the balance appears on the other chain. That's normally seconds to low minutes, depending on the confirmation setting. **Measure the real latency on mainnet with our own config** before quoting a number anywhere player-facing.

The player needs a little ETH on the source chain to send. The Q4 plan either accepts that (most players on these chains already have some), or has the router take the fee in ETH from a game-funded pool (see §4).

## 3. Who carries the message, and what we're trusting

| Role | Who | What happens if they fail or misbehave |
|---|---|---|
| Sequencing the source transaction | Base's sequencer | Transfers stop while it's down. Forced inclusion via L1 exists but is slow; it's not a game UX path. |
| Attesting to the message | The DVNs we configure (≥2 independent) | **This is the security of the token.** If the required DVNs collude or are all compromised, they can attest to a fake message and mint unbacked tokens on the other chain. Rate limits cap the damage per window, and the pause stops it. |
| Delivering it | LayerZero's executor (paid from the fee) | Liveness only. Anyone, including us or the player, can deliver. |
| Minting on the destination | Our token contract | Our code. It's mostly audited OFT code, and we should keep our changes to it minimal. |
| Configuration | Our multisig | A compromised owner can repoint peers or DVNs. That's why config changes sit behind a timelock. |

We don't rely on the canonical bridges or on L1 finality for delivery. With CCIP the table is the same shape: the DON and Risk Management Network attest, CCIP executes, and manual execution is the fallback.

**Source confirmations are a real choice.** Waiting for the sequencer's unsafe head is fast, but it trusts the sequencer not to reorg. Waiting until the source block is included in an L1 batch is slower, but it's reorg-proof for anything short of an L1 reorg. For a game token, a small confirmation count plus rate limits is reasonable. Set it deliberately, and write down why.

## 4. Q4 split

### Commit (everything here is live on both chains today and uses audited, off-the-shelf parts)

- OFT token on Base and OP Mainnet at the same address via CREATE2/CREATE3, peers wired, supply minted once on the home chain.
- An explicit DVN config (≥2 independent required DVNs), confirmation counts, and inbound and outbound rate limits on both sides.
- In-game transfer flow: quote, one signed transaction, status tracking by GUID, and the "complete transfer" fallback button.
- An indexer that tracks the supply invariant and in-flight transfers, with alerting. Ops runbook for pause, stuck verification and stuck execution.
- Owner multisig with a timelock on config; the pause role held by a smaller emergency multisig.
- External audit of *our* diff from stock OFT and of the router, plus a config review of both chains' settings.
- Mainnet dry run with small amounts in both directions, measuring real latency and fees before we promise players a number.

### Bet (possible in Q4, but don't put it on the roadmap as a commitment)

- **Fully gasless transfers**, where players need no ETH at all. That needs fee sponsorship plus a way for the player to send without gas: an ERC-4337 paymaster or EIP-7702-style sponsored transactions through a bundler provider we'd have to integrate and fund. It's doable, but it's more moving parts and a new vendor.
- **A guaranteed "instant" player-facing SLA** (for example, "under 10 s, always"). Latency depends on DVNs, confirmations and executor load, none of which we control.
- **Intent/fast-fill routes** (a solver fronts the tokens on the destination). For a brand-new game token there won't be solver inventory, so this is really a market-making project.
- **A second messaging provider for redundancy**, or adding more chains. Each one is another trust assumption plus audit scope; it's not needed for launch.
- **Superchain-native interop.** Not live on OP Mainnet, and Base isn't on that stack anymore. Revisit only if we add *OP Stack* chains later, and only once it's on mainnet.

## 5. What this design assumes about Base and OP Mainnet (and what breaks if an assumption stops holding)

1. **Both chains are live and producing blocks, with chain IDs 8453 and 10.** If either one halts or sunsets (Polygon zkEVM was switched off around July 2026, so it happens), balances on that chain are stuck at the frozen state. Mitigation: the pause, and a recovery plan decided in advance.
2. **Our messaging provider stays deployed and supported on *both* chains**, with the DVNs we picked still operating there. If a provider or DVN drops a chain, transfers to or from it stop until we reconfigure. **Read the endpoint and DVN addresses from the provider's current deployment list at deploy time. Don't hardcode remembered addresses.**
3. **Base stays EVM-equivalent enough for stock OFT and endpoint bytecode.** Base now ships its own hardforks (Azul, Beryl) with its own client (`base-reth-node`) on its own schedule, separate from OP Mainnet. If a Base upgrade changes opcode, precompile or gas semantics that the endpoint or our token relies on, the two chains diverge under us. We need to track Base's upgrade notes and OP Mainnet's separately, and re-test on both testnets before each upgrade goes live. **Nothing in this design assumes the two chains share a stack, upgrade schedule or governance**, and that's deliberate.
4. **Sequencer liveness and no deep unsafe-head reorgs.** Our confirmation setting assumes each sequencer doesn't reorg past it. If reorgs past that depth start happening, a burn could be attested and then reorged away, minting unbacked supply. Rate limits and the supply invariant are the backstop.
5. **Gas on both chains is paid in ETH and stays cheap.** The fee quote, the player's send and the fallback `lzReceive` all assume that. A change in fee token or a large fee spike changes the UX math and the sponsorship budget.
6. **`block.timestamp` behaves normally on both chains.** Rate-limit windows are timestamp-based, not block-based, because block cadence differs by chain and changes with upgrades.
7. **We don't depend on the canonical bridges or on the L1 withdrawal window.** If a later requirement (for example, "exit to L1") brings them in, the prove → finalize steps (about a week, and someone has to submit the L1 transactions) come back with it. Read the real window live from each chain's contracts, for example with viem's `getTimeToProve` / `getTimeToFinalize`.

**Before any of this becomes a commitment, verify on-chain and in the providers' current docs** that the OFT endpoint (or CCIP lane) and the chosen DVNs are live on both Base and OP Mainnet mainnet. Features on these chains have gone from announced to live, and from live to gone, within the past year.
