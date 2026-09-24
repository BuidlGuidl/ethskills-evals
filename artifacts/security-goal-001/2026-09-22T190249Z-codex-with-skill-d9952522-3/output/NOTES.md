# Save Any Token Notes

Each vault is an ERC-4626 vault. The transferable receipt token is the vault share token.

A depositor's underlying claim is:

```text
assets = shares * (vaultTokenBalance + 1) / (totalReceiptSupply + 10^6)
```

rounded down for `convertToAssets`/`redeem`. The `+1` virtual asset and `10^6` virtual shares come from OpenZeppelin's ERC-4626 virtual accounting with a 6-decimal offset. They make empty-vault donation attacks much more expensive and avoid a fragile first-depositor special case.

Yield is just extra underlying token balance in the vault. When the keeper transfers more of the same ERC-20 into the vault, `vaultTokenBalance` rises while receipt supply stays unchanged, so each receipt token converts into more underlying.

Operators listing a token should get these points right:

- Use the factory once per underlying token and choose clear receipt metadata before publicizing the vault. Listing is permissionless, so the first successful listing fixes the receipt name and symbol for that asset in this factory.
- Verify the token is a normal ERC-20 on Ethereum mainnet. Deposits revert if the vault receives less or more than the requested amount, which rejects taxed, deflationary, and other inexact inbound transfers.
- Avoid advertising tokens with transfer fees, rebases, blacklists, paused transfers, upgradeable behavior controlled by weak admins, or unusual decimals unless users understand the consequences. Outbound transfer fees can make withdrawers receive less than the nominal ERC-4626 asset amount.
- The keeper must send only the vault's underlying token directly to the vault address. Sending another token is not yield for depositors and may require separate recovery tooling outside these contracts.
- Frontends and keepers should use `previewDeposit`, `previewMint`, `previewWithdraw`, and `previewRedeem`, or the slippage helper methods, because direct donations and keeper transfers can change the exchange rate at any time.

