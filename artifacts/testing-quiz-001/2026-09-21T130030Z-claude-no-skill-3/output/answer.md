# Why 25,600 calls found nothing

## Short version

The assertion was never the problem, and neither was `runs`/`depth`. The suite was
green because **essentially every one of those 25,600 calls reverted.** A reverting
call is not a state transition. The fuzzer spent months re-asserting
`0 >= 0` against a vault that never held a single token.

`assertGe(token.balanceOf(vault), vault.totalDeposits())` is trivially true on an
empty vault. It is a *vacuous* pass: the invariant held not because the code
preserves it but because the fuzzer never reached any state where it could fail.

---

## What the 25,600 calls were actually doing

`targetContract(address(vault))` tells the invariant engine: pick a random function
on `MyVault`, pick random arguments, pick a sender from the fuzzer's address pool,
call it. That is all the configuration there is. Consider what that produces for a
vault whose core function is roughly:

```solidity
function deposit(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    shares[msg.sender] += amount;
    totalDeposits += amount;
}
```

1. **`msg.sender` is a random pseudo-address.** The invariant fuzzer does not call
   from the test contract. It calls from addresses it invents (and from
   `targetSender`s, if you registered any — you didn't). Those addresses have
   **zero `MockERC20` balance**, because nothing ever minted to them. `setUp` minted
   to nobody, or at most to the test contract, which is not in the sender pool.
2. **Nothing ever approved the vault.** Even if a sender somehow had tokens,
   `transferFrom` needs `allowance[sender][vault]`, and the only contract the fuzzer
   is allowed to touch is the vault. `token` is not a target contract, so
   `approve` and `mint` were never callable. There is no reachable path in this
   suite that sets an allowance.
3. So **every `deposit` reverted** in `transferFrom` — insufficient balance or
   insufficient allowance, depending on your mock.
4. **Every `withdraw` reverted** too, for the mirror reason: the random sender has
   `shares == 0`, and a random `uint256` amount underflows or trips your
   `require(shares[msg.sender] >= amount)`.
5. Random `uint256` arguments make this worse even where a path exists. An
   unbounded `amount` is ~2^256, so even a funded actor would revert on nearly
   every draw. Realistic amounts are a vanishing fraction of the input space.

Foundry's default is `fail_on_revert = false`. That default exists for a good
reason — in a well-built handler suite a few reverts are expected and you don't
want them to abort the run — but it means **a suite where 100% of calls revert is
reported as a pass.** The 512 sequences of depth 50 were 512 sequences of 50
no-ops, each followed by an assertion on a pristine vault.

The drain is a *cross-user accounting* bug: it needs actor A to deposit, actor B to
deposit, and then some deposit/withdraw ordering that lets one of them remove more
than they put in. That sequence requires at minimum two funded, approved, distinct
actors who persist across calls and who transact in amounts that are small relative
to their balances. The suite as written could not produce a single funded actor,
let alone two interacting ones. No value of `runs` or `depth` fixes that; the
sequence has probability zero, not low probability.

---

## What in the run output would have told you months ago

**1. The revert counter on the PASS line.** Invariant tests print it:

```
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

`reverts == calls` (or anything close to it) means the fuzzer never executed your
contract. That single number was visible on every CI run since the suite was
written. A healthy handler-based suite shows reverts as a small minority of calls.

**2. The per-function metrics table.** Add to `foundry.toml`:

```toml
[invariant]
show_metrics = true
```

This prints calls / reverts / discards **per target function**. It would have shown
`deposit: 12,800 calls, 12,800 reverts`, which names the dead path precisely rather
than leaving you to infer it from a single aggregate.

**3. Coverage over the invariant run.** `forge coverage` including the invariant
tests would have shown the body of `deposit` and `withdraw` as uncovered lines
despite a "passing" test that supposedly calls them 25,600 times.

**4. The absence of a canary.** Nothing in the suite asserted that the fuzzer had
ever done anything. That is the check that turns all of the above from "something
you might notice" into "something CI enforces." See the fix below.

**5. `fail_on_revert = true` on day one.** With that setting the very first run
would have failed loudly with the `transferFrom` revert, before the suite was ever
committed. The usual mistake is to hit that failure, conclude "reverts are noisy,"
flip the flag to `false`, and ship a suite that can never fail.

---

## The change that makes the suite capable of finding the sequence

Stop pointing the fuzzer at the vault. Point it at a **handler** that owns a set of
funded actors, bounds the inputs, and makes every call a call that *should* succeed.
This is the standard handler-based invariant pattern and it is the actual fix — not
raising `runs`.

### `test/handlers/VaultHandler.sol`

```solidity
contract VaultHandler is Test {
    MyVault  public vault;
    MockERC20 public token;

    address[] public actors;
    address   internal currentActor;

    // ghost variables: an independent model of what the vault owes
    uint256 public ghost_depositSum;
    uint256 public ghost_withdrawSum;
    uint256 public ghost_depositCalls;
    uint256 public ghost_withdrawCalls;

    modifier useActor(uint256 actorSeed) {
        currentActor = actors[bound(actorSeed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        // Several persistent, funded, approved actors. Cross-user bugs need >= 2.
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
        vault.deposit(amount);
        ghost_depositSum += amount;
        ghost_depositCalls++;
    }

    function withdraw(uint256 actorSeed, uint256 amount) external useActor(actorSeed) {
        uint256 max = vault.balanceOf(currentActor); // or shares(currentActor)
        if (max == 0) return;                        // discard, do not revert
        amount = bound(amount, 1, max);
        vault.withdraw(amount);
        ghost_withdrawSum += amount;
        ghost_withdrawCalls++;
    }

    function actorCount() external view returns (uint256) { return actors.length; }
}
```

Two details that matter:

- **`bound`, not `vm.assume`.** `bound` maps every random draw into the legal range,
  so every call does work. `vm.assume` throws the draw away, and with a range this
  narrow you would discard almost everything and be back where you started.
- **Early `return` instead of `require`** for "this actor has nothing to withdraw."
  That keeps the call a successful no-op so you can still run with
  `fail_on_revert = true`.

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

        targetContract(address(handler));

        // Only the two real entry points; keep helpers/getters out of the fuzz.
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.withdraw.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));

        // The fuzzer must never be able to act as the vault or the test contract.
        excludeSender(address(vault));
        excludeSender(address(token));
        excludeSender(address(this));
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    /// Ghost-variable solvency: the vault must hold at least what it was
    /// net-given. Catches accounting drift that `totalDeposits` itself may share.
    function invariant_BalanceCoversNetDeposits() public view {
        assertGe(
            token.balanceOf(address(vault)),
            handler.ghost_depositSum() - handler.ghost_withdrawSum()
        );
    }

    /// CANARY. Not a property of the vault — a property of the test suite.
    /// Fails the moment the fuzzer stops reaching the code, which is exactly
    /// the failure mode that hid this bug for months.
    function invariant_FuzzerIsActuallyDoingWork() public view {
        assertGt(handler.ghost_depositCalls(),  0, "no deposit ever succeeded");
        assertGt(handler.ghost_withdrawCalls(), 0, "no withdraw ever succeeded");
    }
}
```

### `foundry.toml`

```toml
[invariant]
runs           = 512
depth          = 50
fail_on_revert = true   # the single most important line
show_metrics   = true
```

`fail_on_revert = true` is safe now precisely because the handler bounds every
input, and it converts "the fuzzer silently stopped reaching the contract" from an
invisible regression into a red build. If a future change to `MyVault` adds a
require that the handler doesn't respect, the suite tells you instead of quietly
going vacuous again.

---

## Why this version finds the drain

With the handler in place, a depth-50 sequence is 50 *successful* deposits and
withdraws, interleaved across five persistent actors holding realistic balances.
That is the exact shape of the user's transaction sequence. The state space the
fuzzer explores now contains the bad state, so 512 × 50 is ample to hit it — the
original suite's problem was reachability, not sample count.

The generalizable rule: **an invariant suite proves nothing until you have
confirmed it can fail.** Before trusting a new invariant, introduce the bug
deliberately — comment out a `require`, or add a `totalDeposits -= amount * 2` —
and verify the suite goes red. If it stays green against a knowingly broken
contract, it was never testing anything. Then check `reverts` against `calls`
on every run, and keep a canary invariant so CI checks it for you.
