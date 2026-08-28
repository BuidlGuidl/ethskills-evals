# Why 25,600 calls found nothing

## Short version

The assertion was fine. The *reachable state space* was empty. Your fuzzer spent
months calling `deposit`/`withdraw` from unfunded, unapproved random addresses;
essentially every call reverted, every revert was rolled back and silently
discarded, and the vault sat at `balance == 0, totalDeposits == 0` for the entire
run. `assertGe(0, 0)` passes. You ran 512 sequences of depth 50 against a
contract that never left `setUp()` state.

---

## 1. What those 25,600 calls were actually doing

`targetContract(address(vault))` means: for each of the 50 steps in a sequence,
pick a random public/external function on `MyVault`, pick a random `msg.sender`
from Foundry's fuzzed sender pool, pick random ABI-encoded args, call it.

Now walk the two functions that matter:

**`deposit(amount)`** — the caller is a random address like
`0x00000000000000000000000000000000000004d2`. That address holds zero
`MockERC20` (the token was minted in `setUp`, presumably to the test contract or
to nobody) and has never called `token.approve(vault, ...)`. So the first thing
`deposit` does — `token.transferFrom(msg.sender, address(this), amount)` —
reverts on allowance, and if you got past that, on balance. The amount is also a
raw `uint256`, so most draws are astronomically large (~ `2^255`) and would
revert regardless.

**`withdraw(amount)`** — same random caller, whose recorded deposit is zero, so
the `require(deposits[msg.sender] >= amount)` (or the underflow) reverts.

Any admin/owner-gated function on the vault reverts on access control for the
same reason: the fuzzer is never the owner.

`MockERC20` is not a target contract, so no sequence can mint or approve either.
There is no path in the whole target surface that funds an actor.

So the actual call ledger is roughly: **~25,600 attempted calls, ~25,600
reverts, ~0 successful state transitions.**

## 2. Why the assertion could never fail

Two compounding reasons.

**(a) Reverted calls do not happen.** When a fuzzed call reverts, Foundry rolls
the state back and moves to the next step in the sequence. And with
`fail_on_revert` at its default of `false`, a revert is not a failure — it is
counted and dropped. So a run where 100% of calls revert is indistinguishable,
in the pass/fail signal, from a run that exercised the protocol perfectly. Both
print `[PASS]`.

Your effective depth was not 50. It was **0**. You ran 512 sequences of nothing.

**(b) The invariant is trivially true at the origin.** The invariant is checked
after every call, so it was evaluated ~25,600 times — every single time against
`token.balanceOf(vault) == 0` and `vault.totalDeposits() == 0`. `0 >= 0` holds.
The suite was, with high confidence, verifying that an empty vault is solvent.

**(c) Even a lucky success wouldn't have been enough.** Suppose one call in ten
thousand had somehow landed. Your drain is a *multi-step, same-actor* bug: it
needs actor A to deposit, then a later call in the same sequence to touch A's
accounting again. Foundry's default sender pool is effectively random addresses,
so the probability of drawing the same funded actor twice in a 50-step sequence
— on top of the near-zero probability of any single call succeeding — is
negligible. Stateful bugs need *correlated* actors across steps. Unhandled
targeting gives you uncorrelated ones.

That is exactly why your hand replay fires and the fuzzer never did. The replay
has a funded, approved account making a coherent sequence of calls. The fuzzer
never had one.

## 3. What in the run output would have told you months ago

**The revert counter on the pass line.** `forge test` prints, per invariant:

```
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25597)
```

`reverts` ≈ `calls` is the whole story, printed on every CI run for months.
A healthy invariant run has reverts as a small fraction of calls. When the two
numbers are within a rounding error of each other, the suite is green because
nothing executed. **Treat `reverts/calls > ~10%` as a failing suite, not a
passing one.**

Two more signals that would have caught it independently:

- **`forge coverage`** — `deposit` and `withdraw` would have shown 0% line
  coverage from the invariant run. Code the fuzzer never executed cannot be code
  the fuzzer verified.
- **A call summary.** With no handler you have nothing to instrument, which is
  itself the tell: you had no way to answer "how many deposits actually
  succeeded?" That number should be visible in every run (see §4).

