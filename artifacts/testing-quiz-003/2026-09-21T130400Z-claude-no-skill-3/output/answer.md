# Why deposits revert on mainnet USDT but never against the mock

## Short version

Line 2 is the bug:

```solidity
usdt.approve(address(aavePool), amount);   // <-- raw IERC20 call, not SafeERC20
```

`usdt` is typed as OpenZeppelin `IERC20`, whose ABI declares `approve(address,uint256)
returns (bool)`. Real USDT (Tether, `0xdAC17F958D2ee523a2206206994597C13D831ec7`) was
deployed in 2017 against a pre-final draft of ERC-20: its `approve` and `transfer`
return **nothing at all**.

So the call sequence at runtime is:

1. Solidity emits a `CALL` to USDT's `approve`.
2. USDT executes successfully and returns with `returndatasize() == 0`.
3. Solidity's generated wrapper for a non-`void` external call checks
   `returndatasize() >= 32` before ABI-decoding the `bool`. The check fails.
4. The compiler-inserted failure path is a bare `revert(0, 0)`.

That is exactly the symptom you observed: **the state-changing call itself succeeded,
and the revert came from your own contract's return-data decoding, with no reason
string** — because `revert(0,0)` carries no data, no `Error(string)`, no custom error.
Nothing to decode, nothing in the trace but "reverted".

There is a second, independent landmine in the same line, discussed below.

## Why the mock never reproduces it

`MockERC20` is a stock OpenZeppelin `ERC20`. OZ's `approve` is fully ERC-20-compliant:
it ends in `return true` and therefore leaves 32 bytes of return data on the stack.
Step 3 above succeeds; the decode yields `true`; execution continues.

The mock and the real token have the **same function selector and the same observable
effect** (allowance is set) but **different ABI return arity**. Your test suite is
written against the mock's ABI, and the mock's ABI matches the interface you declared.
The production token's ABI does not. Decimals are irrelevant here — a 6-decimal mock is
still a compliant mock. The deviation is in the return signature, not the numbers.

This is why the suite was green from the first commit and stayed green: **the suite and
the bug are disjoint**. There is no input, no amount, no sequencing, no fuzz seed that
makes an OZ `ERC20` omit its return value. The property you needed to test is a property
of the *bytecode you did not deploy*.

## Why `using SafeERC20 for IERC20` did not protect that line

`SafeERC20` is not a compiler-enforced policy. It is a library of *separately named*
functions — `safeTransfer`, `safeTransferFrom`, `safeApprove`, `forceApprove`,
`safeIncreaseAllowance`, `safeDecreaseAllowance` — attached to the `IERC20` type. Each
one performs a low-level `call` and then applies the tolerant check:

> the call must not revert, **and** the return data must be either empty **or** a
> 32-byte word decoding to `true`.

That "or empty" clause is the entire point of the library, and it is what makes
`safeTransferFrom` work against USDT on line 1.

But `using A for B` only *adds* methods; it does not remove or intercept the ones the
interface already declares. `usdt.approve(...)` resolves to `IERC20.approve` — the raw
interface method — not to anything in `SafeERC20`. There is no name collision, so there
is no shadowing, and the compiler is perfectly happy. You get the strict decode.

So the mixed usage on lines 1 and 3 is not an inconsistency the tooling can flag; it is
two different functions that merely look similar at the call site. Line 1 is protected
because you wrote `safeTransferFrom`. Line 2 is unprotected because you wrote `approve`.
`forge build`, `solc`, and the OZ library all consider this well-formed code.

(Worth naming explicitly: **SafeERC20 protects call sites, not tokens.** Adding the
`using` directive to a contract gives you nothing; using the `safe*` methods at every
single call site gives you everything. One missed call site is a full-severity bug.)

## The second landmine on the same line

Even after you fix the return-data decode, USDT's `approve` has a non-standard guard
inherited from the original race-condition mitigation:

```solidity
require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
```

A non-zero → non-zero allowance change **reverts** (again with no reason string, since
this is an old-Solidity bare `require`). Your code would survive the first deposit and
then break on the second one *only if* some allowance were left over. With Aave V3 the
pool pulls the exact `amount`, so the allowance normally returns to zero and you would
usually get away with it — which is precisely the kind of "works until it doesn't" bug
that surfaces after a partial-pull, a fee-on-transfer path, or a future pool upgrade.
Fix it now, in the same line, rather than shipping a latent version of it.

## Why no amount of extra mock-based testing would have found it

The failure is a **mismatch between your declared interface and the deployed bytecode at
a specific mainnet address**. Mock-based tests, by construction, substitute bytecode you
wrote for the bytecode you will actually call. They can only ever validate your
contract against your own assumptions. The bug *is* the assumption.

Concretely, the things people reach for all fail to catch it:

- **More unit tests** — they instantiate the same `MockERC20`; every one of them passes.
- **Fuzzing amounts / `vm.assume`** — the divergence is not value-dependent.
- **Invariant tests** — invariants are checked over the mocked system; the mocked system
  genuinely holds them.
- **100% line and branch coverage** — line 2 is already covered, 39 times over. The
  failing branch lives inside compiler-generated decode logic, which coverage tools do
  not surface as a branch at all.
