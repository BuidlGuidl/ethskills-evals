The dashboard is reading the old Velodrome V1 VELO token, not the current
Velodrome V2 VELO token.

The address in the snippet:

```ts
0x3c8B650257cFb5f272f799F5e2b4e65093a11a05
```

is a real ERC-20 contract on Optimism and `symbol()` returns `VELO`, so the
call does not revert and a symbol check looks fine. That address is listed in
Velodrome's archived V1 contracts repo as `Velo`:

https://github.com/velodrome-finance/v1#contracts

But Velodrome migrated to V2. The current Velodrome contracts repo lists the
V2 `VELO` deployment on Optimism as:

```ts
0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db
```

Source:

https://github.com/velodrome-finance/contracts#deployment

That explains the mismatch. The block explorer is showing the account's
current VELO / veVELO position, while the dashboard is asking the obsolete V1
VELO contract for `balanceOf(treasury)`. For accounts that migrated, earned,
or locked V2 VELO, the old V1 ERC-20 balance can correctly be zero.

The dashboard should read:

```ts
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db";
```

Also, `symbol() === "VELO"` is not enough to identify the right token here:
both the old and current contracts answer `VELO` on Optimism. The check needs
to be against Velodrome's current deployment list, chain, and contract address.
