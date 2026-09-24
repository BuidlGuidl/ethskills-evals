# Why `deposit` reverts on mainnet but never against the mock

## TL;DR

`usdt.approve(...)` is a **raw interface call**, not a SafeERC20 call. Real USDT's
`approve` returns **no data at all**, but the `IERC20` interface declares it as
`returns (bool)`. The compiler emits a mandatory returndata decode after the call,
that decode fails on empty returndata, and the contract reverts with **no reason
string**. The mock is a stock OpenZeppelin ERC20, which *does* return `true`, so the
decode always succeeds and the bug is structurally unreachable in the suite.

---

## 1. What actually happens on-chain

USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) predates EIP-20 being finalized.
Its `approve` is declared as:

```solidity
function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32);
```

No return value. The deployed bytecode ends that function with `STOP` / `RETURN` of
zero bytes. Same for `transfer` and `transferFrom`.

Your contract declares `usdt` as OpenZeppelin's `IERC20`, whose ABI says:

```solidity
function approve(address spender, uint256 amount) external returns (bool);
```

When solc compiles `usdt.approve(address(aavePool), amount)` against that interface,
it emits roughly:

```
CALL ...
// success check
RETURNDATASIZE, PUSH 0x20, LT  ->  if returndatasize < 32, revert(0, 0)
RETURNDATACOPY / decode bool
```

The ABI decoder inserts a hard check that the callee returned at least 32 bytes.
USDT returns 0 bytes. The decoder executes `revert(0, 0)` — a revert with an **empty
returndata buffer**, which is exactly the "revert with no reason string" you are
seeing. It is not USDT rejecting the approval; USDT's `approve` *succeeded* and its
state change was rolled back along with the rest of the frame. The revert is thrown
by your own contract's decoder.

That empty revert is itself the diagnostic fingerprint. Aave V3's `supply` never
reverts silently — it reverts with the numeric `Errors` strings (`"26"`,
`"27"`, ...) or a custom error. `SafeERC20` reverts with
`SafeERC20FailedOperation(address)` or a bubbled-up reason. An *empty* revert from a
line that touches a non-standard token is almost always ABI decode failure.

### Line-by-line

| Line | Path taken | Real USDT |
|---|---|---|
| `usdt.safeTransferFrom(...)` | `SafeERC20._callOptionalReturn` → low-level `call`, accepts empty returndata | ✅ works |
| `usdt.approve(...)` | direct `IERC20` call → **mandatory** `bool` decode | ❌ reverts, empty reason |
| `aavePool.supply(...)` | never reached | — |

This matches your observation precisely: "the first line uses the token and succeeds;
the failure is further down."

### The second, latent USDT bug on the same line

Even after you fix the decode, USDT has a second non-standard behavior:

```solidity
require(!((_value != 0) && (allowances[msg.sender][_spender] != 0)));
```

A non-zero → non-zero allowance change **reverts**. Today `supply` pulls the full
`amount`, so the allowance returns to zero and you'd survive; but the moment a pool
pulls less than approved (or a supply partially fails, or you switch to a router that
does), the *next* deposit reverts forever and the vault is bricked. Fix both at once
with `forceApprove`, which zeroes the allowance first when a plain approve fails.

---

## 2. Why `using SafeERC20 for IERC20` did not protect this line

This is the part that fools reviewers, because the file *looks* correctly guarded.

`using A for B` attaches library functions to a type, but **it never overrides members
that already exist on that type**. Solidity resolves `x.f(...)` by looking at the
type's own members *first*; `using`-attached functions are only consulted if no member
matches.

- `approve` **is** a member of `IERC20`. So `usdt.approve(...)` binds to the interface
  function. SafeERC20 is not involved at all.
- `safeTransferFrom` is **not** a member of `IERC20`. So it falls through to the
  attached library, and you get the protected path.

So the directive is doing its job — it just was never asked to do anything on line 2.
There is no compiler warning, no lint by default, and the line reads as "safe" because
`SafeERC20` is imported three lines above. The protection is **opt-in per call site**,
not per file. Any direct `.transfer(...)`, `.transferFrom(...)`, or `.approve(...)` on
an `IERC20` is unguarded regardless of the `using` directive.

(Historical note: OZ removed `safeApprove` in 5.x and replaced it with `forceApprove`
for exactly the USDT allowance-race reason above. If you're on 4.x, `safeApprove` fixes
the decode but still reverts on non-zero→non-zero; `forceApprove` was backported in
4.9.)

---

## 3. Why no amount of mock-based testing could have found this

This is the important part, and it is not "we needed more tests."

