# 5 ETH meetup draw — the full sequence

## The short version

Randomness comes from **`block.prevrandao` of one specific future block that the
contract picks for itself**, and the settling transaction is only valid *in that
exact block*. That is the whole trick:

- Nobody can **foresee** the winner, because the seed is the beacon chain's RANDAO
  mix for a block that has not been proposed yet when entries close.
- Nobody can **influence** the winner, because the only person with any leverage
  over `prevrandao` is the validator who proposes that one slot, and the most they
  can do is *miss the slot* — which doesn't select an outcome, it just forces a
  fresh unpredictable re-arm. They cannot grind it.
- Nobody can **choose when to draw**, because `settle()` reverts in every block
  except the armed one. Caller-chosen timing is the usual way these raffles get
  quietly rigged; this design removes it.

No oracle, no subscription, no LINK, no second token in the treasury. Three
transactions total on the night, all of them permissionless, all of them
recomputable by anyone from public chain data.

---

## Why not the obvious alternatives

**Chainlink VRF / any paid RNG provider.** Ruled out by your own constraint — it
needs a funded subscription in a non-ETH token. It's the right answer when a
protocol draws every week; it's overhead for one evening.

**Entrant commit–reveal (everyone commits a secret, XOR the reveals).** The
last person to reveal sees the result before deciding whether to reveal, so they
get a free veto. Fixing that needs a slashable deposit big enough to outweigh a
share of 5 ETH, which prices your members out, and it forces every entrant to
send a *second* transaction on Friday night. The one who forgets is the one who
blows up the stage.

**`blockhash(N)` of a committed future block.** Tempting, and it has the nice
property that anyone can settle any time within 256 blocks. But a block's hash is
*grindable*: the proposer of block N can reorder or stuff transactions and search
thousands of candidate hashes for free, then publish the one that wins. `prevrandao`
is not grindable — a proposer's only lever is a 1-bit withhold. I'd rather take the
harder randomness. (Variant noted at the bottom if you want the easier ops profile.)

**Anything decided off-chain — a dice roll, a script, a livestream wheel.** Fails
your second requirement outright. A losing entrant has nothing to check.

---

## What has to be in place beforehand

Do all of this **before entries open**, i.e. before the Monday.

1. **Deploy the contract with the 5 ETH already inside it**, in the same
   transaction. The prize is `immutable` and set from `msg.value` in the
   constructor. The treasury funds it once and then has no further role until the
   60-day dead-man sweep. There is no `withdraw`, no `setWinner`, no `pause`, no
   owner, no proxy, no `delegatecall`, no `selfdestruct`.
2. **Fix the deadline in the constructor.** `entryClose` = Friday 20:00:00 UTC as a
   unix timestamp, `immutable`. It cannot be extended, and `enter()` reverts once
   `block.timestamp >= entryClose`.
3. **Publish the member list and its Merkle root before entries open.** The root is
   `immutable`, set at deploy; `enter(proof)` takes a Merkle proof and allows one
   entry per address. Publish the *full* list and the tree, not just the root, so
   members can check both that they're in it and that it doesn't contain forty
   addresses nobody recognises. Without an allowlist, whoever wants to can sybil the
   odds — including you, which is exactly the accusation you're trying to make
   impossible.
4. **Verify the source on Etherscan/Sourcify** and post the address in the same
   announcement as the member list. Repo, commit hash, compiler version, the lot.
5. **Line up three independent settlers.** Three different people, three different
   wallets, three different RPC endpoints or builder relays, each funded with a bit
   of ETH and each running the same small script. They race to land `settle()` in
   the armed block; the two who lose the race revert cheaply. Redundancy here is
   what stops any single person from being able to stall the draw (see failure
   modes).
6. **Rehearse the whole thing on Sepolia** with the same `DELAY` constant and the
   same scripts, a few days before. You want to have seen a missed block and a
   re-arm happen once, in private, before you see one on stage.
7. **Publish the audit recipe** (bottom of this document) alongside the contract, so
   the verification story is on the record *before* anyone has lost.

Two constants worth agreeing on up front:

- `DELAY = 16` blocks (~3 min 12 s) between arming and the draw block. Long enough
  for the settlers to build and broadcast; short enough that a retry costs three
  minutes of stage time, not thirteen.
- The winner is paid **whether or not they are in the room**. There is no
  "must be present to win" rule and no re-draw for absence — a re-draw rule is a
  rigging surface, because someone gets to decide who counts as present.

