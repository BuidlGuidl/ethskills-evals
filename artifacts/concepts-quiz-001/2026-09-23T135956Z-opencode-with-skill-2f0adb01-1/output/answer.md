# Provably fair 5 ETH meetup raffle — run of show

## The core idea

Two properties you asked for — *nobody can foresee or influence the winner* and *losers can verify it afterwards* — rule out the two "easy" options:

- **Chainlink VRF** is out: it needs LINK and a funded subscription, and the treasury holds ETH only.
- **A simple future-blockhash draw alone** is weak: the validator who proposes that one block can compute the outcome before publishing and withhold their block if they don't like it.

So the design is **commit–reveal by the entrants, combined with a future blockhash**, with every step permissionless. The security property you get: *as long as at least one entrant reveals an honest secret, nobody — not the organizers, not a validator, not a cartel of other entrants — can predict or steer the result.* The organizers hold no secret and no admin key in the draw path at all, which is exactly what lets a losing entrant read the contract and find nothing to complain about.

Key mental model: **nothing onchain is automatic.** The contract is a state machine that sits still until someone pokes it and pays gas. So every step below names who pokes it, why they would, and the window they have.

---

## What must be in place beforehand

1. **The raffle contract, deployed and source-verified on Etherscan, address published at least a week ahead.** Verified source is what makes "go read the contract afterwards" a feature instead of a threat. Parameters baked in at deploy:
   - `entryDeadline` = Friday 20:00:00 UTC (timestamp).
   - `revealDeadline` = Friday 20:20:00 UTC.
   - Prize amount = 5 ETH.
2. **Treasury sends exactly 5 ETH to the contract before entries open.** Anyone can then verify onchain that the prize is locked and the contract can pay. No `onlyOwner` withdrawal before the draw — the only pre-draw escape hatch is a `recover()` callable by the treasury **only if the draw was never started, and only after a 30-day timeout**, so it can't be used to rug the event.
3. **An entry UI** (a simple static page is fine) that, for each entrant:
   - generates a random 32-byte secret in the browser,
   - submits `enter(keccak256(secret))` — one entry per address, before the deadline,
   - shows the secret as a backup code and tells the entrant to save it. **Losing the secret = can't reveal = excluded from the draw.** Say this out loud at entry time, in plain language.
4. **A dry run on a testnet** with the organizing crew earlier in the week, so the on-stage transactions are muscle memory.
5. **The MC's phone/laptop** with a funded wallet and the contract's Etherscan "Write Contract" tab (or the UI) open. This is a convenience, not a trust point — every poke below is callable by anyone in the room.

---

## The sequence on the night

### Step 0 — Entries close (no transaction)
- **When:** Friday 20:00:00 UTC, enforced by the contract.
- `enter()` reverts after `entryDeadline`. The entry list and all commitments are now frozen and public. Nobody sends anything; the deadline is just a timestamp check.

### Step 1 — Reveal
- **Who:** every entrant who wants to stay in the draw, from their own wallet (phones in the room).
- **What:** `reveal(secret)`. The contract checks `keccak256(secret)` against the stored commitment and marks the entrant as revealed.
- **Window:** 20:00–20:20 UTC (20 minutes, enforced by `revealDeadline`).
- **Why this window exists:** all reveals must be locked in *before* the future blockhash exists, so that no one can compute the outcome before deciding whether to reveal.

### Step 2 — Start the draw
- **Who:** anyone — in practice the MC calls it on stage; any entrant can if the MC fumbles.
- **What:** `startDraw()`. Requires `block.timestamp > revealDeadline`. Records `targetBlock = block.number + 10` (~2 minutes ahead).
- **Window:** any time after 20:20 UTC. On stage, call it at ~20:25.
- **Why anyone may call it:** the caller gains nothing — the target block hasn't been mined, so its hash is unknown to everyone, including the caller.

### Step 3 — Finalize and pay (the on-stage moment)
- **Who:** anyone — MC on stage, or the winner, who is strongly incentivized.
- **What:** `finalize()`:
  1. Requires `block.number > targetBlock`.
  2. `seed = keccak256(abi.encode(xorOfAllRevealedSecrets, blockhash(targetBlock)))`
  3. `winner = revealedEntrants[uint256(seed) % revealedEntrants.length]`
  4. Transfers 5 ETH to the winner in the same transaction.