And the config that turns the silent case into a loud one:

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true   # <- this
```

With `fail_on_revert = true` this suite would have gone red on the first commit.
The reason teams set it to `false` is precisely that it goes red — and then the
suite is green forever and means nothing. Keep it `true` and make the handler
responsible for only ever making valid calls.

## 4. The change

Stop targeting the vault. Target a **handler** that owns a fixed set of funded,
pre-approved actors, bounds every argument into a valid range, and records what
it did.

### `test/handlers/VaultHandler.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MyVault} from "../../src/MyVault.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract VaultHandler is Test {
    MyVault public vault;
    MockERC20 public token;

    address[] public actors;
    address internal currentActor;

    // ghosts: what the sequence actually managed to do
    uint256 public ghost_depositSum;
    uint256 public ghost_withdrawSum;
    mapping(bytes32 => uint256) public calls;

    modifier useActor(uint256 seed) {
        currentActor = actors[bound(seed, 0, actors.length - 1)];
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

        // small actor set => the fuzzer keeps revisiting the same accounts,
        // which is what makes multi-step accounting bugs reachable
        for (uint256 i; i < 4; ++i) {
            address a = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(a);
            token.mint(a, 1e30);
            vm.prank(a);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
        countCall("deposit")
    {
        uint256 max = token.balanceOf(currentActor);
        if (max == 0) { calls["deposit_skipped"]++; return; }
        amount = bound(amount, 1, max);

        vault.deposit(amount);
        ghost_depositSum += amount;
    }

    function withdraw(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
        countCall("withdraw")
    {
        uint256 max = vault.balanceOf(currentActor); // or deposits(currentActor)
        if (max == 0) { calls["withdraw_skipped"]++; return; }
        amount = bound(amount, 1, max);

        vault.withdraw(amount);
        ghost_withdrawSum += amount;
    }

    function callSummary() external view {
        console.log("deposit          ", calls["deposit"]);
        console.log("  skipped        ", calls["deposit_skipped"]);
        console.log("withdraw         ", calls["withdraw"]);
        console.log("  skipped        ", calls["withdraw_skipped"]);
        console.log("ghost_depositSum ", ghost_depositSum);
        console.log("ghost_withdrawSum", ghost_withdrawSum);
    }
}
```

### `test/VaultInvariant.t.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
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

        targetContract(address(handler));

        // only the two entry points a real user has
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.withdraw.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));

        // handler does its own pranking; keep infra out of the sender pool
        excludeSender(address(vault));
        excludeSender(address(token));
        excludeSender(address(handler));
    }

    // unchanged — it was always the right assertion
    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    // guard against silently regressing to a do-nothing suite
    function invariant_SequenceDidSomething() public view {
        assertGt(handler.ghost_depositSum(), 0, "no deposit ever succeeded");
    }

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
fail_on_revert = true
```

### Why this reaches the drain

- Actors are funded and approved in the constructor, so `deposit` succeeds on
  the first call instead of reverting 25,600 times.
- Only 4 actors, so a 50-step sequence hits the same account ~12 times. The
  drain's "deposit as A, then exploit A's accounting" shape is now routinely
  sampled instead of astronomically unlikely.
- `bound()` (not `vm.assume`) reshapes bad args into valid ones rather than
  throwing the sequence away, so depth 50 means 50 real state transitions.
- `fail_on_revert = true` means any unexpected revert is now a test failure, so
  the suite can never quietly go back to doing nothing.
- The call summary and `invariant_SequenceDidSomething` make "the fuzzer did
  real work" a checked property, not an assumption.

Run it with `forge test --mt invariant -vv` and read the summary. Then confirm
the fix: point the new suite at the pre-patch vault and check that it produces a
shrunk counterexample sequence resembling the user's transactions. If it doesn't
reproduce a known-exploitable bug, the harness is still not exercising what you
think it is.

---

## Unresolved

- I guessed `MyVault`'s ABI (`deposit(uint256)`, `withdraw(uint256)`,
  `balanceOf`, `totalDeposits`) and `MockERC20.mint`. Send the sources and I'll
  match the real signatures.
- Is the bug in share accounting (rounding/first-depositor) or in a per-user
  ledger? If shares, the handler should also fuzz donations/`transfer` to the
  vault and the invariant set should gain a share-price monotonicity property.
- Should the handler cover more surface than deposit/withdraw (transfers of
  shares between actors, direct token donations to the vault)? Those are
  common drain enablers and cheap to add.
