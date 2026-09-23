# 5 ETH meetup raffle — the exact sequence, what must be in place, and what happens when someone drops the ball

## The design in one paragraph

No Chainlink VRF (the treasury holds ETH only, and we're not funding a provider
account for one evening), no owner key, nothing only we can do after deploy.
Entrants' committed secrets plus the hash of one block that **doesn't exist yet
when anyone could still change their mind** decide the winner, and every step
after entries close is permissionless, so the people in the room can run the
whole draw if we're fumbling on stage. The draw rule, fixed in verified source:

```
seed   = keccak256( revealed secrets sorted by entrant address  ‖  blockhash(drawBlock) )
winner = sorted entrant list [ seed % entrant count ]
```

Why this shape: there is no randomness to read onchain — every node re-executes
the same code. `block.timestamp`/`block.number` are steerable by the proposer of
a block; `blockhash(block.number)` is always zero; `block.prevrandao` is
proposer-biasable. And the usual first attempt — having the draw read
`blockhash(block.number - 1)` whenever someone calls it — is broken twice: the
caller can simulate the outcome and only send the winning transaction, and the
proposer who built that block could have dropped it to re-roll. So the deciding
hash must come from a **specific block that nobody can know at the moment they
act** — committed secrets for everyone's dice, and a pinned future block so the
last actor can't see the outcome coming.

## What has to be in place beforehand

1. **The contract, deployed and verified** — sent once by the treasury
   (multisig is fine), any day before entries open. Baked into the code at
   deploy, public and final: entry window ends **Friday 20:00:00 UTC**, reveal
   window ends **20:30:00 UTC**, `pin()` opens **20:31:00 UTC**, prize = 5 ETH
   paid inside `draw()`, and if nobody entered at all the first `draw()`
   returns the pot to the treasury address. **No owner, no pause, no upgrade,
   no admin function.** Deployment is the last privileged thing we ever do;
   after that the contract is a vending machine.

2. **The 5 ETH already inside the contract** — treasury sends it early in the
   week (Monday, not Thursday). Two reasons: entrants can see the funded pot
   onchain before they bother entering, and a slow multisig can't ruin Friday
   night. On the night, no treasury signature is needed at all — `draw()` pays
   out of the contract's own balance.

3. **Entries, all week** — each attendee sends `enter(commit)` from their own
   wallet, any time before Friday 20:00 UTC, with
   `commit = keccak256(secret ‖ salt ‖ their address)`. The address-binding
   means a commit can't be stolen or replayed by another entrant, and
   front-running a *reveal* gains nothing (reveals are public by design). The
   UI on their device keeps the secret and salt; they'll need them Friday.
   One entry per address.

4. **Room readiness** — a QR to the verified source on the explorer, and the
   explicit understanding (say it on stage) that *anyone* can call `pin()`,
   `draw()` and `claim()` from any wallet. That is our redundancy. A tiny
   open-source script that recomputes the winner from onchain data is a nice
   extra but optional.

## The sequence on the night

| # | When (UTC) | Transaction | Who sends it | Window |
|---|------------|-------------|--------------|--------|
| 0 | Fri 20:00 | **None.** Entries close. | Nobody — `enter()` simply starts reverting. | — |
| 1 | 20:00–20:30 | `reveal(secret, salt)` | Every entrant, from the address they entered with | 30 minutes |
| 2 | from 20:31 | `pin()` — first mined call sets `drawBlock` to the block it lands in | Anyone; on the night, us on stage. First call wins; later calls revert. | 20:31 until the draw — realistically immediately |
| 3 | ~20:32 (once the pin block is mined and final) | `draw()` | Anyone; us on stage. Identical result whoever calls it. | Within 256 blocks of `drawBlock` (~51 min at 12 s/block, ~8.5 min at 2 s/block) |

Step 3 in detail: `draw()` reads `blockhash(drawBlock)`, hashes it together
with the revealed secrets (sorted by entrant address, so nobody gains by
ordering their reveal), indexes into the entrant list sorted by address, and
**sends the 5 ETH to the winner in the same transaction**, emitting the seed
and winner in an event. The prize lands in the winner's wallet the moment
`draw()` is mined — around 20:33, on stage, with the room watching the block
confirm.

**Who and why, honestly stated.** Entrants reveal for cents of gas, one tap;
their reveal puts *their* entropy into the draw and the room can see who
contributed — but note that revealing does not change anyone's odds (that's
the point: no one, revealer included, has bias available to them). We send
`pin()` and `draw()` because we want to hand over the prize tonight; if we
don't or can't, any attendee can, because both are permissionless and fully
deterministic — the caller cannot tweak the outcome. A stranger passing by
with a wallet could run steps 2 and 3 too. Nothing runs itself onchain; the
timers only stop `enter()` and `reveal()`. The steps that must *happen* are
exactly the two that any hand in the room can perform, which is what makes
this keep working when the organizers are busy on stage.

**Why pin after the reveal deadline.** `pin()` requires block timestamp ≥
20:31, and `reveal()` reverts at 20:30 — so every reveal, without exception,
is in a block strictly earlier than the pin block. The last revealer acts
while the deciding hash is still unknowable, so they cannot simulate the
outcome and cannot gain by withholding their reveal. This is the ordering
that lets entry be free: the classic commit-reveal construction, where the
draw is seeded from a hash that already exists during the reveal window, needs
a forfeitable deposit to stop the last revealer from simulating and
withholding. If you ever change the ordering, you must add that deposit.

## Why nobody — us included — can influence or foresee the result

