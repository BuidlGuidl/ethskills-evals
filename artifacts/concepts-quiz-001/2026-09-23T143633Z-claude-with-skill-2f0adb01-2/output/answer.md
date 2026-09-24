# 5 ETH giveaway: draw sequence, onchain

## The short version

There is no free oracle and no scheduler. Nothing in the contract happens because
Friday arrives — it happens because a person sends a transaction. So the design is
a **two-source draw**: a multi-party commit–reveal by a handful of named "sealers",
mixed with **block hashes from blocks that are mined after the reveal window closes**.
Neither source alone is enough; together, rigging the result requires simultaneously
controlling a sealer secret *and* proposing specific Ethereum blocks minutes later.

The whole sequence is four transactions on the night, none of which require the
organisers specifically — anyone in the room (or anyone on the internet) can send
the last three.

Why not Chainlink VRF: it is the right tool for this, but it needs a funded
subscription account. (VRF 2.5 can be paid in native ETH, so the blocker is not
the LINK token — it's opening and topping up the account, which you've ruled out.)
Everything below works with ETH, the contract, and the people present.

---

## 1. What has to exist before the night

### 1.1 The contract, deployed and funded early in the week

Deploy **before entries open**, with every parameter fixed in the constructor and
**no owner, no pause, no upgrade path, no admin key of any kind**. If a key exists
that can change the winner, the rules, or the deadlines, a losing entrant has a
credible story — "they could have", which is all a rigging accusation needs. Delete
the possibility instead of promising not to use it.

Fixed at deploy:

| Parameter | Value |
|---|---|
| `PRIZE` | 5 ETH, sent in the deploy tx or immediately after |
| `ENTRY_CLOSE` | Friday 20:00:00 UTC |
| `REVEAL_DEADLINE` | Friday 20:20:00 UTC |
| `ROSTER_ROOT` | Merkle root of eligible member addresses |
| `SEALERS[]` | 3–5 addresses (see 1.2) |
| `SEALER_BOND` | 0.25 ETH each |
| `TREASURY` | address the ETH returns to on the dead-end paths |
| `ARM_TIP` / `DRAW_TIP` | 0.02 ETH each, funded at deploy on top of the 5 ETH |

Verify the source on Etherscan the same day, and publish the address. Contract
holds 5.04 ETH from Monday; anyone can see it.

### 1.2 Sealers — who they are and why it matters

Pick 3–5 people who will each hold a secret. **At least one must not be an
organiser** — a regular from the community, ideally someone who has publicly
grumbled about the treasury. The cryptography doesn't care who they are, but the
credibility story does: the sealer set is the thing a sceptic looks at first.

Each sealer generates `secret` (32 random bytes) and `salt` locally, and submits
`keccak256(secret, salt, theirAddress)` with the 0.25 ETH bond. Tell them plainly:
write the secret down somewhere you will still have it on Friday, and do not show
it to anyone until you reveal.

### 1.3 Entry eligibility — close the sybil hole before it opens

"Anyone who turns up can enter" needs a definition of *anyone*, or one person with
50 wallets quietly takes 50 tickets and the draw is genuinely rigged even though
the randomness is perfect. Publish a roster of member addresses, put its Merkle
root in the constructor, and have `enter()` take a Merkle proof. One entry per
address, enforced by the contract. The full roster goes in the repo alongside the
contract so anyone can rebuild the root themselves.

(If maintaining a roster is too much friction, the alternative is a refundable
entry deposit large enough that 50 wallets is expensive — but then you've made
the giveaway cost money to enter, which is probably worse for a community meetup.
The roster is the better trade.)

### 1.4 Dry run and logistics

- Run the entire sequence on Sepolia end to end, including a sealer deliberately
  failing to reveal, and including the re-arm path. Budget an evening for this.
- Every sealer's wallet has ETH for gas on Friday. Check on Thursday, not at 19:55.
- The person who will call `arm()` and `draw()` from the stage has a tested wallet,
  a tested RPC endpoint, and **a second person in the room with the same setup**.
