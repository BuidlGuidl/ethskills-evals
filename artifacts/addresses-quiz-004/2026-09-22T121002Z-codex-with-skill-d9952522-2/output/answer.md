The dashboard is reading the old Velodrome v1 token.

`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05` is a real contract on Optimism and
it still returns `symbol() == "VELO"`, so the call succeeds. But that address is
the VELO listed in the archived Velodrome v1 contracts repo. Velodrome v2
launched a new VELO token, also with symbol `VELO`, and v1/v2 continue to exist
in parallel. A symbol check therefore cannot distinguish the stale v1 ERC-20
from the current token the Velodrome app and explorer pages are showing.

The current Velodrome v2 deployment list names the Optimism VELO token as:

`0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db`

That is the address the dashboard should read for liquid VELO balances. If the
dashboard also wants to report locked VELO, that is represented through the v2
VotingEscrow / veNFT position rather than by `balanceOf(treasury)` on the ERC-20.

Checks performed:

- Optimism RPC: both the v1 token and v2 token have bytecode and both return
  `symbol() == "VELO"`.
- Velodrome v1 repo lists `0x3c8B650257cFb5f272f799F5e2b4e65093a11a05` as
  `Velo`.
- Velodrome v2 repo lists `0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db` as
  `VELO`, with v2 `VotingEscrow` at
  `0xFAf8FD17D9840595845582fCB047DF13f006787d`.
