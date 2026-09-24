# Why 25,600 calls never found the drain

## TL;DR

Your assertion is fine. Your *state space* is empty.

`setUp()` never gives a single fuzz-able address any tokens and never sets a single
approval. So every `deposit(...)` the fuzzer generated reverted inside
`token.transferFrom`, and every `withdraw(...)` reverted on a zero user balance.
Foundry's default `fail_on_revert = false` swallowed all of it silently.

After every one of those 25,600 calls the vault's state was byte-for-byte identical
to the state `setUp()` left behind:

```
token.balanceOf(address(vault)) == 0
vault.totalDeposits()           == 0
assertGe(0, 0)                  -> passes
```

The suite has been green for months because it has been asserting `0 >= 0`, 512
times a run, since the day it was written. It never executed a single successful
state-changing call against the vault. It is not a weak test — it is a test of
nothing, and it would have stayed green if you had deleted the body of `deposit()`.

---

## 1. What the 25,600 calls were actually doing

Open targeting — `targetContract(address(vault))` with no handler, no
`targetSelector`, no `targetSender` — tells Foundry: *"take the ABI of `MyVault`,
pick a random external function, pick random ABI-encoded arguments, pick a random
`msg.sender` from the fuzzer's address pool, and call it directly."*

Here is what that produces, call by call:

**`deposit(uint256 amount)`**
The fuzzer picks `amount` uniformly from `[0, 2**256-1]`. The sender is a random
address like `0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38` that was invented by the
fuzzer a microsecond ago. That address has:

- a token balance of `0`, because `MockERC20`'s constructor minted supply to its
  deployer — the *test contract* — and nothing was ever distributed; and
- an allowance to the vault of `0`, because nobody ever called `approve`.

So the call reaches `token.transferFrom(msg.sender, address(vault), amount)` and
reverts on allowance or balance. On the rare draw where `amount == 0`, either the
vault's own `require(amount > 0)` rejects it or the transfer is a no-op that moves
zero tokens and adds zero to `totalDeposits`. Either way: no state change.

**`withdraw(uint256 amount)`**
Same random sender, whose `deposits[msg.sender]` (or share balance) is `0`. Every
draw except possibly `0` underflows or trips the `require`. Revert. No state change.

**Everything else on the ABI**
`owner()`, `totalDeposits()`, `token()` and friends are view functions — the fuzzer
happily burns calls on them and they change nothing by construction. Any
`onlyOwner` function is called by a random non-owner and reverts.

Then Foundry runs `invariant_SolvencyHolds()` after each call, reads `0` and `0`,
and moves on.

Multiply by 50 calls per sequence and 512 sequences. The revert rate is
approximately 100%, and the fraction of calls that mutated vault storage is
**exactly zero**.

### Why this is unfixable by turning the dial up

The instinct is "run more". It does not help, and understanding why is the point.

To reach a state where solvency can even be questioned, the fuzzer needs a
*conjunction* of events it has no machinery to produce:

1. Some address must hold tokens. Nothing mints to fuzz senders. **Probability: 0.**
2. That same address must have approved the vault. `approve` is on `MockERC20`, which
   is not a target contract, so the fuzzer cannot call it at all. **Probability: 0.**
3. The same address must then deposit, and then withdraw, *later in the same
   sequence* — because invariant sequences start fresh from the `setUp()` snapshot
   every run, so nothing accumulates across the 512 runs.
4. For an accounting bug of the kind that drains a vault, you typically need **two
   interacting actors** — a victim whose funds are in the vault and an attacker
   whose withdraw path over-credits against them. Under open targeting every call
   gets a fresh random sender, so even if (1) and (2) were satisfied, the chance of
   the same address appearing twice in a 50-call window is negligible, and the
   chance of the *right two* addresses interleaving correctly is worse.

Steps 1 and 2 are probability zero, not "small". `runs = 512` and `runs = 5,000,000`
both multiply zero by a constant. The suite is not under-powered; it is
disconnected from the contract.

And note the shape of the bug you actually shipped: "ordinary deposit and withdraw
calls." That is precisely a bug that lives at depth ≥ 2 in a populated,
multi-actor state. Your fuzzer never got to depth 1.

---

## 2. Why the assertion could never fail

The invariant is

```
token.balanceOf(vault) >= vault.totalDeposits()
```

Both sides are monotonic functions of successful deposits and withdrawals. With no
successful deposits and no successful withdrawals, both sides are pinned at their
initial value of `0` for the entire run. `assertGe(0, 0)` is true.

This is the classic failure mode: **a vacuously true invariant.** The assertion is
correct — you proved that by hand against the real drain — but correctness of the
predicate is worthless if the predicate is only ever evaluated at one point in the
state space, and that point is the origin. A test that asserts a property over an
empty set passes trivially, and it passes *loudly and green*, which is what makes it
dangerous.

---

## 3. What in the run output would have told you this months ago

Four signals, any one of which would have caught it on day one. This is the real
takeaway: **a green invariant run is not evidence until you have looked at what it
executed.**

### 3.1 The revert ratio in the run metrics

Run with:

```bash
forge test --match-test invariant_SolvencyHolds -vvv
```

