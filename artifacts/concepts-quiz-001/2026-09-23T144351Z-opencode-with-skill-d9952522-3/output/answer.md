# 5 ETH meetup raffle — the exact sequence

**Chain assumption:** mainnet (12 s blocks). Every block-count figure below
rescales if this runs elsewhere — see the lookback note in step 5.

## The approach, and why

Chainlink VRF is the usual answer for "provably fair randomness", and it's
excluded here twice over: it needs a funded account with a third-party
provider, and the value arrives in a *later* callback transaction, not when
you ask for it. So: **commit-reveal**, built so the organizers contribute
nothing to the outcome and cannot stall any step.

During the entry week each entrant commits
`hash(their address, secret, salt)` onchain, along with a refundable bond.
After entries close, each entrant reveals their own `secret, salt`. The
winning seed is `keccak256(all reveals, in commit order ‖ blockhash(H))`,
where `H` is a block mined *after* reveals close. Nobody — us included —
supplies any input that existed before the entrants chose their secrets, and
the blockhash didn't exist when they chose them. Every function that advances
the raffle after deployment is **permissionless**: if we stall, anyone in the
room can send the transaction instead. There is no owner key at all.

The bond exists because the last person to reveal can see the outcome coming
(they know every earlier reveal, which is onchain, plus their own secret) and
could withhold their reveal to re-roll the dice once. Withholding means
forfeiting the bond and dropping out of the draw, so as long as the bond
exceeds what one re-roll is worth — roughly `prize / entrants`, ~0.1–0.2 ETH
for 5 ETH over a few dozen people — withholding is strictly money-losing.
**Bond: 0.25 ETH**, refundable on reveal, and one commit per address.

## What has to be in place beforehand

1. **Contract deployed and funded before entries open.** Deployment
   transaction moves the 5 ETH from the treasury into the contract, so the
   prize balance is visible onchain all week — entrants can verify the money
   is real before they commit their bonds. Parameters fixed in code:
   entries close Fri 20:00:00 UTC, reveal deadline 20:30:00, lock deadline
   21:00:00, draw deadline 21:15:00, unwind from Sat 20:00:00 UTC, bond
   0.25 ETH, one commit per address. No owner, no upgrade, no admin
   functions of any kind.
2. **Source verified on the block explorer**, plus a published recipe and a
   small script (`verify.js`) that recomputes the winner from onchain data.
   This is what makes the "was it rigged?" question answerable by anyone.
   A verified contract alone is not the whole story: the *frontend* (entry
   page, reveal page) is a convenience we run and it can die — entering and
   revealing must also be doable straight from the block explorer, and on
   the night that's our stated fallback.
3. **An entry flow that doesn't lose the secret.** The commit page generates
   `secret` + `salt`, sends the commit, and makes sure the entrant still has
   them on Friday — saved in the wallet they'll bring, or printed on a slip.
   If an entrant loses their secret, their entry and bond are dead. The
   contract cannot recover it, by design — that's what makes the secret
   theirs alone. Say this loudly at entry time.
4. **Gas in the MC's wallet**, and two or three community members told in
   advance that they can also send the lock/draw transactions if we fumble.
5. Optional but nice: in-person sign-in at the pre-meetup entry session, so
   "one commit per address" is roughly "one per human."

## The sequence on the night

| # | When (UTC) | Transaction | Who sends it | Why they send it |
|---|---|---|---|---|
| 1 | Entry week → Fri 20:00:00 | `enter(commitHash)` + 0.25 ETH bond | Each entrant | To be in the draw |
| 2 | Fri 20:00:00 | **None** — entries close | Nobody | The contract simply rejects `enter` after the deadline; there is no cron, no keeper, nothing to forget |
| 3 | 20:00:00 → 20:30:00 | `reveal(secret, salt)` | Each entrant (their own wallet, in the room) | Only a revealed commit is eligible to win, and only reveal gets the bond back |
| 4 | 20:30:00 → 21:00:00 | `lock()` — records `H = block.number`, once | Anyone; the MC on stage | The hash of block `H` is not knowable until `H` is mined, so nobody could have precomputed the seed |
| 5 | One block after `H` → 21:15:00 | `draw()` | Anyone; the MC on stage | Computes the seed, pays the prize, refunds bonds — all in this one transaction |

**Step 5 in detail — this is where the prize lands.** `draw()`:

- takes the revealed entrants in commit order (a list fixed before any
  secret was known),
- computes `seed = keccak256(reveals ‖ blockhash(H))`,
- picks `winner = seed mod count(revealed)` — modulo bias here is
  `count / 2^256`, i.e. zero credible,
- **pushes the 5 ETH to the winner's wallet in the same transaction**, and
- refunds every revealed entrant's bond plus their pro-rata share of any
  forfeited bonds, in the same loop (~50 refunds is fine in one tx).

