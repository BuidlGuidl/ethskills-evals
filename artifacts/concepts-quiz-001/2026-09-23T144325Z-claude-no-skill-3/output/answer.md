# Meetup giveaway: 5 ETH, drawn live, no oracle account

## The randomness decision, first

You need a seed that (a) nobody can predict before entries close, (b) nobody can
nudge afterwards, and (c) a losing entrant can recompute from public data.
Without a paid VRF, the only source with those properties on Ethereum L1 is the
beacon chain RANDAO, surfaced to the EVM through the header of a **specific,
pre-announced future block**.

The two naive versions of this both fail the "can't build a credible case it was
rigged" test, and it's worth knowing why, because someone in the room will ask:

- **`block.prevrandao` read inside the draw transaction.** The caller chooses
  *when* to send that transaction, so the caller chooses among many candidate
  seeds. Whoever runs the draw can simulate, discard the ones they don't like,
  and submit only the favourable one. That is grindable and the contract code
  proves it's grindable. Unusable.
- **`blockhash(block.number - 1)`.** Same problem, plus it's already known when
  the transaction is built.

The fix is to **pin the block number before the value exists**, then read it
afterwards:

1. A transaction on the night records `drawBlock = block.number + 10`. At that
   moment `drawBlock` has not been proposed, so its RANDAO mix does not exist.
2. Roughly two minutes later, a second transaction reads `blockhash(drawBlock)`.
   That is one single value. The caller has no choice about it — they can call
   in block `drawBlock+1` or `drawBlock+200`, the seed is identical. Nothing to
   grind.

That closes off you, the caller, and every entrant. The one actor left with
residual influence is the **validator who proposes `drawBlock`**: they see the
would-be hash before publishing and could drop their slot to force a different
proposer, buying themselves exactly one re-roll (one bit of influence, and it
costs them a block reward). It's a remote risk for a 5 ETH meetup prize, but
it's the thing a sceptical loser would point at, so we remove it for free with a
commit–reveal layer from the people in the room:

```
seed = keccak256(revealAccumulator, blockhash(drawBlock))
```

`revealAccumulator` is the XOR of secrets that entrants committed to during
entry week and revealed after entries closed. Now:

- **You can't influence it** — you contribute nothing to either input.
- **Entrants can't influence it** — a secret is fixed by its commitment hash a
  week earlier, and the reveal deadline is *before* `drawBlock` exists, so an
  entrant deciding whether to withhold their reveal cannot compute the outcome
  under either choice. Withholding is a coin flip against a coin flip. That's
  why no reveal bond or slashing is needed, and why reveals can be optional.
- **The proposer can't influence it** — their one-bit re-roll is XORed against
  secrets they don't control.

Every input is onchain: entry list, commitments, reveals, `drawBlock`, and a
block hash anyone can fetch. A loser can replay the whole computation from a
block explorer and an archive node. That's the audit story.

**Hard prerequisite: this runs on Ethereum L1.** On L2s the primitives lie.
Arbitrum's `blockhash` is derived from sequencer-controlled data, and Optimism's
`prevrandao` is an L1 value that is already public well before your L2 block.
Both are grindable by the sequencer. Deploy to mainnet; 5 ETH justifies the gas.

---

## What has to be in place beforehand

**Two weeks out**

- Decide the sybil policy and encode it. "One entry per address" is not "one
  entry per person" — a single attendee can enter fifty addresses and take a
  50× share. If the giveaway is meant to be per-person, publish a Merkle root of
  attendee addresses in the constructor and have `enter()` require a proof.
  If you're fine with per-address, say so publicly before entry week opens, so
  it's a rule and not a surprise.
- Write and test the contract. It must be **non-upgradeable, non-proxied, with
  no owner function that can touch the entrant list, the seed, `drawBlock`, or
  the payout**. The only privileged function is the post-claim-deadline sweep
  (below). Any `onlyOwner` beyond that is ammunition for the rigging case.
- Deploy to Sepolia and run the entire sequence end to end, including the
  expiry path, with real wallets on real phones.

**One week out, before entry week opens**

- Treasury multisig deploys the contract with all parameters fixed in the
  constructor: `entryClose = Fri 20:00 UTC`, `revealClose = Fri 20:15 UTC`,
  `DRAW_DELAY = 10 blocks`, `CLAIM_WINDOW = 30 days`, Merkle root if used.