Foundry prints per-run metrics for invariant tests. Yours would have read something
like:

```
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

`calls: 25600, reverts: 25600`. That line has been in your CI logs every commit for
months. **A revert count at or near the call count means the fuzzer never got
through your front door.** Treat any invariant suite with a revert rate above ~20%
as broken until proven otherwise; at 100% it is not a test.

### 3.2 `fail_on_revert = true` — the single highest-value line

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true
```

This is the setting that turns silent nothing-happened into a loud failure. With it
on, your suite would have failed on the very first call of the very first run,
months ago, with the `transferFrom` revert reason printed.

The reason it is usually off — and the reason people leave it off — is that under
open targeting reverts are unavoidable noise. That is the tell. Once you move to a
handler (below), the handler is responsible for only ever generating *valid* calls,
reverts become genuine bugs, and `fail_on_revert = true` becomes both affordable and
extremely informative. Run with it on by default; only relax it for specific
selectors you have deliberately decided may revert.

### 3.3 A call-summary invariant (ghost counters)

The standard Foundry discipline is to have the handler count what it actually
managed to do, and print it:

```solidity
function invariant_CallSummary() public view {
    handler.callSummary();   // console.log of per-function success counts
}
```

```
forge test --match-test invariant_CallSummary -vvv
```

If that prints `deposit: 0  withdraw: 0`, you know instantly. Without it you are
reading a green checkmark and inferring coverage you do not have.

### 3.4 The canary / falsification check

Before trusting any invariant suite, **prove it can fail.** Two cheap ways:

```solidity
// Canary: this SHOULD fail once the fuzzer reaches real state.
// If it passes, your fuzzer never deposited anything.
function invariant_Canary() public view {
    assertEq(vault.totalDeposits(), 0, "canary: fuzzer reached non-zero state");
}
```

Run it. If the canary *passes*, your suite is vacuous. Delete it once it correctly
fails.

Equivalently, mutate the contract: introduce an obvious solvency bug (make
`withdraw` send double), run the suite, and confirm it goes red. A suite that stays
green against a deliberately broken contract is telling you it is not connected to
the contract. That one-minute check would have saved the vault.

Bonus signal: `forge coverage` would have shown `deposit`/`withdraw` bodies at 0%
line coverage from the invariant test.

---

## 4. The change that makes the suite capable of finding the sequence

Replace open targeting with a **handler** that owns actor funding, approvals, actor
selection and input bounding, so that every generated call is a *valid* call and the
fuzzer spends its 25,600 calls exploring real state instead of bouncing off
`require`s.