- Publish a one-page "how to check this yourself" before Friday: contract address,
  roster file, the exact hash preimage, and the three-line script that recomputes
  the winner from public data. A loser who can re-derive the result in 30 seconds
  does not start a thread about it.
- Print the entrant list and the commit hashes. Read the entrant count aloud on
  stage before `arm()` — it makes the "the list changed afterwards" story dead
  on arrival, and it's a nice moment.

### 1.5 Chain choice

Mainnet gives the strongest version of the block-hash ingredient. On an L2 the
block hashes are produced by a single sequencer that could, in principle, reorder
or withhold; if you deploy on Base or Arbitrum for gas reasons, lean harder on the
sealer reveals and read an **L1** block hash via the `L1Block` predeploy rather
than the local one. For 5 ETH and ~40 entrants, mainnet gas is a rounding error
against the prize — I'd use mainnet.

---

## 2. The sequence

### Monday–Thursday — commits and entries

| Step | Who sends it | Window |
|---|---|---|
| `commit(hash)` + 0.25 ETH bond | each sealer, individually | any time before Fri 20:00, **aim for Thursday** |
| `enter(merkleProof)` | each entrant, themselves | entry open → Fri 20:00:00 UTC |

Sealers must commit **before entries close**, because a sealer who could pick their
secret after seeing the final entrant list could grind for a secret that selects
their friend. The contract enforces `commit` before `ENTRY_CLOSE`; ask for it by
Thursday so a lost key is discovered with a day to spare.

### Friday 20:00:00 UTC — entries close

**No transaction.** This is the one thing that genuinely needs no poker: `enter()`
simply reverts once `block.timestamp >= ENTRY_CLOSE`. Reading time is free;
*doing* something at a time is not. Every step below needs a human.

### Friday 20:00–20:20 UTC — reveal window

| Step | Who sends it | Window |
|---|---|---|
| `reveal(secret, salt)` | each sealer | 20:00:00 → 20:20:00 UTC |

The contract checks the hash, XORs the secret into `revealedSeed`, and returns that
sealer's 0.25 ETH bond in the same transaction. That refund is the incentive: it is
the sealer's own money, held hostage by their own laziness.

Do this on stage, out loud, one sealer at a time. It's 20 minutes of actual theatre
and it's the part of the evening that makes the result feel earned.

### Friday ~20:21 UTC — arm the draw

| Step | Who sends it | Window |
|---|---|---|
| `arm()` | **anyone** (host on stage; 0.02 ETH tip to the caller) | any time from 20:20:00 |

`arm()` records `seedStart = block.number + 5` and locks in an 8-block span
(`seedStart … seedStart + 7`, roughly 96 seconds on mainnet). It does **not** draw
anything. Nobody, including the caller, knows those eight block hashes yet.

This separation is the whole security of the step. If `draw()` just read the
previous block hash directly, the caller could simulate the transaction first, see
whether they won, and only broadcast if they did — re-rolling for the price of gas
until they liked the answer. Committing to future blocks first makes that
impossible: by the time `draw()` can be called, the hashes are already fixed and
identical for every possible caller.

### Friday ~20:23 UTC — draw and pay

| Step | Who sends it | Window |
|---|---|---|
| `draw()` | **anyone** (0.02 ETH tip to the caller) | from `seedStart + 8` until `seedStart + 256` (~51 min) |

```
seed    = keccak256(revealedSeed, blockhash(seedStart) … blockhash(seedStart+7), entryCount)
winner  = entrants[seed % entryCount]
```

`draw()` records the winner, then attempts to push the 5 ETH straight to their
address in the same transaction. That's your stage moment: one transaction, name on
screen, ETH in the wallet, block explorer on the projector.

If the push fails — the winner's address is a contract that reverts or is gas-hungry
— the contract does **not** revert the draw. It marks the prize `claimable` and the
winner (or anyone, on their behalf) calls `claim()` afterwards. A failed transfer
must never be able to un-draw a completed draw, or a winning contract address
becomes a way to force a re-roll.

---

## 3. Why nobody can influence or foresee the winner

**A sealer** commits before the entrant list is final and before the seed blocks
exist. They control one XOR input but cannot see the other seven ingredients.

