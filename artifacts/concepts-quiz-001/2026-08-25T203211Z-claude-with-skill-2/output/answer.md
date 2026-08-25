# 5 ETH giveaway — the sequence from entries closing to the prize landing

## The shape of it, in one paragraph

Your constraint rules out Chainlink VRF (that's a subscription with a third
party, funded in LINK or native ETH). What's left that actually works is
**commit–reveal, seeded by a block that did not exist yet when the last secret
was revealed.** Entrants commit a hashed secret during the week. At 20:00 they
reveal it — revealing is also how you prove you're in the room, and it's what
makes you eligible. Once all the reveals are public, the contract points at a
block ~2 minutes in the future. When that block gets mined, the winner is
already decided; the `draw()` transaction only writes down a number that anyone
in the audience could have computed themselves from data that is already
public. Nobody chooses it, and nobody — including whoever revealed last, and
including you — could see it coming.

Nothing in this design runs itself. Every arrow below is a transaction someone
has a reason to send.

---

## Timeline: who sends what, and when

Concrete times assume entries close **Friday 20:00:00 UTC**. All deadlines are
`block.timestamp` constants fixed in the constructor. There is no owner
function that can move any of them.

| # | Transaction | Who sends it | Window | Why they'd bother |
|---|---|---|---|---|
| 0 | `constructor` (deploy, payable, 5 ETH) | Organizer, from the treasury | ≥ 1 week before, before entries open | It's your giveaway |
| 1 | `enter(bytes32 commitment, bytes32[] proof)` + 0.01 ETH stake | Each entrant, one tx each | Entries open → **Fri 20:00:00 UTC** | To have a chance at 5 ETH |
| 2 | `reveal(bytes32 secret)` | Each entrant, one tx each | **Fri 20:00:00 → 20:40:00 UTC** | Gets their 0.01 ETH back in the same tx, and it's the only way to become eligible |
| 3 | `lockDraw()` | **Anyone** — in practice you, live on stage | **Fri 20:40 → Sat 08:40 UTC** (12 h) | Every entrant has ~1/n × 5 ETH riding on it; the draw cannot happen without it |
| 4 | `draw()` | **Anyone** — the winner will race to do it | From `drawBlock` (~2 min after step 3) → +8191 blocks (~27 h) | By the time it's callable the result is already fixed and public, so exactly one person knows they're about to collect 5 ETH |
| 5 | `claim()` | **The winner only** | From step 4 → +14 days | 5 ETH |

Wall-clock on the night: reveals 20:00–20:40, `lockDraw()` at ~20:41, `draw()`
at ~20:43, `claim()` on stage at ~20:45. The two-minute gap between step 3 and
step 4 is the drum roll, and it is the whole security argument — use it.

### Step 1 — entering (during the week)

The entry dapp generates a 32-byte secret with `crypto.getRandomValues`, and
submits

```
commitment = keccak256(abi.encode(msg.sender, secret))
```

Binding the commitment to `msg.sender` matters: without it, anyone could copy
your commitment off the mempool, and later replay your secret as their own
reveal.

`enter()` requires: `block.timestamp < ENTRY_CLOSE`, `msg.value == STAKE`
(0.01 ETH), a valid Merkle proof against the attendee root, and that this
address hasn't entered before. It also hard-rejects the treasury and deployer
addresses.

### Step 2 — revealing (20:00–20:40, in the room)

```solidity
require(keccak256(abi.encode(msg.sender, secret)) == commitmentOf[msg.sender]);
seed = keccak256(abi.encode(seed, secret));
eligible.push(msg.sender);
// refund the stake in the same transaction — no second tx to chase
```

**Only revealers can win.** People who entered on Tuesday and aren't in the
room on Friday drop out of the pool. That's a feature: you wanted to hand the
prize over on stage.

### Step 3 — `lockDraw()`, permissionless

```solidity
require(block.timestamp >= REVEAL_CLOSE && block.timestamp <= REVEAL_CLOSE + 12 hours);
require(eligible.length > 0);
drawBlock = block.number + 10;   // ~2 minutes on mainnet
```

It commits to a block **in the future**. Whoever sends this cannot know
`blockhash(drawBlock)` — it doesn't exist yet — so choosing the moment to send
it buys them nothing.

### Step 4 — `draw()`, permissionless

```solidity
require(block.number > drawBlock);
bytes32 h = _blockhashOf(drawBlock);          // reverts if the hash has aged out
winner = eligible[uint256(keccak256(abi.encode(seed, h))) % eligible.length];
```

