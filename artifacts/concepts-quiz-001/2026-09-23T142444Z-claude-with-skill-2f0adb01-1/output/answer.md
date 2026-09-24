# Meetup Raffle: 5 ETH, drawn live, no oracle subscription

## The one thing to internalise first

A contract has no timer and no cron. It sits in a state until somebody sends a
transaction and pays gas to move it to the next state. "Entries close Friday at
20:00" is not something the contract *does* — it is a condition the contract
*checks* when the next person poles it. So every step below names a sender and a
window, and every step is callable by **anyone**, never by an admin key. If the
only person who can advance the draw is you, then a losing entrant's rigging
story writes itself: "they chose when to pull the lever."

## Where the randomness comes from

You have ruled out a paid VRF subscription, and you are right that you don't need
one for 5 ETH among a room of people. Two free sources, each individually weak,
are strong when combined:

1. **Entrant commit–reveal.** Each entrant picks a secret at entry time and
   commits only `keccak256(secret, theirAddress)`. After entries close they reveal
   the secret. The seed mixes every revealed secret. You cannot know the seed in
   advance because you don't know their secrets.
2. **A future block's RANDAO.** The draw reads `blockhash()` of a block that had
   not been produced yet at the moment the last secret was revealed. Post-merge,
   a block header carries `prevrandao`, the accumulated RANDAO mix — derived from
   validators' BLS signatures, which nobody can predict ahead of their slot. So no
   entrant, including the last one to reveal, can compute the outcome.

