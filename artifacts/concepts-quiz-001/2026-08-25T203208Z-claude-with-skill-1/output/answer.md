# 5 ETH meetup raffle — the sequence from entries closing to the prize landing

## The short version

No paid provider means no Chainlink VRF, so the randomness has to come from the
people in the room. Every entrant commits to a secret during the week, everyone
reveals their secret in the 40 minutes after entries close, and the seed is
those reveals mixed with the hash of a block that hasn't been mined yet when the
last reveal lands.

That ordering is the whole design, and it's the answer you give a sore loser:

- **Nobody can foresee the winner**, because the last input to the seed is a
  blockhash from the future relative to every reveal.
- **Nobody can influence the winner**, because each entrant's contribution was
  locked into a hash before anyone had revealed anything, and the only remaining
  choice — reveal or don't — is made blind.
- **A loser reading the contract afterwards** finds their own secret inside the
  seed, an entry list that was published before anything was known, and no owner
  key that could have touched any of it.

`block.prevrandao` on its own would technically stop *you* rigging it, but it is
a known-biasable source and a losing entrant can read that on any blog. Don't
hand them the argument. `blockhash(block.number)` is always zero, and
`block.timestamp`/`block.number` are not random at all.

## Contract state machine

```
enter(commitment, merkleProof)   Mon 00:00 UTC  →  Fri 20:00 UTC   entrants
reveal(entrant, secret, salt)    Fri 20:00 UTC  →  Fri 20:40 UTC   anyone
closeReveals()                   Fri 20:40 UTC  →  Sat 20:40 UTC   anyone
draw()                           seedBlock mined →  seedBlock+8191  anyone
abort()                          after either deadline passes      anyone
```

Commitment: `keccak256(abi.encode(entrantAddress, secret, salt))`.

Seed accumulator, updated on every valid reveal — XOR, so it does not depend on
the order reveals arrive in and a block builder can't reorder anything into a
better position:

```solidity
seedAcc ^= keccak256(abi.encode(secret, entrant));
```

Winner selection, also order-independent, so the index someone happens to occupy
in the array is worth nothing:

```solidity
bytes32 seed = keccak256(abi.encode(seedAcc, blockhash(seedBlock)));
// winner = the revealer with the largest keccak256(seed, revealer)
```

Iterating a few hundred revealers costs well under 100k gas, and anyone can
recompute the same result offchain from public data in about ten lines.

## The sequence on the night

| # | When | Tx | Who sends it | Why they would |
|---|---|---|---|---|
| 0 | Mon 00:00 – Fri 20:00 UTC | `enter(commitment, proof)` | each entrant, from their own address | it's their ticket |
| 1 | Fri 20:00 – 20:40 UTC | `reveal(entrant, secret, salt)` | each entrant, or anyone holding their secret | **an unrevealed entry cannot win** — this is the ticket, not step 0 |
| 2 | Fri 20:40 UTC onward (on stage: ~20:41) | `closeReveals()` | permissionless; in practice an organiser at the podium | at this moment nobody knows who wins, so every entrant has ~5/n ETH of expected value riding on this call happening |
| 3 | ~36 s later, once `seedBlock` is mined (on stage: ~20:42) | `draw()` | permissionless; the winner will happily send it | the winner is already computable from public data — whoever wants the 5 ETH has 5 ETH of reason to call it |

`closeReveals()` sets `seedBlock = block.number + 3`. The caller picks *when* to
call, but `blockhash(block.number + 3)` doesn't exist yet, so they are picking
blind, and it can only ever be set once.

`draw()` reads `blockhash(seedBlock)`, computes the winner, and pushes the 5 ETH
with a `call{value: 5 ether}`. If that transfer fails (winner is a contract that
rejects ETH), it credits the winner instead and they take it with `withdraw()`
whenever they like. The draw itself is final either way — a failed transfer
never bricks the raffle or lets it be re-run.

Two transactions about 40 seconds apart is good theatre, incidentally: "reveals
are closed, we're waiting on block 23,140,912" — then the hash lands and the
name appears.

### Why every step is permissionless

There is no `onlyOwner` anywhere. If you lose your keys on Thursday, or nobody
from the organising crew makes it to the venue, any entrant can send steps 2 and
3 from their phone and the raffle completes exactly as specified. The organisers
are convenience, not infrastructure — and that is precisely what makes the
"could you have rigged it?" question answerable.

## What you need in place beforehand

**Deploy and fund by Sunday evening**, a day before entries open. Constructor
takes `entryClose = Fri 20:00 UTC`, `revealClose = Fri 20:40 UTC`, the attendee
merkle root, and the treasury address for the abort path. All four immutable.
Send the 5 ETH from the treasury multisig in the same session; `enter()` should
revert until the balance is there, so nobody enters an unfunded raffle.

**Decide the entry gate, and publish it.** This is the part that actually
decides whether a loser can make a case. Open entry means one person with a
script can enter 500 addresses and take the prize with near-certainty — that is
influence over the winner, and it's the hole a sore loser will find first. So:
gate `enter()` on a merkle proof over the attendee list, and publish the full
list — names or handles alongside addresses — at the same time you publish the
root, before entries open. One entry per listed address, enforced onchain.
Anyone can then check the list against the humans who actually turn up.

That gate is an organiser power, and you should say so out loud: you choose who
is on the list. It's exercised once, in public, before anyone knows anything,
and it cannot be changed after deployment. That's the honest shape of it.

**Verify the source on the explorer** and link it from the meetup page. Also
publish, before the night: the exact commitment formula, a 15-line script that
recomputes the winner from public data, and the raw `cast send` commands for
`reveal`, `closeReveals` and `draw`.

