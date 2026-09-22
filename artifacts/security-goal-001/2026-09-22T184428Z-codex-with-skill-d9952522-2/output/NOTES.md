# Save Any Token Notes

## Depositor Claim

Each vault is an ERC-4626 receipt-token vault for exactly one ERC-20 asset.
Depositors receive transferable shares. A holder's claim is their pro-rata
portion of the vault's current underlying balance:

```text
holder claim ~= holder shares * totalAssets / totalSupply
```

The deployed contract uses OpenZeppelin ERC-4626 conversion math, which includes
virtual assets and virtual shares. This protects the empty-vault case from the
classic first-deposit donation attack and means tiny amounts can differ by a few
wei due to rounding. Integrations should use `previewDeposit`, `previewMint`,
`previewWithdraw`, and `previewRedeem` immediately before acting and enforce
their own minimum shares or minimum assets received.

Yield is simply more of the same underlying token arriving in the vault. When a
keeper transfers assets directly to the vault, `totalAssets` increases while
`totalSupply` stays unchanged, so every existing share converts to more assets.

## Operator Checklist

- List only real ERC-20 contracts. The factory rejects the zero address and EOAs,
  then creates one canonical vault per asset.
- Do not list fee-on-transfer tokens unless the fee is permanently disabled for
  vault transfers. Deposits and withdrawals check token balance deltas and revert
  if the exact requested amount is not received.
- Treat rebasing, blacklistable, pausable, upgradable, or otherwise permissioned
  tokens as operational risks. Negative rebases or token-level freezes can reduce
  or block withdrawals even though the vault logic is permissionless.
- The keeper should send only the vault's own underlying token to the vault
  address. Sending other tokens does not create yield for depositors and there is
  no rescue function by design.
- Keep keeper accounting offchain precise: yield transfers should be final,
  observable, and for the intended asset/vault pair. The vault has no special
  keeper role; any direct transfer of the underlying is treated as yield.
- UIs and routers should quote from the vault onchain and apply slippage bounds,
  especially for first deposits, very small deposits, and deposits immediately
  after large direct transfers.