Neither source alone is enough. Commit–reveal alone has the last-revealer
problem: whoever reveals last sees everyone else's secret, computes the winner,
and stays quiet if they don't like it. RANDAO alone is manipulable at the margin
by the validator proposing that exact block. Together, the last revealer is
blind to a block that doesn't exist yet, and the proposer is one input among
many with no knowledge of which way to push. (Residual risk quantified at the
bottom — it's real, small, and worth stating out loud rather than hiding.)

What you must not do, because a reader of the contract will find it in thirty
seconds and it *will* end up on the group chat: `block.timestamp`,
`blockhash(block.number - 1)` in the same transaction as the entry,
`keccak256(msg.sender)`, or anything where an organiser submits a number
generated off-chain. That last one is the worst option: it is unfalsifiable, and
"trust us, we rolled a die" is exactly the accusation you're trying to make
impossible.

---

## Before the night — what has to be in place

**Deployed and funded well before entries open.**
- Contract deployed and source-verified on Etherscan; address posted in the
  community channel with the entry instructions.
- The 5 ETH sent from the treasury into the contract **before the entry window
  opens**, in one transaction anyone can point at. Fund first, then open entries.
- The contract has **no owner, no pause, no withdraw**. The only paths for the
  ETH are: to the winner, or — after a 30-day unclaimed deadline — back to a
  treasury address hardcoded at deploy time. If there is an `onlyOwner` function
  that can touch the balance, every other fairness property is decoration.
- All four deadlines (entry open, entry close = Friday 20:00 UTC, reveal close,
  claim deadline) are `immutable` constructor arguments. Nobody can move them
  afterwards, including you.

**Eligibility, decided in advance.** Addresses are free, so "one entry per
address" means one person with a script takes 200 of the 250 entries and wins
honestly. Publish a **Merkle root of eligible member addresses** as a constructor
argument before the entry window opens; entrants supply a Merkle proof when they
enter. The root is immutable, so you can't add yourself or a friend on Friday
afternoon. Publish the full address list alongside it so anyone can recompute the
root and check it matches the deployed contract. (If you'd rather have no
allowlist, the honest alternative is a refundable entry deposit — but that
changes who can play, so decide it before, not after.)

**Make the secret impossible to lose.** The single most likely failure on the
night is a person who entered, showed up, and cannot find their secret — that is
a forfeited entry and a bad moment on stage. Have the entry page derive the
secret deterministically from an EIP-712 signature over a fixed message
(`secret = keccak256(signature)`). Then the secret is reproducible from the
wallet alone, on any device, with no note to keep. Store it in localStorage as
well, and show it as copyable text.

**Dry run.** Deploy the identical contract to a testnet and run the whole Friday
sequence end to end with three or four people, including one who fails to reveal
and one who lets the draw window lapse. Rehearse the failure modes, not the happy
path.

**In the room.** Two funded hot wallets on two laptops (one is the backup
poker), an RPC endpoint plus a fallback, the block explorer on the projector, and
the entry page open so people can reveal from their phones. Everyone in the room
can send every transaction below — that is the point — but somebody should be
ready to send each one so the evening doesn't stall on diffusion of
responsibility.

---

## The sequence on the night

**Step 0 — Entry window (Mon → Friday 20:00:00 UTC).**
*Sender: each entrant.* `enter(commitHash, merkleProof)`. The contract records the
commit against `msg.sender` and rejects anything at or after the close timestamp.
No admin action closes entries; the timestamp check does it.

**Step 1 — Reveal window (Friday 20:00 → 20:20 UTC).**
*Sender: each entrant, from the room.* `reveal(secret)`. The contract checks
`keccak256(secret, msg.sender)` matches the stored commit, mixes the secret into
the running seed, and adds the address to the final entrant list.

Revealing is what makes you eligible to win. That is the incentive that makes
this step happen without anyone chasing it — a 20-minute window on stage where
the only thing between you and 5 ETH is one transaction. It also means an entrant
who doesn't come, or doesn't reveal, forfeits. Decide that now and say it in the
entry instructions, because it's a policy choice, not a technical necessity: you
can instead let all entrants stay eligible and treat reveals as pure entropy, but
then nobody has a reason to reveal at all.

**Step 2 — Lock the target block (any time after 20:20).**
*Sender: anyone in the room — realistically an organiser. Window: from 20:20
onward, unbounded.* `lockDraw()` freezes the entrant list and sets
`drawBlock = block.number + 10` (~2 minutes). Delaying this call gains nobody
anything: whenever you call it, the target block is still in the future and its
RANDAO is still unknown, so there is no lever here to pull.

**Step 3 — Draw (from ~20:23, and it must land within 256 blocks — about 51
minutes — of the target block).**
*Sender: anyone.* `draw()` requires `block.number > drawBlock`, computes
`seed = keccak256(revealSeed, blockhash(drawBlock))`, picks
`winner = entrants[seed % entrants.length]`, and emits an event. The 256-block
limit is a hard EVM constraint: `blockhash()` returns zero for anything older,
and a contract that computes a winner from a zero hash is a contract where the
winner was knowable in advance. The contract must reject that, not shrug at it.

**Step 4 — Payout.**
*Sender: the winner. Window: immediately, until the 30-day claim deadline.*
`claim()` sends the 5 ETH to the winner using the pull pattern —
checks-effects-interactions, balance zeroed before the transfer. Pull rather than
push because a push into a smart-contract wallet that reverts, or that needs more
gas than a bare `transfer` forwards, would brick the payout inside the draw
transaction. On stage this is one tap on the winner's phone and the ETH is
theirs; the explorer on the projector shows it landing.

---

## When someone doesn't do their part

The design rule throughout: **a missed step costs time, never the money, and
never the fairness.**

**An entrant doesn't reveal by 20:20.** They are simply not in the entrant list.
No refund is owed (they staked nothing), the draw proceeds, and their absence
can't shift the outcome toward anyone in particular because the draw still turns
on a block that doesn't exist yet. If *nobody* reveals, `lockDraw()` reverts on an
empty list and the funds sit until the claim deadline, after which anyone can
call `returnToTreasury()`.

**Nobody calls `lockDraw()`.** Nothing expires. It stays callable indefinitely;
the draw simply happens later — next week if need be. There is no deadline that
can strand the prize here.

**Nobody calls `draw()` within the 256-block window.** The target blockhash is now
unreadable. The contract must not fall back to a weaker source. Instead,
`resetDraw()` — permissionless, callable only once the window has provably
lapsed — picks a fresh `drawBlock = block.number + 10` and the draw is retried.
This is repeatable forever, so the prize can never be stranded by a missed poke.

The honest caveat: `resetDraw()` is a re-roll, and a re-roll is a lever. In
principle an entrant who sees a result they dislike could try to suppress
`draw()` for 51 minutes to force one. In practice `draw()` is callable by anyone,
including by every person in the room and by any bot watching the contract, so
suppressing it means suppressing all of them — and after the reset they are back
to a blind future block, so the "advantage" is one free re-roll they cannot aim.
The alternative (no reset) is strictly worse: it strands 5 ETH permanently on one
missed transaction.

**The winner never claims.** After 30 days, anyone can call `returnToTreasury()`
and the 5 ETH goes back to the hardcoded treasury address. Not to an organiser's
wallet, not to a re-draw.

**You get hit by a bus on Friday afternoon.** Nothing in the sequence needs you.
Every transaction is permissionless and every deadline is in the contract. The
draw happens if the community shows up, and only then — which is exactly the
property that makes the rigging accusation unavailable.

---

## The residual risk, stated plainly

The validator proposing the target block sees its RANDAO value before publishing,
so it can compute the winner and choose to withhold the block, shifting the draw
to the next slot's value. That is one bit of bias — a choice between two
outcomes, not a choice of winner. To use it, someone would have to be an entrant
*and* the proposer of that specific slot; for a solo staker that's roughly one
slot in a million, and the cost of a dropped block (missed block reward, plus a
missed-proposal penalty) is comparable to the expected gain from doubling one
entrant's odds in a 5 ETH draw. It is a real property of the mechanism, not a
bug, and it's the price of not paying an oracle.

If you want it smaller for near-zero extra complexity, mix **four consecutive
blockhashes** (`drawBlock` through `drawBlock + 3`) instead of one. Biasing then
requires proposing consecutive slots, which compounds the improbability and the
cost. Same 256-block deadline, measured from the last of the four.

The thing worth saying on stage, before the draw rather than after: here is the
verified contract, here is the Merkle root and the member list it commits to,
here is the funding transaction from the treasury, and there is no function in it
that lets us touch the money or choose the block. A losing entrant reading it
afterwards finds the same thing you told them in advance. That, and not the
quality of the entropy, is what actually settles the argument.

---

## Appendix: reference sketch

Not audited, not deployment-ready — it's the state machine made concrete so you
can see that each transition has a named caller and no privileged path.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract MeetupRaffle {
    bytes32 public immutable memberRoot;
    uint256 public immutable entryClose;   // Friday 20:00:00 UTC
    uint256 public immutable revealClose;  // Friday 20:20:00 UTC
    uint256 public immutable claimWindow;  // 30 days
    address public immutable treasury;

    uint256 constant DRAW_DELAY  = 10;   // ~2 minutes
    uint256 constant BLOCKHASH_TTL = 256; // EVM limit, ~51 minutes

    mapping(address => bytes32) public commitOf;
    mapping(address => bool) public revealed;
    address[] public entrants;
    bytes32 private revealSeed;

    uint256 public drawBlock;
    address public winner;
    uint256 public drawnAt;

    event Entered(address indexed who);
    event Revealed(address indexed who);
    event DrawLocked(uint256 drawBlock, uint256 entrantCount);
    event Drawn(address indexed winner, bytes32 seed);
    event Claimed(address indexed winner, uint256 amount);

    constructor(bytes32 root, uint256 ec, uint256 rc, uint256 cw, address t) payable {
        require(msg.value == 5 ether, "fund at deploy");
        memberRoot = root; entryClose = ec; revealClose = rc; claimWindow = cw; treasury = t;
    }
    // no owner, no pause, no withdraw, no receive()

    function enter(bytes32 commitHash, bytes32[] calldata proof) external {
        require(block.timestamp < entryClose, "entries closed");
        require(commitOf[msg.sender] == 0, "already entered");
        require(commitHash != 0, "empty commit");
        require(
            MerkleProof.verify(proof, memberRoot, keccak256(abi.encodePacked(msg.sender))),
            "not a member"
        );
        commitOf[msg.sender] = commitHash;
        emit Entered(msg.sender);
    }

    function reveal(bytes32 secret) external {
        require(block.timestamp >= entryClose && block.timestamp < revealClose, "not reveal window");
        require(!revealed[msg.sender], "already revealed");
        require(keccak256(abi.encodePacked(secret, msg.sender)) == commitOf[msg.sender], "bad reveal");
        revealed[msg.sender] = true;
        entrants.push(msg.sender);
        revealSeed = keccak256(abi.encodePacked(revealSeed, secret));
        emit Revealed(msg.sender);
    }

    /// @notice Anyone. Any time after reveals close. Freezes the list, targets a future block.
    function lockDraw() external {
        require(block.timestamp >= revealClose, "reveals open");
        require(drawBlock == 0, "already locked");
        require(entrants.length > 0, "no entrants");
        drawBlock = block.number + DRAW_DELAY;
        emit DrawLocked(drawBlock, entrants.length);
    }

    /// @notice Anyone. Must land within 256 blocks of drawBlock.
    function draw() external {
        require(drawBlock != 0 && winner == address(0), "not ready");
        require(block.number > drawBlock, "too early");
        require(block.number <= drawBlock + BLOCKHASH_TTL, "expired: call resetDraw");
        bytes32 seed = keccak256(abi.encodePacked(revealSeed, blockhash(drawBlock)));
        winner = entrants[uint256(seed) % entrants.length];
        drawnAt = block.timestamp;
        emit Drawn(winner, seed);
    }

    /// @notice Anyone. Only once the blockhash window has provably lapsed. Never strands the prize.
    function resetDraw() external {
        require(drawBlock != 0 && winner == address(0), "nothing to reset");
        require(block.number > drawBlock + BLOCKHASH_TTL, "window still open");
        drawBlock = block.number + DRAW_DELAY;
        emit DrawLocked(drawBlock, entrants.length);
    }

    /// @notice The winner. Pull payment, checks-effects-interactions.
    function claim() external {
        require(msg.sender == winner, "not winner");
        uint256 amount = address(this).balance;
        require(amount > 0, "nothing to claim");
        winner = address(0xdead); // consumed; blocks re-entrancy and re-claim
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        emit Claimed(msg.sender, amount);
    }

    /// @notice Anyone, after the claim deadline. Funds can only ever go here or to the winner.
    function returnToTreasury() external {
        require(
            (drawnAt != 0 && block.timestamp > drawnAt + claimWindow) ||
            (drawnAt == 0 && block.timestamp > revealClose + claimWindow),
            "too early"
        );
        uint256 amount = address(this).balance;
        require(amount > 0, "empty");
        (bool ok, ) = treasury.call{value: amount}("");
        require(ok, "transfer failed");
    }
}
```

Note on `claim()`: setting `winner` to a burn address before transferring both
prevents re-entrancy and, combined with the balance check, makes a second claim a
no-op. Note on `returnToTreasury()`: after a successful claim the balance is zero
so it can only ever revert — the treasury path exists for the unclaimed and
no-entrant cases, not as a back door.
