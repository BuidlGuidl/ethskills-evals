# Why the deposit reverts on mainnet but never in the suite

## Short version

`usdt.approve(...)` is a **raw `IERC20` call**, not a SafeERC20 call. Real USDT's `approve`
returns **nothing**. The compiler-generated decoder for `IERC20.approve` demands 32 bytes of
returndata and reverts with empty returndata when it doesn't get them. Your MockERC20 is a
stock OpenZeppelin ERC20, which *does* return `bool` — so the mock can never reproduce the
failure, for any input, in any number of tests.

---

## 1. Why it reverts against real USDT

Real USDT (`TetherToken`, deployed 2017, pre-EIP-20-finalization) declares:

```solidity
function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32);
//                                                   ^ no `returns (bool)`
```

Your `usdt` is typed `IERC20`, whose `approve` is declared `returns (bool)`. A high-level
Solidity call through that interface compiles to roughly:

```
call(...)                       // succeeds — USDT's approve runs fine, allowance IS set
if iszero(success) { revert(returndata) }
if lt(returndatasize(), 32) { revert(0, 0) }   // <-- fails here
returnValue := abi.decode(returndata, (bool))
```

USDT returns `returndatasize() == 0`. The decoder guard trips and reverts with **zero bytes of
returndata** — which is exactly the "revert with no reason string" you're seeing. Note the
state change already happened; the revert is in *your* contract's ABI-decode epilogue, not in
USDT. That's why it's so opaque: nothing failed inside the token.

There is a **second, independent USDT landmine** waiting behind this one:

```solidity
require(!((_value != 0) && (allowances[msg.sender][_spender] != 0)));
```

USDT refuses any non-zero → non-zero allowance change. So even after you fix the decoding
problem, a `safeApprove(pool, amount)` will revert the moment a **stale non-zero allowance**
survives a deposit (partial pull, a failed/reverted-and-retried supply, a paused reserve, dust).
Fix both at once — see §4.

Third, lower-probability quirk worth knowing: USDT has a live fee mechanism
(`basisPointsRate` / `maximumFee`, currently 0 but owner-settable). If it were ever turned on,
`safeTransferFrom(amount)` would credit you **less than `amount`**, and `supply(amount)` would
then revert on insufficient balance. Cheap to defend against; see §4.

## 2. Why it never reverts against the mock

Your MockERC20 is a stock OZ `ERC20`. Its `approve` is:

```solidity
function approve(address spender, uint256 value) public virtual returns (bool) { ...; return true; }
```

It returns a correctly ABI-encoded `true`, always. The decoder guard is satisfied, always.

The failure mode does not live in the *input space* of the mock — it lives in the **bytecode at
the token address**. No argument value, no caller, no state, no sequencing gets a stock ERC20 to
return zero bytes. Your mock is a model of the *specification*; the bug is a deployed contract's
*deviation from* that specification.

The 6-decimals detail actively made this worse: it's the one USDT trait you copied, and the
least important one. It bought a false sense of "we modeled USDT."

## 3. Why SafeERC20 didn't protect that line

`using SafeERC20 for IERC20` **adds names**; it does not intercept or rewrite existing ones.

- It attaches `safeTransfer`, `safeTransferFrom`, `forceApprove`, `safeIncreaseAllowance`,
  `safeDecreaseAllowance`.
- It does **not** define anything called `approve`. So `usdt.approve(...)` resolves, with no
  ambiguity and no warning, to the plain `IERC20.approve` member — the strict-decode path.

SafeERC20 is **opt-in per call site**. Line 1 opted in and was protected; line 2 didn't and wasn't.

What line 1 got, via `_callOptionalReturn` (OZ v5):

```solidity
// success, then:
if (returnSize == 0 ? address(token).code.length == 0 : returnValue != 1)
    revert SafeERC20FailedOperation(address(token));
```

Empty returndata is **accepted** as long as the address has code. That is precisely the
non-standard-token accommodation that line 2 skipped.

So the prompt's clue — "the first line uses the token and succeeds" — is the whole tell: the
token isn't the problem, the *inconsistent call convention within three lines* is.

## 4. The code fix

```solidity
using SafeERC20 for IERC20;

uint256 before = usdt.balanceOf(address(this));
usdt.safeTransferFrom(msg.sender, address(this), amount);
uint256 received = usdt.balanceOf(address(this)) - before;   // fee-on-transfer safe

usdt.forceApprove(address(aavePool), received);              // <-- the actual fix
aavePool.supply(address(usdt), received, address(this), 0);
```

