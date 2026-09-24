The dashboard is reading the old Velodrome V1 VELO token:

`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05`

That contract still exists on Optimism and still reports `symbol() == "VELO"`, so
the RPC call succeeds and looks superficially correct. But it is the V1 token
address from Velodrome's archived V1 deployment. Velodrome V2 issued a new VELO
token, convertible 1:1 from the V1 token, and the V2 token took over the same
economic role and emissions schedule. A wallet that has only V2 VELO, or VELO
locked through the V2 voting escrow, will correctly show `0` when asked for its
balance on the old V1 ERC20 contract.

The explorer is showing the current Velodrome V2 token / veVELO state, while the
dashboard is querying the deprecated V1 ERC20. The contract address alone is the
bug; `symbol()` is not enough to disambiguate tokens across migrations.

It should read VELO from the V2 token address on Optimism:

`0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db`

Cross-checks:

- Velodrome V1 repo lists `Velo` as
  `0x3c8B650257cFb5f272f799F5e2b4e65093a11a05`.
- Velodrome V2 contracts list `VELO` as
  `0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db`.
- Velodrome docs describe the V2 migration as issuing a new `$VELO` token
  convertible 1:1 with the V1 token, with the old token captured/locked and the
  new token taking over emissions.