Payment is a push, not a claim: the winner does not need to be on stage,
present, or to ever send a transaction. Realistic timing: lock at 20:31,
draw at 20:32, prize in the winner's wallet by ~20:45 at the latest.

**Lookback note (why the windows are these sizes):** `blockhash` only reaches
back 256 blocks ≈ 51 minutes on mainnet. Latest lock is 21:00 and latest
draw 21:15, so `draw()` is at most ~75 blocks after `H` — always inside the
window. On a 2-second chain this collapses to ~8.5 minutes and the windows
must be re-sized (or rely on the EIP-2935 history contract, 8191 blocks ≈
27 h, where it exists).

## If someone doesn't do their part in time

- **An entrant doesn't reveal by 20:30.** Their commit is excluded from the
  draw and their bond is forfeited, split among everyone who did reveal.
  The night continues exactly as planned — their secret simply isn't in the
  seed. The same forfeit is what prices the "reveal last, watch the outcome,
  withhold to re-roll" move: one re-roll is worth < 0.2 ETH, withholding
  costs 0.25 ETH and your entry.
- **Nobody sends `lock()` by 21:00** (our laptop dies, we stall, we're
  gone). Two answers, in order: anyone in the room can send it — that's the
  point of permissionless. If the entire room misses the window, a
  permissionless `drawLate()` opens at 21:15 with no deadline, seeding from
  the reveals alone. Still unforecastable at commit time (any honest
  entrant's secret was), and weaker in exactly one named way: a holder of
  most of the commits could grind it. Acceptable as a fallback that should
  never fire.
- **Nobody ever draws.** After Sat 20:00:00, permissionless `unwind()`:
  prize back to the treasury address (fixed at deployment), every bond back
  to its sender. Funds can never freeze in the contract — every path ends
  with the money going somewhere named, and every path is callable by
  anyone.
- **Zero reveals** (or below an optional minimum-entrants floor): the
  raffle can't run; same unwind path, all bonds refunded.
- **We disappear at any point after deployment.** Nothing happens. No key
  exists that can pause, redirect, extend, or upgrade anything. The
  remaining steps are reveals (entrants' own money at stake) and
  lock/draw/unwind (permissionless, and there's a room full of people who
  want the raffle to conclude). Conversely, no key means no rescue either:
  if we deploy with the wrong close time, the raffle runs with the wrong
  close time.

What the contract *does* about all this is enforcement-by-guard, not
enforcement-by-actor: each function checks the clock itself
(`commit` only before 20:00, `reveal` only 20:00–20:30, `lock` once in
20:30–21:00, `draw` only after lock and before 21:15). There is no
transaction whose absence breaks the schedule, and no person whose
presence is required.

## Why a losing entrant can't credibly claim it was rigged

They run the published script against the verified source and check, from
public data alone:

1. every commit was mined before 20:00 — nobody entered after close;
2. every reveal hashes to a pre-existing commit from the same address;
3. the seed recipe is deterministic: `keccak256(reveals-in-commit-order ‖
   blockhash(H))`, and `H` is onchain with a timestamp after 20:30 — its
   hash did not exist while any secret was being chosen;
4. `winner = seed mod N` over the revealed list — one line of arithmetic.

To claim rigging they must name which input was gamed. Each input was,
at the moment it mattered, outside every single party's control: each
secret known only to its entrant, the blockhash not yet mined, and the
organizers contributing nothing — there is no owner function that touches
the draw, no pause, no proxy, no blacklist, so "the organizers did X"
has no X to point at.

What the design honestly gives up, stated plainly so nobody finds it
before we say it:

- The proposer of block `H` could have dropped the `lock()` transaction for
  one re-roll (~1/N of 5 ETH ≈ 0.1 ETH for a night's effort, and invisible
  to a lone victim but also available to *anyone in the room*, not just us
  — it's a 12-second window that any attendee can close by re-sending).
- A withheld reveal re-roll is priced below water by the bond.
- The `drawLate` fallback is grindable by a majority commit-holder.
- Sybil entries would raise someone's odds honestly; our own sybils would
  be visible onchain (addresses freshly funded from one wallet) and the
  room would notice. We considered a team blacklist and rejected it — it
  would be an operator power over user funds, which is a worse rigging
  story than the one it prevents.
- Withholding a *permissionless* transaction can only delay, never change,
  the outcome, and closing the evening requires censoring the whole room's
  transactions for minutes, in public.
- Privacy: none, by nature. Entrant addresses, bonds, and the winner are
  public forever. For a meetup raffle that's a feature.

One housekeeping note: "audited", if we ever get it, covers a point in time
and a fixed scope — the verification script above is the standing
guarantee, because it checks the chain itself, every month, forever, with
nobody running it.