---

## The sequence on the night

Times assume Friday, entries closing at 20:00:00 UTC. Every one of these
transactions is permissionless — "who sends it" is a matter of who you've asked to
be ready, not who the contract allows.

### Step 0 — 20:00:00 UTC, entries close

No transaction. `enter()` starts reverting on its own the moment a block arrives
with `block.timestamp >= entryClose`. Block timestamps can drift a few seconds from
wall clock; that's fine, it's public and symmetric. Nobody sneaks in an entry,
because the check is in the contract, not in a UI.

### Step 1 — `arm()`

- **Who:** any of the three settlers (first one to land it wins; the others revert).
  In practice, your script fires it automatically.
- **Window:** any time at or after `entryClose`. Target **20:00:12–20:00:30** —
  the first or second block after close.
- **What it does:** snapshots the entrant count, sets `drawBlock = block.number + 16`,
  emits `Armed(drawBlock, entrantCount)`.
- **Why it's safe:** the caller picks *when* to arm, and therefore which block becomes
  `drawBlock` — but the RANDAO mix of a block 16 slots in the future is unknown to
  everyone alive, so there is nothing to choose between. Arming early or late gains
  you exactly nothing.

Announce the block number from the stage. It's now a public commitment, three
minutes ahead of time, and anyone in the room can watch for it.

### Step 2 — `settle()`

- **Who:** all three settlers, racing. One lands, two revert.
- **Window:** **exactly block `drawBlock`** — one slot, ~20:03:20, twelve seconds wide.
- **What it does:** reads `block.prevrandao`, computes
  `seed = keccak256(prevrandao, drawBlock, address(this), entrantCount)`,
  picks `entrants[seed % entrantCount]`, records the winner, emits
  `Settled(winner, seed, drawBlock)`, and **pushes the 5 ETH to the winner in the
  same transaction** via a gas-capped call.
- **If the transaction lands in a later block instead:** it does *not* draw. It
  re-arms — sets a new `drawBlock = block.number + 16` — and returns. The contract
  will never fall back to a stale or predictable seed. Go round again, three minutes.

### Step 3 — the prize lands

Normally there is no Step 3: the ETH moves inside the `settle()` transaction, so the
winner's wallet pings while the transaction is still on the projector. Roughly
**20:03:32**, about three and a half minutes after entries closed.

The push is made with a 100k gas cap and a `nonReentrant` guard. If it fails — the
winning address is a contract that reverts on receive, which shouldn't happen with an
allowlist of member EOAs but is cheap to defend against — the winner is recorded and
**`claim()`** becomes available:

- **Who:** the winner, from the winning address only.
- **Window:** any time up to `entryClose + 60 days`.

### Step 4 — dead-man sweep (expected never to run)

- **Who:** anyone; funds can only go to the `immutable` treasury address.
- **Window:** after `entryClose + 60 days`, and only if no winner has been paid.

This exists so 5 ETH can't be bricked forever by a freak failure. It is not a
control lever: `settle()` is permissionless the whole time, so suppressing the draw
for sixty consecutive days against three settlers and an open mempool isn't a plan,
it's a fantasy.

---

## What happens if someone doesn't do their part

| What goes wrong | What the contract does | What you do |
|---|---|---|
| Nobody calls `arm()` at 20:00 | Nothing. State is unchanged and `arm()` stays callable forever. No seed exists yet, so nothing has leaked. | Anyone in the room calls it. Costs ~50k gas. |
| The settlers all miss the armed slot — bad timing, RPC hiccup, fee too low | The first late `settle()` **re-arms** instead of drawing. New `drawBlock`, new unknowable seed. The old block's `prevrandao` is now worthless. | Wait ~3 minutes, try again. Say so from the stage; it's a normal branch, not an incident. |
| The validator proposing `drawBlock` **misses the slot** (including deliberately, to force a reroll) | That block never exists, so no `settle()` can land in it. Next call re-arms. | Same: three minutes, new block. They bought one reroll they can't aim, for the price of a block reward. |
| A settler sees the pending result 12 s early (after block `drawBlock - 1` lands) and decides not to submit | Irrelevant if even one of the other two submits — the outcome in that block is fixed no matter who sends it. If *all three* sit on their hands, it re-arms. This is why there are three of them, unconnected, automated. | Nothing; and the withholding is visible on-chain as an unexplained re-arm. |
| The winner isn't in the room | Nothing special. The ETH is already in their wallet. | Message them. |
| The push payment fails (contract address, reverting receiver) | `winner` is recorded and the funds stay escrowed; `claim()` is open to the winner for 60 days. | Winner claims when convenient. |
| Nobody ever claims | After 60 days, `sweep()` returns the ETH to the treasury. | Re-run it next month. |
| Zero entrants | `arm()` reverts with `NoEntrants`. The draw cannot run. | Funds return via `sweep()` after 60 days. |