`forceApprove` (OZ ≥4.9; the only correct choice in v5, where `safeApprove` was removed):

1. tries `approve(spender, value)` via a **bool-returning optional-return** helper — tolerates
   USDT's empty returndata;
2. if that fails, does `approve(spender, 0)` then retries — defeats the non-zero→non-zero guard.

One call, both USDT quirks handled. Do **not** use bare `safeApprove` (deprecated, and it only
solves quirk #1).

If you'd rather not pay an approve per deposit, the alternative is a single `forceApprove(pool,
type(uint256).max)` at initialization plus a top-up check — but per-deposit `forceApprove` on the
exact amount is simpler and leaves no standing allowance. Prefer it unless gas forces your hand.

**Then sweep the rest of the codebase**, because this is a call-site-by-call-site discipline and
one miss is proof the discipline isn't enforced:

```bash
grep -rnE '\.(approve|transfer|transferFrom)\(' src/   # every hit must be safe*/forceApprove
```

Check the withdraw path, any `rescueTokens`/sweep function, and any reward-claim path. Add
Slither to CI — its `unchecked-transfer` and `incorrect-erc20-interface` detectors flag exactly
this line.

## 5. The testing-practice fix

**Rule: a mock may stand in for your own contracts. It may never stand in for a third-party
deployed contract.** For anything you don't compile yourself — USDT, the Aave V3 Pool — the only
oracle of truth is the real bytecode on a fork. Your MockAavePool is hiding a second batch of the
same class of problem (reserve active/frozen/paused checks, supply caps, aToken accounting,
Aave's own return conventions) that no amount of mock-based testing will reveal either.

Add a fork suite pinned to a block, and gate deployment on it:

```solidity
contract VaultUsdtForkTest is Test {
    address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    // resolve the Pool from the addresses provider rather than hardcoding it —
    // Aave upgrades the Pool address, the provider is the stable entry point
    IPoolAddressesProvider constant PROVIDER =
        IPoolAddressesProvider(0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e);

    Vault vault;
    IPool  pool;
    address alice = makeAddr("alice");

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 20_000_000); // pinned = deterministic
        pool  = IPool(PROVIDER.getPool());
        vault = new Vault(IERC20(USDT), pool);
    }

    function test_DepositRealUsdtIntoRealAave() public {
        deal(USDT, alice, 10_000e6);              // if StdStorage misses USDT's `balances`
                                                  // slot, prank a whale instead
        vm.startPrank(alice);
        IERC20(USDT).forceApprove(address(vault), 10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();

        address aUSDT = pool.getReserveData(USDT).aTokenAddress;
        assertGt(IERC20(aUSDT).balanceOf(address(vault)), 0, "no aTokens minted");
    }

    // catches quirk #2 — passes with forceApprove, fails with plain safeApprove
    function test_SecondDepositWithStaleAllowance() public {
        deal(USDT, alice, 20_000e6);
        vm.startPrank(alice);
        IERC20(USDT).forceApprove(address(vault), type(uint256).max);
        vault.deposit(10_000e6);
        vault.deposit(10_000e6);
        vm.stopPrank();
    }
}
```

Keep **both** tests. The first fails today at the raw `approve`. The second is the one that
survives a half-fix (`safeApprove`) and still catches the allowance guard.

Institutionalize it:

- **Token matrix in CI.** Run the same fork suite against every token you intend to list, not
  just the one you shipped: USDT (no return value + approve race), USDC (upgradeable proxy +
  blacklist), a fee-on-transfer token, a rebasing token (stETH), an 8-decimal token (WBTC).
  Parameterize the fork test over an address array.
- **Listing gate.** No token enters the vault's allowlist without a green fork test *at that
  token's address*. This converts "we should remember USDT is weird" into a mechanical check.
- **Deployment rehearsal.** Before announcing, fork mainnet at HEAD and replay the literal first
  user deposit against the *actually deployed* contract. This alone would have caught it, with
  zero new tests written.
- **Pinned block + RPC cache** keeps fork tests fast and deterministic, so they run on every PR,
  not nightly.

Finally, the line in your report that should have been the loudest alarm: **"39 tests, all green,
green since the first commit."** A suite that has never gone red has never demonstrated it can
detect anything. Green-since-inception measures agreement between your code and your mocks — two
artifacts written by the same people on the same day, with the same assumptions. Sanity-check the
suite by mutation: change a `+` to a `-`, delete a `require`, make the mock's `approve` return
nothing. If the suite stays green, it isn't testing — it's confirming.