- **Static analysis / linting** — Slither's `unchecked-transfer` style detectors look for
  *ignored* return values; here the return value is checked (too strictly), so the
  common detectors stay quiet.
- **A "USDT-like" mock you write yourself** — better, and worth having (see below), but
  it only encodes the deviations you already thought of. It would not have helped here,
  because if you had thought of the missing return value you would have written
  `forceApprove` in the first place.

The only test that can detect a bytecode mismatch is one that executes the real
bytecode.

## Fix 1 — the code change

Replace the raw `approve` with `SafeERC20.forceApprove`, which handles **both** USDT
quirks: it tolerates empty return data, and on failure it retries after resetting the
allowance to zero.

```solidity
using SafeERC20 for IERC20;

function deposit(uint256 amount) external {
    usdt.safeTransferFrom(msg.sender, address(this), amount);
    usdt.forceApprove(address(aavePool), amount);        // <-- was usdt.approve(...)
    aavePool.supply(address(usdt), amount, address(this), 0);
}
```

Notes:

- `forceApprove` requires OpenZeppelin Contracts **v4.9.0 or later**; it is the
  recommended form in v5.x. Do not use `safeApprove` — it is deprecated and it *reverts*
  on a non-zero → non-zero change rather than handling it.
- If you are pinned below 4.9, the equivalent is
  `usdt.safeApprove(address(aavePool), 0); usdt.safeApprove(address(aavePool), amount);`
  but upgrading OZ is the better move.
- A cleaner variant for a pool that always pulls the full amount: approve once to
  `type(uint256).max` in the constructor/initializer via `forceApprove`, and drop the
  per-deposit approval entirely. This saves an `SSTORE` per deposit. Trade-off: a
  standing infinite allowance to the Aave pool. For Aave V3 that is a widely accepted
  posture, but it is a deliberate risk decision — make it explicitly, don't drift into
  it.

Then audit **every** call site in the repo for the same class of mistake:

```bash
# any raw ERC-20 mutator that should be a safe*/force* call
grep -rnE '\.(approve|transfer|transferFrom)\(' src/ --include='*.sol'
```

Every hit should be `safeTransfer`, `safeTransferFrom`, or `forceApprove`. Consider a CI
grep or a Slither custom detector that fails the build on a raw `.approve(`.

## Fix 2 — the change in testing practice

**Mocks test your logic. Fork tests test your integration. You need both, and the second
is not optional for any contract that names a real mainnet address.**

Keep the 39 mock tests — they are fast, they cover accounting and access control, and
that is what they are for. Add a second, smaller suite that runs the exact same deposit
and withdraw flows against **forked mainnet state**: real USDT at
`0xdAC17F958D2ee523a2206206994597C13D831ec7`, real Aave V3 Pool, real aToken.

In Foundry:

```solidity
contract VaultUsdtForkTest is Test {
    address constant USDT      = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2; // V3 mainnet

    Vault vault;

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 20_000_000); // pin the block
        vault = new Vault(IERC20(USDT), IPool(AAVE_POOL));
    }

    function test_deposit_realUsdt() public {
        address user = makeAddr("user");
        deal(USDT, user, 1_000e6);

        vm.startPrank(user);
        IERC20(USDT).approve(address(vault), 1_000e6);
        vault.deposit(1_000e6);
        vm.stopPrank();

        assertGt(vault.balanceOf(user), 0);
    }

    function test_deposit_twice_doesNotStickOnAllowance() public { /* ... */ }
}
```

The `deposit_twice` case matters: it is the one that catches the non-zero → non-zero
allowance guard. Any integration test worth having exercises the path **at least twice**,
because first-call-only tests miss every piece of sticky state.

Make this concrete and enforceable:

1. **Rule: every external address the contract will touch on mainnet gets a fork test
   before deployment.** Tokens, pools, oracles, routers. No exceptions for "it's just an
   ERC-20."
2. **Pin the fork block number** so the tests are deterministic and cacheable, and put
   the RPC URL in CI secrets. Run the fork suite on every PR if latency allows, nightly
   plus pre-deploy at minimum. A fork suite that only runs manually is a fork suite that
   doesn't run.
3. **Parameterize the fork suite over your whole supported token list** — USDT, USDC,
   DAI, WETH, and anything you might add later. Weird tokens are the norm, not the
   exception: USDT and BNB omit return values, USDC is upgradeable and has a blocklist,
   some tokens are fee-on-transfer, some rebase, some have non-18 decimals, some revert
   on zero-value transfer. `d-xo/weird-erc20` is a good checklist and a good source of
   adversarial mocks.
4. **Add an adversarial mock alongside the honest one.** Keep a `MockNonStandardERC20`
   that returns no data from `approve`/`transfer` and reverts on non-zero → non-zero
   approval. Run the existing unit suite against both mocks. This is cheap, needs no RPC,
   and makes the failure mode a permanent regression test rather than a one-time lesson.
5. **Deployment gate:** the deploy script should not run unless the fork suite for the
   specific token and pool addresses being deployed has passed at a recent block.

The general principle to take away: **a green suite tells you your code matches your
mocks.** It says nothing about whether your mocks match the chain. The only way to learn
that is to run against the chain — and the cost of doing so is one fork test, versus a
deployed vault that cannot accept a deposit.
