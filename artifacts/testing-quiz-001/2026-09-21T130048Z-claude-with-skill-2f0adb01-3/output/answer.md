# Why 25,600 calls never found the drain

Short version: the suite never called your vault. All 25,600 calls reverted at the
first line of `deposit`, the vault's state stayed at `(balance = 0, totalDeposits = 0)`
for every one of the 512 sequences, and `assertGe(0, 0)` is true. The suite was green
because it was empty, not because the vault was solvent.

---

## 1. What those calls were actually doing

`targetContract(address(vault))` with no handler tells Foundry: *pick a random
function from `MyVault`'s external ABI, fill its arguments with random bytes, and send
it from a random `msg.sender`.* That is the entire strategy. Three things follow.

**The callers own nothing.** `new MockERC20()` mints its supply to the deployer — the
test contract. The fuzzer's senders are arbitrary 160-bit addresses with a zero token
balance and zero allowance to the vault. So:

```
vault.deposit(amount)  ->  token.transferFrom(msg.sender, vault, amount)
                       ->  revert: insufficient balance / insufficient allowance
```

Every single time. `withdraw(amount)` reverts just as reliably, because the caller's
ledger entry is zero and the vault's `require(balance >= amount)` fires. There is no
ordering of these calls that gets past the first `transferFrom`.

**Reverts are silently swallowed.** `fail_on_revert` defaults to `false`. A reverted
call is not an error and is not retried — it counts toward `depth`, the EVM state is
rolled back, and the fuzzer moves to call 2 of 50. A "sequence of 50 calls" was 50
independent no-ops against identical state.

**Even the theoretical escape hatch was closed.** Before you call `targetContract`,
Foundry targets every contract deployed in `setUp` — including `token`. Your explicit
`targetContract(address(vault))` narrowed the target set to the vault alone, so the
fuzzer could not have called `token.mint`/`token.approve` to bootstrap itself even by
accident.

**And the fuzzer got dumber over time, not smarter.** Foundry seeds its value
dictionary from the storage of the target contracts as the run progresses. Your target
contract's storage never changed, so the dictionary stayed empty of meaningful amounts
and the fuzzer kept guessing near-`uint256.max` garbage — which would have reverted on
an amount check even if the callers had been funded.

So: 512 runs × 50 depth = 25,600 reverts, one `assertGe(0, 0)` per run, 512 passes.
Months of green CI measuring nothing.

Note the second-order consequence, which matters for the fix: because `msg.sender` was
a fresh random address on every call, there was no such thing as "the same user acting
twice." A drain that needs *user A deposits, user B deposits, user A withdraws twice*
is unreachable even after you fund the callers, unless you deliberately reuse a small
set of actors.

---

## 2. What the run output was telling you

**The invariant metrics table.** Run with metrics on (`forge test --mt invariant -vvv`;
in older Foundry set `show_metrics = true` under `[invariant]`). It prints per-selector
counts:

```
| Contract  | Selector | Calls | Reverts | Discards |
| MyVault   | deposit  | 12834 | 12834   | 0        |
| MyVault   | withdraw | 12766 | 12766   | 0        |
```

`reverts == calls` is the whole story in one line. Any ratio above ~10-20% on a
handler-driven suite means your fuzzer is spending its budget on rejected input; 100%
means the suite is inert. This table is the single artifact that would have caught it
on day one.

**Coverage.** `forge coverage --mt invariant` would have shown `MyVault.deposit` and
`MyVault.withdraw` at **0% line coverage** after 25,600 "calls." Coverage is the
falsifiability check for an invariant suite: an invariant can only fail on code the
fuzzer actually executed.

**Wall-clock time.** A real 25,600-call vault run takes meaningful seconds. A run where
every call reverts in the first opcodes of `transferFrom` finishes almost instantly. A
suspiciously fast invariant suite is a suite that isn't doing anything.

**The canary you never ran.** Break the invariant on purpose — add `vault.skim()` that
sends tokens out, or just assert something a single real deposit would falsify — and
re-run. If the suite still passes, the suite cannot see your contract. Do this once
whenever you write a new invariant; a test that has never been observed to fail has
not been shown to work.

---

## 3. The change that makes the suite capable of finding it