- **Window:** after `targetBlock` (~2 minutes after Step 2) and **within 256 blocks of `targetBlock` (~51 minutes)** — after that, `blockhash(targetBlock)` returns zero onchain. Call it live at ~20:30; the tx hash goes up on the projector and the prize is already in the winner's wallet.
- **The ~2-minute gap between Step 2 and Step 3 is the "nobody can foresee" window:** once `targetBlock` is mined, anyone can compute the winner, so do Step 3 promptly and make the reveal part of the show.

### Afterwards — verifiability
Every input is onchain and public: all commitments, all revealed secrets, `targetBlock`, its blockhash, and the index arithmetic. A losing entrant can recompute `seed % n` themselves against verified source code. There is no organizer input in the seed at all — "us included" can't influence it because there is literally no organizer parameter to influence it with.

---

## What happens if someone doesn't do their part

| Failure | Contract's response | Why it can't be abused |
|---|---|---|
| **An entrant doesn't reveal by 20:20** | They are excluded from the draw; their commitment never enters the seed. No refund needed (entry was free). | Withholding a secret can only remove *yourself* from winning. At reveal time the `targetBlock` hash doesn't exist yet, so a withholder can't know whether revealing helps or hurts them — aborting buys zero influence. |
| **An entrant loses their secret** | Same as above: they can't reveal, so they're excluded. | Prevented socially, not in code: the UI makes them save a backup code at entry. |
| **Nobody calls `startDraw()`** | Nothing happens — the contract is a state machine and won't move on its own. | Every entrant in the room is incentivized to poke it; it's permissionless and costs cents of gas. This is why the dry run matters. |
| **`finalize()` isn't called within 256 blocks of `targetBlock`** | `blockhash(targetBlock)` becomes unreadable, so `finalize()` would revert. Anyone can then call `reseed()`, which sets a fresh `targetBlock = block.number + 10`, reopening the finalize window. | Reseeding is safe because the new blockhash is just as unpredictable as the old one, and the secrets are already locked — the caller cannot steer the outcome, only restart the clock. |
| **Zero entrants reveal** | `finalize()` reverts (division by zero guard). After the 30-day timeout, the treasury can call `recover()` to take the 5 ETH back. | Realistically impossible at a meetup where everyone present wants the prize; the timeout path exists so funds can never be permanently bricked. |
| **A validator proposes `targetBlock` and doesn't like the result** | They can withhold their block — but that costs them their block reward, only buys a 1-in-~1-million-slot lottery ticket (they must happen to be assigned that exact slot), and the *next* proposer's block is used instead, which they don't control. | The XOR of revealed secrets means even the proposer can only veto their own block at cost, never steer toward a chosen winner. This residual 1-bit bias is the honest price of avoiding a paid oracle, and it's far below the trust bar for a community meetup. |
| **The organizers disappear mid-event** | Nothing breaks. There is no admin key in the draw path: reveal, `startDraw`, `finalize`, and `reseed` are all callable by anyone, and the winner is paid by the contract, not by the treasury team. | This is the property that makes the system credible to a skeptical loser: the people running the event are *unnecessary* the moment the contract is funded. |

---

## Timeline summary (Friday night, UTC)

| Time | Step | Tx sender |
|---|---|---|
| before the week | Deploy, verify, fund 5 ETH, publish address | Treasury / organizers |
| Mon–Fri 20:00 | `enter(commitment)` | Each entrant |
| 20:00 | Entries close (timestamp check, no tx) | — |
| 20:00–20:20 | `reveal(secret)` | Each entrant |
| ~20:25 | `startDraw()` → sets `targetBlock` | MC (or anyone) |
| ~20:30 | `finalize()` → winner computed + 5 ETH paid | MC (or anyone) on stage |
| fallback | `reseed()` if the 256-block window was missed | Anyone |
| +30 days | `recover()` only if the draw never started | Treasury |
