# Why 25,600 calls found nothing

## Short version

The assertion is fine. The **state space it was evaluated over was a single point**.

Nearly every one of those 25,600 calls reverted. `fail_on_revert` defaults to
`false` for invariant runs, so a reverting call is silently rolled back and the
fuzzer moves on. After 512 sequences the vault was still in exactly the state
`setUp()` left it in: `token.balanceOf(vault) == 0`, `vault.totalDeposits() == 0`.
The suite asserted `0 >= 0` five hundred and twelve times and reported PASS.

Depth 50 doesn't help when the effective depth is 0.

---

## What the calls were actually doing

`targetContract(address(vault))` tells Foundry: build sequences by picking a
random function from `MyVault`'s ABI, filling its arguments from the fuzz
dictionary, and calling it from a **random sender address**. Three things follow
from that, and each one alone is enough to make the run vacuous.

### 1. The target set contains no path to a non-zero state

The senders are freshly generated addresses. They hold zero `MockERC20` — the
mock's supply went to its deployer, the test contract — and they have granted the
vault no allowance.

- `deposit(n)` → `token.transferFrom(msg.sender, vault, n)` → reverts on balance
  or allowance, every time, for every sender, for every `n`.
- `withdraw(n)` → the caller's recorded deposit is 0 → reverts (or returns
  without moving anything).

And because `targetContract` **restricts** the target set to the vault alone,
the fuzzer cannot call `token.mint` or `token.approve` either. There is no
sequence of calls over the reachable ABI that puts a single wei of token into
the vault. Not "unlikely" — unreachable.

### 2. Even with funding, the argument values are wrong

The fuzzer draws `uint256` arguments largely from the extremes and from the
state dictionary: `type(uint256).max`, `2**128`, `0`, values scraped from
storage. Unbounded amounts against a realistically-funded actor revert on
balance. `deposit(0)` succeeds and changes nothing. The narrow band of amounts
that both succeed *and* move meaningful value is a rounding error of the input
space. This is what `bound()` exists for, and there was nowhere to put it.

### 3. Even with funding and bounds, the actors don't correlate

Your drain is a *sequence*: the same address (or a small set of addresses)
deposits, then withdraws, with the accounting bug accumulating across those
steps. Foundry picks `msg.sender` per call from a broad random pool. Without
`targetSender`, the probability that any actor is selected twice inside a
50-call window is negligible, so the fuzzer essentially only ever generates
sequences of 50 *distinct one-shot strangers*. It cannot construct
"A deposits, A withdraws, A deposits again, B withdraws" — the exact shape a
deposit/withdraw accounting drain requires.

A handler with a bounded actor set is not a style preference. It is the
mechanism that makes stateful sequences stateful.

### 4. Depth is being spent on view functions

`totalDeposits()`, `balanceOf()`, and every other getter in the ABI are valid
fuzz targets. A meaningful share of the 50 slots per sequence went to calls that
cannot change state by construction. `targetSelector` fixes this; nothing here
did.

---

## What in the output would have told you months ago

### The revert counter, printed on every run

Foundry prints it right there in the pass line:

```
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25591)
```

`reverts ≈ calls` is the entire diagnosis, visible on the first green commit.
The rule of thumb: on a healthy handler-based suite the revert rate should be
low — single-digit percent, ideally zero. Anything above ~20% means your
handler is generating invalid calls and you are not exploring what you think
you are. Above 90% means the suite is decorative.

Enable the per-selector breakdown (`show_metrics = true` under `[invariant]`,
on by default in recent Foundry) and you get it split by function — which is how
you see *which* entry point is closed, not just that something is.

### `fail_on_revert = true`

This is the setting that would have caught it on day one. Put it in
`[invariant]` while developing. The first `deposit()` that reverts fails the run
and prints the offending sequence, and you are forced to fix the setup instead
of banking a green check. Once the handler guards every call properly, leave it
on permanently — it then also catches *newly* introduced unreachability when
someone adds a `require` to the vault.

### A call-summary invariant

The standard trick: ghost counters in the handler, dumped by a no-op invariant.

```solidity
function invariant_callSummary() public view {
    console.log("deposits  ", handler.calls("deposit"));
    console.log("withdraws ", handler.calls("withdraw"));
    console.log("skipped   ", handler.calls("skipped"));
    console.log("depositSum", handler.ghost_depositSum());
}
```