**The last sealer to reveal** — normally the weak point of any commit–reveal, since
they can see everyone else's reveal, compute the result, and withhold if they don't
like it — gains nothing here. The eight block hashes are mined *after* the reveal
deadline. Withholding a reveal changes the seed to another value they equally can't
predict. This is the specific reason the block-hash ingredient is drawn after the
reveal window rather than before it.

**The organisers** have no privileged function. There is no owner. They cannot
change deadlines, add entrants, re-draw, or pause.

**The `arm()` / `draw()` callers** have no choice that matters. `arm()` points at
blocks that don't exist yet; `draw()` reads hashes already fixed, so grinding the
call timing changes nothing.

**A block proposer** is the only residual risk, and it's narrow: to bias the result
they must be an entrant, be assigned one of the eight specific slots that `arm()`
happened to name, and skip their own block to force a fresh seed. Missing a slot
costs them the block reward plus its MEV, and buys a single re-roll — worth roughly
one extra ticket's expected value against a 5 ETH prize. The probability that one of
your forty meetup attendees is also a validator proposing one of eight named slots
is effectively zero. I'd rather state this honestly than tell you it's VRF-grade:
it isn't, it's a well-known residual, and it is far below the threshold that matters
for a community giveaway.

**And the audit trail:** commits, entries, reveals, seed blocks and the winner are
all public. Anyone can recompute `keccak256(...) % entryCount` from chain data alone
and get the same address. There's no step where a losing entrant has to take your
word for anything.

---

## 4. What happens when someone doesn't do their part

Each of these is a real code path, not a plan. Test every one on Sepolia.

**A sealer doesn't reveal by 20:20.** The draw proceeds without them. Their secret
is simply absent from the XOR; their 0.25 ETH bond is forfeited and goes to the
`draw()` caller. No re-runs, no extensions, no discussion on stage.