- Secrets are committed **before** entries close and bound to each address;
  they can't be changed after anyone else's commit is known.
- The one thing an attacker needs — simulate first, act second — is removed
  twice: reveals lock **before** the draw block is even chosen, and the pin
  block's hash is unknown to whoever sends the pin transaction (so it's not
  the `blockhash(block.number - 1)` trap where the caller picks their moment).
- We hold no key that matters. After deploy we have no pause, no draw
  authority, no upgrade, nothing. House rule: organizers don't enter.
- After the pin block is mined, the winner is already fixed by public data;
  `draw()` just executes arithmetic anyone can redo.

**The one residual, disclosed plainly:** the staker who happens to propose
the pinned block is, at that moment, the sole holder of the deciding hash. If
that staker were also an entrant, they could rebuild the block to re-roll.
They cannot steer toward a chosen winner — the committed secrets are mixed in
and unknown to them at entry time — only re-roll for themselves, once per
attempt, at the cost of a block. Their edge equals their share of stake on
that one 12-second slot. This residual exists in every ETH-only design
(it's what VRF exists to remove, and the treasury constraint rules VRF out).
For a 5 ETH community pot it is negligible, and it's still smaller than the
influence a "trusted organizer draws from a hat" gives us.

## How a losing entrant checks it afterwards

Everything needed is permanent and public:

1. Read the verified source — the draw rule is the four lines at the top.
2. Confirm all commits landed with timestamps before Friday 20:00 UTC, one
   per address.
3. Confirm the entrant list onchain, read the reveals and the pin
   transaction, get `blockhash(drawBlock)` from any explorer or archive node
   (the draw transaction's event also records the seed).
4. Recompute `seed`, the index, and the winner — with our script or from
   scratch — and check it matches the emitted event and the 5 ETH transfer.

Nothing in that chain depends on us being honest or even alive. That's the
whole answer to "it was rigged."

## If someone doesn't do their part in time

- **An entrant misses the 20:30 reveal deadline.** Their entry still stands,
  they can still win; the seed simply doesn't contain their secret — which
  moves nobody's odds, theirs included, because nobody could have evaluated
  the difference. `reveal()` reverts after 20:30; the unrevealed secret stays
  secret forever, harmlessly.
- **Nobody reveals at all.** The draw still runs; the seed falls back to the
  pinned blockhash alone. Still unbiased — the pin happens after reveals are
  locked, and a hash nobody could foresee at entry time doesn't become
  predictable because reveals are missing.
- **Nobody pins at 20:31.** Nothing happens and nothing decays: the pot sits
  in the contract and `pin()` stays open indefinitely. Anyone — an attendee,
  a stranger, the winner-to-be — can pin at 21:00 or next Tuesday with the
  identical result. The raffle has no expiry that anyone can miss.
- **Nobody calls `draw()` within 256 blocks of the pin** (~51 minutes on a
  12-second chain, ~8.5 minutes on a 2-second L2 — so on a fast chain, draw
  promptly after pinning). The `blockhash` read goes to zero, so `draw()`
  refuses to run on a dead seed and `pin()` reopens to pin a fresh block.
  Re-pinning is safe for the same reason pinning was: reveals are locked
  long before, and the new pin's hash is just as unknowable to its sender.
  If the chain has the EIP-2935 history contract
  (`0x0000F90827F1C53a10cb7A02335B175320002935`), the hash stays readable
  for 8191 blocks instead of 256 — check it's actually deployed there before
  relying on the longer window rather than the re-pin path.
- **The winner's wallet can't receive ETH** (a contract wallet with a
  reverting fallback). `draw()` doesn't fail: it records the prize as
  claimable, and the winner (or anyone) sweeps it later with `claim()`.
- **We don't do our part on the night** — lost laptop, dead phone, stage
  fright: the room runs steps 2 and 3 from any wallet; the result is
  identical. If we vanished entirely the Friday before, the raffle still
  runs to completion without us. That's not a hope, it's the design: after
  deployment there is nothing only we can do.
- **The treasury never funded the pot.** Visible all week onchain — and
  honest entrants will have checked before entering. `draw()` would revert
  rather than pay out a prize that isn't there; the fix is procedural (fund
  on Monday, publicly).
- **Zero entrants.** The first `draw()` returns the pot to the treasury
  address baked in at deploy — no key, no vote, just the state machine
  unwinding.

## What this design gives up (said out loud)

- **Operator powers after deploy: none.** No pause, no upgrade, no owner, no
  blacklist. The trade: a mistake baked in at deploy is also permanent. The
  parameters above are simple enough to read aloud on stage before entry
  opens.
- **Censorship:** a proposer can exclude someone's `enter` or `reveal`
  transaction from the blocks they build. Sustaining that across a week-long
  entry window is unrealistic, and — by design — eligibility never depends on
  a reveal getting through in a narrow window.
- **Anyone can run it:** contracts, pot, entrant list and the draw itself are
  the entire system, onchain. The frontend and our script are convenience and
  die with us; the raffle doesn't.
- **What observers learn:** every entrant address, the winner, and the pot
  are public forever. For a meetup raffle that's the nature of the event.
- **Sybil:** entry is free and permissionless, so one person can enter from
  many wallets. Onchain personhood doesn't exist; a per-person cap can only
  be enforced at the door, offchain, and wouldn't be trustless.
- **"Verified" is not "audited":** a point-in-time review of fixed scope.
  For a one-night 5 ETH pot, minimal code plus a source everyone can read is
  the assurance level we're choosing; a recurring pot deserves an audit.