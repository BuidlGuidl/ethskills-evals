# Why 25,600 calls never found the drain

Short version: the assertion was fine, the fuzzer never reached a state where it
could be false. Almost every one of those 25,600 calls reverted, was silently
discarded, and the invariant was re-checked against a vault holding zero tokens
with `totalDeposits == 0`. `0 >= 0` is true. The suite was green for months
because it was asserting a tautology, not because the vault was solvent.

## 1. What the calls were actually doing

`targetContract(address(vault))` puts the vault in the target set with no handler
and no `targetSelector` filter. For each of the 512 sequences, forge builds 50
calls; each call is:

- a random selector from the vault's **entire public ABI** (not just `deposit`
  and `withdraw` — every view, every admin function, every getter),
- random calldata drawn from the fuzz dictionary, so `deposit(uint256)` gets
  amounts like `2**255`, `type(uint256).max`, and a handful of small dictionary
  values,
- from a random `msg.sender` — a fresh, arbitrary 160-bit address.

Now trace what such a call does against a freshly deployed vault:

- `deposit(amount)` calls `token.transferFrom(msg.sender, address(vault), amount)`.
  `MockERC20` was constructed in `setUp()` and minted (at most) to the test
  contract. The random sender has **zero balance and zero allowance**. Every
  deposit reverts inside `transferFrom`, for every amount, including the small
  well-formed ones. The amount was never the binding constraint — funding was.
- `withdraw(amount)` reverts on the sender's zero share balance
  (underflow / `require`).
- The remaining selectors are views and admin functions that revert on
  `onlyOwner` or return without touching state.

So the sequence that actually executed was: revert, revert, revert, ×50, ×512.

The part that makes this invisible is Foundry's default `fail_on_revert = false`.
A reverting call in an invariant sequence is **not** a failure and **not** a
finding — forge drops it and moves to the next call, then evaluates the invariant
against the resulting state. The resulting state was always the initial state.
The vault balance was 0 and `totalDeposits` was 0 on essentially every one of the
~25,600 invariant checks. The property held **vacuously**, and a vacuous pass is
indistinguishable from a real pass in the summary line.

## 2. Why the drain sequence was unreachable even in principle

Two structural reasons, independent of the revert problem:

**No funded actors.** The fuzzer cannot mint itself tokens. Nothing in `setUp()`
gives any address that the fuzzer can act as a token balance or an allowance to
the vault. There is no assignment of random calldata that gets past
`transferFrom`. The reachable state space of this suite is exactly one state.

**No stable actor set.** The drain is a *relational* bug: it needs actor A to
deposit, then a specific interleaving of A and B withdrawing, with the same
addresses recurring across several calls in one sequence. Foundry's default
sender pool is random addresses (seeded partly from the dictionary). Without an
explicit bounded actor set, the probability that the same address reappears at
the right point in a 50-call sequence, holding the right balance, is
negligible. Accounting bugs almost always live in cross-actor, same-actor-twice
sequences; unbounded random senders can't reach them even when calls do land.

`runs = 512, depth = 50` was never the limiting factor. Raising it to 5,000,000
calls would have produced 5,000,000 reverts and the same green line.

## 3. What in the run output would have told you this months ago

**The `reverts:` counter, right there in the pass line.** Forge prints it on
every invariant run:

    [PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25598)

`reverts` at or near `calls` means the fuzzer never got through the front door.
The healthy shape is reverts as a small minority of calls — a handful from
legitimate guard conditions, not 99%. This number was printed on every CI run
for months. It is the single most under-read number in Foundry output.

**Per-selector metrics.** Set `show_metrics = true` under `[invariant]` in
`foundry.toml` and forge prints a table of calls / reverts / discards **per
selector**. It would have shown `deposit` and `withdraw` at 100% reverts, and
would have shown how much of the budget was being burned on getters and
`onlyOwner` functions that should never have been in the target set.

**Coverage.** `forge coverage --mt invariant` would have reported ~0% line
coverage inside the bodies of `deposit` and `withdraw`. An invariant suite that
never executes the functions it is meant to constrain is not testing anything.

**The missing negative control.** The suite had never been observed to fail. A
test that has never gone red has not demonstrated it *can* go red. Deliberately
break the vault (add a `debug_steal()` that moves tokens out, or off-by-one the
accounting), confirm the suite catches it, then revert. This is the cheapest
possible check and it would have exposed the whole problem in five minutes on
day one.

## 4. The change

Stop targeting the vault directly. Target a **handler** that owns the actors,
funds them, bounds the inputs, and only makes calls that are expected to
succeed. Then turn on `fail_on_revert` so any revert is a loud failure rather
than a silent discard.

