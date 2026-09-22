# save-any-token — onchain vaults

Permissionless ERC-4626 savings vaults for arbitrary ERC-20s on Ethereum mainnet.
Deposit a token, hold a transferable receipt share, withdraw any time. A keeper transfers
yield in as more of the same token; it vests into the share price over a fixed cycle.

* `src/SavingsVaultFactory.sol` — permissionless listing, one vault per token (CREATE2).
* `src/SavingsVault.sol` — the vault + receipt token (ERC-4626, ERC-2612 permit).
* `src/TokenMetadata.sol` — defensive `name()`/`symbol()` reads for untrusted tokens.

See [NOTES.md](./NOTES.md) for how a claim is computed and the operator runbook.

```bash
forge build && forge test
```
