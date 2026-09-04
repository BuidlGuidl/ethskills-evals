# Notes

## Depositor claim math

Each vault is an ERC-4626 vault whose share token is the transferable receipt token depositors hold.

- `totalAssets()` is the current balance of the underlying ERC-20 held by the vault.
- `totalSupply()` is the total number of receipt shares outstanding.
- A holder's economic claim is their pro-rata portion of vault assets:

`holder assets ~= holderShares / totalSupply * totalAssets`

On-chain, the exact conversion is the ERC-4626 `convertToAssets` / `previewRedeem` math from OpenZeppelin v5.0.2:

`assets = shares * (totalAssets + 1) / (totalSupply + 1)`

That `+1 / +1` virtual offset is the built-in empty-vault inflation-attack mitigation in this ERC-4626 version. Once a vault has meaningful balances, the result is effectively the usual pro-rata claim. When the keeper sends more underlying into the vault, `totalAssets()` goes up while `totalSupply()` stays the same, so every existing share is worth more underlying.

Deposits use the inverse conversion. A depositor receives however many shares `previewDeposit(assets)` returns at the current exchange rate. Withdrawals and redemptions burn shares and return underlying at the current rate.

## Listing and keeper operations

Vault creation is permissionless through `SaveTokenVaultFactory.createVault(asset, shareName, shareSymbol)`. The factory allows one vault per underlying asset address.

The operator who lists a token and runs the keeper has to get these things right:

- Only list standard ERC-20s. The vault rejects deposits that arrive short, so fee-on-transfer / tax tokens will fail on deposit. Rebasing, callback-heavy, or otherwise non-standard tokens are also poor fits for a generic pro-rata vault.
- Pick sane receipt metadata. `shareName` and `shareSymbol` are set once at vault creation and become the user-facing receipt token forever.
- Fund yield in the correct token. Yield must arrive as more of the same underlying asset for that vault. Sending any other token does nothing for depositor claims.
- Prefer `donate(uint256 assets)` for keeper top-ups. It uses `transferFrom`, measures what actually arrived, and emits `YieldDonated`. A raw ERC-20 transfer to the vault also works because claims are based on vault balance, but it emits no vault event.
- Keep enough allowance/balance for the keeper. `donate` pulls from the caller, so the keeper must approve the vault and hold the underlying token.
- Expect rounding at the margins. ERC-4626 rounds in favor of the vault on some preview paths, so very small deposits or withdrawals can lose a minimal amount to rounding.
