# Why 25,600 calls found nothing

## Short version

The suite was green because it was **empty**. Essentially every one of those 25,600
calls reverted, Foundry silently discarded each revert, and the vault never left its
zero state. The assertion that ran 25,600 times was:

```
assertGe(0, 0)   // token.balanceOf(vault) == 0, vault.totalDeposits() == 0
```

That is a tautology. The property is right; it was just never evaluated against a
vault that had ever held a token. A months-long green streak on a vacuous invariant
is not evidence — it is the absence of evidence, and Foundry's default settings make
those two look identical in the test output.

---

## What the 25,600 calls were actually doing

`targetContract(address(vault))` with no handler puts the fuzzer in direct contact
with the vault's ABI. For each of the 512 sequences Foundry does this 50 times:

1. Pick a random `msg.sender` from its generated sender pool.
2. Pick a random selector from `MyVault`'s public ABI.
3. Fill the parameters with random 256-bit words.
4. `prank(sender)` and call it.
5. Evaluate every `invariant_*` function.

Now walk through what those calls hit, given this `setUp`:

```solidity
token = new MockERC20();        // supply, if any, sits with the test contract
vault = new MyVault(token);     // nobody is dealt tokens, nobody approves anything
targetContract(address(vault));
```

**`deposit(amount)` — reverts, 100% of the time.** The vault's deposit path ends in
`token.transferFrom(msg.sender, address(vault), amount)`. The caller is a
fuzzer-generated address with a zero token balance and a zero allowance to the vault.
`transferFrom` reverts on allowance before it even reaches the balance check. There
is no value of `amount` and no sender in the pool for which this succeeds — the
failure is not "rare," it is total. And because `deposit` is the only way tokens enter
the vault, `token.balanceOf(address(vault))` is `0` for the entire campaign.

**`withdraw(amount)` — reverts (or no-ops), 100% of the time.** Every caller has a
recorded deposit of zero, so the `require(deposits[msg.sender] >= amount)` check (or
the underflow on the subtraction) reverts for any non-zero `amount`. A fuzzed `amount`
of exactly `0` is the one call that might survive, and it changes nothing.

**Everything else** — owner/admin functions, pause, setters — reverts on access
control, because the fuzzer's senders are not the owner.

The parameters made it worse. Random `uint256` arguments are astronomically large:
the median fuzzed `amount` is around 2^255. Even if a sender *had* been funded, almost
every amount would have exceeded the balance and reverted on the amount check instead.
Fuzzers only find bugs in ranges you steer them into; unbounded 256-bit arguments
steer them into the revert path, not the interesting one.

So the actual call distribution was roughly:

| calls | outcome | state change |
|---|---|---|
| ~25,600 | revert (allowance / insufficient deposit / onlyOwner) | none — EVM state rolled back |
| a handful | `deposit(0)` / `withdraw(0)` no-ops | none |

`fail_on_revert` defaults to `false`. Under that setting a reverting call is counted
in the revert metric, its state change is rolled back, and the sequence **just keeps
going** to the next call. So each "sequence of 50 calls" was really a sequence of 50
rollbacks: depth 50 explored exactly one state — the initial one. 512 sequences ×
50 depth bought 512 × 50 re-checks of the same trivial state, not 25,600 states.

And that is why the drain was unreachable. The user's exploit is a *sequence*:
deposit, then withdraw, then deposit again, with a second account interleaved — the
bug lives in how `totalDeposits` and the per-user ledger diverge after several
successful state transitions. Your suite could not produce even **one** successful
state transition, let alone a specific interleaving of five. Reaching the bug required
funded actors and bounded amounts; the harness supplied neither.

---

## What the run output was telling you, and where to look

### 1. The revert count on the summary line

`forge test` prints this for every invariant, and it is the single most important
number in the whole run:

