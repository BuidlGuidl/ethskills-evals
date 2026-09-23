# Friday 20:00 UTC raffle — how the 5 ETH gets from the treasury to the winner, with nobody able to influence or credibly dispute the result

## The scheme in one paragraph

A **commit–reveal raffle whose randomness is mixed from two independent sources**:
(1) a secret chosen by every entrant during the entry week and committed as a hash, revealed on the night; and
(2) the hashes of **8 consecutive Ethereum blocks mined after the reveal deadline** (a chained "dice roll" that no one can see in advance).

Every step after entries close is **permissionless** — the organizers hold no key, no admin function, no upgrade path. The winner is paid **by the contract, inside the draw transaction itself**. No oracle, no LINK, no subscription, no third party: the only token involved is ETH, and the only people involved are whoever is in the room.

Why not the obvious alternatives:
- **Chainlink VRF or any paid RNG** needs a funded account / subscription in a third-party token — excluded by the treasury constraint (ETH only, no provider account).
- **A single future blockhash** is the classic tutorial raffle, but the proposer of that one block can grind it in private, and a losing entrant would have to take everyone's word that it didn't.
- **An external beacon (drand etc.)** introduces an offchain trust root — which is exactly where a "it was rigged" attack would land.

With commit–reveal plus a multi-block anchor, every input to the winner selection is either **committed onchain before anyone could know anything** (the secrets) or **produced by the chain itself after all secrets are public** (the 8 blockhashes). Everything a loser needs to re-check is onchain.

## Contract rules (hard-coded at deployment, immutable afterwards)

- `commitDeadline` — Friday 20:00:00 UTC (block timestamp). Commits accepted from any block while `timestamp ≤ commitDeadline`. One commit per address.
- Commitment format: `keccak256(secret ‖ salt ‖ msg.sender)` — the sender is hashed in, so nobody can copy someone else's commitment and reveal it from their own address for a free ticket.
- `revealDeadline` — Friday 20:15:00 UTC. A reveal is valid if `commitDeadline < block.timestamp ≤ revealDeadline` and the preimage hashes to the stored commitment **for that sender**.
- **Seal**: the first transaction to call `seal()` with `block.timestamp > 20:16:00` records `N = its own block number`. Its hash was unknown to the sender when they signed and sent. Later calls are no-ops while that anchor is live.
- **Draw**: callable once blocks `N … N+7` all exist (i.e. `block.number ≥ N+8`) and while they are all still readable (`block.number ≤ N+250`; the EVM only exposes the last 256 block hashes):

  ```
  digest  = keccak256(abi.encodePacked(reveal_1, …, reveal_R, blockhash(N), …, blockhash(N+7)))
  winner  = revealedEntrants[digest mod R]        // revealedEntrants in commit order
  ```

  where `R` = number of validly revealed entries. The draw transaction **transfers the entire 5 ETH to the winner**. The caller gets nothing — anyone can call it, so nobody must.
- **Re-seal**: if a sealed anchor expires unused (`block.number > N+250`, no draw), the next `seal()` call sets a fresh `N`. Sealing is allowed until 21:30 UTC.
- **Void**: if no winner exists after 21:30 UTC (or if `R = 0`), anyone may call `void()`, which returns the 5 ETH to the treasury. No path ever strands funds.
- **No owner, no pausing, no withdrawal for organizers, no upgrade.** The treasury's only transaction is the one that funds the contract.

Timestamps are the chain's clock: "entries close at 20:00" means *the last block with timestamp ≤ 20:00:00 UTC*. The contract is the sole referee — not anyone's watch.

## What must be in place beforehand