Four things, in order of importance: **a handler that funds and pranks a fixed actor
set**, **bounded amounts**, **`fail_on_revert = true`**, and **ghost-variable
invariants** so you're checking accounting, not just a tautology.

### foundry.toml

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true   # reverts are now bugs in the handler, not silent skips
show_metrics = true
```

`fail_on_revert = true` is the guardrail that makes this class of failure impossible to
ship again: the moment the handler stops reaching real code, the suite goes red.

### test/VaultInvariant.t.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MyVault} from "../src/MyVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract VaultHandler is Test {
    MyVault public vault;
    MockERC20 public token;

    address[] public actors;
    address internal currentActor;

    // Ghost variables: an independent model of what the vault owes.
    uint256 public ghost_depositSum;
    uint256 public ghost_withdrawSum;
    mapping(address => uint256) public ghost_actorDeposits;

    modifier useActor(uint256 seed) {
        currentActor = actors[bound(seed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        // A SMALL, FIXED actor set, so the same user acts many times in a
        // sequence. This is what makes multi-step drains reachable.
        for (uint256 i = 0; i < 5; i++) {
            address actor = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(actor);
            token.mint(actor, 1_000_000e18);
            vm.prank(actor);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount) external useActor(actorSeed) {
        amount = bound(amount, 1, token.balanceOf(currentActor));
        if (amount == 0) return;              // guard, never revert
        vault.deposit(amount);
        ghost_depositSum += amount;
        ghost_actorDeposits[currentActor] += amount;
    }

    function withdraw(uint256 actorSeed, uint256 amount) external useActor(actorSeed) {
        uint256 max = vault.balanceOf(currentActor);
        if (max == 0) return;                 // guard, never revert
        amount = bound(amount, 1, max);
        vault.withdraw(amount);
        ghost_withdrawSum += amount;
        ghost_actorDeposits[currentActor] -= amount;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }
}

contract VaultInvariantTest is Test {
    MyVault vault;
    MockERC20 token;
    VaultHandler handler;

    function setUp() public {
        token = new MockERC20();
        vault = new MyVault(token);
        handler = new VaultHandler(vault, token);

        targetContract(address(handler));   // fuzz the handler, never the vault
        excludeContract(address(vault));
        excludeContract(address(token));

        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.withdraw.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    // Your original property — now actually reachable.
    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    // Accounting identity: totalDeposits must equal what flowed in minus out.
    function invariant_TotalDepositsMatchesFlows() public view {
        assertEq(
            vault.totalDeposits(),
            handler.ghost_depositSum() - handler.ghost_withdrawSum()
        );
    }

    // Per-user ledger must sum to the global figure.
    function invariant_UserLedgerSumsToTotal() public view {
        uint256 sum;
        for (uint256 i = 0; i < handler.actorCount(); i++) {
            sum += vault.balanceOf(handler.actorAt(i));
        }
        assertEq(sum, vault.totalDeposits());
    }

    // Prints the call/revert distribution at the end of the run — read it.
    function invariant_callSummary() public view {
        console.log("deposits:  ", handler.ghost_depositSum());
        console.log("withdraws: ", handler.ghost_withdrawSum());
    }
}
```

### Why this finds the drain

`invariant_SolvencyHolds` now runs against a vault that holds real tokens, with five
repeat actors executing 50-call interleavings of deposit and withdraw. A withdraw path
that transfers more than it debits from `totalDeposits` — or debits the per-user ledger
without debiting the global one, or lets a user withdraw against another user's
principal — moves the two sides of that `assertGe` apart within a handful of calls, and
Foundry prints the minimal reproducing sequence at `-vvvv`.

The two ghost invariants are the ones that catch it *early*: they fail on the first
accounting mismatch, before the imbalance is large enough to actually break solvency,
so the counterexample sequence you get back is short and readable rather than a
50-call drain.

### Before you trust it again

1. `forge coverage --mt invariant` — confirm `deposit`/`withdraw` are near 100%.
2. Read the metrics table — reverts should be ~0 now that `fail_on_revert = true`.
3. Run the canary: introduce a deliberate off-by-one in `withdraw`'s accounting and
   confirm the suite goes red. Then revert it.

Step 3 is the one that would have saved you. An invariant test you have never seen
fail is not a test.