The pattern, stated once: **every failure on this list degrades to a delay, never to
a determined outcome.** There is no path where a missed transaction, a missed slot,
or an expired window produces a winner that somebody could have computed in advance.
That property — not the choice of entropy source — is the thing a losing entrant
would actually go looking to break.

---

## The residual risk, stated honestly

The validator who proposes `drawBlock` learns the RANDAO mix before they publish,
and therefore sees the winner ~12 seconds before everyone else. They can respond by
missing the slot, which forces a re-arm. That's one bit of influence, and it's the
only one in the design.

Concretely, to use it, someone would have to (a) be an entrant, (b) be running a
validator, and (c) be assigned to propose that exact slot — probability equal to
their share of ~1M validators, i.e. not a community member. Even then, all they buy
is a second draw at the cost of a forfeited block reward and MEV, and they cannot
aim the second one any better than the first.

Compare with what you'd be exposed to under `blockhash`: there, the same proposer
can *grind* thousands of candidate hashes and pick the one that names them. Same
probability of being in position; vastly better payoff if they are. That's the
trade this design makes, and it's the right way round.

It's also auditable after the fact. The proposer of any slot is public. If anyone
raises it, you point at a beacon explorer and show that `drawBlock` was proposed by
some staking pool with no connection to anyone in the room.

---

