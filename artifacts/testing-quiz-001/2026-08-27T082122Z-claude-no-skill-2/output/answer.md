# Why 25,600 calls found nothing

## Short version

The suite never tested the vault. All ~25,600 calls reverted, the reverts were
silently discarded, and `invariant_SolvencyHolds` was evaluated 512 times against
the untouched `setUp()` state: `assertGe(0, 0)`. It was green because the vault
was empty, not because it was solvent.

---

## 1. What those calls were actually doing

`targetContract(address(vault))` puts the vault under *open* fuzzing: for each of
the 512 sequences, Foundry makes 50 calls, each one picking a random external
selector on `MyVault`, random ABI-encoded args, and a **random `msg.sender`**.
Three things then kill every call, in order of how fatal they are:

**a) The fuzz senders own no tokens and have granted no allowance.**
This is the whole story. `setUp()` mints nothing and approves nothing. The
fuzzer's senders are arbitrary addresses with a zero `MockERC20` balance and zero
allowance to the vault. So:

- `deposit(amount)` → `token.transferFrom(msg.sender, address(vault), amount)`
  → reverts on insufficient allowance (or insufficient balance). **Always.**
- `withdraw(amount)` → caller has no shares/credit → reverts on underflow or an
  explicit `require`. **Always.**

There is no ordering of calls that escapes this. Deposit is the only way tokens
enter the vault, and deposit can never succeed, so the vault's token balance is
`0` and `totalDeposits()` is `0` for the entire campaign.

**b) The amounts are astronomically wrong.**
Even if the senders had been funded, `amount` is drawn from the full `uint256`
range. The fuzzer's dictionary biases toward boundary values
(`0`, `1`, `type(uint256).max`, ...), so the overwhelming majority of draws are
larger than any plausible balance and would revert anyway. Foundry's fuzzer only
learns from *reverting* vs. *non-reverting* in the sense of discarding — it has no
gradient telling it "try a smaller number"; you have to `bound()` it yourself.

**c) The sender scatters across the address space.**
Your drain is a *sequence*: the same actor (or a small set of interleaved actors)
deposits, then withdraws, and the accounting bug shows up in the relationship
between those calls. Open fuzzing draws a fresh random sender per call. Foundry
does keep an address dictionary and will occasionally reuse an address it has
seen, but you cannot rely on it to produce "actor A deposits, then A withdraws,
then B withdraws" inside a 50-call window. Multi-actor, path-dependent bugs are
not reachable by accident.

**And the reason none of this was visible:** `[invariant] fail_on_revert` defaults
to **false**. A reverting call is not an error — it is rolled back, counted, and
the sequence moves on to the next call. So the harness cheerfully executed 25,600
no-ops per run and reported success.

## 2. Why the assertion could never have fired

`invariant_SolvencyHolds` is correct and it does catch the drain on replay. But an
assertion can only fail on a state the harness actually constructs. The only state
this harness ever constructed was the `setUp()` state:

```
token.balanceOf(address(vault)) == 0
vault.totalDeposits()           == 0
assertGe(0, 0)                  -> true
```

512 sequences × 50 calls produced exactly one distinct state, and it was the state
the vault was born in. The suite was not asserting solvency; it was asserting that
`0 >= 0`, 512 times, for months.

Worth noting the irony: `targetContract(address(vault))` was added to focus the
fuzzer, and it is what starved it. Foundry's default (no `targetContract` call) is
to fuzz *every contract deployed during `setUp()`* — which would have included
`MockERC20`, giving the fuzzer access to `mint` and `approve`. That would still
almost certainly not have found the bug (it needs mint→approve→deposit→withdraw
from a consistent sender), but it shows how narrow the target selection was.

## 3. What in the run output said this months ago

**The revert counter.** Foundry prints it on every invariant test, pass or fail:

