# Save Any Token Vaults

Each listed ERC-20 gets one `TokenSavingsVault` receipt token, deployed through
`TokenSavingsVaultFactory.createVault(asset)`. The receipt token is transferable
and represents a pro-rata claim on the underlying tokens held by that vault.

## Depositor Claim

The vault tracks claims with ERC-4626-style share math:

```text
assets claim = shares * (totalAssets + 1) / (totalSupply + 1e6)
new shares   = assets * (totalSupply + 1e6) / (totalAssets + 1)
```

`totalAssets` is simply the underlying token balance of the vault. When the
keeper sends more of the same token directly to the vault, `totalAssets` rises
while `totalSupply` stays fixed, so every existing share converts into more
underlying.

The `+1` virtual asset and `+1e6` virtual shares make first-deposit donation
attacks uneconomical. They also mean conversions can differ by a few wei due to
rounding, especially for tiny deposits or tiny vaults.

Deposits mint against the actual balance increase observed by the vault. This
protects the pool from over-minting if a token charges a transfer fee. The
`mint(shares)` path is stricter and reverts when the transferred amount received
is less than the assets required for the requested shares.

## Operator Checklist

- Check that the proposed asset is the intended token contract on Ethereum
  mainnet. The factory only checks that the address has code; it cannot prove
  that a token is honest, liquid, unpaused, or canonical.
- Understand token behavior before listing it in the UI. Rebasing, blocklists,
  pausability, transfer fees, non-standard metadata, upgradeable token logic,
  or transfer hooks can all affect depositor experience.
- Keep yield transfers simple: send the exact underlying token to the vault
  address. Do not send another asset, LP token, bridged lookalike, or ETH.
- For fee-on-transfer assets, keeper transfers may also be taxed; only the net
  amount received becomes yield.
- The keeper should not need any allowance from the vault. Avoid integrations
  that require the vault to approve third-party spenders.
- Monitor vault balances and share price offchain with `totalAssets()`,
  `totalSupply()`, `convertToAssets(shares)`, and the `Deposit`/`Withdraw`
  events.
- Treat receipt names and symbols as display hints. The asset address is the
  source of truth.
- Deploy and operate from a reviewed release, verify source on Etherscan, and
  run static analysis plus fuzz tests before mainnet deployment.
