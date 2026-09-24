# Incident explanation

0xB2 lost their USDC because the vault used the vault's live token balance as
the denominator when pricing new shares, and integer division rounded the share
result down to zero.

USDC has 6 decimals, so the sequence in base units was:

- 0xA1 deposited `1` unit, meaning `0.000001 USDC`.
- Because the vault was empty, 0xA1 received `1` share.
- 0xA1 then transferred `20,000 USDC` directly to the vault, which is
  `20,000,000,000` USDC base units.
- The vault now held `20,000,000,001` units while the share supply was still
  only `1`.

When 0xB2 deposited `15,000 USDC`, that was `15,000,000,000` base units. With
the vault's minting formula:

```text
shares = assets * totalShares / vaultUSDCBalance
```

the share calculation was approximately:

```text
shares = 15,000,000,000 * 1 / 20,000,000,001
shares = 0.7499999999625...
```

Solidity integer division rounds down, so the result became:

```text
shares = 0
```

The deposit still succeeded because the contract did not reject a nonzero asset
deposit that mints zero shares. 0xB2's USDC was transferred into the vault, but
no shares were minted to them. After that transfer, the vault held
`35,000.000001 USDC` and the share supply was still `1`, entirely owned by
0xA1. When 0xA1 redeemed that single share, it represented 100% of the share
supply, so 0xA1 received the whole vault balance.

# Bug or depositor mistake?

This is a bug in the vault design, not a mistake by 0xB2.

0xA1 performed an inflation attack, also called a donation attack. They seeded
the vault with one dust share, donated assets directly to the vault to make each
share extremely expensive, and waited for a later depositor's share calculation
to round down to zero. The later depositor used the public deposit path and the
transaction succeeded; the vault should not accept nonzero assets while minting
zero shares.

The plain ERC-20 transfer is also why the attack works: token balances can be
sent to the vault without calling the vault contract. A vault cannot stop USDC
from being transferred to its address, so the accounting and conversion logic
must be robust to unsolicited donations.

# Fix

Ship an ERC-4626-compatible inflation-attack defense.

The immediate invariant should be:

```text
depositing a nonzero amount must not mint zero shares
```

So `deposit` and any internal deposit path should revert when `assets > 0` and
the computed `shares == 0`. That prevents this exact loss mode.

However, the stronger ERC-4626-compatible fix is to change the conversion math
to use virtual assets and virtual shares, as used by hardened ERC-4626
implementations:

```text
shares = assets * (totalSupply + virtualShares) / (totalAssets + virtualAssets)
assets = shares * (totalAssets + virtualAssets) / (totalSupply + virtualShares)
```

Use a large enough virtual share offset, especially for a 6-decimal asset like
USDC, so early deposits cannot be rounded to zero by a small seed deposit plus a
direct donation. This keeps the vault ERC-4626 compatible because ERC-4626
allows the vault to define its share/asset conversion math, and conversions may
round down. The important part is that the chosen math must not let donations
turn ordinary deposits into zero-share donations to existing shareholders.

In practice, I would ship both:

- virtual assets/shares with an appropriate decimals offset to make the
  inflation attack uneconomic; and
- an explicit revert if a nonzero `deposit` would mint zero shares.

That preserves ERC-4626 behavior while ensuring a depositor cannot transfer
assets into the vault and receive no claim on them.