```
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

**`reverts` ≈ `calls` means the run did nothing.** That line was in your CI logs on
every commit for months. A healthy invariant run has a revert count that is a small
fraction of the call count — the reverts are the genuinely invalid inputs your handler
didn't filter, not the entire campaign. When `reverts == calls`, the `[PASS]` is
meaningless: the fuzzer bounced off the front door 25,600 times and you graded it on
the door still being locked.

Make this a hard rule: **any invariant whose revert count is above ~10–20% of its call
count is broken until proven otherwise**, and above 90% it is not a test at all.

### 2. Per-selector metrics

Turn on the breakdown so you see *which* functions are dying:

```toml
[invariant]
show_metrics = true
```

You get a table per target function with calls / reverts / discards. Yours would have
read `deposit: 8500 calls, 8500 reverts` — immediately diagnostic, and it names the
exact function that never once executed.

### 3. `fail_on_revert = true`

This is the setting that would have caught it on day one. With it on, the first
reverting call aborts the run and Foundry prints the failing sequence and the revert
reason:

```
[FAIL: ERC20: insufficient allowance]
    [Sequence] vault.deposit(4297...e74)
```

You would have seen "insufficient allowance" the first time you ran it and known the
harness was never funding anyone. Keep it on permanently: the discipline it enforces
is that the *handler* is responsible for only making calls that should succeed, which
means any revert is now real signal — either a bug in the vault or a gap in the
handler.

### 4. A coverage canary

The general defense against a vacuous invariant is to assert something that is false
in the zero state, confirm it fails, and then delete it (or keep it as a ghost check):

```solidity
function invariant_Canary() public view {
    assertLt(vault.totalDeposits(), 1);  // passes only while the vault is empty
}
```

If that *passes* at the end of a campaign, the fuzzer never deposited anything and
every other invariant in the file is worthless. Five lines, run once, would have told
you the truth months ago.

### 5. A call-summary handler function

Ghost counters logged at the end of the run turn "did this test do anything" from a
guess into a number:

```solidity
function invariant_CallSummary() public view {
    console.log("deposit  ok/attempted:", handler.depositOk(), handler.depositCalls());
    console.log("withdraw ok/attempted:", handler.withdrawOk(), handler.withdrawCalls());
    console.log("vault balance:", token.balanceOf(address(vault)));
}
```

Run with `-vv` and read it. `deposit ok: 0` is not subtle.

---

## The change that makes this suite able to find the drain

Four things have to change together; any one alone leaves the test vacuous.

1. **A handler**, so the fuzzer calls a funded, bounded wrapper instead of the raw vault.
2. **Real actors** — a small fixed set of addresses that are dealt tokens and have
   approved the vault — and more than one of them, because the drain depends on one
   account's withdraw touching another's deposits.
3. **Bounded arguments**, via `bound()` (not `vm.assume`, which discards the run
   instead of reshaping it), so amounts land in the range where the vault actually
   transacts.
4. **`fail_on_revert = true`**, so the harness can never silently go quiet again.

### `foundry.toml`

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true     # the setting that would have caught this
show_metrics = true       # per-selector calls/reverts
```

