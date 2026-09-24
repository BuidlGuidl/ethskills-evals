# Post-mortem: 0xB2 received 0 shares for a 15,000 USDC deposit

**Short version:** this is the ERC-4626 first-depositor / share-inflation
("donation") attack. It is a bug in our contract, not a mistake by 0xB2.
0xB2 had no way to protect themselves. The fix is virtual shares and virtual
assets (OpenZeppelin's `ERC4626` with a `_decimalsOffset()`), plus a
non-zero-shares check and a slippage-checked entry point.

---

## 1. What actually happened, step by step

All amounts below are in USDC base units (6 decimals), so
1 USDC = 1,000,000 units.

Our mint rule is

```
shares = assets * totalShares / totalAssets       // totalAssets = USDC.balanceOf(vault)
shares = assets                                    // special case when totalShares == 0
```

Integer division in the EVM truncates toward zero. That, plus the fact that
`totalAssets` is read from the token balance, is the whole exploit.

### 09:12 — seed the vault with the smallest possible share supply

0xA1 calls `deposit(1)`. Share supply is zero, so the 1:1 branch runs.

```
totalShares = 1
totalAssets = 1
```

The share supply is now the smallest non-zero number representable. This is
the state the attack needs; from here on the 1:1 branch never runs again.

### 09:13 — inflate the share price by direct transfer

0xA1 sends 20,000 USDC = 20,000,000,000 units straight to the vault address
with a plain `ERC20.transfer`. No vault function executes — there is nothing
to reject it, and nothing to hook.

```
totalShares = 1                       (unchanged — no shares were minted)
totalAssets = 20,000,000,001          (balanceOf sees the donation)
```

One share is now worth 20,000.000001 USDC. **This is the bug:** our
`totalAssets` is `balanceOf(address(this))`, so anyone can move the exchange
rate without interacting with the contract at all.

### 09:41 — 0xB2's deposit rounds to zero

0xB2 deposits 15,000 USDC = 15,000,000,000 units.

```
shares = 15,000,000,000 * 1 / 35,000,000,001 = 0.4285... -> 0
```

(If the balance is read before the pull instead of after, it is
`15,000,000,000 * 1 / 20,000,000,001 = 0.7499... -> 0`. Either ordering gives
the same result, so the bug does not depend on that detail.)

The true value of 0xB2's deposit is 0.75 of a share — but a share is the
smallest indivisible unit, and truncation sends 0.75 to **0**.

Nothing reverts. `mint(0xB2, 0)` is a perfectly legal no-op. The
`transferFrom` succeeded, so the USDC is in the vault. The function returns
normally with `shares = 0`. 0xB2's 15,000 USDC became an anonymous donation
to the existing share supply — which is 0xA1's single share.

```
totalShares = 1
totalAssets = 35,000,000,001
```

### 09:44 — collect

0xA1 redeems its 1 share, which is 100% of the supply, and pro rata pays out
100% of assets: 35,000,000,001 units = 35,000.000001 USDC.

**Attacker P&L:** paid 1 unit + 20,000 USDC donated, received 35,000.000001.
Net profit **+15,000 USDC**, i.e. exactly 0xB2's deposit. The donated 20,000
was never at risk; it was working capital that came straight back out.

### The profitability condition

With donation `D` and victim deposit `V` (units, supply of 1 share):

```
victim shares = floor(V / (D + 1 + V))  = 0   whenever   V <= D
```

So the attacker only needs to donate at least as much as the victim deposits,
and they recover the donation in full. Here 20,000 >= 15,000. The capital can
be flash-borrowed within a single block if the attacker sandwiches a pending
deposit they see in the mempool. There is no "large enough" deposit that is
safe in general — the attacker just sizes the donation to the target.

---

## 2. Is this our bug or the depositor's mistake?

**Ours.** Three independent defects in our contract, any one of which would
have stopped this:

1. **`totalAssets` is `balanceOf(this)`, so it is externally writable.**
   Any address can change our exchange rate with a bare token transfer. Our
   accounting trusts a number the attacker controls.
2. **No special handling of the near-empty vault.** A share supply of 1 makes
   the share the coarsest possible unit of account, so rounding error can be
   the entire deposit rather than a dust amount. The "first depositor gets 1:1"
   branch is what lets an attacker choose that state deliberately and for
   1 unit of cost.
3. **A deposit that mints zero shares does not revert.** Even granting (1) and
   (2), a `require(shares > 0)` would have turned a total loss into a failed
   transaction that costs only gas.

It is not 0xB2's mistake, and "they should have called `previewDeposit`"
is not a valid defence:

- ERC-4626's `deposit(assets, receiver)` has **no minimum-shares-out
  parameter**. The standard gives a depositor no on-chain slippage guard.
- `previewDeposit` read off-chain is worthless here: the donation and the
  victim's deposit can land in the same block, with the donation ordered first.
  Any quote 0xB2 obtained beforehand was stale by construction.
- The EIP's own Security Considerations section names this attack. Defending
  against it is the *implementer's* responsibility, and we did not.

0xB2 did nothing unusual. They deposited into a vault that was live on mainnet.

---

## 3. What we ship

### 3.1 Primary fix — virtual shares and virtual assets (stays ERC-4626 compatible)

Inherit OpenZeppelin's `ERC4626` and override `_decimalsOffset()`. This makes
every conversion behave as if the vault permanently holds `10**offset` phantom
shares backed by 1 phantom asset unit:

```solidity
contract UsdcVault is ERC4626 {
    constructor(IERC20 usdc)
        ERC20("USDC Vault", "vUSDC")
        ERC4626(usdc)
    {}

    /// 1e6 virtual shares backing 1 virtual asset unit.
    /// Share token therefore has 12 decimals against 6-decimal USDC.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }
}
```

The conversion becomes

```
shares = assets * (totalSupply + 10**offset) / (totalAssets + 1)
```

Replaying the exact attack with `offset = 6`:

| step | totalSupply (real) | totalAssets | result |
|---|---|---|---|
| A1 deposits 1 unit | 0 -> 1,000,000 | 1 | `1 * 1e6 / 1` = 1e6 shares |
| A1 donates 20,000 USDC | 1,000,000 | 20,000,000,001 | no mint |
| B2 deposits 15,000 USDC | +1,499,999 | 35,000,000,001 | `15e9 * 2e6 / 2.0000000002e10` = **1,499,999 shares** |
| A1 redeems its 1e6 shares | | | `1e6 * 35,000,000,002 / 3,499,999` ≈ **10,000.00 USDC** |

0xB2 now gets a correct, non-zero share balance. 0xA1 spent 20,000.000001 USDC
and recovered about 10,000 — **a 10,000 USDC loss**. The attack is not merely
harder, it is strictly unprofitable: the offset guarantees that any donation is
shared with the virtual shares the attacker can never own, so the attacker
always subsidises the pool rather than draining it. The residual rounding loss
a depositor can suffer is bounded by roughly `donation / 10**offset` — dust.

This is fully ERC-4626 compliant. The only externally visible change is that
the share token reports 12 decimals; `convertToAssets`, `previewDeposit`,
`previewRedeem` and friends remain consistent, and OZ rounds in the vault's
favour on every path.

### 3.2 Defence in depth — ship all of these alongside

**a) Never mint zero shares.**

