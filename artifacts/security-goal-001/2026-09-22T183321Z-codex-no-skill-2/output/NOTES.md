# Save Any Token Vaults

## Depositor claim accounting

Each vault has one immutable ERC-20 asset and one transferable receipt token. The receipt token is the share ledger for that vault.

The vault's `totalAssets()` is the current underlying token balance held by the vault. Keeper yield is just an ERC-20 transfer into the vault, so it increases `totalAssets()` without minting new shares. Existing shares therefore redeem for more assets.

For a holder:

```text
claim = holderShares * vault.totalAssets() / vault.totalSupply()
```

Deposits mint shares at the current exchange rate:

```text
first deposit: shares = assetsReceived
later deposits: shares = assetsReceived * totalSupply / totalAssetsBeforeDeposit
```

The vault measures `assetsReceived` from the balance delta after `transferFrom`, so fee-on-transfer tokens cannot mint shares for assets the vault did not actually receive.

Redemptions burn shares and transfer:

```text
assetsOut = shares * totalAssets / totalSupply
```

Rounding is down when converting shares to assets or assets to shares. Integrators should pass nonzero `minSharesOut` on deposit and `minAssetsOut`/`maxSharesIn` on exit based on a fresh quote.

For fee-on-transfer assets, withdraw and redeem accounting is based on the amount the vault sends. The receiving address may receive less if the token charges fees on outbound transfers.

## Operator checklist

- List one vault per token through `SaveVaultFactory.createVault(asset)`. The factory rejects duplicate vaults for the same asset address.
- Verify the token contract before listing it in your UI. Permissionless deployment means anyone can create a vault for malicious, pausable, blocklisted, rebasing, upgradeable, or nonstandard tokens.
- Treat the vault as compatible with vanilla ERC-20s and many optional-return tokens. Tokens with transfer hooks, rebases, blacklists, transfer fees, or balance-changing side effects need explicit risk labeling and testing.
- Configure the keeper to send only the same underlying token directly to the vault address. Sending any other token creates stranded funds unless that token has its own vault.
- Quote immediately before submitting deposits or withdrawals. Keeper transfers, donations, and other user activity can change the share price at any time.
- Keep receipt token decimals equal to the underlying token decimals. Names and symbols are read best-effort from token metadata and fall back if metadata is missing or unusual.
- There is no owner withdrawal, fee switch, pause, or rescue path in these contracts. Operational mistakes in token selection or keeper transfers are intentionally not correctable by an admin.
