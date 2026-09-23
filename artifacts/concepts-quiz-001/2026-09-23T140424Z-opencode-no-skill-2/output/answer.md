# The Friday-night draw: commit–reveal + a future block hash

## The design in one paragraph

Every entrant locks in a hidden secret **before** entries close (commit), everyone
reveals their secret in a 30-minute window after closing (reveal), and the winning
index is derived from the XOR of all revealed secrets **mixed with the hash of a
block that doesn't exist yet** at the moment the last possible reveal happens.
Because the entropy isn't final until after all choices are locked in, nobody —
organizers included — can predict or steer the outcome, and every input is onchain
and recomputable by any losing entrant afterwards. No LINK, no VRF subscription,
no third party: just ETH for the prize and gas.

---

## 1. What must be in place beforehand

**The contract (deployed and source-verified on Etherscan well before entry week):**

- `enter(bytes32 commitment)` payable with a small deposit (e.g. 0.01 ETH).
  The commitment is `keccak256(abi.encodePacked(entrantAddress, secret))` —
  binding the secret to the sender so nobody can copy someone else's reveal.
- A hardcoded `CLOSE_TIME` (Friday 20:00:00 UTC). Entries are rejected after it,
  enforced by `block.timestamp`, not by anyone sending a transaction.
- A reveal window: `CLOSE_TIME` to `CLOSE_TIME + 30 minutes`.
- A permissionless two-step draw (`finalizeReveals()` then `draw()`), and a
  `claim()` for the winner.
- The treasury funds the contract with **exactly 5 ETH before entries open**, so
  anyone can see onchain that the prize is escrowed and the organizers can't
  touch it. Forfeited deposits get added to the pot.

**Operational:**

- A simple dApp (projected at the venue / on the meetup page) that: generates the
  secret client-side, shows it to the entrant, and makes them save it (screenshot
  or written down). **Losing the secret = losing the deposit and eligibility.**
  This is the one thing to drum into people at the door.
- The 0.01 ETH deposit exists purely to make people bother revealing; the
  block-hash mix (below) is what actually removes any *strategic* reason to
  withhold.
- A laptop on stage with a wallet holding a little gas, and the events feed
  projected on screen so the room watches each step land.

---

## 2. The exact sequence on the night

Times assume 12-second blocks; every step is permissionless so "who" is a
suggestion, not a dependency.

| # | Step | Who sends it | Window |
|---|------|--------------|--------|
| 0 | Entries close | **Nobody — automatic.** `enter()` starts reverting at `CLOSE_TIME`. | Friday 20:00:00 UTC exactly |
| 1 | `reveal(secret)` — contract checks the hash against the commitment, marks the entrant revealed, refunds their 0.01 ETH deposit on the spot | **Each entrant**, from the wallet they entered with (they're in the room with their phones; the screen shows a live "revealed: n / N" counter) | 20:00 – 20:30 UTC |
| 2 | `finalizeReveals()` — XORs all revealed secrets into `revealSeed`, marks non-revealers as forfeited (deposit → pot, out of the draw), and records `targetBlock = block.number + 2` | **The MC on stage** (but anyone may call it) | Any time after 20:30 |
| 3 | `draw()` — computes `seed = keccak256(revealSeed, blockhash(targetBlock))`, `winnerIndex = uint256(seed) % revealedCount`, records the winner | **The MC on stage** (but anyone may call it) | After `targetBlock`, and **within 256 blocks (~51 minutes) of it** — after that `blockhash` returns zero. In practice called at ~20:31, seconds after step 2 |
| 4 | `claim()` — the contract sends the winner 5 ETH plus all forfeited deposits | **The winner**, from their entry wallet, on stage | Any time from the moment `draw()` lands, up to a 30-day claim deadline |

The prize lands in the winner's wallet around **20:35**, on stage, with the
transaction visible on the projector.

**Why this order is safe:** every reveal is locked in before `targetBlock` even
exists, so the last person to reveal cannot compute the outcome and has nothing
to gain by withholding — withholding is a *blind* reroll, not a chosen one.
The organizer calling `finalizeReveals()` can't grind either: choosing when to
send it changes `targetBlock`, but every future block hash is equally unknown.
The winner is determined by data that was fixed (commitments, timestamps) or
unknowable (a future block hash) before anyone could react to it. A loser can
recompute the XOR and the modulo from public events and the verified source.

---

## 3. If someone doesn't do their part

- **An entrant doesn't reveal by 20:30** (lost secret, dead phone, walked out):
  `finalizeReveals()` forfeits their 0.01 ETH deposit into the pot and excludes
  them from the draw. The draw proceeds without them. This is stated in the
  entry flow, so there's no "rigged" case to build — their commitment simply
  never opened, which anyone can verify.
- **The organizers disappear / never call `finalizeReveals()` or `draw()`:**
  doesn't matter. Both functions are permissionless; any entrant (or anyone at
  all) can call them after the deadlines. The organizers are never a single
  point of failure.
- **Nobody calls `draw()` within 256 blocks of `targetBlock`** (~51 min):
  `blockhash(targetBlock)` becomes unavailable, so `draw()` for that target
  reverts. The contract exposes `reArm()`: anyone calls it to set a fresh
  `targetBlock = block.number + 2`, and `draw()` proceeds against the new
  block. The reveal seed stays locked; only the unpredictable component is
  re-rolled, and only because the old one expired.
- **Nobody reveals at all:** the draw still runs over the full entrant list with
  `revealSeed = 0`, i.e. on the future block hash alone — still unforeseeable at
  entry time and outside organizer control.
- **The winner never claims:** after 30 days, anyone can call
  `sweepUnclaimed()` to return the unclaimed prize to the treasury.
- **The winner's wallet is a smart contract that rejects plain transfers:**
  that's exactly why payment is pull (`claim()`) not push — a reverting receive
  function can never wedge the draw for everyone else.

**The one honest caveat** for the "credible rigging claim" test: the validator
proposing `targetBlock` could, in theory, withhold their block for one blind
reroll. Doing so costs them real money (missed proposal reward and MEV), buys
them no *chosen* outcome, and would require colluding with a specific entrant in
the room — not a credible story for a 5 ETH community giveaway, and it's
impossible for the organizers to do on their own. Every other actor in the
system has provably zero influence.
