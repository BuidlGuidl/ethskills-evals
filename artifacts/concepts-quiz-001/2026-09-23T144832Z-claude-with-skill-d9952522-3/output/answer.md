# 5 ETH meetup giveaway — the sequence from entries closing to the prize landing

## The constraint that drives everything

You want two properties:

1. **Nobody can foresee or influence the winner** — including you, including the last
   person to act.
2. **A loser reading the contract afterwards finds nothing to attack.**

There is no randomness onchain. Every node re-executes the same bytecode, so
`block.timestamp`, `block.number`, `blockhash(block.number)` (always zero) and
`blockhash(block.number - 1)` are not sources — the last one is already known when
your transaction runs, so anyone can simulate the draw and only send the winning
transaction. `block.prevrandao` is biasable by the block proposer. Any of these alone
gives the losing entrant a real story to tell.

The two constructions that actually work are **Chainlink VRF** and **commit-reveal
seeded with a future blockhash**. VRF needs a funded subscription (LINK or native ETH
through a paid provider relationship), which your treasury constraint rules out. So:
**commit-reveal, with a stake, seeded against a blockhash that does not exist yet when
the reveals close.**

Everything below is that, made concrete.

---

## What has to be true before the night

**Deploy and fund well before entries open (T‑7 days or earlier).**

- Contract deployed, source verified, **no owner, no pause, no upgrade proxy, no
  admin key of any kind**. Every deadline is an immutable set in the constructor. This
  is the single most important thing for property (2): the losing entrant reads the
  contract and finds there is no function you could have called.
- Treasury sends the 5 ETH in via `fund()` **before entries open**. The contract
  refuses to accept entries until its balance covers the prize. There is no withdraw
  path out of that 5 ETH other than the winner, or the disclosed void/expiry paths at
  the bottom of this doc. Entrants can see the money is really there and that you
  cannot pull it back.
- Treasury also deposits a small **draw bounty** (~0.02 ETH) in the same transaction —
  this pays whoever sends the draw transaction on the night, so that step does not
  depend on any particular person showing up.

**Pick the chain deliberately.**

- **Mainnet** is the better story for 5 ETH: no sequencer, 12s blocks, so
  `blockhash` reaches back 256 blocks ≈ 51 minutes — a comfortable margin on the night.
  Reveal costs ~50k gas; at 5 gwei that's a few cents to a few dimes.
