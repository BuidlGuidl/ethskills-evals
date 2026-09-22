# Incident explanation

0xB2 received zero shares because the vault priced new deposits against the
USDC balance already sitting in the vault, and Solidity integer division rounds
down.

USDC has 6 decimals, so the relevant amounts in base units are:

- 0xA1 deposited `1` unit, equal to `0.000001 USDC`.
- Because the vault had no shares yet, 0xA1 received `1` share.
- 0xA1 then directly transferred `20,000 USDC` to the vault, equal to
  `20,000,000,000` units. This was not a vault deposit, so no new shares were
  minted.
- The vault now had `20,000,000,001` USDC units backing only `1` share.
- 0xB2 deposited `15,000 USDC`, equal to `15,000,000,000` units.

The mint calculation was:

```text
shares = assets * totalShares / vaultUSDCBalance
```

At 0xB2's deposit, using the vault balance before 0xB2's assets are added,
that is:

```text
15,000,000,000 * 1 / 20,000,000,001 = 0
```

The exact rational result is about `0.74999999996` shares. Since shares are an
integer amount, Solidity division floors it to `0`.

The transaction still succeeded because the contract did not reject a deposit
that mints zero shares. So 0xB2's USDC was transferred into the vault, but the
share mint was for amount `0`. 0xB2 therefore had no claim on the vault after
the deposit.

When 0xA1 redeemed its single share, it owned `1 / 1` of the share supply.
Redeeming paid out the whole vault balance:

```text
20,000.000001 USDC donated/seeded by 0xA1
+15,000.000000 USDC deposited by 0xB2
=35,000.000001 USDC
```

# Bug or depositor mistake?

This is a bug in the vault design, not a mistake by 0xB2.

0xB2 used the public `deposit` flow and the transaction succeeded. A vault must
not accept a user's assets while minting them zero shares. The direct transfer
from 0xA1 is permitted ERC-20 behavior and is a known ERC-4626 risk: anyone can
increase `totalAssets()` by donating tokens directly to the vault. If the first
real share supply is tiny, that donation can make later deposits round down to
zero. This is the ERC-4626 inflation/donation attack.

# Fix to ship

Ship an ERC-4626-compatible conversion that protects an empty or near-empty
vault with virtual liquidity, and also reject zero-share deposits.

The standard mitigation is the virtual asset/share offset used by modern
ERC-4626 implementations:

```text
shares = assets * (totalSupply + virtualShares) / (totalAssets + virtualAssets)
```

with corresponding redemption math using the same virtual terms. For example,
OpenZeppelin-style ERC-4626 uses `virtualAssets = 1` and
`virtualShares = 10 ** decimalsOffset`, with extra share precision from
`decimalsOffset`.

This keeps the vault ERC-4626 compatible while making first-deposit donation
attacks uneconomic and preventing ordinary deposits from being rounded to zero
by a tiny initial share supply. Separately, `deposit` and `mint` paths should
revert when the computed result would mint zero shares for nonzero assets, so
the failure mode is an explicit revert rather than silent asset loss.
