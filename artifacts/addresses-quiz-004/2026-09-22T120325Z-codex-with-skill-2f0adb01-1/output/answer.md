The dashboard is reading the deprecated Velodrome V1 VELO token:

```ts
0x3c8B650257cFb5f272f799F5e2b4e65093a11a05
```

That contract still exists on Optimism and still returns `VELO` from
`symbol()`, so the RPC call succeeds and the metadata check looks plausible.
But it is not the active Velodrome token whose balances the explorer is
showing for current Velodrome positions/rewards.

Velodrome V2 uses a new VELO ERC-20 on Optimism:

```ts
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db";
```

So the dashboard reads `0` because it is querying the V1 VELO balance ledger,
where those treasuries do not hold tokens. The explorer is showing the active
V2 VELO token, plus any related locked Velodrome position. The fix is to read
`balanceOf` from `0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db` instead.
