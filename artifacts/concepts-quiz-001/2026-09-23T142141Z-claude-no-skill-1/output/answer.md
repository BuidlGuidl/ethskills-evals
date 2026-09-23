# Drawing the 5 ETH winner on stage, with nobody able to steer it

## The short version

No paid VRF, no LINK, no off-chain oracle. The randomness comes from two
independent sources that are mixed together on-chain:

1. **Sealed commitments** from a small set of bonded *sealers* — people in the
   room who each commit to 32 secret bytes *before* entries close and reveal
   them *after* entries close.
2. **`blockhash` of a future block** that is pinned by a transaction before that
   block exists.

`seed = keccak256(revealed secrets ‖ blockhash(targetBlock))`
`winner = entrants[uint256(seed) % entrants.length]`

To bias the result you must control *every* sealer who revealed **and** the
proposer of the target block. To foresee it you must know all the secrets plus a
block hash that does not exist yet. Every input is an on-chain transaction, so a
losing entrant can recompute the winner from public data in three lines of code
and get the same answer — that is the whole defence against "it was rigged".

Why the pieces are shaped this way (each fixes a real, specific attack):

- Sealers commit **before** entries close, so nobody can choose a secret with
  the final entrant list in front of them.
- Reveals are accepted **only after** entries close, so no entrant can enter
  *in response to* a known seed.
- The block hash is pinned in a separate transaction (`lockDraw`) **before** the
  block is mined, so the person who calls `draw` cannot simulate the call, see
  they lost, and just call again in the next block. This is the mistake that
  sinks most home-made raffles.

---

## What has to be in place beforehand

**More than a week out**

- **Deploy the contract and verify the source** on Etherscan. Publish the
  address, the verified source, and the exact commit hash. All parameters
  (`closeTime`, `revealDeadline`, prize amount, bond size, the sealer list) are
  `immutable`, set in the constructor. There is **no owner, no admin, no pause,
  no upgrade path, and no function that can change an entrant list, a deadline,
  or a winner.** That absence is what an accusing entrant will be reading for.
- **Fund it with exactly 5 ETH from the treasury** in the same session, before
  entries open. The contract refuses entries until `address(this).balance >= 5
  ether`, and after the first entry there is no path that returns that ETH to
  the treasury except the "no entrants" branch below. The treasury cannot pull
  the prize back mid-week.
- **Recruit 3 sealers.** Pick people who are **not entrants** (the contract
  enforces this: a sealer address cannot call `enter`, and an entrant cannot
  register as a sealer) and who do not all answer to the organisers — e.g. one
  organiser, one regular from a different community, one venue/speaker guest.
  Each will be in the room on the night with a funded wallet.
- **Publish the rules and this timeline** in advance, including the residual
  risk section at the bottom. Saying the limits out loud beforehand is worth
  more than claiming perfection.
- **Dry-run the whole thing on a testnet**, on the clock, with the real people
  doing the real key-presses. Rehearse once more the day before.

**Before Friday 20:00 UTC (the commit window)**

- Each sealer generates 32 random bytes offline (`openssl rand -hex 32`), saves
  them somewhere they will still have on Friday night (written down is fine),
  and sends `commit(keccak256(secret ‖ msg.sender))` plus a **0.25 ETH bond**.
  The bond goes into the contract; the secret never leaves their machine.
  - Hashing the sender in with the secret stops sealer B from copying sealer
    A's commitment off the mempool and cancelling A's contribution.