Run with `-vv`. `deposits: 0` on a solvency suite is a five-second read.

### A coverage meta-invariant

The strongest version — make vacuity itself a test failure:

```solidity
// Fails if the fuzzer never reached a state where solvency was non-trivial.
function invariant_RunWasNotVacuous() public view {
    assertGt(handler.ghost_depositSum(), 0, "fuzzer never funded the vault");
    assertGt(handler.ghost_withdrawCount(), 0, "fuzzer never withdrew");
}
```

Any invariant that is trivially true in the initial state — and `0 >= 0` is —
needs a companion assertion proving the run left the initial state. Without one,
"green" and "never ran" are indistinguishable.

---

## The change

Add a handler. Everything else follows from it.

```solidity
// test/VaultHandler.sol
contract VaultHandler is Test {
    MyVault  public vault;
    MockERC20 public token;

    address[] public actors;
    address   internal currentActor;

    // ghosts — the run's audit trail
    uint256 public ghost_depositSum;
    uint256 public ghost_withdrawSum;
    mapping(bytes32 => uint256) public calls;

    modifier useActor(uint256 seed) {
        currentActor = actors[bound(seed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    modifier count(bytes32 name) {
        calls[name]++;
        _;
    }

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        // Small, fixed actor set: this is what makes sequences correlate.
        for (uint256 i = 0; i < 4; i++) {
            address a = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(a);
            token.mint(a, 1_000_000e18);
            vm.prank(a);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
        count("deposit")
    {
        amount = bound(amount, 1, token.balanceOf(currentActor));
        vault.deposit(amount);
        ghost_depositSum += amount;
    }

    function withdraw(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
        count("withdraw")
    {
        uint256 max = vault.depositOf(currentActor);   // adjust to your API
        if (max == 0) { calls["skipped"]++; return; }
        amount = bound(amount, 1, max);
        vault.withdraw(amount);
        ghost_withdrawSum += amount;
    }
}
```

```solidity
// test/VaultInvariant.t.sol
contract VaultInvariantTest is Test {
    MyVault      vault;
    MockERC20    token;
    VaultHandler handler;

    function setUp() public {
        token   = new MockERC20();
        vault   = new MyVault(token);
        handler = new VaultHandler(vault, token);

        // Target ONLY the handler, and only its state-changing entry points.
        bytes4[] memory sels = new bytes4[](2);
        sels[0] = VaultHandler.deposit.selector;
        sels[1] = VaultHandler.withdraw.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: sels}));
        targetContract(address(handler));

        excludeContract(address(vault));
        excludeContract(address(token));
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    // Localizes the bug instead of just detecting it: if per-user accounting
    // and the aggregate disagree, this fires before solvency does.
    function invariant_TotalDepositsEqualsSumOfUsers() public view {
        uint256 sum;
        for (uint256 i = 0; i < 4; i++) sum += vault.depositOf(handler.actors(i));
        assertEq(sum, vault.totalDeposits());
    }

    function invariant_RunWasNotVacuous() public view {
        assertGt(handler.ghost_depositSum(), 0, "fuzzer never funded the vault");
        assertGt(handler.calls("withdraw"),  0, "fuzzer never withdrew");
    }

    function invariant_callSummary() public view {
        console.log("deposit ", handler.calls("deposit"));
        console.log("withdraw", handler.calls("withdraw"));
        console.log("skipped ", handler.calls("skipped"));
    }
}
```

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true    # the setting that would have caught this on day one
show_metrics = true
```

Keep `runs`/`depth` where they are — they were never the problem. With the
handler in place those same 25,600 calls become 25,600 *successful* deposits and
withdraws spread across 4 recurring actors, which is the population your drain
sequence was drawn from.

---

## The generalizable lesson

A green invariant test asserts two things at once: *the property holds* and
*the fuzzer explored*. Foundry reports the first and stays quiet about the
second. Every invariant suite needs an explicit answer to "did this run leave
the initial state?" — a revert rate you actually look at, `fail_on_revert = true`,
ghost counters, and a meta-invariant that fails on a vacuous run.

Without that, "passed 512 sequences" and "did nothing 512 times" print the
same word.
