# Why 25,600 calls found nothing

## Short version

The suite never tested the vault. Every one of those ~25,600 calls reverted, and
because `fail_on_revert` defaults to `false` for invariant runs, each revert was
counted, discarded, and the state rolled back. After all 512 sequences the vault was
in exactly the state `setUp()` left it in: token balance `0`, `totalDeposits()` `0`.

The assertion you ran 512 times was:

    assertGe(0, 0)

That is true, and it will stay true forever. The suite was green for months because
green is what a suite that never leaves its initial state always reports. It was not
failing to find the bug — it was not looking.

## What the calls were actually doing

`targetContract(address(vault))` tells the fuzzer to call the vault's external
functions directly, with random calldata, from senders it picks itself. Nothing in
`setUp()` prepares the world for those calls to succeed:

1. **Nobody holds tokens.** `new MockERC20()` — you never mint, `deal`, or transfer
   to anyone. Every fuzz sender has a zero token balance.
2. **Nobody approved the vault.** Even if a sender somehow held tokens, `deposit`'s
   internal `transferFrom` fails on allowance.
3. **So every `deposit(amount)` reverts** on balance or allowance, for every sender,
   for every amount. (`deposit(0)`, if your vault permits it, "succeeds" as a no-op
   that moves no value and cannot break solvency.)
4. **Every `withdraw(amount)` reverts** too — the caller's recorded deposit is `0`,
   and the vault holds nothing to send.
5. **The senders are near-disjoint anyway.** With no `targetSender` and no actor pool,
   the fuzzer draws from a large address space. Your drain needs one actor to deposit
   and withdraw repeatedly against balances another actor put in. Random one-shot
   addresses do not produce that shape even after you fix the funding.
6. **The amounts are unbounded `uint256`.** The fuzzer's dictionary biases toward
   small values and values it observes in storage, but with an all-zero state there is
   nothing in storage to observe. Almost every draw is an astronomical number that
   would fail a balance check even in a funded vault.

Points 1–4 are fatal on their own. Points 5–6 are why fixing only the funding would
still leave the suite weak.

Note what this means about `runs = 512, depth = 50`. Depth is the number of calls
*attempted* per sequence, not applied. All 50 calls in a sequence reverting leaves you
with a sequence of length zero. You had 512 sequences of length zero. Raising `runs`
or `depth` multiplies zero.

## What in the run output said so

**The `reverts` counter on the pass line.** Forge has been printing it all along:

    [PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)

`reverts == calls` — or anything close to it — means the sequences are empty. A
healthy invariant run has reverts as a small minority of calls; a handler with tight
bounds gets it near zero. This one line was the whole diagnosis, on every CI run, for
months. Treat the revert rate as a first-class CI signal, not decoration.

**The per-selector metrics table.** Set `show_metrics = true` under `[invariant]`
(default in recent Foundry) and you get the breakdown:

    ├─ deposit:  calls: 12801, reverts: 12801, discards: 0
    ├─ withdraw: calls: 12799, reverts: 12799, discards: 0

Zero successful calls to either function under test.

**Coverage.** `forge coverage --mt invariant_SolvencyHolds` reports ~0% on the bodies
of `deposit` and `withdraw` past their first `require`. An invariant suite that does
not execute the functions it is guarding is not a suite.

**The check that would have settled it in thirty seconds.** Temporarily add:

    function invariant_ProveTheFuzzerReachesState() public view {
        assertEq(vault.totalDeposits(), 0, "delete me — if this PASSES the suite is dead");
    }

If asserting that *nothing ever happened* passes across 512 sequences, nothing ever
happened. More generally: an invariant suite you cannot deliberately make fail is not
telling you anything. Before trusting a new invariant, break the contract on purpose
(add a `steal()`, skip a decrement) and confirm the suite goes red. If it stays green,
you have a harness bug, not a safe contract.

---

# The change

Two parts: make reverts loud in config, and put a handler between the fuzzer and the
vault so the calls actually land.