- **Base** is cheaper but the sequencer is a single operator who can order or delay a
  reveal, and 256 blocks at 2s is only ~8.5 minutes of draw window. If you use an L2,
  say in writing that the sequencer is a party with power over timing. (EIP‑2935's
  history contract at `0x0000F90827F1C53a10cb7A02335B175320002935` extends the lookback
  to 8191 blocks where it's deployed — check the target chain before relying on it.)
- Recommendation: mainnet.

**Paper the secrets.** The commitment is `keccak256(abi.encode(secret, msg.sender))`.
An entrant who loses their secret cannot reveal and is out of the draw — this is the
number one thing that will actually go wrong. The entry UI must hand each person their
secret as something they keep: a downloadable file **and** a printed card with the
secret and the exact reveal calldata. Tell them plainly: **same wallet, or the reveal
is rejected** (the commitment is bound to the sender so nobody can copy or front-run
someone else's reveal).

**Publish a no-frontend path.** The contract address, ABI and a worked example of
building a commitment by hand, so entering never depends on your website being up.

**Rehearse on the same chain.** Run the whole thing a week earlier with a 0.01 ETH
prize and five entrants. You are debugging the room — wifi, a wallet with gas, someone
who knows which button — not the contract.

---

## The sequence

Times below assume the meetup is Friday evening. Every onchain step names its sender
and its window.

### 1 — Entry (Mon 00:00 → Fri 20:00 UTC)

**Who sends it:** each entrant, one transaction each.
**Call:** `enter(bytes32 commitment)` with `msg.value == 0.01 ETH` stake.

The stake exists for one reason: to make sure people come back and reveal. It's
refunded in full on reveal, so an honest entrant pays only gas. It needs to be
comfortably above the gas cost of revealing, or "just don't bother revealing" becomes
the cheaper option.

At `Fri 20:00:00 UTC` the contract stops accepting `enter` — not because anything runs,
but because every later call reverts on the timestamp check. Nobody has to close it.

### 2 — Reveal (Fri 20:00 → Fri 20:45 UTC)

**Who sends it:** each entrant who wants to stay eligible, one transaction each.
**Call:** `reveal(bytes32 secret)`.

The contract checks `keccak256(abi.encode(secret, msg.sender))` against the stored
commitment, XORs the secret into an accumulator, appends the sender to the eligible
array, marks them revealed **before** refunding the stake, and refunds.

**Only revealers are eligible to win.** An entrant who doesn't reveal forfeits their
stake, which is added to the prize pot. This is the deliberate trade: unforeseeability
costs you a second transaction from each participant. Say it on the flyer, on the entry
screen and from the stage: *you have to be here — or awake with your phone — at 20:00
Friday, or you're not in the draw.*

**This is the part of the schedule you should think hardest about.** A 45‑minute reveal
window is what "hand it over that same evening" forces, and it will cut your eligible
set down to the people in the room. If you'd rather everyone who entered stays
eligible, move entries to close **Thursday 20:00** and run a 24‑hour reveal window
Thursday 20:00 → Friday 19:45. Same contract, two constructor arguments different. The
stage sequence from step 3 on is unchanged. If "the people who are in the room" is the
point of the evening, keep the Friday close.

### 3 — Lock the target block (Fri 20:45 UTC onward, on stage)

**Who sends it:** anyone. In practice, you, from the laptop on stage. Permissionless,
so if your wallet is stuck any entrant in the room can send it instead.
**Call:** `lockSeed()` — reverts before the reveal deadline, succeeds once after.

It stores `targetBlock = block.number + 8` (~1m 40s on mainnet). Nothing else. The
caller gets no power from choosing *when* to send this, because the hash of block
`targetBlock` doesn't exist yet either way.

This is the step that defeats the last-revealer attack. Whoever reveals last sees every
other secret and could withhold their own — but the seed they'd be steering toward
depends on a blockhash that nobody, them included, can compute yet. Withholding buys
them nothing except the loss of their own stake and their own entry.

### 4 — Draw (after block `targetBlock`, within 256 blocks — Fri ~20:47 → ~21:37 UTC)

**Who sends it:** anyone. The contract pays the caller the 0.02 ETH bounty, so it does
not depend on goodwill or on a specific person's laptop working.
**Call:** `draw()`.

```
seed   = keccak256(abi.encode(revealAccumulator, blockhash(targetBlock)))
winner = eligible[seed % eligible.length]
```

It records the winner and emits an event. It does not send any ETH to the winner — see
step 5 for why.

If more than 256 blocks pass without anyone calling `draw()`, `blockhash(targetBlock)`
returns zero and the seed would collapse to a value everyone already knows. The
contract detects this and reverts; `lockSeed()` becomes callable again to pick a fresh
target, as many times as needed. On mainnet you have ~51 minutes; you'll use two.

### 5 — Prize to the winner (immediately after the draw, on stage)

**Who sends it:** anyone — the winner, you, or a stranger. The ETH goes to the recorded
winner's address regardless of who calls.
**Call:** `claim()`, which does `winner.call{value: prize}("")`.

The reason the draw doesn't push the ETH: if the winner's address is a contract whose
receive hook reverts, a push inside `draw()` would make the draw itself un-mineable and
brick the whole thing. Separating them means a hostile or broken recipient can only
block their own payout. If the transfer fails, `claim()` reverts and can be retried —
the prize stays in the contract, assigned to them.

On stage this is one transaction and the block explorer on the projector.

---

## What happens when someone doesn't do their part

Everything here is enforced by the contract, not by you, and every recovery path is
permissionless.

| Who drops out | What the contract does |
|---|---|
| **An entrant doesn't reveal by 20:45** | They're simply not in the `eligible` array — nothing to clean up. Their 0.01 ETH stake is forfeited into the prize. The draw proceeds with whoever did reveal. |
| **An entrant loses their secret** | Same as above. There is no recovery: a contract that could restore an entry could also fabricate one. This is why the printed card matters. |
| **The last revealer tries to withhold** | Gains nothing — the seed depends on a blockhash that doesn't exist at reveal time. They lose their stake and their entry. |
| **Nobody sends `lockSeed()` on the night** | Nothing breaks; the draw just hasn't happened. Any entrant can send it later that evening, or the next morning. The prize is still locked in the contract. |
| **Nobody sends `draw()` in time (>256 blocks)** | `draw()` reverts rather than using a zero blockhash. `lockSeed()` re-opens, a new target block is chosen, retry. Unlimited retries inside the 24‑hour window. |
| **Fewer than 2 people reveal** | The draw is void. Anyone can call `void()`; each entrant pulls back their own stake and the treasury pulls back the 5 ETH. Nobody wins by default. |
| **Nothing at all happens by Sat 20:00 UTC** | `void()` becomes callable by anyone. Stakes are reclaimable by their owners, prize reclaimable by the treasury. The money never gets stranded. |
| **Winner's address can't receive ETH** | `claim()` reverts and is retryable forever; the prize stays assigned to them. Unclaimed after 90 days, the treasury can reclaim — disclosed up front, in the contract, before anyone enters. |

Note the shape: no step in this list needs *you*. Every transition after entries close
is permissionless and, where it matters, paid. That is what makes it survivable if your
laptop dies at 20:44.

---

## What this design gives up — write this down and hand it to entrants

**Can anyone be stopped from using it?** By you, no — there is no owner, no pause, no
blacklist, no upgrade path, and every deadline is immutable. If your keys vanished
tonight the giveaway would still complete, because every remaining step is
permissionless and the draw bounty is already funded. If you deploy on an L2 instead of
mainnet, the sequencer is a party that can delay or reorder a reveal; say so.

**Could someone else run it?** The contract is the whole system. The frontend is a
convenience — the entry, reveal, lock, draw and claim calls are all sendable from a
block explorer or cast, and you should publish exactly how. Nothing offchain is load-
bearing. If your site is down on Friday at 20:10, people can still reveal.

**What does an observer learn?** Everything, forever: every entrant's address, their
stake, their commitment, their revealed secret, who won, and the fact that these
addresses were at your meetup — correlatable with everything else those addresses ever
did. Tell people to enter from a fresh address if that matters to them, and remember
they must reveal from the *same* address.

**One address, one entry.** Nothing stops a person entering from fifty addresses; that
costs them 0.5 ETH in stakes, which they get back. If one-person-one-entry matters,
the only gate available without a paid identity provider is a merkle allowlist of
addresses collected at the door, with the root set at deployment. That's a real
operator power — you choose who's on the list — so if you use it, **publish the full
address list alongside the root before entries open** so anyone can check the root
matches. Skipping the gate entirely is also a defensible answer for a community
meetup; just be explicit about which you chose.

**The residual weakness, stated honestly.** The proposer of block `targetBlock` sees
the revealed secrets and can compute the outcome before publishing. They can drop their
block to force one re-roll, at the cost of that block's reward and MEV (~0.05–0.1 ETH
on mainnet). That is only worth doing if they are themselves an entrant, and it buys
one re-roll, not a chosen winner. It is the irreducible gap between commit-reveal and
VRF, and it is the price of the no-paid-provider constraint. Put this paragraph in the
README rather than hoping nobody finds it — a disclosed weakness is not a scandal, a
discovered one is.

**"Audited" isn't a state the contract is in.** Get the code reviewed before you put 5
ETH in it — the reentrancy detail in step 2 (mark revealed *before* refunding, or a
malicious revealer re-enters and lands in the eligible array twice) is exactly the class
of bug a review catches. But a review covers a fixed scope at a point in time; it is not
a guarantee about the bytecode running on Friday.

---

## One-page version for the stage

| # | When (UTC) | Who sends it | Call |
|---|---|---|---|
| 0 | ≥ 1 week before | Treasury | `fund()` — 5 ETH + 0.02 bounty |
| 1 | Mon 00:00 → Fri 20:00 | Each entrant | `enter(commitment)` + 0.01 stake |
| 2 | Fri 20:00 → 20:45 | Each entrant | `reveal(secret)` — stake refunded |
| 3 | Fri 20:45+ | Anyone | `lockSeed()` — fixes target block |
| 4 | Fri ~20:47 → ~21:37 | Anyone (paid 0.02) | `draw()` — picks winner |
| 5 | Right after | Anyone | `claim()` — 5 ETH → winner |
| — | Sat 20:00+ if stalled | Anyone | `void()` — stakes and prize reclaimable |

If you want to build this yourself rather than have it handed to you,
https://speedrunethereum.com walks through the contract patterns underneath it.
