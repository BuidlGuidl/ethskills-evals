# Cross-chain layer for the game token (Base ↔ OP Mainnet)

## TL;DR

- **One token contract, deployed at the same address on both chains.** Supply moves by **burning on the source chain and minting on the destination chain**. Nothing is locked, there's no wrapped version, and there's no "canonical side."
- **Q4 transport: a third-party messaging network that runs its own delivery** (my recommendation is LayerZero OFT in its mint/burn form; Chainlink CCIP with a burn/mint token pool is the equally valid alternative). That's how we avoid running a relayer ourselves. The player pays one fee on the source chain and the tokens arrive at the same address on the destination chain. We run no infrastructure beyond a monitor that only reads.
- **The bet: switch to native Superchain interop** (`SuperchainTokenBridge` + ERC-7802) once Base and OP Mainnet are both live in the same interop dependency set. The token is built for that from day one, so the switch is a permissions change, not a migration. We shouldn't promise it for Q4.
- **Not an option: the canonical OP Stack bridges through L1.** Moving L2→L1→L2 means a ~7-day fault-proof withdrawal window. That doesn't work inside a game.

---

## 1. What we deploy

### On both Base (chain id 8453) and OP Mainnet (chain id 10)

| Contract | Purpose |
|---|---|
| `GameToken` (ERC-20) | Same address on both chains, deployed with a deterministic CREATE2 deployer and the same salt and init code. It implements the **ERC-7802** interface (`crosschainMint` / `crosschainBurn`) plus ERC-165. It holds a small **list of authorized bridges**, each with **its own mint and burn rate limits** (xERC20/ERC-7281-style buckets: a maximum amount per window that refills over time). Only authorized bridges can mint or burn. |
| `GameTokenBridgeAdapter` | The contract the transport talks to. With LayerZero: an OFT-style contract that calls `crosschainBurn` on send and `crosschainMint` on receive, with the other chain's adapter set as its only peer. With CCIP: a BurnMint token pool. It's kept separate from the token so we can add or remove a transport without redeploying the token. |
| Admin Safe (multisig) + timelock | Owns the token and adapter on each chain. Adding a bridge, raising a limit, or changing the peer or security config goes through the timelock (for example 48h). **Pausing and lowering limits are instant**, with no timelock, and use a separate guardian role. |

