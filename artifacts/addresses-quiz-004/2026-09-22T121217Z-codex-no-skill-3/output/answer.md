The dashboard is reading the deprecated Velodrome V1 token.

`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05` is a real ERC-20 on Optimism and it still returns `symbol() == "VELO"`, so the contract call can succeed while still asking the wrong token contract for balances. Velodrome migrated to V2 by issuing a new VELO token, convertible 1:1 from the V1 token. The old token and the new token both exist in parallel, which is why checking the symbol alone is not enough.

Velodrome's archived V1 contracts repo lists:

`Velo | 0x3c8B650257cFb5f272f799F5e2b4e65093a11a05`

Source: https://github.com/velodrome-finance/v1/blob/master/readme.md

Velodrome's current V2 contracts repo lists:

`VELO | 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db`

Source: https://github.com/velodrome-finance/contracts/blob/main/README.md

That explains the mismatch: the block explorer is showing the current Velodrome V2 VELO holdings/veVELO position, while the dashboard is calling `balanceOf` on the old V1 token. Accounts that migrated, earned V2 emissions, or hold V2 positions can therefore show `0` on the old V1 ERC-20 even though the explorer plainly shows VELO activity.

The ERC-20 address the dashboard should read for current VELO balances is:

`0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db`

One related caveat: a locked veVELO position is represented by the V2 `VotingEscrow` contract, not by the wallet's liquid ERC-20 `balanceOf`. So liquid VELO should be read from the V2 VELO token above; locked positions need separate veVELO/VotingEscrow accounting.