`_blockhashOf` tries the `blockhash` opcode first (last 256 blocks, ~51 min)
and falls back to the EIP-2935 history contract at
`0x0000F90827F1C53a10cb7A02335B175320002935`, which serves the last 8191 blocks
(~27 h). That fallback is what buys you a full day of slack if the venue wifi
dies mid-ceremony. **Verify it's live on whatever chain you deploy to** — it's
been on mainnet since Pectra; don't assume it on an L2.

The key property to say out loud from the stage: *once `drawBlock` is mined,
the winner is determined.* `draw()` is a pure function of three public things —
the reveals, the block hash, and the entrant list. It does not matter who sends
it, or when within the window, or how many times they simulate it first. A
caller who dislikes the outcome can only decline to send it, and then someone
else sends it, and the answer is the same.

### Step 5 — `claim()`, winner only

Pull, not push. `draw()` deliberately does **not** transfer. If it pushed to an
address that can't accept ETH, the payout would revert and take the draw with
it. Instead the winner sends one transaction, on stage, and the room watches 5
ETH land. Set `claimed = true` before the `.call{value:}` — checks, effects,
interactions.

The pot is `5 ETH + every forfeited stake`. Track it in a storage variable, not
`address(this).balance`, so a stray forced transfer can't change the arithmetic.

---

## What has to be in place beforehand

**Deployed and funded a week out.** One transaction: deploy with 5 ETH of value
attached. Verify the source on Etherscan, put the address and ABI on the
flyer/QR/site. Anyone can read the balance and see the money is really there
before they commit.

**The attendee Merkle root, fixed in the constructor.** This is the part that
needs care, because *without it you have no giveaway*: entries are just
addresses, the deposit is refundable, so anyone — you most of all — could enter
500 addresses and win their own prize. Collect attendee addresses at the door
(or from prior-meetup POAP holders), build the Merkle root, hard-code it, and
**publish the full list** (gist/IPFS) so anyone can verify their own leaf and
count the pool. Fixed at deploy means you cannot add a friend or drop an enemy
after entries open. Keep organizer addresses off the list, and let the contract
reject the treasury and deployer addresses anyway, so a suspicious loser can
check that in the code rather than take your word.

**Secret custody.** This is the number one thing that goes wrong on the night.
The dapp must store the secret in localStorage *and* show it as a QR plus a
copyable hex string, with a "save this or you cannot claim" warning. Print it on
a card at the door if you can. Someone who loses their secret is simply out —
there is no recovery path and there must not be one, because a recovery path is
an organizer power over who's eligible.

**A reveal fallback that doesn't need your server.** Publish the ABI and a
plain "paste your secret, sign" page, plus written instructions for
`reveal(bytes32)` via Etherscan's Write Contract tab or `cast send`. If your
frontend falls over at 20:05 with 60 people in the room, that page is the
giveaway.

**A recompute script, published in advance.** Twenty lines: pull the `Revealed`
events, pull `blockhash(drawBlock)`, hash them, index into the entrant list,
print the winner. This is what converts "trust us" into "check it yourself,"
and it's the single most effective answer to a losing entrant with a theory.

**Practical room stuff.** Wifi that works, the times printed in UTC *and* local
time, a screen showing live contract state (entries, reveals, countdown) read
from the chain rather than from a database, a couple of loaner devices, and a
small organizer wallet (~0.05 ETH) to top up anyone who can't cover gas. Topping
up gas doesn't touch fairness.

**A full rehearsal on Sepolia the week before**, with the real timings
compressed to 15 minutes and at least three people revealing.