I've assumed the vault API is `deposit(uint256)` / `withdraw(uint256)` with a
per-user balance getter; adjust the two call sites if it differs.

### Handler

```solidity
// test/handlers/VaultHandler.sol
pragma solidity ^0.8.20;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {MyVault} from "../../src/MyVault.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract VaultHandler is CommonBase, StdCheats, StdUtils {
    MyVault public vault;
    MockERC20 public token;

    address[] public actors;
    address internal currentActor;

    // ghost accounting — the fuzzer's own view of what should be true
    uint256 public ghost_depositSum;
    uint256 public ghost_withdrawSum;

    // call counters, for the summary
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

        // a small, FIXED actor set — this is what makes multi-step,
        // cross-actor sequences reachable
        for (uint256 i = 0; i < 4; i++) {
            address actor = makeAddr(string(abi.encodePacked("actor", i)));
            actors.push(actor);
            token.mint(actor, 1_000_000e18);
            vm.prank(actor);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
        countCall("deposit")
    {
        // bound to what the actor can actually pay — so this never reverts
        amount = bound(amount, 0, token.balanceOf(currentActor));
        if (amount == 0) return;

        vault.deposit(amount);
        ghost_depositSum += amount;
    }

    function withdraw(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
        countCall("withdraw")
    {
        // bound to the actor's actual position — again, never reverts
        amount = bound(amount, 0, vault.balanceOf(currentActor));
        if (amount == 0) return;

        vault.withdraw(amount);
        ghost_withdrawSum += amount;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}
```

Two things to note about the bounding. First, `bound()` — never `vm.assume()` on
a wide range; `assume` throws the whole run away and you burn the budget on
rejections. Second, the `if (amount == 0) return;` guards and the balance-capped
bounds exist so that **legitimate reverts are prevented by construction**. Do
not wrap the vault calls in `try/catch` and swallow failures — that reintroduces
exactly the blindness you just came out of.

### Test

```solidity
contract VaultInvariantTest is Test {
    MyVault vault;
    MockERC20 token;
    VaultHandler handler;

    function setUp() public {
        token = new MockERC20();
        vault = new MyVault(token);
        handler = new VaultHandler(vault, token);

        // fuzz ONLY the handler
        targetContract(address(handler));

        // and only the state-changing entry points on it
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.withdraw.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));

        // keep the fuzzer from calling the vault or token directly
        excludeContract(address(vault));
        excludeContract(address(token));
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    // ghost-variable cross-check: catches accounting drift the balance
    // comparison alone can miss
    function invariant_DepositsMatchGhostAccounting() public view {
        assertEq(vault.totalDeposits(), handler.ghost_depositSum() - handler.ghost_withdrawSum());
    }

    // not an invariant — a permanent readout so a future regression to a
    // vacuous suite is visible in the log
    function invariant_CallSummary() public view {
        console.log("deposits ", handler.calls("deposit"));
        console.log("withdraws", handler.calls("withdraw"));
        console.log("vault bal", token.balanceOf(address(vault)));
    }
}
```

### foundry.toml

```toml
[invariant]
runs = 512
depth = 100          # depth was never the problem, but the drain is a
                     # multi-step sequence — give it room
fail_on_revert = true   # THE important line: no more silent discards
show_metrics = true     # per-selector calls/reverts in the output
shrink_run_limit = 5000 # get a minimal counterexample once it fails
```

`fail_on_revert = true` is the change that keeps this from happening again. With
it on, the original suite would have failed on the first sequence, months ago,
with `transferFrom` in the trace — not because the vault was broken, but because
the test was.

### Negative control

Add this once, run it, watch it fail, then delete or `skip` it:

```solidity
function invariant_CanaryMustFail() public view {
    assertLe(token.balanceOf(address(vault)), 0); // fails once deposits land
}
```

If that stays green, the fuzzer still isn't moving tokens and nothing above is
working yet. Check this before trusting the suite.

## Standing checklist

- `reverts` should be a small fraction of `calls`. Read that number on every run.
- Fuzz a handler, never the target contract directly.
- Fund and approve a small fixed actor set in the handler constructor.
- `bound()` inputs to what can succeed; don't `try/catch` away failures.
- `fail_on_revert = true`.
- Prove the suite can go red before you trust it green.

## Open questions

- Does `MyVault` expose a per-user balance (`balanceOf` / `shares`)? The
  `withdraw` handler needs it to bound correctly.
- Are there other state-changing entry points (`transfer` of shares, fee
  accrual, admin rate changes)? Each one belongs in the handler — the drain may
  need a selector I don't have.
- Is the vault share-based or 1:1 with deposits? If share-based, the ghost
  invariant needs a rounding tolerance rather than `assertEq`.
