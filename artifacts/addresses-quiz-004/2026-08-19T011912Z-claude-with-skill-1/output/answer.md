# Why the VELO dashboard reads 0

## Answer

`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05` is the **legacy Velodrome v1 VELO**
token. It is still deployed on Optimism, still answers `symbol()` with `"VELO"`,
and still holds a totalSupply — but the desk's emissions, LP rewards and locks
have been on the **Velodrome v2 VELO** token since the v1→v2 migration. The v1
contract holds no balance for your accounts, so every read comes back 0 without
reverting.

Use instead, on Optimism (chain 10):

```
VELO (Velodrome v2) = 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db
```

Related v2 addresses, for when the dashboard also wants to price the locked
position:

```
VotingEscrow (veNFT) = 0xFAf8FD17D9840595845582fCB047DF13f006787d
Voter                = 0x41C914ee0c7E1A5edCD0295623e6dC557B5aBf3C
Minter               = 0x6dc9E1C04eE59ed3531d73a72256C0da46D10982
```

## Reasoning

The symptom is the classic tell for a superseded deployment: right ABI, right
chain, call succeeds, `symbol()` matches — and the state read returns 0. A wrong
address usually does not revert. `symbol()` returning `"VELO"` proves the
contract is *a* VELO; it does not prove it is the *current* one.

Everything checked below is `cast` against Optimism mainnet
(`https://mainnet.optimism.io`), at head block ~155,751,814.

### 1. Both contracts are live, and `name()` separates them

| | 0x3c8B65…a11a05 | 0x9560e8…1088Db |
|---|---|---|
| `symbol()` | `"VELO"` | `"VELO"` |
| `name()` | `"Velodrome"` | `"VelodromeV2"` |
| `decimals()` | 18 | 18 |
| `totalSupply()` | 1.9919e27 | 2.5753e27 |
| code | present (4187 B hex) | present (9883 B hex) |

Identical symbol, identical decimals. Only `name()` distinguishes them — which
is why a `symbol()` sanity check passed and told you nothing.

### 2. The current protocol contracts point at 0x9560e8…, not at 0x3c8B65…

```
Voter (v2)   .ve()    -> 0xFAf8FD17D9840595845582fCB047DF13f006787d
VotingEscrow .token() -> 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db
Minter       .velo()  -> 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db
```

The contract that mints emissions and the escrow that issues veNFTs both
denominate in `0x9560e8…`. Nothing current references `0x3c8B65…`.

### 3. The locked VELO physically sits in the v2 token

Locked positions are held by the VotingEscrow, so its balances settle it:

```
balanceOf(VotingEscrow) on 0x3c8B65… (v1) = 0
balanceOf(VotingEscrow) on 0x9560e8… (v2) = 1.2951e27   (~50% of v2 supply)
```

This is the same shape as your multisig: the explorer shows it holding VELO and
a locked position, because the explorer is showing the v2 token and the v2
veNFT. Your `readContract` is asking v1, which knows nothing about either.

### 4. v1 is effectively dormant; v2 carries the traffic

`Transfer` events in the last 300 blocks (~10 minutes):

```
0x3c8B65…a11a05 (v1)    0 transfers
0x9560e8…1088Db (v2) 4084 transfers
```

Over a 5,000-block window v1 managed 119 transfers, while v2 returned more log
data than the RPC would serve in one response. The live token is unambiguous.

### Why "nothing in our code changed" is consistent with this

Nothing had to change. The v1→v2 migration happened on-chain: emissions,
rewards and locks moved to a new token contract, and the desk's VELO position
moved with them. A hardcoded address does not follow a migration — it keeps
pointing at a contract that is still deployed, still answers, and is now empty
for you. The break is silent by construction, which is why it surfaced as a
dashboard reading 0 rather than as an error.

## Before this goes near real funds

Whoever deploys this should re-verify on the target chain — I checked at one
block on one RPC:

```bash
RPC=<optimism rpc>
cast call 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db "name()(string)"   --rpc-url $RPC  # "VelodromeV2"
cast call 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db "symbol()(string)" --rpc-url $RPC  # "VELO"
cast call <treasury multisig> ...                                                        # nonzero balance
```

Two further notes for the dashboard:

- **Do not reuse this address on another chain.** Velodrome v2 is Optimism-only;
  the sibling deployment on Base is Aerodrome (`AERO`), a different token at a
  different address. Same codebase is not the same address.
- **The locked position is not in `balanceOf`.** veVELO is an NFT held by the
  multisig; the underlying VELO sits in the VotingEscrow. If the dashboard is
  meant to show total exposure, it needs `balanceOf` on the token *plus* the
  escrow's locked amount for the multisig's veNFTs — otherwise it will still
  under-report once the token address is fixed.
