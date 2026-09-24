The dashboard is reading the old Velodrome V1 token, not the current VELO token.

The address in the code,

```ts
0x3c8B650257cFb5f272f799F5e2b4e65093a11a05
```

is a real Optimism contract and still returns `symbol() == "VELO"`, so the
`balanceOf` call succeeds. That only proves the address is an ERC-20 named VELO;
it does not prove it is the current Velodrome deployment.

Velodrome's archived V1 contracts repo lists `Velo` at that address:

https://github.com/velodrome-finance/v1

The current Velodrome contracts repo is the V2 deployment list and names `VELO`
as:

```ts
0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db
```

https://github.com/velodrome-finance/contracts/blob/main/README.md

Velodrome's own docs also explain the migration: V2 issued a new `$VELO` token
convertible 1-to-1 with the V1 token, and both versions/tokens operate in
parallel. That is exactly the failure mode here: the explorer is showing the
current V2 VELO balance/lock, while the dashboard is asking the V1 token
contract for `balanceOf(treasury)`, so it gets zero.

I also checked Optimism directly:

```text
old token  0x3c8B650257cFb5f272f799F5e2b4e65093a11a05: symbol = VELO, name = Velodrome
new token  0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db: symbol = VELO, name = VelodromeV2
```

The dashboard should read:

```ts
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db";
```
