# Why every USDT deposit reverts with no reason string

## Short version

`usdt.approve(...)` is a **raw `IERC20` call, not a SafeERC20 call**. The `IERC20`
interface declares `approve` as returning `bool`, so Solidity emits a return-data
decode after the call: it requires `returndatasize() >= 32` and then ABI-decodes a
bool. Real USDT's `approve` is declared `function approve(address, uint)` — **no
return value at all**. It succeeds, returns zero bytes, and the compiler-generated
decode check fails. That check reverts with empty returndata, which is exactly the
"revert with no reason string" you are seeing. The revert is produced by your own
contract's compiled code, not by USDT and not by Aave.

## 1. Why it reverts against real USDT but never against the mock

Real USDT (0xdAC1…1ec7) predates the finalized ERC-20 ABI. Its
[`approve`](https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7#code)
and `transfer`/`transferFrom` have **no `returns (bool)`**. Two consequences:

1. **No return value.** Calling it through an interface that promises `bool` makes
   solc insert a decode that reverts on 0-byte returndata.
2. **Approve race guard.** USDT additionally has
   `require(!((_value != 0) && (allowances[msg.sender][_spender] != 0)))` — a
   non-zero → non-zero allowance change reverts. Not what bites you on the first
   deposit, but it is a latent second bug: any time a previous approval is not fully
   consumed (partial `supply`, a reverted-and-retried flow, a leftover dust
   allowance), the next `approve(amount)` reverts too.

`MockERC20` is a stock OpenZeppelin `ERC20`. Its `approve` is
`function approve(address, uint256) public returns (bool)` and it `return true`s.
The decode finds 32 bytes containing `1`, succeeds, and execution continues. The mock
also has no approve-race guard. So the mock satisfies both assumptions the production
code silently makes; the real token satisfies neither.

Decimals are a red herring here — your mock matching USDT's 6 decimals makes it look
faithful while diverging on the thing that actually matters, the **ABI**.

## 2. Why SafeERC20 did not protect the failing line

`using SafeERC20 for IERC20` attaches SafeERC20's functions to `IERC20` values. Those
functions are named `safeTransfer`, `safeTransferFrom`, `safeApprove`/`forceApprove`,
`safeIncreaseAllowance`, `safeDecreaseAllowance`. **`approve` is not one of them.**

Solidity resolves a member on an interface type by preferring the interface's own
declared function; `usdt.approve(...)` therefore binds to `IERC20.approve`, the raw
external call, and the `using for` directive never enters the picture. There is no
compiler warning, no shadowing error, nothing. It looks protected because the line
above it is.

That line above is why the first call works and reveals the mechanism:
`safeTransferFrom` routes through SafeERC20's `_callOptionalReturn`, which does a
low-level `call` and then accepts the result if **either** returndata is empty **or**
returndata decodes to `true`. That tolerance for empty returndata is the entire point
of SafeERC20, and it is precisely the protection line 2 opts out of.

So: line 1 is SafeERC20 and tolerates USDT's missing return value; line 2 is a bare
interface call and does not. Line 3 (`aavePool.supply`) is never reached — Aave and
the pool are innocent.

## 3. Why no amount of extra mock-based testing would have found it

Because the bug is not in your logic. It is in a **false assumption about a
counterparty's ABI**, and the mock is built from the same assumption.

The mock is written by the same people, from the same mental model, as the contract
under test. It encodes "ERC-20 `approve` returns `bool`" as ground truth. Every test
you run against it is therefore checking your code against your belief, not against
reality — the test and the bug share a premise, so the test can never contradict the
bug. You can add a 40th, 400th test; they all inherit the same premise. 39/39 green is
not evidence the integration works; it is evidence the code agrees with itself.

This generalizes: **a hand-written test double can only reproduce the parts of a
dependency you already knew about.** Mocks are good for exercising *your* branching
(access control, accounting, pause logic, reentrancy paths). They are structurally
incapable of validating an *integration boundary*, because the boundary is exactly
what has been replaced by your own assumptions. Anything that depends on the real
deployed bytecode — missing return values, fee-on-transfer, rebasing, blocklists,
`decimals()` quirks, custom `permit`, upgradeable proxies whose implementation
changed, Aave's own reserve config / caps / frozen state — lives in the blind spot.

## 4. Fix 1 — the code change

Route the approval through SafeERC20 as well. With OpenZeppelin v4.9+ or v5.x use
`forceApprove`, which sets the allowance to zero first if the direct approve fails —
this handles both USDT quirks (no return value *and* the non-zero → non-zero guard):

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

Notes:

- **Do not use `safeApprove`.** It is removed in OZ v5 and, in v4, it *reverts* on a
  non-zero → non-zero change rather than fixing it. If you are pinned to an older OZ,
  the explicit equivalent is `usdt.safeApprove(pool, 0); usdt.safeApprove(pool, amount);`.
- If you are on an OZ version without `forceApprove`, upgrade; that is the cleanest
  path and gets you the rest of the v4.9 SafeERC20 hardening.
- Consider auditing the whole codebase for the same shape:
  `grep -rn '\.approve(\|\.transfer(\|\.transferFrom(' src/` and confirm every hit is
  a `safe*`/`force*` variant. This is a mechanical, one-time sweep — add it to CI as a
  lint rule (Slither's `unchecked-transfer` / a custom solhint rule) so it cannot
  regress.
- Separately consider whether the vault should handle **fee-on-transfer** tokens:
  USDT has a fee mechanism in its code (currently set to zero, but ownable and
  settable). If it were ever enabled, `amount` would exceed what actually arrived.
  Measuring `balanceAfter - balanceBefore` and supplying *that* is the robust form.

## 5. Fix 2 — the change in testing practice

**Test integrations against forked mainnet state, using the real deployed contracts.**

Concretely, for this repo:

1. **Add a forked-mainnet test suite** alongside the unit suite. In Foundry:

   ```solidity
   contract VaultUsdtForkTest is Test {
       address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
       address constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

       function setUp() public {
           vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
           vault = new Vault(USDT, AAVE_V3_POOL);
       }

       function test_deposit_realUsdt() public {
           deal(USDT, alice, 1_000e6);
           vm.startPrank(alice);
           IERC20(USDT).approve(address(vault), 1_000e6);
           vault.deposit(1_000e6);
           // assert aUSDT balance, share accounting, second deposit, withdraw round-trip
       }
   }
   ```

   Pin the block number so the tests are deterministic and cacheable. Run them in CI
   with an RPC URL in secrets; keep them in a separate profile
   (`forge test --match-path 'test/fork/*'`) so the fast unit suite stays fast.

2. **Make the fork test a release gate.** The rule: *no token is supported on mainnet
   until there is a green fork test that deposits and withdraws that exact token
   address.* Had that gate existed, this would have failed in CI the day USDT was
   added, with the same empty revert, at zero cost.

3. **Parameterize the fork suite over the real token set** you intend to support —
   USDT, USDC, DAI, WBTC, WETH — as a table-driven test. Non-standard behavior is the
   norm, not the exception, and each token surfaces a different quirk (USDT: no return
   value + approve race; USDC: upgradeable proxy + blocklist; WBTC: 8 decimals +
   pausable). Also assert on the Aave side: reserve is active, not frozen, not paused,
   and under its supply cap.

4. **Keep the mocks, but demote them and make them adversarial.** Mocks stay for
   fast logic tests. Separately, add hostile doubles that deliberately violate the
   spec — a `NoReturnERC20` (returns zero bytes), a `FalseReturnERC20`, a
   `FeeOnTransferERC20`, a `ReturnsGarbageERC20`, an `ApproveRaceERC20` that
   replicates USDT's require. A stock OZ `ERC20` is the *best-case* dependency; testing
   only against it tests only the happy path of the outside world.

5. **Add a pre-deploy checklist step:** for every external address the contract will
   touch on mainnet, read the actual verified source on Etherscan and confirm the ABI
   you compiled against matches. Two minutes of reading USDT's `approve` signature
   would have caught this before any test was written.

The one-line takeaway: **39/39 green against mocks measured your code's consistency
with your assumptions, and this bug lived entirely in the assumptions.** The only test
that can falsify an assumption about a deployed contract is one that runs against that
deployed contract.