1. **Deploy + fund (treasury's transaction, e.g. Monday morning, before entries open):** deploy the raffle contract with this Friday's deadlines baked in, then send it exactly 5 ETH. Entrants must be able to see, before committing, a contract that already holds the prize and whose rules can no longer change.
2. **Verified, public source code** (Etherscan) published at deployment, so every entrant has the whole week to read it — the "loser reads the contract afterwards" story starts here.
3. **Entry UI that persists the preimage.** The commit screen must store (or make the entrant write down) `secret ‖ salt`. Losing the preimage = being unable to reveal. This is the single most common way an entrant drops themselves.
4. **Entrants need a little ETH for gas** in the committing wallet, on both Friday transactions (reveal; and, if they want, seal/draw — though those aren't theirs to do).
5. **The same wallet on the night.** The commitment is bound to the sender's address, so the reveal must come from the address that committed.
6. **A projector showing the live contract** (commit list, reveal progress "41/53 revealed", then seal and draw), a printed QR to the contract page, and **a rehearsal on a testnet** with the MC so the on-stage sequence is scripted: 20:00 close → reveal → 20:16 seal → ~20:18 draw.
7. **The MC script** makes clear the MC has no special power: seal and draw can equally be sent by any entrant from their phone — the MC is ceremony, not a trust root.

## The exact sequence from entries closing to the prize landing

*(Step 0 is context — it happens during the week.)*

| # | Step | Who sends it | Window | What happens |
|---|------|--------------|--------|--------------|
| 0 | Commits | Each entrant, from their own wallet | Entry week, up to the last block with timestamp ≤ Fri 20:00:00 UTC | Contract stores `keccak256(secret‖salt‖sender)`, one per address. Nothing about any secret is visible. |
| 1 | **Entries close** | — no transaction | 20:00:00 UTC | The commit list is final and public. Nothing anyone can do at this point changes who is in the pool. |
| 2 | **Reveals** | Each entrant, from the **same** wallet (phones, in the room) | Blocks with timestamp in (20:00:00, 20:15:00] | Entrant sends `secret, salt`; contract re-hashes and checks it matches their commitment. Valid reveals form the eligible set, visible on the projector in commit order. |
| 3 | **Seal** | **Anyone** — the MC sends it on stage; any entrant could instead | First call after 20:16:00 UTC (and before 21:30) | The seal block's number `N` is recorded. Its hash — and the hashes of the next 7 blocks — don't exist yet. This is the "dice" being thrown. |
| 4 | **Draw + payout** | **Anyone** — the MC sends it on stage | From `N+8` (≈2 min after seal) until `N+250` (≈50 min after seal; if sealed at 20:16, roughly **20:18–21:06**) | Contract reads `blockhash(N) … blockhash(N+7)`, mixes them with all revealed preimages, computes `digest mod R`, and **transfers the full 5 ETH to the winning address inside this same transaction**. The winner does nothing; the prize lands in their wallet on stage, roughly 20:20, and everyone in the room can recompute it on their phones. |
| 5 | Void (failure path only) | Anyone | After 21:30 UTC, only if no winner was paid | 5 ETH returns to the treasury; raffle is void. |

Why the ordering is what it is:
- Secrets are hidden (hashed) during the entry week → nobody, organizers included, can pick entries or grind outcomes at commit time.
- Reveals close **before** the anchor blocks exist → the last revealer knows all secrets but still cannot compute the digest, because 8 future block hashes are unknown to them. Withholding a reveal doesn't shift the odds; it only removes the withholder.
- The seal sender cannot choose a favorable hash: `N` is the block their own transaction lands in, whose hash no one knows at signing time.
- Even the proposer of block `N` can't grind: the digest depends on 7 *later* blocks' hashes that don't exist yet. To bias the digest you would have to control the proposers of **8 consecutive slots** and grind all of them within their 12-second windows — uneconomical by orders of magnitude for 5 ETH, and publicly visible onchain afterwards.

## What if someone doesn't do their part in time

- **An entrant doesn't reveal by 20:15.** They are simply not in the eligible set; their secret isn't in the mix and they can't win. That is the *entire* effect. The draw never depends on any individual's cooperation — entropy and integrity come from the anchor blocks plus everyone who did reveal — so a non-revealer cannot stall, shrink, or bias anyone else's chances. (No bond is needed: withholding is self-exclusion, not griefing.) If a reveal contains the wrong preimage, the transaction reverts and they can retry any time inside the window.
- **Nobody calls seal by 20:45.** Nothing breaks; the seal window simply stays open (to 21:30). Any entrant can send it from their seat. In practice the room full of people with money on the line is the redundancy — a failure here requires literally everyone to abstain.
- **Nobody calls draw before the anchor expires (~50 min).** That anchor dies, the contract re-arms, and the next `seal()` sets a fresh `N`. A two-minute delay, nothing more.
- **Nobody does anything by 21:30.** `void()` becomes callable; the 5 ETH goes back to the treasury. Inaction can delay or void the raffle, but it can never freeze funds, never change the winner, and never let anyone (organizers included) redirect the prize.
- **The organizers do nothing at all after deploying.** Irrelevant by construction: post-deployment there is no privileged action for them to skip. They cannot cancel, extend, reopen, reorder, or redirect — the contract's rules were frozen before the first entry.

## Why a losing entrant can't build a credible rigging case

Everything that determined the winner is onchain and reproducible: the commitment list (provably submitted before 20:00), every reveal (the contract itself verified each preimage against its commitment, and the commitment is bound to the revealer's address, so the eligible set and its order cannot be doctored), and the 8 anchor block hashes (readable from any node or explorer). Anyone can re-run `keccak256(reveals ‖ hashes) mod R` and get the same winner — on the night or a month later.

To have *actually* cheated, an accuser must name a mechanism, and every candidate fails:
- Change a secret after committing → impossible; the commitment hash binds it.
- Copy someone's ticket → impossible; the hash includes the sender's address.
- Withhold a reveal to steer the outcome → impossible; the anchor hashes didn't exist yet, and you only exclude yourself.
- Pick or grind the anchor → requires proposing 8 consecutive Ethereum slots, and the grinding (and the proposer overlap with the winning entry) would be on permanent public record — for a 5 ETH prize.
- Organizers intervened → they had no transaction to send and no key to use; their only onchain act was funding the contract before entries opened, and the code they deployed was public for a week before anyone entered.

That is the standard the design is built to meet: not "trust us, it was fair," but "here is the data, recompute it yourself."