```
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

`reverts == calls` is the tell. That line means *zero* state transitions occurred.
Treat these as hard gates on any invariant suite:

| `reverts / calls` | Reading |
|---|---|
| ~100% | The harness is dead. Nothing is under test. |
| >30–50% | Most of your depth budget is being burned on rejected calls; effective depth is a fraction of the configured 50. |
| <10–20% | Healthy — the fuzzer is spending its calls inside your contract. |

Nobody looked at that number, and the `[PASS]` next to it made it easy not to.

**Two corroborating signals, both cheap:**

1. **`forge coverage`.** The bodies of `deposit` and `withdraw` would show 0% line
   coverage while the "solvency" suite was green. A passing invariant suite over
   uncovered code is a contradiction, and it is the single most direct evidence.

2. **Mutation / negative control.** Break the vault on purpose — make `withdraw`
   transfer `amount * 2`, or hardcode `totalDeposits += amount * 2` — and re-run.
   If the suite still passes, the suite is measuring nothing. Every invariant
   harness should be validated this way once, when it is written. A test that has
   never been observed to fail has never been shown to work.

**Also available:** set `[invariant] show_metrics = true` (recent Foundry) to get a
per-selector calls/reverts/discards breakdown, which localizes *which* function is
being rejected rather than just telling you the total.

## 4. The change that makes the suite able to find it

The fix is not to the assertion. It is to replace open fuzzing of the vault with a
**handler**: a contract that owns a fixed pool of funded actors, exposes only the
user-reachable operations, bounds arguments to values a real user could actually
pass, and tracks ghost state. Then the fuzzer's random bytes get translated into
*valid* vault operations instead of guaranteed reverts.

### `test/handlers/VaultHandler.sol`

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {MyVault} from "../../src/MyVault.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract VaultHandler is CommonBase, StdCheats, StdUtils {
    MyVault   public immutable vault;
    MockERC20 public immutable token;

    address[] public actors;
    address   internal currentActor;

    // ghost state: what the harness believes, independent of the vault
    uint256 public ghost_depositSum;
    uint256 public ghost_withdrawSum;
    mapping(bytes32 => uint256) public calls;

    uint256 constant NUM_ACTORS  = 5;
    uint256 constant ACTOR_FUNDS = 1_000_000e18;

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

        for (uint256 i; i < NUM_ACTORS; ++i) {
            address a = address(uint160(uint256(keccak256(abi.encode("actor", i)))));
            actors.push(a);
            token.mint(a, ACTOR_FUNDS);
            vm.prank(a);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
        countCall("deposit")
    {
        amount = bound(amount, 0, token.balanceOf(currentActor));
        vault.deposit(amount);
        ghost_depositSum += amount;
    }

    function withdraw(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
        countCall("withdraw")
    {
        // bound to what this actor is *entitled* to ask for, NOT to what
        // happens to keep the vault solvent. The vault's own accounting is
        // the thing under test.
        amount = bound(amount, 0, vault.balanceOf(currentActor));
        vault.withdraw(amount);
        ghost_withdrawSum += amount;
    }

    /// Donations / direct transfers in. Real and worth modelling: they are how
    /// share-price rounding bugs are usually triggered.
    function donate(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
        countCall("donate")
    {
        amount = bound(amount, 0, token.balanceOf(currentActor));
        token.transfer(address(vault), amount);
    }

    function callSummary() external view {
        console.log("deposit ", calls["deposit"]);
        console.log("withdraw", calls["withdraw"]);
        console.log("donate  ", calls["donate"]);
    }

    function actorCount() external view returns (uint256) { return actors.length; }
    function actorAt(uint256 i) external view returns (address) { return actors[i]; }
}
```

### `test/VaultInvariant.t.sol`

```solidity
contract VaultInvariantTest is Test {
    MyVault      vault;
    MockERC20    token;
    VaultHandler handler;

    function setUp() public {
        token   = new MockERC20();
        vault   = new MyVault(token);
        handler = new VaultHandler(vault, token);

        // fuzz ONLY the handler, and only its user-facing entrypoints
        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.withdraw.selector;
        selectors[2] = VaultHandler.donate.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    /// Tighter and it localizes the bug: the vault's own total must equal the
    /// sum of what it thinks each actor holds. Fails closer to the root cause
    /// than the solvency check does.
    function invariant_AccountingIsConsistent() public view {
        uint256 sum;
        for (uint256 i; i < handler.actorCount(); ++i) {
            sum += vault.balanceOf(handler.actorAt(i));
        }
        assertEq(sum, vault.totalDeposits());
    }

    /// Everyone can actually get out. Catches drains that only become visible
    /// on the last exit, which a between-calls solvency check can miss.
    function afterInvariant() public {
        for (uint256 i; i < handler.actorCount(); ++i) {
            address a = handler.actorAt(i);
            uint256 bal = vault.balanceOf(a);
            if (bal == 0) continue;
            vm.prank(a);
            vault.withdraw(bal);
        }
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    function invariant_CallSummary() public view {
        handler.callSummary();
    }
}
```

### `foundry.toml`

```toml
[invariant]
runs               = 512
depth              = 100      # sequence length matters more than run count for
                              # path-dependent accounting bugs; 50 is short
fail_on_revert     = true     # THE key change — a rejected call is now a red test
show_metrics       = true
call_override      = false
dictionary_weight  = 80
```

### Why each piece matters

- **Funded, approved actors in the handler constructor** — removes the 100%
  revert wall. Without this nothing else helps.
- **`bound()` on every amount** — turns a `uint256` lottery into values in the
  live range. Bound to what the actor is *permitted* to attempt, never to what
  keeps the invariant true; the latter assumes away the bug you are hunting.
- **Fixed actor pool + `useActor`** — makes "A deposits, B deposits, A withdraws"
  a common sequence instead of an astronomical coincidence. This is what actually
  reaches your drain.
- **`targetSelector`** — stops depth being wasted on view functions and
  admin-gated calls that would revert anyway.
- **`fail_on_revert = true`** — the harness can no longer fail silently. Turned on
  months ago, this suite would have gone red on call #1. Keep it on; when a
  legitimate revert path appears, model it in the handler with a `try/catch` and
  an assertion about *why* it reverted, rather than switching the flag back off.
- **`depth = 100`** — the drain is a sequence. 50 calls across three selectors and
  five actors is a short window.
- **`afterInvariant`** — asserts full-exit solvency, which a between-calls check
  can step over.

### Before trusting it again

1. Add the user's exact drain sequence as a plain unit test. That is the
   regression test, and it should be red right now.
2. Run the new invariant suite against the **unfixed** vault and confirm it goes
   red on its own. If it does not, the handler is still too narrow — widen the
   bounds or add the missing selector until it finds the bug you already know is
   there.
3. Only then fix the vault, and check that `reverts` is a small fraction of
   `calls` and that `forge coverage` shows the deposit/withdraw bodies executing.

The rule this suite violated: **an invariant test's revert count is part of its
result.** `[PASS]` on its own tells you nothing about whether anything ran.