### `test/handlers/VaultHandler.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MyVault} from "../../src/MyVault.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract VaultHandler is Test {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    // A SMALL, FIXED actor set. This is what makes multi-actor sequences
    // reachable: the same 4 addresses recur, so "alice deposits, bob withdraws,
    // alice withdraws" happens constantly instead of never.
    address[] public actors;
    address internal currentActor;

    // Ghost variables: an independent accounting of truth, computed by the test,
    // never read from the contract under test.
    uint256 public ghost_depositSum;
    uint256 public ghost_withdrawSum;
    mapping(address => uint256) public ghost_actorNet;

    // Call counters — these are what you read to confirm the suite is alive.
    mapping(bytes32 => uint256) public calls;

    modifier useActor(uint256 actorSeed) {
        currentActor = actors[bound(actorSeed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    modifier countCall(bytes32 key) {
        calls[key]++;
        _;
    }

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        for (uint256 i = 0; i < 4; i++) {
            address actor = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(actor);
            // THE FIX FOR STEP 1: actors actually hold tokens.
            token.mint(actor, 1_000_000e18);
            // THE FIX FOR STEP 2: actors have actually approved the vault.
            vm.prank(actor);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount)
        public
        useActor(actorSeed)
        countCall("deposit")
    {
        // bound(), not vm.assume(): reshape the input into the valid range instead
        // of discarding the run. assume() here would throw away ~100% of draws.
        amount = bound(amount, 1, token.balanceOf(currentActor));
        if (amount == 0) return;

        vault.deposit(amount);

        ghost_depositSum += amount;
        ghost_actorNet[currentActor] += amount;
    }

    function withdraw(uint256 actorSeed, uint256 amount)
        public
        useActor(actorSeed)
        countCall("withdraw")
    {
        uint256 max = vault.balanceOf(currentActor); // or deposits(currentActor)
        if (max == 0) return;
        amount = bound(amount, 1, max);

        vault.withdraw(amount);

        ghost_withdrawSum += amount;
        ghost_actorNet[currentActor] -= amount;
    }

    // Lets sequences explore partial/zero-value and self-directed edge cases
    // without the fuzzer having to stumble onto them.
    function withdrawAll(uint256 actorSeed)
        public
        useActor(actorSeed)
        countCall("withdrawAll")
    {
        uint256 max = vault.balanceOf(currentActor);
        if (max == 0) return;
        vault.withdraw(max);
        ghost_withdrawSum += max;
        ghost_actorNet[currentActor] -= max;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }

    function callSummary() external view {
        console.log("deposit     :", calls["deposit"]);
        console.log("withdraw    :", calls["withdraw"]);
        console.log("withdrawAll :", calls["withdrawAll"]);
        console.log("ghost deposits :", ghost_depositSum);
        console.log("ghost withdraws:", ghost_withdrawSum);
    }
}
```

### `test/VaultInvariant.t.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MyVault} from "../src/MyVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {VaultHandler} from "./handlers/VaultHandler.sol";

contract VaultInvariantTest is Test {
    MyVault vault;
    MockERC20 token;
    VaultHandler handler;

    function setUp() public {
        token = new MockERC20();
        vault = new MyVault(token);
        handler = new VaultHandler(vault, token);

        // Target the HANDLER, not the vault. The vault is now reached only
        // through calls the handler has made valid.
        targetContract(address(handler));

        // Restrict to the state-changing entry points so the fuzzer does not
        // waste depth on view functions and getters.
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.withdraw.selector;
        selectors[2] = VaultHandler.withdrawAll.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));

        // Keep the fuzzer from calling the vault or token directly.
        excludeContract(address(vault));
        excludeContract(address(token));
    }

    /// Your original property — unchanged, because it was right.
    /// It is now evaluated against real, populated, multi-actor state.
    function invariant_SolvencyHolds() public view {
        assertGe(
            token.balanceOf(address(vault)),
            vault.totalDeposits(),
            "vault is insolvent"
        );
    }

    /// Stronger and strictly earlier-firing: internal accounting must match the
    /// test's independent ghost accounting. This catches the drift that CAUSES
    /// insolvency, one step before the tokens are actually gone.
    function invariant_TotalDepositsMatchesGhost() public view {
        assertEq(
            vault.totalDeposits(),
            handler.ghost_depositSum() - handler.ghost_withdrawSum(),
            "totalDeposits diverged from ghost accounting"
        );
    }

    /// Per-actor: the sum of individual balances must equal the aggregate.
    /// This is the one that typically nails "ordinary deposit/withdraw" drains,
    /// because they usually over-credit one actor against the pool.
    function invariant_ActorBalancesSumToTotal() public view {
        uint256 sum;
        for (uint256 i = 0; i < handler.actorCount(); i++) {
            sum += vault.balanceOf(handler.actorAt(i));
        }
        assertEq(sum, vault.totalDeposits(), "per-actor sum != totalDeposits");
    }

    /// Solvency stated as "everyone can exit": the strongest form of the property.
    function invariant_AllActorsCanFullyExit() public {
        uint256 snap = vm.snapshot();
        for (uint256 i = 0; i < handler.actorCount(); i++) {
            address a = handler.actorAt(i);
            uint256 bal = vault.balanceOf(a);
            if (bal == 0) continue;
            vm.prank(a);
            vault.withdraw(bal); // must not revert
        }
        vm.revertTo(snap);
    }

    /// Read this in CI. If the counters are zero, the suite is vacuous again.
    function invariant_CallSummary() public view {
        handler.callSummary();
    }
}
```

### `foundry.toml`

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true     # <- the line that would have caught this on day one
call_override = false
dictionary_weight = 80
shrink_run_limit = 5000   # get a minimal reproducer when it does fire
```

`depth = 50` is fine now — with a handler, 50 *effective* calls across 4 recurring
actors is deep enough to build up the layered state a drain needs. Under open
targeting, 50 calls meant 50 reverts. The depth was never the problem.

---

## 5. Verify the fix actually fixes it

Do not trust the new suite either until it has failed on purpose.

```bash
# 1. Confirm the fuzzer is now doing work: counters must be non-zero,
#    reverts must be ~0.
forge test --match-test invariant_CallSummary -vvv

# 2. Confirm it can fail. Add the canary; it must now go RED.
#    (assertEq(vault.totalDeposits(), 0) should fail immediately.)

# 3. Mutation-test it: break withdraw() deliberately (send 2x, or skip the
#    totalDeposits decrement) and confirm the suite goes red with a shrunk
#    counterexample sequence.
forge test --match-contract VaultInvariantTest -vvv

# 4. Then run it against real MyVault. This is where your drain shows up.
```

Expect the shrunk counterexample to look roughly like:
`deposit(actor0, X)` → `deposit(actor1, Y)` → `withdraw(actor1, Z)` →
`withdraw(actor0, X)` — the two-actor interleaving that open targeting could never
construct.

---

## The generalisable lesson

**An invariant test has two halves: the assertion, and the reachable state space.
You wrote the first half.** Reviews, audits and CI all scrutinise the assertion,
because it is the part that looks like a test. Nobody scrutinises the state space,
because it is implied by `targetContract` and invisible in the output.

So make it visible, every time:

- `fail_on_revert = true` by default; use a handler to earn it.
- Read `calls:` vs `reverts:` on every invariant run — a high revert ratio is a
  red build wearing a green badge.
- Keep a `callSummary()` and actually look at it.
- Never trust an invariant you have not watched fail — canary it or mutate the
  contract.
- Fund and approve your actors in the handler constructor, keep the actor set
  small and fixed so sequences can interleave, and `bound()` every input rather
  than `vm.assume()`-ing it away.