## Contract sketch

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// No owner. No admin. No proxy. No pause. Deployed funded; deadline and
/// member set fixed at construction.
contract MeetupDraw is ReentrancyGuard {
    uint256 public immutable entryClose;   // Fri 20:00:00 UTC
    bytes32 public immutable memberRoot;   // published in full before entries open
    uint256 public immutable prize;        // 5 ether, escrowed at deploy
    address public immutable treasury;     // only reachable by sweep(), after 60 days

    uint256 public constant DELAY       = 16;      // ~3m12s
    uint256 public constant SWEEP_AFTER = 60 days;

    address[] public entrants;
    mapping(address => bool) public entered;

    uint256 public drawBlock;   // 0 until armed
    address public winner;      // 0 until settled
    bool    public paid;

    event Entered(address indexed who, uint256 index);
    event Armed(uint256 drawBlock, uint256 entrantCount);
    event Settled(address indexed winner, uint256 seed, uint256 drawBlock);
    event Paid(address indexed winner, uint256 amount);

    error TooEarly(); error TooLate(); error NotEligible(); error AlreadyEntered();
    error NoEntrants(); error AlreadySettled(); error NotWinner(); error NotYet();

    constructor(uint256 _entryClose, bytes32 _memberRoot, address _treasury) payable {
        require(msg.value == 5 ether, "fund at deploy");
        require(_entryClose > block.timestamp && _treasury != address(0));
        entryClose = _entryClose;
        memberRoot = _memberRoot;
        treasury   = _treasury;
        prize      = msg.value;
    }

    // ---- during the week ----

    function enter(bytes32[] calldata proof) external {
        if (block.timestamp >= entryClose) revert TooLate();
        if (entered[msg.sender]) revert AlreadyEntered();
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender))));
        if (!MerkleProof.verifyCalldata(proof, memberRoot, leaf)) revert NotEligible();
        entered[msg.sender] = true;
        entrants.push(msg.sender);
        emit Entered(msg.sender, entrants.length - 1);
    }

    // ---- on the night ----

    /// Permissionless. Commits to a block 16 slots ahead whose RANDAO mix
    /// nobody can know yet. Also the recovery path after a missed draw block.
    function arm() public {
        if (block.timestamp < entryClose) revert TooEarly();
        if (winner != address(0)) revert AlreadySettled();
        if (entrants.length == 0) revert NoEntrants();
        if (drawBlock != 0 && block.number <= drawBlock) revert NotYet();
        drawBlock = block.number + DELAY;
        emit Armed(drawBlock, entrants.length);
    }

    /// Permissionless, but valid in exactly one block: `drawBlock`.
    /// Early -> revert. Late -> re-arm, never a stale seed.
    function settle() external nonReentrant {
        if (winner != address(0)) revert AlreadySettled();
        uint256 db = drawBlock;
        if (db == 0 || block.number < db) revert TooEarly();
        if (block.number > db) { arm(); return; }

        uint256 n = entrants.length;
        uint256 seed = uint256(keccak256(
            abi.encode(block.prevrandao, db, address(this), n)
        ));
        address w = entrants[seed % n];   // modulo bias here is ~2^-250
        winner = w;
        emit Settled(w, seed, db);
        _pay();
    }

    function claim() external nonReentrant {
        if (msg.sender != winner) revert NotWinner();
        _pay();
    }

    function _pay() internal {
        if (paid || winner == address(0)) return;
        paid = true;                                        // effects first
        (bool ok, ) = winner.call{value: prize, gas: 100_000}("");
        if (!ok) { paid = false; return; }                  // fall back to claim()
        emit Paid(winner, prize);
    }

    /// Dead-man switch so the prize can never be bricked. Destination is fixed.
    function sweep() external nonReentrant {
        if (block.timestamp <= entryClose + SWEEP_AFTER) revert TooEarly();
        if (paid) revert AlreadySettled();
        (bool ok, ) = treasury.call{value: address(this).balance}("");
        require(ok);
    }

    function entrantCount() external view returns (uint256) { return entrants.length; }
}
```

Note that `_pay()` is called from `nonReentrant` entry points, so a winning contract
that tries to re-enter during the push gets a revert, `ok == false`, and `paid`
correctly rolls back to `false` with no ETH having moved.

---

## The audit recipe (publish this with the contract)

Hand a losing entrant this list. Every item is checkable by them alone, from public
data, with no cooperation from you.

1. **Read the verified source.** Confirm: no owner, no admin role, no proxy or
   `delegatecall`, no `selfdestruct`, no function that writes `winner` other than
   `settle()`, no function that moves ETH other than `_pay()` and the 60-day
   `sweep()`.
2. **Check the constructor arguments** in the deployment transaction: `entryClose`,
   `memberRoot`, `treasury`, and `msg.value == 5 ETH`. All `immutable` — compare
   against the announcement post, which predates entries opening.
3. **Rebuild the Merkle root** from the published member list and check it matches
   `memberRoot`. Check your own address is a leaf.
4. **Replay the entrant list** from the `Entered` events. Order and count are
   whatever the chain says; nobody can insert or remove.
5. **Check `Armed` came after `entryClose`** and that `drawBlock` is exactly 16 more
   than the block that emitted it.
6. **Recompute the seed yourself:**
   `keccak256(abi.encode(prevrandao_of_drawBlock, drawBlock, contractAddress, n))`,
   take `seed % n`, index into the entrant list. Confirm it equals the `winner` in the
   `Settled` event. `prevrandao` for that block is in any block explorer's JSON.
7. **Confirm `drawBlock` was arming-time-unknowable:** it was fixed ~3 minutes
   before it existed, and its RANDAO mix depends on reveals that hadn't happened.
8. **Look up who proposed `drawBlock`** on a beacon explorer, and satisfy yourself
   it wasn't anyone with a stake in the outcome.

If all eight check out, the only remaining story is "the proposer of that one slot
was in on it" — a claim that is itself checkable in step 8, and that no amount of
contract design can do better than.

---

## Appendix: the lower-ops variant

If landing a transaction in one exact slot makes you nervous and you'd rather not run
three settler bots, swap Step 2 for: `settle()` is callable at any point in
`[drawBlock, drawBlock + 256)` and seeds from `blockhash(drawBlock)`, with a re-arm if
the 256-block window lapses. Be aware of what you're giving up: `blockhash` is
grindable by that block's proposer over many candidate orderings, where `prevrandao`
is only withholdable. **The re-arm on a lapsed window is non-negotiable in this
variant** — `blockhash` returns `0` outside the 256-block window, which would make the
"winner" computable weeks ahead by anyone willing to sit on the draw, and that is a
genuine, live rigging path.

For 5 ETH among a room of people you know, either variant is defensible. The
`prevrandao` one is the one you can defend against a stranger on the internet.