```solidity
function deposit(uint256 assets, address receiver) public override returns (uint256) {
    uint256 shares = previewDeposit(assets);
    if (shares == 0) revert ZeroShares();
    _deposit(_msgSender(), receiver, assets, shares);
    return shares;
}
```

A depositor's transaction must never succeed while taking their assets and
giving nothing back. Mirror this with `if (assets == 0) revert ZeroAssets()`
on `redeem`/`withdraw`.

**b) Seed the vault at deployment.** In the same transaction that deploys the
vault, deposit a small amount (e.g. 1,000 USDC) from the deployer and send
those shares to `address(0)` or a burn address. This removes the empty-vault
state from the attack surface entirely and makes the first real depositor
indistinguishable from the thousandth. Cheap, permanent, and complements 3.1.

**c) A slippage-checked entry point for users.** ERC-4626 cannot express
minimum-shares-out, so add a non-standard overload (or a thin router) next to
the standard one:

```solidity
function deposit(uint256 assets, address receiver, uint256 minSharesOut)
    external returns (uint256 shares)
{
    shares = deposit(assets, receiver);
    if (shares < minSharesOut) revert Slippage(shares, minSharesOut);
}
```

Keep the standard `deposit` for integrator compatibility; point our own
frontend at the guarded one and document it.

**d) Consider, but weigh carefully: internal asset accounting.** Tracking
`totalAssets` in a storage variable updated only by vault operations makes
direct donations accounting-invisible and kills this class of attack outright.
The trade-off is that legitimately received yield — airdrops, rebates, strategy
profits pushed in by transfer — stops accruing to shareholders unless you add
an explicit `sync()`/`harvest()` path, and that path reintroduces the
donation surface if it is permissionless. If this vault is meant to accrue
yield by receiving tokens, stay with `balanceOf` plus the offset from 3.1.
If it never should, internal accounting is the stronger and simpler choice.

**e) Use `SafeERC20`** for all USDC movement. USDC's proxy could change
behaviour, and this costs nothing.

### 3.3 Tests that must exist before redeploy

- Exact replay of this incident against the fixed contract; assert 0xB2's
  shares > 0 and 0xA1's P&L < 0.
- Fuzz `(donation, victimDeposit)` over the full uint128 range with a 1-unit
  seed deposit; invariant: **attacker final balance <= attacker initial
  balance** and **victim shares > 0 or the deposit reverted**.
- Invariant: `convertToAssets(balanceOf(user))` is non-increasing for a
  passive holder across arbitrary sequences of other users' deposits,
  withdrawals and donations.
- Boundary cases: deposit of 1 unit into an empty vault, into a donated vault,
  and `redeem` of 1 share; assert no path lets a caller extract more than they
  put in.
- Confirm `previewDeposit(x) == deposit(x)` exactly, on a donated vault.

### 3.4 Immediate operational steps

1. **Pause deposits now** (or block them at the frontend if there is no pause
   function — the vault is empty, but it is still live and still exploitable).
2. Do not attempt to patch in place unless the contract is upgradeable and the
   storage layout permits it; the share decimals change in 3.1 is a
   redeploy-shaped change. Redeploy and migrate.
3. 0xB2's 15,000 USDC is gone — it left the contract to 0xA1 and is not
   recoverable on-chain. Decide on compensation as a business matter and
   communicate it; this was our defect.
4. Trace 0xA1's funding and withdrawal addresses and preserve the evidence
   before deciding whether to escalate.
5. Publish this post-mortem, and get the redeployed contract reviewed before
   it takes another deposit.

---

## 4. The one-line takeaway

Never use an unprotected `assets * totalSupply / totalAssets` conversion with a
1:1 empty-vault special case when `totalAssets` is a token balance. Start from
OpenZeppelin's `ERC4626`, set a decimals offset, seed the vault, and never let
a deposit mint zero shares.