**Solve secret custody**, because this is where you'll lose entrants. Five days
pass between commit and reveal. The entry page should hand each person their
`secret` and `salt` as a downloadable file *and* a printable card *and*
localStorage, and tell them plainly: lose this, forfeit your ticket. Have a
"check my secret" page that hashes their input and tells them whether it matches
their onchain commitment — get people to run it Friday afternoon, not at 20:39.

**On the night:** a working RPC endpoint that isn't the venue WiFi (mobile
hotspot as backup), a laptop with a funded hot wallet that can broadcast
`reveal()` for anyone whose phone dies, and 0.002 ETH of gas to hand to anyone
who shows up empty. `reveal()` deliberately does not check `msg.sender` — the
commitment already binds to the entrant's address, so someone else broadcasting
your secret cannot steal your prize, only help you claim it. Put that on the
slide so people hand their card over without worrying.

**Run it on L1.** On an L2 the sequencer can delay your reveal past 20:40, which
means an operator you don't control can quietly change who's in the pool. At
these gas levels the L1 cost is noise: entry ~70k, reveal ~45k, draw ~80k — call
it well under a dollar each at 3 gwei and $3k ETH, against a $15,000 prize.
Check the actual gas price on the day; if the network is on fire, widen the
reveal window rather than the budget.

## When someone doesn't do their part

**An entrant doesn't reveal.** They're out — the winner is drawn only from
revealers. Their absence changes the seed, but they had to decide whether to
withhold *before* `seedBlock` existed, so they were re-rolling a dice they
couldn't see, at the cost of their own ticket. This is the reason there is no
minimum-reveals threshold and no forfeitable bond: a minimum would be a griefing
lever (withhold to void the whole raffle) and a bond taxes forgetfulness for no
security gain. One reveal is enough; that person wins, and they were the only
one who showed up.

**Nobody reveals at all.** Zero revealers, no winner. `abort()` becomes callable
and returns all 5 ETH to the treasury.

**Nobody calls `closeReveals()` before Sat 20:40 UTC** (24h after reveals
close). The raffle expires. `abort()` returns the 5 ETH to the treasury. Note
what the contract does *not* do here: it does not let anyone start a fresh
window. If a stalled raffle could be restarted, the attack writes itself —
simulate `draw()`, and if you lost, sit on your hands and re-roll tomorrow. So
the timeout is terminal, on purpose.

**`closeReveals()` runs but nobody calls `draw()` within 8191 blocks** (~27h) of
`seedBlock`. That's the EIP-2935 history window — the contract reads the seed
block's hash from the history contract at
`0x0000F90827F1C53a10cb7A02335B175320002935` rather than `blockhash()`, which
only reaches back 256 blocks (~51 minutes) and would be a genuinely tight
deadline for an evening that runs long. Past 8191 blocks the seed is gone for
good, `draw()` reverts permanently, and `abort()` sends the 5 ETH back to the
treasury. Again: no re-roll, no second seed block.

Both timeouts are close to theoretical. For the raffle to expire, every entrant
— *including the one who can already compute that they won* — has to ignore a
5 ETH prize for a full day, with a permissionless function sitting right there.
And it's worth saying the flip side plainly, because someone will ask: the only
path where the treasury gets its money back is that one, and the organisers
cannot cause it, because they cannot stop anyone on L1 from sending `draw()`.

**The prize transfer fails.** Credited to the winner, claimable by `withdraw()`
with no deadline. The draw result is already final and recorded.

## What this design gives up

**Can anyone be stopped from using it?** No pause, no owner withdrawal, no
upgrade proxy, no admin key over anyone's entry or the prize. The one operator
power is the attendee merkle root, set once at deployment, published in full
beforehand, immutable after. Lose every organiser key on Friday morning and the
raffle still runs to completion without you. The residual censorship risk is L1
inclusion itself in the 40-minute reveal window — mitigated by making the window
40 minutes rather than five, and by letting anyone broadcast anyone's reveal.

**Could someone else run it?** The contract, the entries, the reveals, the seed
and the draw are entirely onchain and need nothing you host. The website, the
secret-custody page and the winner-recompute script are yours — so pin them on
IPFS and put the repo link on the slide, and publish the raw calldata so that
someone with `cast` and an RPC can complete every step with your site down. If
you disappear tonight, the raffle finishes; only the pretty frontend dies.

**What does an observer learn?** Everything, forever. Every entrant's address is
public, and the attendee list you publish deliberately ties those addresses to
names or handles — that's the same disclosure that makes the raffle auditable.
It is a real cost, and it cuts against the "no credible case it was rigged"
requirement pulling the other way. We're choosing auditability here because that
was your stated top priority; say so on the entry page so people can decide
whether to enter with a fresh address, and don't be surprised when a few
regulars sit it out.

**What does "audited" cover?** Nothing here is audited, and if it were, that
would be a point-in-time review of a fixed scope, not a guarantee about the code
holding your 5 ETH tonight. It's ~150 lines. Get two people who didn't write it
to read it, write the test that walks the whole sequence plus both timeout
paths, and deploy the exact bytecode you tested.

**The honest weak spot.** Whoever proposes `seedBlock` sees every reveal and can
compute the winner before publishing, so they get one re-roll by skipping their
slot — the standard 1-bit proposer bias. It costs them a block reward, they had
to be the proposer of that specific slot, and they only get one extra sample.
For a 5 ETH community raffle that's the right trade against needing a LINK
balance. If this were a $10M lottery, it wouldn't be — you'd pay for VRF and
budget for its callback landing in a later transaction.