**No sealer reveals at all** (all keys lost, everyone's phone dies). `draw()` still
works, seeded by the eight block hashes and the entrant count alone. This is safe
precisely because those blocks are mined after the reveal deadline — no one who
could have influenced anything knew them in advance. It's a weaker seed and you
should say so out loud, but it is not a rigged one, and the alternative — bricking
on a missing reveal — would hand any sealer a unilateral veto over the whole
giveaway. Never let one participant's inaction stop the machine.

**Nobody calls `arm()`.** Nothing happens. The contract sits there holding 5.04 ETH
indefinitely, which is exactly what a state machine does when nobody pokes it.
Anyone can call it the next morning, the next week, or a year later; the sequence
resumes from wherever it stopped. This is why `arm()` is permissionless and carries
a tip rather than being an organiser-only function.

**Nobody calls `draw()` within 256 blocks of `seedStart`.** This one has teeth:
`blockhash()` returns zero beyond a 256-block lookback, so a naive contract would
silently draw from a seed of zeros. Instead `draw()` reverts once the window has
lapsed, and **anyone can call `arm()` again** to name a fresh set of blocks and
restart the ~51-minute clock. Unlimited retries, no state lost, no way to brick.
The one thing this permits is an extremely expensive form of re-rolling — but
re-arming costs a transaction and hands the caller no ability to predict the next
seed either, so there's nothing to gain by it.

**The prize push fails.** Draw stands, winner stands, prize sits as `claimable`
forever. `claim()` is callable by anyone and always sends to the recorded winner,
so a friend with gas money can complete it for them.

**The winner never claims.** After 90 days the contract lets anyone sweep the
unclaimed prize back to `TREASURY`. Put that in the announcement beforehand, not
in a footnote afterwards.

**Zero entrants.** `draw()` returns the 5 ETH and the tips to `TREASURY`.

**Everyone goes home and the contract is forgotten.** A 30-day backstop lets anyone
return the prize to `TREASURY` if no valid `draw()` has occurred. This can't be used
to grief the giveaway, because during those 30 days *anyone at all* can call
`arm()`/`draw()` and complete it — the backstop only fires when literally nobody,
including the entrants with 5 ETH on the line, could be bothered.

---

## 5. Contract sketch

Structure only — have this audited or at least read by two people who aren't you
before Friday.

```solidity
contract MeetupDraw {
    // all immutable, set in constructor. no owner, no pause, no upgrade.
    uint256 public immutable ENTRY_CLOSE;      // Fri 20:00 UTC
    uint256 public immutable REVEAL_DEADLINE;  // Fri 20:20 UTC
    bytes32 public immutable ROSTER_ROOT;
    address public immutable TREASURY;

    address[] public entrants;
    mapping(address => bool) public entered;
    mapping(address => bytes32) public commitOf;   // sealer => hash
    bytes32 public revealedSeed;

    uint256 public seedStart;      // 0 = not armed
    address public winner;
    bool    public drawn;
    bool    public claimed;

    function commit(bytes32 h) external payable {
        require(block.timestamp < ENTRY_CLOSE && isSealer(msg.sender));
        require(msg.value == SEALER_BOND && commitOf[msg.sender] == 0);
        commitOf[msg.sender] = h;
    }

    function enter(bytes32[] calldata proof) external {
        require(block.timestamp < ENTRY_CLOSE && !entered[msg.sender]);
        require(MerkleProof.verify(proof, ROSTER_ROOT, leaf(msg.sender)));
        entered[msg.sender] = true;
        entrants.push(msg.sender);
    }

    function reveal(bytes32 secret, bytes32 salt) external {
        require(block.timestamp >= ENTRY_CLOSE && block.timestamp < REVEAL_DEADLINE);
        require(keccak256(abi.encode(secret, salt, msg.sender)) == commitOf[msg.sender]);
        commitOf[msg.sender] = 0;                  // effects before interaction
        revealedSeed ^= secret;
        _send(msg.sender, SEALER_BOND);            // bond back, non-reverting
    }

    // permissionless. names future blocks; reveals nothing.
    function arm() external {
        require(block.timestamp >= REVEAL_DEADLINE && !drawn);
        require(seedStart == 0 || block.number > seedStart + 256);  // re-arm if lapsed
        seedStart = block.number + 5;
        _send(msg.sender, ARM_TIP);
    }

    // permissionless. seed is already fixed when this becomes callable.
    function draw() external {
        require(!drawn && seedStart != 0);
        require(block.number > seedStart + 7, "seed blocks not final");
        require(block.number <= seedStart + 256, "window lapsed - call arm() again");

        bytes32 h;
        for (uint256 i = 0; i < 8; i++) h = keccak256(abi.encode(h, blockhash(seedStart + i)));
        drawn = true;                                        // effects first

        if (entrants.length == 0) { _send(TREASURY, address(this).balance); return; }

        uint256 seed = uint256(keccak256(abi.encode(revealedSeed, h, entrants.length)));
        winner = entrants[seed % entrants.length];

        _send(msg.sender, DRAW_TIP);
        if (_trySend(winner, PRIZE)) claimed = true;         // stage moment
        // else: stays claimable. a failed push never un-draws the draw.
    }

    function claim() external { require(drawn && !claimed); claimed = true; _send(winner, PRIZE); }
}
```

Points worth keeping when this turns into real code: state changes before every
external call, `_trySend` uses a capped-gas low-level call and never reverts the
caller, and `blockhash` results are checked non-zero in the loop so a lapsed window
can never be mistaken for entropy.

---

## 6. Friday night, on one card

| Time (UTC) | What | Sender |
|---|---|---|
| — | entries close | *no tx — `enter()` just starts reverting* |
| 20:00–20:20 | each sealer calls `reveal()` | sealers, on stage |
| ~20:21 | `arm()` — names 8 future blocks | host (anyone can) |
| ~20:23 | `draw()` — seed fixed, winner selected, 5 ETH pushed | host (anyone can) |
| if push failed | `claim()` | winner, or anyone for them |

If a sealer no-shows, the draw runs without them. If the host's laptop dies, someone
else calls `arm()`/`draw()` and collects the tip. If the room clears out before
anyone calls anything, the contract waits — and the first person to remember, any
time in the next 30 days, finishes it.