**A mock encodes your assumptions about the dependency. A test against a mock can only
ever explore behaviors the mock implements.** The bug is a divergence between your
mental model of ERC-20 and the bytecode actually at
`0xdAC17F9...`. That divergence lives *in the mock itself*, not in any code path
through it — so it is outside the search space of every test in the suite, including
fuzz tests and invariant tests.

Concretely:

- `MockERC20` is stock OZ `ERC20`. Its `approve` **always** `return true;`. The
  returndata is always 32 bytes. The decoder your contract emits therefore **cannot**
  fail, on any input, for any caller, at any state.
- Fuzzing `amount` over the full `uint256` range doesn't help: the decode failure is
  independent of the arguments. Every one of 10,000,000 runs decodes a `true`.
- Invariant testing doesn't help: no call sequence makes an OZ ERC20 return empty
  returndata.
- Adding a 40th, 400th, or 4,000th test doesn't help. They all route through the same
  fiction.
- The 6-decimals detail is a red herring that made the mock *feel* faithful. Decimals
  were the one USDT quirk you modeled; the ABI-shape quirk — the one that actually
  matters here — was not modeled, and matching decimals gave false confidence that the
  mock was "USDT-like."

"39 tests, green since the first commit" is consistent with this: a suite that has
never gone red has never been shown to be capable of detecting anything. The green is
evidence about the mock, not about USDT.

The general rule: **mocks test your logic; only real bytecode tests your integration.**
Coverage metrics measure lines of *your* code executed. They say nothing about whether
the counterparty you executed against resembles the one on mainnet. This was never a
coverage gap — it was a **fidelity gap**, and fidelity gaps are invisible to every
metric a mock-based suite can produce.

---

## 4. Fix #1 — the code change

Replace the raw `approve` with `forceApprove`, which (a) tolerates empty returndata
and (b) handles the non-zero→non-zero allowance restriction.

```solidity
using SafeERC20 for IERC20;

function deposit(uint256 amount) external {
    usdt.safeTransferFrom(msg.sender, address(this), amount);
    usdt.forceApprove(address(aavePool), amount);   // <-- was usdt.approve(...)
    aavePool.supply(address(usdt), amount, address(this), 0);
    // optional belt-and-braces: usdt.forceApprove(address(aavePool), 0);
}
```

`forceApprove` does a low-level `call`, treats "success with empty returndata" as
success, and on failure retries with `approve(spender, 0)` followed by
`approve(spender, amount)`.

Requires OpenZeppelin `^4.9.0` or `5.x`. On 5.x `safeApprove` no longer exists; on 4.x,
prefer `forceApprove` over `safeApprove` for the reason in §1.

Also sweep the rest of the codebase for the same shape — the `using` directive hides
these:

```bash
# any direct (unguarded) ERC-20 call on an IERC20-typed variable
grep -rnE '\.(approve|transfer|transferFrom)\(' src/ \
  | grep -v -E 'safeTransfer|safeTransferFrom|safeApprove|forceApprove|safeIncreaseAllowance'
```

Withdrawal, rescue, fee-sweep, and emergency paths are the usual stragglers — they get
written after the deposit path and rarely get the same review attention. Slither's
`unchecked-transfer` / `incorrect-erc20-interface` detectors will also flag these; add
`slither .` to CI.

Two adjacent things worth handling while you're in here, since USDT is now a supported
underlying:

- **Don't assume `supply` consumed the full allowance.** Either re-zero after the call
  (commented line above) or assert `allowance == 0`.
- **If you ever add a fee-on-transfer or rebasing underlying**, measure the balance
  delta across `safeTransferFrom` rather than trusting `amount`. USDT has a fee
  mechanism in its source (`basisPointsRate`) that is currently set to zero but is
  owner-settable — if it is ever turned on, `amount` overstates what you received and
  `supply` will revert on insufficient balance. Using the measured delta is cheap
  insurance and makes the vault correct for the whole class.

---

## 5. Fix #2 — the change in testing practice

The code fix closes one hole. The practice fix is what stops the next one, and it is
the actual answer to "how did this reach mainnet."

### The rule

> **Every external dependency that exists on-chain must be tested against its real
> deployed bytecode, at the real address, on a fork — before mainnet. Mocks are for
> your own logic and for simulating states you cannot otherwise reach (oracle failure,
> pool insolvency), never as a stand-in for a contract that is already deployed.**

Both dependencies here violated it: USDT *and* the Aave V3 pool. `MockAavePool`
accepted your `supply` call happily; the real pool has supply caps, frozen/paused
reserve flags, an isolation-mode debt ceiling, and its own revert codes. Fixing only
the token leaves the pool mock still lying to you.

### Concretely

