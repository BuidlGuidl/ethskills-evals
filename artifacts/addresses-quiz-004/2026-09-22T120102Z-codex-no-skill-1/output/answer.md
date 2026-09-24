The dashboard is reading the old Velodrome v1 token, not the current VELO token.

`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05` is a real ERC-20 on Optimism and it still returns `symbol() == "VELO"`, so the contract read succeeds and the symbol check is misleading. But it is the archived v1 Velodrome token. Velodrome v2 issued a replacement VELO token, and the live v2 contract list gives:

`VELO = 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db`

That also explains the explorer mismatch. The explorer is showing balances and locks for the current Velodrome v2 system. On-chain checks match this:

- Old token `0x3c8B...1a05`: `symbol()` is `VELO`, `name()` is `Velodrome`.
- Current token `0x9560...88Db`: `symbol()` is `VELO`, `name()` is `VelodromeV2`.
- Current v2 `VotingEscrow` at `0xFAf8FD17D9840595845582fCB047DF13f006787d` reports its underlying `token()` as `0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db`.
- The old v1 `VotingEscrow` at `0x9c7305eb78a432ced5C4D14Cac27E8Ed569A2e26` reports its underlying `token()` as `0x3c8B650257cFb5f272f799F5e2b4e65093a11a05`.

So the dashboard reads zero because the tracked accounts no longer hold the v1 VELO ERC-20. They hold current Velodrome v2 VELO and/or v2 veVELO positions.

Use this address instead:

`0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db`

References checked:

- Velodrome v2 contracts README deployment table: `VELO | 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db`
- Archived Velodrome v1 README contract table: `Velo | 0x3c8B650257cFb5f272f799F5e2b4e65093a11a05`
- Velodrome docs note that v2 issued a new VELO token convertible 1:1 with v1.