- Entrants call `enter()` any time during the week, one entry per address, zero
  value, gas only. (On Sybils: "anyone who turns up" is not something the chain
  can check. If you care, gate `enter` on an attendance signature from an
  organiser key — that lets organisers control *who is eligible*, which is a
  judgement they are already making at the door, but it still gives them no
  influence over *which eligible entrant wins*. Don't conflate the two.)

**On the night, in the room**

- Sealers present with their secret and gas. A laptop on a wallet with a
  handful of ETH for gas, plus a second one as backup, to send the
  permissionless calls. A block explorer on the projector.

---

## The sequence on the night

| # | Step | Who sends it | Window |
|---|------|--------------|--------|
| 0 | Entries close | nobody — `block.timestamp >= closeTime` | Fri 20:00 UTC |
| 1 | `reveal(secret)` | each sealer, one tx each | 20:00 → 20:15 UTC (`revealDeadline`) |
| 2 | `lockDraw()` | **anyone** (permissionless) | any time after 20:15 UTC |
| 3 | `draw()` | **anyone** (permissionless) | from `targetBlock + 1` until `targetBlock + 200` (~40 min) |
| 4 | prize lands | `draw()` pays the winner inside the same tx | immediate |

**Step 0 — entries close.** No transaction. `enter()` reverts once
`block.timestamp >= closeTime`. The entrant array is frozen from that instant
and there is no function anywhere that adds to it, removes from it, or reorders
it.

**Step 1 — reveal, 20:00–20:15 UTC.** Each of the 3 sealers sends `reveal(bytes32
secret)`. The contract checks `keccak256(secret ‖ msg.sender) == theirCommitment`,
XORs the secret into an accumulator, marks them revealed, and refunds their 0.25
ETH bond in the same transaction. Reveals before 20:00 or after 20:15 revert.
Fifteen minutes is deliberately generous for three transactions; it is the
buffer for a congested block or a fumbled hardware wallet, and you can run the
raffle segment of the meetup around it.

**Step 2 — `lockDraw()`, any time after 20:15.** Anyone can call it; do it from
the stage laptop the moment the reveal window closes. It requires at least one
revealed secret (see failure modes), then records
`targetBlock = block.number + 2` and emits it. This is the tx that makes the
draw unfoolable by its own caller: the randomness is now pinned to a block that
does not exist yet, so retrying does not get you a different answer.

**Step 3 — `draw()`, from `targetBlock + 1`.** Anyone. That's roughly 24–36
seconds after step 2 — on stage you simply count two blocks on the explorer and
press go. The contract computes

```
bytes32 h = blockhash(targetBlock);
require(h != bytes32(0), "expired, re-lock");
uint256 seed = uint256(keccak256(abi.encode(accumulatedSecrets, h)));
address winner = entrants[seed % entrants.length];
```

and emits `Winner(winner, seed, targetBlock)`.

**Step 4 — payment.** `draw()` sends the 5 ETH to the winner in the same
transaction with `call{value: 5 ether}("")` and a generous gas stipend. If that
call **succeeds**, you're done: the prize is in their wallet before the
applause stops, and it never touched an organiser's hands. If it **fails** — the
winner entered from a contract or a wallet with a reverting receive hook — the
draw does *not* revert (a reverting payout must never be able to un-declare a
winner). The amount is credited to `owed[winner]` and they call `claim()`
themselves whenever they like.

Steps 2, 3 and 4 need no organiser key. If the entire organising team is hit by
a bus at 20:10, any entrant with a phone can finish the draw.

---

## When someone doesn't do their part

**A sealer doesn't reveal by 20:15.** Their 0.25 ETH bond is **forfeited into
the prize pot**, paid to the winner on top of the 5 ETH. The draw proceeds with
whoever did reveal — `require(revealCount >= 1)`. Nothing waits for them and
nothing is rescheduled.

The bond exists because a sealer who withholds has exactly two outcomes to pick
between (reveal, or don't), i.e. one bit of grinding, which at best doubles one
entrant's chance. Sealers are barred from entering, so the only way to cash that
in is to collude with an entrant — and it costs a certain 0.25 ETH to buy an
extra `5/N` ETH of expected value for someone else. With 20+ entrants that is
underwater; with fewer than 20 entrants, raise the bond to 0.5 ETH on the night,
or accept it and say so. Either way the *evidence* is public: a non-reveal is
visible forever on-chain, with a name attached.

**No sealer reveals at all.** `lockDraw()` still succeeds if all three bonds
were posted and all three were forfeited (a `require(revealCount >= 1 ||
allBondsForfeited)` branch), and the seed falls back to `blockhash(targetBlock)`
alone. Weaker — see the residual risk below — but the prize is still handed over
that evening, and all 0.75 ETH of bonds ride on top. The alternative, cancelling,
would hand any single sealer a veto over the whole giveaway, which is worse.

**Nobody calls `lockDraw()`.** Nothing expires. It stays callable by anyone,
forever, and the entrant list and the ETH stay frozen in place. Worst case the
draw happens next morning, or next month, with the same guarantees.

**Nobody calls `draw()` in time.** `blockhash` only reaches back 256 blocks
(~51 min), and returns zero beyond that. The contract enforces a 200-block
window and reverts with "expired" on a zero hash rather than drawing on a seed
of zero — which would be a fixed, fully predictable winner, and is the single
nastiest bug in this class of contract. Recovery: anyone calls `lockDraw()`
again, which pins a fresh `targetBlock = block.number + 2`, and you draw within
the next 40 minutes. Re-locking is permissionless and unlimited, and it does not
let anyone grind: the secrets are already fixed and each attempt is still
pinned to a block that doesn't exist yet at pin time. (It does hand a re-locker
a second sample if the first draw is left to expire *deliberately* — which is
why the window is 200 blocks and you draw two blocks after locking, in front of
a room full of witnesses.)

**The winner can't receive ETH.** Covered above: `owed[winner]` plus `claim()`,
callable forever. If it is still unclaimed after 90 days, `sweepUnclaimed()`
returns it to the treasury address fixed at construction. No one can trigger
that early.

**Nobody entered.** After `closeTime` with zero entrants, `refundTreasury()`
returns the 5 ETH to the treasury address and the bonds to the sealers. It is
the only path that moves the prize anywhere other than to a winner, and it can
only fire when the entrant array is empty.

**Chain congestion / RPC trouble on the night.** Every deadline is generous
(15 min for 3 txs; 40 min for one), every post-close step is permissionless so
any of several people can send it, and the worst outcome of blowing every window
is a delay, never a lost prize and never a manipulable draw.

---

## Residual risk, stated plainly

One party has a sliver of influence: the **validator who proposes
`targetBlock`**. They can skip their slot, forfeiting their block reward and MEV
(~0.05–0.15 ETH), to force a resample — one extra draw, no more. That is only
worth doing if they are themselves an entrant, which for a meetup crowd is
overwhelmingly unlikely, and if they are, the sealers' secrets are already mixed
in and fixed, so their resample is over the whole seed, not a targeted pick.

This is a real limit and it is why the sealer commitments carry the weight: with
even one honest sealer reveal, the proposer cannot know *whose* name their
resample produces without also knowing that secret. Put this paragraph in the
published rules. A raffle that says "here is the one bit of slack and here is
what it costs to use it" is far harder to attack afterwards than one that claims
to be perfect.

**Rejected alternatives, and why:** Chainlink VRF needs a funded subscription
with a third party — ruled out by the treasury constraint. `blockhash` or
`block.prevrandao` read directly inside a `draw()` that anyone can call at any
moment is trivially grindable by the caller and is the classic rigged-raffle
bug. An off-chain RNG with an organiser submitting the result is exactly the
thing a losing entrant would be right to complain about. drand / League of
Entropy is free and genuinely good, but needs on-chain BLS verification and
someone to relay the beacon on the night — more moving parts, and the relayer
becomes another person who has to show up on time.