### `test/handlers/VaultHandler.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {MyVault} from "../../src/MyVault.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract VaultHandler is CommonBase, StdCheats, StdUtils {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    address[] public actors;
    address internal currentActor;

    // Ghost accounting — the fuzzer's own independent ledger.
    uint256 public ghostDeposited;
    uint256 public ghostWithdrawn;
    mapping(address => uint256) public ghostBalanceOf;

    // Coverage counters — read these in invariant_CallSummary.
    uint256 public depositCalls;
    uint256 public depositOk;
    uint256 public withdrawCalls;
    uint256 public withdrawOk;

    modifier useActor(uint256 seed) {
        currentActor = actors[bound(seed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        // Several actors, because the drain needs cross-account interleaving.
        for (uint256 i = 0; i < 5; i++) {
            address actor = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(actor);
            deal(address(token), actor, 1_000_000e18);   // fund them
            vm.prank(actor);
            token.approve(address(vault), type(uint256).max); // approve them
        }
    }

    function deposit(uint256 actorSeed, uint256 amount) external useActor(actorSeed) {
        depositCalls++;
        amount = bound(amount, 1, token.balanceOf(currentActor));

        vault.deposit(amount);

        ghostDeposited += amount;
        ghostBalanceOf[currentActor] += amount;
        depositOk++;
    }

    function withdraw(uint256 actorSeed, uint256 amount) external useActor(actorSeed) {
        withdrawCalls++;
        uint256 owed = ghostBalanceOf[currentActor];
        if (owed == 0) return;                // skip cleanly; never revert
        amount = bound(amount, 1, owed);

        vault.withdraw(amount);

        ghostWithdrawn += amount;
        ghostBalanceOf[currentActor] -= amount;
        withdrawOk++;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}
```

Two details that matter. `deal` + `approve` in the constructor is what turns the
fuzzer from a stranger at the door into a depositor — it is the entire fix for the
revert storm. And the handler never makes a call it expects to fail: when an actor has
nothing to withdraw it returns early rather than letting the vault revert. That is
what makes `fail_on_revert = true` livable, and it is what converts every future
revert into a genuine finding.

### `test/VaultInvariant.t.sol`

```solidity
contract VaultInvariantTest is Test {
    MyVault vault;
    MockERC20 token;
    VaultHandler handler;

    function setUp() public {
        token = new MockERC20();
        vault = new MyVault(token);
        handler = new VaultHandler(vault, token);

        targetContract(address(handler));   // fuzz the handler...
        excludeContract(address(vault));    // ...never the vault directly
        excludeContract(address(token));

        // Only the two user-facing entry points.
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.withdraw.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    // Your original property — unchanged, and now actually exercised.
    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    // Stronger: the vault must cover what users are individually owed, which
    // catches the drain even if totalDeposits is the field being corrupted.
    function invariant_CoversEveryUser() public view {
        uint256 owed;
        for (uint256 i = 0; i < handler.actorCount(); i++) {
            owed += vault.balanceOf(handler.actors(i));
        }
        assertGe(token.balanceOf(address(vault)), owed);
    }

    // Ghost reconciliation: the vault's own accounting vs. an independent tally.
    // This fires at the moment the ledger diverges, several calls before the
    // drain completes — which is where the bug actually is.
    function invariant_AccountingMatchesGhost() public view {
        assertEq(
            vault.totalDeposits(),
            handler.ghostDeposited() - handler.ghostWithdrawn()
        );
    }

    function invariant_CallSummary() public view {
        console.log("deposit  ok/calls:", handler.depositOk(), handler.depositCalls());
        console.log("withdraw ok/calls:", handler.withdrawOk(), handler.withdrawCalls());
        console.log("vault balance:", token.balanceOf(address(vault)));
        console.log("totalDeposits:", vault.totalDeposits());
    }
}
```

`invariant_AccountingMatchesGhost` is the one most likely to catch this class of bug
first. A drain via ordinary deposits and withdraws means the vault's internal ledger
and reality parted ways at some earlier call; the ghost tally is an independent
reimplementation of that ledger, so it flags the divergence at the instant it happens
rather than at the end, when the tokens are already gone. Foundry then hands you the
minimal call sequence that produced it.

---

## How to confirm the new suite is real

Run it and check, in this order:

1. `reverts` on the summary line is `0` (with `fail_on_revert = true` it must be).
2. `invariant_CallSummary` shows `depositOk` and `withdrawOk` both in the thousands,
   and a non-zero vault balance.
3. Add the canary `assertLt(vault.totalDeposits(), 1)` and confirm it **fails**, then
   remove it. A passing canary means you are still testing nothing.
4. Reintroduce the shipped bug (or just run against the pre-fix vault) and confirm
   `invariant_SolvencyHolds` now fires and Foundry shrinks to a readable sequence.

Step 4 is the one that matters. An invariant test you have never seen fail is a test
you have no reason to believe. Before trusting any new invariant, break the contract
on purpose and watch it catch you — that, not a green streak, is what makes the suite
evidence.

---

## The generalizable lesson

The bug here was not in the assertion, and not really in the vault. It was that
`fail_on_revert = false` makes "the property held across 25,600 states" and "the
fuzzer never reached a second state" print the identical green `[PASS]`. Foundry's
defaults are tuned to keep noisy campaigns running, and the cost is that a silently
dead harness looks exactly like a healthy one.

So: a green invariant is only as good as its reachability. Every invariant suite needs
a funded handler, bounded inputs, `fail_on_revert = true`, and at least one number in
the output — revert count, ghost counter, call summary — that proves the fuzzer got
somewhere. Check those before you believe the `[PASS]`.