**a) Add a fork test for the real deposit path.** This is the single test that would
have caught it. Pin the block for reproducibility.

```solidity
// test/fork/VaultUSDT.fork.t.sol
contract VaultUSDTForkTest is Test {
    address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    // Resolve the pool from the addresses provider rather than hardcoding a proxy
    // address from memory — Aave's provider is the canonical source of truth.
    address constant AAVE_V3_PROVIDER = 0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e;

    Vault vault;
    address alice = makeAddr("alice");

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 20_000_000);
        address pool = IPoolAddressesProvider(AAVE_V3_PROVIDER).getPool();
        vault = new Vault(IERC20(USDT), IPool(pool));
    }

    function test_DepositRealUSDT() public {
        deal(USDT, alice, 10_000e6);           // USDT is 6 decimals
        vm.startPrank(alice);
        IERC20(USDT).forceApprove(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        assertGt(IERC20(aUSDT).balanceOf(address(vault)), 0, "no aTokens minted");
    }

    /// The one that would have gone red on the old code, for the right reason.
    function test_SecondDepositDoesNotStrandAllowance() public {
        // ... deposit twice; old code reverts on the approve, and after a decode
        //     fix would still revert on USDT's non-zero -> non-zero allowance rule.
    }
}
```

Note `test_DepositRealUSDT` fails on the *old* code with an empty revert — the exact
mainnet symptom, reproduced locally in seconds. That is the whole value proposition.

**b) Parameterize the fork test over every token you actually deploy with.** Not the
tokens you imagine supporting — the ones in your deploy script. Make the list a shared
constant that the deploy script and the test both import, so adding a token to
production mechanically adds it to the test matrix and you cannot ship an untested
underlying.

```solidity
function test_DepositAllSupportedTokens() public {
    for (uint256 i; i < SUPPORTED.length; ++i) { _runDeposit(SUPPORTED[i]); }
}
```

**c) Keep a deliberately non-standard mock for the fast suite.** Fork tests are slow
and need an RPC; keep the unit suite fast but make it *honest*. A mock that returns
nothing, plus one that enforces USDT's allowance rule, plus a fee-on-transfer mock:

```solidity
contract NoReturnDataERC20 {
    mapping(address => mapping(address => uint256)) public allowance;
    // ... balances, etc.

    function approve(address spender, uint256 amount) external {
        require(amount == 0 || allowance[msg.sender][spender] == 0, "unsafe approve");
        allowance[msg.sender][spender] = amount;
        // deliberately returns nothing — like USDT
    }
    function transfer(address, uint256) external { /* ... no return ... */ }
    function transferFrom(address, address, uint256) external { /* ... no return ... */ }
}
```

Run the whole vault suite against **both** `MockERC20` and `NoReturnDataERC20` by
making the token a constructor parameter of an abstract base test and subclassing per
token. That turns "does this work with weird tokens" from a test someone has to
remember to write into a property of the suite. The
[d-xo/weird-erc20](https://github.com/d-xo/weird-erc20) collection is a ready-made set
covering missing returns, fee-on-transfer, rebasing, blocklists, and approve races —
import it rather than hand-rolling.

**d) Add fork tests to CI as a required check.** Pinned block, RPC key in secrets, run
on every PR. Fork tests that only run locally, or only when someone remembers, are
fork tests that don't exist. Pin the block so a mainnet state change never turns CI red
for an unrelated reason — bump it deliberately.

**e) Treat "the suite has never been red" as a smell, not a badge.** Before trusting a
suite, mutate the contract — delete the `safeTransferFrom`, flip a comparison, comment
out an access check — and confirm tests go red. A suite that stays green through
deliberate sabotage is measuring nothing. This is cheap to do by hand once per critical
path; `vertigo-rs` automates it if you want it in CI.

**f) Gate deployment on it.** Add to the pre-deploy checklist, as a hard blocker:

- [ ] A fork test exists for **every** (token, protocol) pair in the deploy script
- [ ] Each fork test uses the real mainnet address, not a mock
- [ ] `grep` for unguarded `.approve` / `.transfer` / `.transferFrom` returns nothing
- [ ] `slither .` shows no unaddressed `unchecked-transfer` findings
- [ ] Unit suite runs against at least one non-standard-token mock
- [ ] Deploying with a token not previously used → fork test added first

### The underlying lesson

The suite was green for the same reason the deposit reverted: **the mock and the
contract shared an assumption, so they agreed with each other and neither was checked
against reality.** Tests that only ever run against your own assumptions can confirm
internal consistency; they cannot confirm correctness. The moment your code makes an
external call to an address you do not control, the only test with real evidentiary
value is one that calls that address.
