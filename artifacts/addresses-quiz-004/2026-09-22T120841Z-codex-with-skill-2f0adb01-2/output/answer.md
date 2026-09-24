The dashboard is reading the old Velodrome V1 token:

```ts
0x3c8B650257cFb5f272f799F5e2b4e65093a11a05
```

That address is still a real ERC-20 on Optimism and its `symbol()` still returns
`VELO`, so the RPC call and ABI are not failing. The problem is that it is not the
current Velodrome token. Velodrome migrated to V2, and current emissions,
liquidity rewards, and VELO balances shown by explorers are for the V2 token.
Reading `balanceOf` on the deprecated V1 contract will therefore return zero for
accounts that only hold or earn the current V2 VELO.

The address to read for liquid VELO on Optimism is:

```ts
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db";
```

One extra caveat: a locked VELO position is represented through Velodrome's V2
voting-escrow contract, not as liquid ERC-20 balance in the wallet. So the
dashboard should use the V2 VELO token above for liquid balances, and query the
V2 voting-escrow position separately if it wants to include locked VELO.
