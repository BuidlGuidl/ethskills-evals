This is a contract bug, not a depositor mistake.

The vault is vulnerable to the ERC-4626 inflation or donation attack. The key issue is that share minting uses the vault's live token balance as the denominator:

`shares = assets * totalShares / currentAssets`

and Solidity rounds division down.

## What happened

Assume USDC base units throughout.

### 1. Attacker seeds the vault

`0xA1` deposits `1`.

- Before deposit: `totalShares = 0`, `totalAssets = 0`
- Special-case first deposit mints `1` share
- After deposit: `totalShares = 1`, `totalAssets = 1`

So `0xA1` owns 100% of the vault for a cost of `0.000001 USDC`.

### 2. Attacker donates 20,000 USDC directly

`0xA1` then transfers `20,000 USDC = 20,000,000,000` base units straight to the vault address.

That transfer increases the vault's USDC balance, but does not mint any shares.

- After donation: `totalShares = 1`
- `totalAssets = 20,000,000,001`

So the single existing share is now worth essentially all assets in the vault.

### 3. Victim deposits 15,000 USDC

`0xB2` deposits `15,000 USDC = 15,000,000,000` base units.

Using the vault's formula at that moment:

`shares = 15,000,000,000 * 1 / 20,000,000,001`

Since `15,000,000,000 < 20,000,000,001`, the quotient is strictly less than `1`, and Solidity rounds down to `0`.

So the deposit succeeds, USDC is transferred in, but `0xB2` is minted `0` shares.

This is exactly why the transaction did not revert: the formula produced `0`, and the contract accepted that result.

After the deposit:

- `totalShares = 1`
- `totalAssets = 35,000,000,001`
- `0xB2` owns no shares at all

### 4. Attacker redeems

`0xA1` still owns the only share, so redeeming `1/1` of the shares withdraws `1/1` of the assets:

`35,000,000,001` base units = `35,000.000001 USDC`

That includes:

- the attacker's original dust deposit,
- the attacker's 20,000 USDC donation,
- and `0xB2`'s 15,000 USDC deposit.

## Why this is a bug

The depositor did not misuse the interface. ERC-20 tokens can always be transferred directly to a vault address, and ERC-4626 vaults must be safe in the presence of unsolicited asset transfers.

The bug is that the vault lets an attacker manipulate the share price by donating assets before another user deposits, and it allows a deposit that mints zero shares.

Two properties make the loss possible:

1. Direct donations increase `totalAssets` without increasing `totalShares`.
2. `deposit` does not revert when `previewDeposit(assets)` is `0`.

So this is a protocol accounting flaw in the contract, not operator error by `0xB2`.

## What to ship

Stay ERC-4626 compatible, but change share conversion to use a virtual offset, the standard mitigation used to make this attack uneconomic.

Conceptually:

```solidity
shares = assets.mulDiv(
    totalSupply() + VIRTUAL_SHARES,
    totalAssets() + VIRTUAL_ASSETS,
    Math.Rounding.Down
);
```

and the reverse conversion should use the same offset.

Example pattern:

```solidity
function _convertToShares(uint256 assets, Math.Rounding rounding)
    internal
    view
    returns (uint256)
{
    return assets.mulDiv(
        totalSupply() + 10 ** _decimalsOffset(),
        totalAssets() + 1,
        rounding
    );
}

function _convertToAssets(uint256 shares, Math.Rounding rounding)
    internal
    view
    returns (uint256)
{
    return shares.mulDiv(
        totalAssets() + 1,
        totalSupply() + 10 ** _decimalsOffset(),
        rounding
    );
}
```

This is the OpenZeppelin-style ERC-4626 defense. It preserves ERC-4626 behavior, but prevents an attacker from turning a tiny seed share into ownership of a huge donated balance at negligible cost.

Also add an explicit guard in `deposit` and `mint` paths so that a call reverts if the resulting share amount is zero. That does not solve the inflation attack by itself, but it does prevent silent confiscation like `0xB2` experienced.

## Bottom line

`0xB2` got zero shares because:

`15,000,000,000 * 1 / 20,000,000,001 = 0` after rounding down.

The deposit succeeded because the contract allowed zero-share mints.

The root cause is a vault inflation/donation vulnerability in the contract. The fix is to implement ERC-4626 virtual-share and virtual-asset offsets, and to reject deposits that would mint zero shares.