- Treasury multisig sends the 5 ETH in. Nobody can draw until it's funded.
- Verify the source on Etherscan and publish the address, the verified link, and
  a one-page plain-English description of the sequence. Publishing before
  entries open is what makes the rules pre-committed rather than chosen.
- Publish the commitment recipe entrants will use:
  `commitment = keccak256(abi.encode(secret, msg.sender))`. Binding the
  commitment to the sender stops anyone from copying someone else's commitment.
  Give people a tiny web page or cast one-liner that generates a random 32-byte
  secret, shows the commitment, and tells them to save the secret.

**On the day, before 20:00**

- Two wallets funded with ETH and ready to send `seal()` and `draw()`: the host's
  laptop, and a second one held by someone else in the room. These are not
  privileged — anyone can send them — but you want no scramble on stage.
- A keeper script watching for `drawBlock` and auto-sending `draw()` as soon as
  it's readable. This is the single most useful operational safeguard; see the
  expiry failure mode.
- Venue wifi tested against an RPC endpoint, and a mobile hotspot as backup.

---

## The sequence, entries closing to ETH in the wallet

| # | Step | Who sends it | Window |
|---|------|--------------|--------|
| 0 | `enter(commitment[, proof])` | each entrant | entry week, until **Fri 20:00 UTC**; reverts after |
| 1 | `reveal(secret)` | each entrant, optional | **20:00–20:15 UTC**, on stage; reverts outside |
| 2 | `seal()` | anyone — host's wallet | any time from **20:15 UTC**, no deadline |
| 3 | `draw()` | anyone — keeper script, host as backup | blocks `drawBlock+1` … `drawBlock+256`, i.e. roughly **20:17–21:08** |
| 4 | `claim()` | the winner | only if the automatic payout in step 3 failed; within **30 days** |

Step 3 selects the winner *and* pushes the 5 ETH in the same transaction. In the
normal case the prize lands in the winner's wallet about two minutes after the
host taps a button on stage, and step 4 never happens.

The live ritual is worth structuring: reveals happen in front of the room
(fifteen minutes is generous — it's one transaction each, and non-revealers are
still in the draw), the host calls `seal()` on stage and reads out the pinned
`drawBlock`, and then everyone watches that block get proposed. Announcing
`drawBlock` before it exists, to a room of witnesses, is the whole argument in
one gesture.

---

## When someone doesn't do their part

**Nobody reveals, or only some do.** Nothing breaks. Reveals are hardening, not
a requirement. `revealAccumulator` stays zero or partial, the seed falls back to
`blockhash(drawBlock)` alone, and you're back to the "only a validator who
proposes that exact block has a one-bit nudge" risk. `draw()` does not require a
minimum reveal count — requiring one would hand any single entrant a veto over
the entire giveaway.

**An entrant withholds their reveal to game the result.** They can't. The
reveal window closes before `drawBlock` is proposed, so at decision time they
cannot evaluate either branch. The contract does nothing special about it and
doesn't need to.

**Nobody calls `seal()` on the night** — the laptop dies, the wifi is out. No
deadline, no loss. `seal()` is permissionless and valid at any point after
20:15, tonight or next Tuesday. You lose the stage moment, not the prize.

**`draw()` isn't called within 256 blocks of `drawBlock`** (~51 minutes). This
is the real one: `blockhash()` only reaches back 256 blocks, after which it
returns zero. The contract **must reject a zero hash rather than draw on it** —
otherwise the seed becomes a known constant and the winner is whoever bothers to
compute it first. On expiry, `draw()` reverts and anyone may call `reseal()`,
which pins a fresh `drawBlock` and increments a public `resealCount`.

Be honest about the residual here, because it's the one thing left: someone who
can reliably call `draw()` while suppressing everyone else could let unfavourable
windows lapse and re-roll. That requires monopolising a permissionless function
for 51 minutes at a time, in public, with `resealCount` ticking up on a verified
contract. The keeper script plus a second wallet in the room reduces it to
theory — but publish `resealCount` in whatever you post afterwards, and if it
ever reads above zero, explain why.

**The winner's address can't receive the push.** A contract wallet with an
expensive fallback, a Safe with an unusual guard. `draw()` sends with a gas cap
inside a `try`; on failure it records the winner and emits `PayoutPending`, and
the winner pulls with `claim()`. The draw result is final either way — a failed
transfer never re-rolls the winner.