**Gas, with the numbers next to each other.** Roughly `enter` ~70k, `reveal`
~55k, `lockDraw` ~30k, `draw` ~60k, `claim` ~35k. At 10 gwei and ETH at $3,000
that's about $2 to enter and $1.60 to reveal — check today's actual gas price
and ETH price before you commit to mainnet. Two dollars against a 1/n shot at 5
ETH is fine, and mainnet is what makes the "nobody could have interfered"
argument cleanest. If you'd rather use an L2 for cent-level fees, two things
change and both are real: 2-second blocks mean the 256-block `blockhash`
lookback is only ~8 minutes (so the EIP-2935 fallback stops being optional, if
it's even there), and a centralized sequencer is a party that can delay
somebody's reveal past 20:40. Say so on the night if you go that way.

---

## What happens when someone doesn't do their part

Every one of these is handled by a deadline in the contract, not by a decision
someone makes.

**An entrant misses 20:00.** `enter()` reverts. There is no extension function,
for you or for anyone. If you want the ability to extend, you also want the
ability to rig, and you can't have one without the other.

**An entrant enters but never reveals** (not in the room, lost the secret,
phone died, reveal tx didn't confirm by 20:40). They're not in `eligible`, so
they cannot win, and their 0.01 ETH is forfeited into the prize pot. Not to the
treasury — into the pot, so that no-shows enrich a random winner rather than
you. Expect the eligible set to be meaningfully smaller than the entrant set;
say the number out loud before `lockDraw()` so nobody is surprised.

**Someone withholds their reveal to try to change the outcome.** This is the
classic commit–reveal attack, and the future block is what kills it. The last
revealer sees every secret but not `blockhash(drawBlock)`, so withholding
re-rolls a die they cannot see. They give up their stake and their entire
chance at the prize in exchange for no information. There is nothing to gain.

**Nobody calls `lockDraw()` within 12 hours.** No draw ever happens. At
`ENTRY_CLOSE + 72 h`, anyone can call `abort()`; every entrant then pulls their
stake back with `withdrawStake()`, and `returnPrize()` — permissionless, sends
to the treasury address hard-coded at deploy, not to `msg.sender` — puts the 5
ETH back. Worth being blunt about: the *only* party who benefits from an abort
is the treasury, i.e. you. That's exactly why `lockDraw()` is permissionless and
why any of the n entrants can send it over your objection. Have the room watch
that transaction land.

**Zero people reveal.** `lockDraw()` reverts on an empty eligible set, and you
land in the same abort path. Nobody loses anything.

**Exactly one person reveals.** They win. It is not rigged, it is a raffle with
one entrant, and it's better to have said this in advance than to explain it
afterwards.

**`lockDraw()` happened but nobody calls `draw()` for 27 hours.**
`blockhash(drawBlock)` is gone for good — that entropy is not recoverable by
anyone, including you. `draw()` reverts forever and the abort path at +72 h
refunds everything. In practice this cannot really happen, because the winner
is publicly computable as soon as `drawBlock` is mined and has 5 ETH of reason
to send it, but the contract shouldn't rely on that and doesn't.

**The winner never calls `claim()` within 14 days.** Anyone can then call
`sweep()`, which sends the pot to the treasury address. Same window applies if
the winner is a smart account that can't receive ETH — since *they* initiate
the claim, they get to sort that out on their side rather than discovering it
when a push transfer reverts.

**Mainnet is congested at 20:00 and reveals are slow.** The 40-minute window
plus a generous priority fee in the dapp covers this. Tell the room to reveal
in the first ten minutes, not at 20:39.

---

## What this design gives up

**Can anyone be stopped from using it?** No pause, no upgrade proxy, no
owner-only function anywhere near the entrant list, the seed, the winner, or the
money. After deploy, losing every organizer key changes nothing — every step is
permissionless or winner-only. The one real power you hold is the one you hold
*before* deploy: you choose the attendee Merkle root, and that choice is frozen
into the constructor. Publish the list and that power is auditable, but be
honest that it exists. On an L2, add: the sequencer can delay a reveal.

**Could someone else run it?** The contract, the commitments, the reveals, the
seed and the winner are all onchain and all readable and forkable by anyone.
What only you run is the entry/reveal frontend and the hosted attendee list. If
those vanish tonight, an entrant who kept their secret can still reveal, still
trigger the draw and still claim, using the verified contract on Etherscan or
`cast` — which is precisely why the ABI and the fallback instructions need to be
published before the night, not improvised during it. An entrant who lost their
secret is out either way; your frontend can't save them.

**What does an observer learn?** Everything, permanently. Every entrant's
address, when they entered, whether they showed up to reveal, and the winner's
address receiving 5 ETH. Because eligibility is an address allowlist built from
a door list you publish, the pair "this address / this person attended this
meetup on this date" is now public forever, and the winner's address is publicly
tagged as holding 5 ETH — a real physical-safety consideration for whoever wins.
Let attendees register a fresh address at the door instead of their main one,
and tell them why.

**What "audited" would cover.** This is ~150 lines and it will not be audited. A
review is a point-in-time look at a fixed scope, not a guarantee about the code
running on the night. Get two people who aren't you to read it, do the Sepolia
rehearsal, and cap the exposure at what's in the contract — which, given the
deadline-and-refund paths above, is the 5 ETH plus stakes and nothing more.

**The residual randomness risk, stated plainly.** `blockhash` of a future block
is biasable in exactly one way: the validator who proposes `drawBlock` can drop
their block to force a re-roll. To profit, that validator would have to also be
an entrant in the room, and dropping costs them the block reward plus its MEV
for a 1/n shot at 5 ETH. For a community meetup that's a fine trade to accept —
this is the case where "biasable is fine for a raffle" applies. Understand that
it's the reason VRF exists, and that you're consciously choosing not to buy it.
If the prize were the treasury rather than 5 ETH of it, this answer would be
different.

---

If someone in the room wants to build this rather than watch it, point them at
https://speedrunethereum.com.
