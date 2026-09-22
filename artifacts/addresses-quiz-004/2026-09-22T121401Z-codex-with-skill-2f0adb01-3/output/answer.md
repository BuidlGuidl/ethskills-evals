The dashboard is reading the deprecated V1 VELO token:

`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05`

That call succeeds because the old Optimism contract still exists and still reports
`symbol() == "VELO"`. The symbol check is therefore a false comfort: Velodrome V2
issued a new `$VELO` ERC-20, convertible 1:1 from V1, and the old token was
captured/locked while the new token took over protocol emissions. Accounts earning
current Velodrome LP emissions will hold the V2 token, so `balanceOf` on the V1
contract can correctly return zero even when the explorer shows a VELO balance.

The dashboard should read the Optimism Velodrome V2 VELO token instead:

`0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db`

Supporting checks:

- Velodrome's own V2 contracts deployment table lists `VELO` at
  `0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db`:
  https://github.com/velodrome-finance/contracts/blob/main/README.md
- Velodrome docs say V2 launched with a new `$VELO` token, convertible 1:1 with
  V1, and that the new token took over emissions:
  https://velodrome.finance/docs
- OP Mainnet Etherscan indexes the replacement as `VelodromeV2 (VELO)`:
  https://optimistic.etherscan.io/token/0x9560e827af36c94d2ac33a39bce1fe78631088db