## 1. `foundry.toml`

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true   # this alone would have failed on day one
show_metrics = true
```

`fail_on_revert = true` is the important line. With it, the very first reverting
`deposit` aborts the run and hands you a counterexample sequence. It converts "silently
tests nothing" into "loudly broken," which is what you wanted. Keep it on permanently:
with a correctly bounded handler, a revert means either the handler drifted out of sync
with the contract or you found real behavior — both are worth stopping for. If some
call genuinely may revert for legitimate reasons, guard it inside the handler with an
early `return` rather than turning the flag back off.

## 2. Handler

The handler owns three things the raw target could not: a **bounded actor set** so
sequences involve the same few addresses repeatedly, **funding and approvals** so calls
succeed, and **bounds derived from live state** so amounts are plausible. Ghost
variables give you a second, independent accounting of what should be true.

```solidity
// test/VaultHandler.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MyVault} from "../src/MyVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract VaultHandler is Test {
    MyVault public vault;
    MockERC20 public token;

    address[] public actors;
    address internal currentActor;

    // Ghost accounting — an independent model of the vault
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

        // Small actor set: sequences reuse the same addresses, which is what
        // "user A deposits, user B withdraws against A's funds" requires.
        for (uint256 i = 0; i < 4; i++) {
            address actor = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(actor);
            token.mint(actor, 1_000_000e18);
            vm.prank(actor);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount)
        public
        useActor(actorSeed)
        countCall("deposit")
    {
        amount = bound(amount, 1, token.balanceOf(currentActor));
        vault.deposit(amount);
        ghost_depositSum += amount;
    }

    function withdraw(uint256 actorSeed, uint256 amount)
        public
        useActor(actorSeed)
        countCall("withdraw")
    {
        uint256 max = vault.balanceOf(currentActor); // adjust to your accessor
        if (max == 0) {
            calls["withdraw_skipped"]++;
            return; // early return, not a revert — keeps fail_on_revert usable
        }
        amount = bound(amount, 1, max);
        vault.withdraw(amount);
        ghost_withdrawSum += amount;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }
}
```

## 3. Test

```solidity
// test/VaultInvariant.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MyVault} from "../src/MyVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {VaultHandler} from "./VaultHandler.sol";

contract VaultInvariantTest is Test {
    MyVault vault;
    MockERC20 token;
    VaultHandler handler;

    function setUp() public {
        token = new MockERC20();
        vault = new MyVault(token);
        handler = new VaultHandler(vault, token);

        targetContract(address(handler));
        excludeContract(address(vault));  // fuzzer must go through the handler
        excludeContract(address(token));

        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.withdraw.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    // Your original property — unchanged, it was always the right one.
    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    // Ghost check: the vault's own accounting must match an independent tally.
    // This localizes the bug — solvency tells you money is missing, this tells
    // you which side of the ledger drifted.
    function invariant_AccountingMatchesGhosts() public view {
        assertEq(
            vault.totalDeposits(),
            handler.ghost_depositSum() - handler.ghost_withdrawSum(),
            "vault accounting diverged from ghost ledger"
        );
    }

    // Exit solvency: a vault can look solvent at rest and still be undrainable.
    // After every sequence, let everyone exit and check nothing is stuck or over-paid.
    function afterInvariant() public {
        uint256 n = handler.actorCount();
        for (uint256 i = 0; i < n; i++) {
            address actor = handler.actorAt(i);
            uint256 bal = vault.balanceOf(actor);
            if (bal == 0) continue;
            vm.prank(actor);
            vault.withdraw(bal);
        }
        assertEq(vault.totalDeposits(), 0, "deposits outstanding after full exit");
        assertGe(token.balanceOf(address(vault)), 0);
    }

    // Run with -vv. If deposit/withdraw counts are lopsided or tiny, the handler
    // is not exploring — fix it before trusting a green run.
    function invariant_CallSummary() public view {
        console.log("deposit         ", handler.calls("deposit"));
        console.log("withdraw        ", handler.calls("withdraw"));
        console.log("withdraw_skipped", handler.calls("withdraw_skipped"));
    }
}
```

## How to confirm the fix actually works

Do not accept a green run as proof. In order:

1. Run `forge test --mt invariant -vv`. Confirm `reverts: 0` and that the call summary
   shows thousands of real deposits and withdrawals with `withdraw_skipped` a small
   minority. That is the evidence the sequences are non-empty.
2. Run against the vulnerable vault. It should reproduce your drain and print the
   shrunken counterexample sequence.
3. Only after step 2 fails as expected, fix the vault and confirm green.

Step 2 is the one you skipped for months. An invariant suite has two failure modes —
the contract is broken, or the suite is — and only a deliberate red run distinguishes
them.

## Unresolved

- I do not have `MyVault.sol` here, so `balanceOf(address)`, `deposit(uint256)`, and
  `withdraw(uint256)` are guesses at your surface. Adjust the handler's accessors.
- `MockERC20` is assumed to expose `mint`. If not, swap to `deal(address(token), actor, amt)`.
- If the drain depends on the vault being non-empty from other users at the start,
  consider seeding a deposit in `setUp()` as well as relying on the fuzzer to build it.