Supply rules:
- **Genesis mint happens on one chain only** (pick Base or OP, it doesn't matter which). After that, the only way to create tokens on the other chain is a bridge mint that's matched by a burn.
- If the game emits tokens over time (rewards), the emission contract lives on **one chain only** and those tokens reach the other chain through the bridge. Two independent minters would break "one supply."
- The invariant is `totalSupply(Base) + totalSupply(OP) + in-flight = issued supply`. A monitoring job we run (it only reads, it isn't a relayer) checks this and pages us if it drifts beyond what's in flight.

### Off-chain (ours)
- The in-game transfer flow (UI and SDK calls to the adapter).
- The read-only supply monitor and alerts.
- Optional: an ERC-4337 paymaster so players don't need ETH for gas (see §2).

We run no relayer, no signer that attests to messages, and no hot key in the message path.

## 2. What happens when a player moves a balance (Q4 design)

Say a player moves 100 tokens from Base to OP Mainnet:

1. **In the game**, the player picks the amount and destination. The client calls the adapter's quote function to get the messaging fee (paid in ETH on the source chain) and shows it, or hides it if we sponsor it.
2. **Source transaction on Base** (one signature): the adapter calls `GameToken.crosschainBurn(player, 100)`, which checks the burn rate limit, then hands the message `{to: player, amount: 100}` to the transport's endpoint along with the fee. The player's balance on Base drops immediately, and the UI shows "in transit."
3. **Who carries the message:** the transport's own verifier set. For LayerZero, that's the DVNs we configure. **Use at least 2 required DVNs from different operators**, not the default single one. For CCIP, it's the Chainlink DON plus its Risk Management Network. They wait for the confirmation depth we set on Base, attest to the message, and **the transport's executor submits the delivery transaction on OP Mainnet**, paid for out of the source-chain fee. We don't do any of this.
4. **Destination on OP Mainnet:** the adapter checks that the message came from its configured peer on Base, then calls `GameToken.crosschainMint(player, 100)`, which checks the mint rate limit. The balance shows up at the **same address** on OP.
5. **The game** listens for the destination mint event (keyed by message id/GUID) and clears "in transit." It also shows a link to the transport's message explorer.

Details that matter:
- **Same player address on both chains.** With EOAs this is automatic. With smart accounts or embedded wallets, use a factory that produces the same counterfactual address on both chains. Otherwise the destination address has to be passed explicitly and validated. It's still worth putting an explicit `to` field in the message either way.
- **Gas:** the player only needs ETH on the **source** chain, because the transport fee pays for destination execution. To go fully gasless, sponsor the source transaction with a paymaster on each chain. Both chains have mature 4337 infrastructure.
- **Confirmation depth vs. latency:** don't mint on the destination based on the source sequencer's *unsafe* head alone. If the batcher stalls, unsafe OP Stack blocks can be reorged, and then you'd have minted on OP against a burn that no longer exists on Base, which inflates supply. Wait for the source block to become *safe* (its batch is posted to L1). That's roughly minutes, not seconds. A CCIP-style wait for L1 finality is longer, on the order of tens of minutes. **Measure it on mainnet before promising a number in the UI.** Rate limits cap how much damage a reorg can do if the confirmation depth is set too aggressively.
- **Stuck delivery:** if destination execution reverts (for example the mint limit is exhausted), the message stays verified but unexecuted. Anyone can retry it later, and the game client can do that itself. We don't need a service for this.
- **No refunds after burn.** Once the burn is final on the source chain, the only way out is delivery. The UI has to say so before the player signs.

## 3. Q4 commitment vs. bet

### What we can commit to for Q4
Everything here is standard, audited-pattern code on infrastructure that already supports both chains:

1. `GameToken` with ERC-7802 hooks, a multi-bridge allow-list, per-bridge rate limits, pause, and the same address on both chains.
2. One transport (LayerZero OFT mint/burn, or CCIP burn/mint pool), with a hardened config: several required verifiers, explicit confirmation counts, and a single peer per chain.
3. The in-game transfer flow: quote, send, track, retry. It needs ETH on the source chain only, with optional paymaster sponsorship.
4. Safe + timelock admin on both chains, a guardian that can pause instantly, and a written incident runbook (pause both sides, cut limits).
5. A supply-invariant monitor and alerts.
6. **An audit.** This is the real critical path for Q4, not the engineering. The code diff is small, so book the auditor now.

Launch with conservative rate limits (sized to expected daily player flow × a safety factor) and loosen them through the timelock once we have data.

### What's a bet
1. **Native Superchain interop** (`SuperchainTokenBridge` at `0x4200…0028`, `L2ToL2CrossDomainMessenger`, `CrossL2Inbox`). Here the chains' own derivation verifies messages instead of a third party, and transfers could land within about a block. What it depends on:
   - Interop being **activated on mainnet** for both chains, with **Base and OP Mainnet in the same dependency set**. As of my information (mid-2026) this wasn't live on mainnet, so check its current status before planning around it.
   - **Base staying on the Superchain interop roadmap.** Base runs its own upgrade and governance process and doesn't automatically adopt every OP Stack feature.
   - **Someone submitting the relay transaction on the destination chain.** Native interop proves the message but doesn't deliver it. Without a relayer of our own, that's either (a) the **player's own client relaying it** (a second transaction on the destination chain, which a paymaster can sponsor so the player needs no ETH there), or (b) a public auto-relayer run by OP Labs or others, which isn't guaranteed.

   Because the token already implements ERC-7802 at the same address on both chains, adopting interop means timelocked authorization of `SuperchainTokenBridge` as a minter/burner (with its own rate limit), then winding down the Q4 transport's limits. No token migration, and players' balances aren't touched.
2. **"Instant" transfers.** Anything faster than waiting for the source block to become safe means trusting the sequencer's unsafe head. That could be acceptable for small amounts under tight rate limits, but it's a product and risk decision, not a Q4 promise.
3. **Running two transports at once for redundancy.** It sounds safer, but supply security then becomes the *weaker* of the two. Only do it as a timed changeover with limits split between them.

## 4. What I'm assuming about Base and OP Mainnet (and what breaks if it stops holding)

| Assumption | What breaks if it stops holding |
|---|---|
| **Both stay EVM-equivalent and the same CREATE2 deployer exists on both**, so the token can live at one address on both chains. | The "same address" property. Native interop's `SuperchainTokenBridge` *requires* the token at the same address on both chains, so the bet path dies, and wallet and UX simplicity suffers. |
| **The sequencers stay live.** If one halts, transfers in or out of that chain stall. Balances are safe but frozen. Forced inclusion through L1 exists but has a delay of hours, not seconds. | Transfer liveness, not supply safety. Players see "in transit" for as long as the outage lasts. |
| **Unsafe blocks only reorg if the batcher fails, and blocks marked safe (batch posted to L1) only reorg if L1 does.** The confirmation depth is chosen based on this. | Supply safety. A deep reorg of the source chain after the destination has minted duplicates tokens. Rate limits are the backstop. |
| **The chosen transport keeps supporting chain ids 8453 and 10 with an honest verifier set.** | If support is dropped, transfers stop, which is recoverable by authorizing another bridge through the timelock. If the verifiers are compromised, an attacker can mint up to the rate limit, which is why the limits exist and why we require several DVNs. |
| **Chain upgrades (through each chain's upgrade keys / Security Council) don't change the EVM or predeploy behavior our contracts rely on**, and we get notice of hard forks. | Anything that depends on specific opcodes, precompiles, or the `0x4200…` predeploys, most importantly the interop path. |
| **L2 gas stays cheap** (blob-based data availability), so a transfer costs cents. | The economics of transferring inside the game and of sponsoring gas with a paymaster. It isn't a correctness issue. |
| **The L1 withdrawal path keeps its ~7-day fault-proof window.** This is why the canonical bridge is ruled out. | Nothing in this design depends on it. If it got dramatically faster, the canonical bridge would become worth reconsidering. |
| **For the bet only:** Base and OP Mainnet both activate Superchain interop, stay in one dependency set, and keep the ERC-7802 / `SuperchainTokenBridge` interface as currently specified. | The native-interop migration, but not the Q4 product, which doesn't depend on it. |

Summary: for Q4 we ship a burn/mint token with rate limits and a third-party transport that handles delivery, so we have no relayer to run. The token is built to be ERC-7802-ready, so native Superchain interop can become the transport later, when and if Base and OP Mainnet are actually connected through it.