**The winner never claims.** After `CLAIM_WINDOW` (30 days from the draw), the
treasury multisig may call `sweep()` to return the 5 ETH. This is the only
privileged function in the contract, it cannot fire before the deadline, and it
cannot touch funds that a winner is still entitled to. Say the 30 days out loud
on stage.

**Fewer than two entrants.** With one, they win at `seal()` and the whole
randomness path is skipped. With zero, `sweep()` unlocks immediately and the
treasury takes its ETH back.

**Modulo bias.** `seed % n` is very slightly biased for `n` not a power of two.
With a 256-bit seed and a few hundred entrants the bias is around `n / 2^256`.
It is not a real effect, but say it before someone else does.

---

## Sketch

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MeetupDraw {
    uint256 public immutable entryClose;    // Fri 20:00 UTC
    uint256 public immutable revealClose;   // Fri 20:15 UTC
    address public immutable treasury;
    uint256 constant DRAW_DELAY  = 10;      // ~2 min
    uint256 constant CLAIM_WINDOW = 30 days;

    address[] public entrants;
    mapping(address => bytes32) public commitmentOf;
    mapping(address => bool)    public revealed;
    bytes32 public revealAccumulator;

    uint256 public drawBlock;      // pinned by seal(), re-pinned by reseal()
    uint256 public resealCount;    // public, audit-relevant
    address public winner;
    uint256 public drawnAt;
    bool    public paidOut;

    // --- entry week ---
    function enter(bytes32 commitment) external {
        require(block.timestamp < entryClose, "closed");
        require(commitmentOf[msg.sender] == 0, "already entered");
        require(address(this).balance >= 5 ether, "unfunded");
        commitmentOf[msg.sender] = commitment;   // keccak256(abi.encode(secret, msg.sender))
        entrants.push(msg.sender);
    }

    // --- 20:00-20:15, optional ---
    function reveal(bytes32 secret) external {
        require(block.timestamp >= entryClose && block.timestamp < revealClose, "window");
        require(!revealed[msg.sender], "done");
        require(commitmentOf[msg.sender] == keccak256(abi.encode(secret, msg.sender)), "bad");
        revealed[msg.sender] = true;
        revealAccumulator ^= secret;
    }

    // --- from 20:15, anyone ---
    function seal() external {
        require(block.timestamp >= revealClose, "early");
        require(drawBlock == 0 && winner == address(0), "sealed");
        if (entrants.length == 0) return;                 // sweep() unlocks
        if (entrants.length == 1) { _settle(entrants[0]); return; }
        drawBlock = block.number + DRAW_DELAY;             // value does not exist yet
    }

    // --- drawBlock+1 .. drawBlock+256, anyone ---
    function draw() external {
        require(drawBlock != 0 && winner == address(0), "state");
        require(block.number > drawBlock, "wait");
        bytes32 bh = blockhash(drawBlock);
        require(bh != bytes32(0), "expired: reseal()");    // never draw on zero
        uint256 seed = uint256(keccak256(abi.encode(revealAccumulator, bh)));
        _settle(entrants[seed % entrants.length]);
    }

    function reseal() external {
        require(drawBlock != 0 && winner == address(0), "state");
        require(block.number > drawBlock + 256, "not expired");
        drawBlock = block.number + DRAW_DELAY;
        resealCount++;
    }

    function _settle(address w) private {
        winner = w;
        drawnAt = block.timestamp;
        emit Drawn(w, drawBlock, revealAccumulator);
        (bool ok,) = w.call{value: 5 ether, gas: 100_000}("");
        if (ok) { paidOut = true; emit Paid(w); } else { emit PayoutPending(w); }
    }

    function claim() external {
        require(msg.sender == winner && !paidOut, "no");
        paidOut = true;
        (bool ok,) = msg.sender.call{value: 5 ether}("");
        require(ok, "send failed");
    }

    function sweep() external {
        require(msg.sender == treasury, "no");
        require(
            (winner == address(0) && block.timestamp >= revealClose && entrants.length == 0)
            || (winner != address(0) && !paidOut && block.timestamp >= drawnAt + CLAIM_WINDOW),
            "locked"
        );
        (bool ok,) = treasury.call{value: address(this).balance}("");
        require(ok, "send failed");
    }

    event Drawn(address indexed winner, uint256 drawBlock, bytes32 revealAccumulator);
    event Paid(address indexed winner);
    event PayoutPending(address indexed winner);
}
```

Treat this as the shape of the thing, not audited code — get a second pair of
eyes on it and run the Sepolia rehearsal before you put 5 ETH behind it.
