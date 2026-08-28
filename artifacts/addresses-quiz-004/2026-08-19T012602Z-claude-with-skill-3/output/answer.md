# Why the VELO balance reads 0

**Diagnosis:** the address in the dashboard is the *Velodrome V1* VELO token. The desk's
liquidity is on Velodrome V2, whose emissions pay a **different VELO token contract**.
Both contracts are live on Optimism, both answer `symbol() == "VELO"`, and neither call
reverts — so nothing in the code fails. The reads are simply against a superseded
deployment that the treasury has no position in.

**Use this address instead:**

```
VELO (Velodrome V2, Optimism)  0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db
```

```js
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db"; // VelodromeV2, OP mainnet
```

---

## Reasoning

The symptom is the textbook signature of a stale deployment rather than a broken call:
a state read that returns `0` **without reverting**. Right ABI, right chain, wrong
generation of the contract. A reverting call means the address has no code or no such
function; a silent zero means you asked a real contract a valid question about an account
it has genuinely never seen. The explorer disagrees because it is showing the token the
account actually holds, not the one the dashboard is asking about.

`symbol()` returning `"VELO"` is not evidence the address is current. Velodrome kept the
ticker across the V1→V2 migration, so the one check that felt reassuring is exactly the
check that cannot distinguish the two.

### On-chain verification (Optimism mainnet, `https://mainnet.optimism.io`)

Both addresses hold code and both identify as VELO — `name()` is what separates them:

| | `0x3c8B65…a11a05` (in the dashboard) | `0x9560e8…31088Db` (correct) |
|---|---|---|
| code | present (4,187 B) | present (9,883 B) |
| `symbol()` | `"VELO"` | `"VELO"` |
| `name()` | `"Velodrome"` | `"VelodromeV2"` |
| `decimals()` | 18 | 18 |
| `totalSupply()` | 1.9919e27 | 2.5753e27 |

```bash
cast call 0x3c8B650257cFb5f272f799F5e2b4e65093a11a05 "name()(string)" --rpc-url https://mainnet.optimism.io
# "Velodrome"
cast call 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db "name()(string)" --rpc-url https://mainnet.optimism.io
# "VelodromeV2"
```

### The locked position pins it down

The multisig's locked VELO is a veNFT in a `VotingEscrow`. Each escrow declares the token
it escrows, and the two generations point at different tokens:

```bash
cast call 0xFAf8FD17D9840595845582fCB047DF13f006787d "token()(address)"   # V2 escrow
# 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db
cast call 0x9c7305eb78a432ced5C4D14Cac27E8Ed569A2e26 "token()(address)"   # V1 escrow
# 0x3c8B650257cFb5f272f799F5e2b4e65093a11a05
```

And the same account, read through each token, gives the whole story in one line —
the V2 escrow custodies 1.295e27 VELO of the V2 token and exactly zero of the V1 token:

```
account                                      via V2 token    via V1 token
0xFAf8FD17…631088Db  VotingEscrow (V2)       1.2951e27       0
0x9D4736EC…C21EA99b  RewardsDistributor      5.8577e24       0
0x41C914ee…B5aBf3C   Voter                   4.1778e23       0
```

Every live V2 system contract shows the identical pattern the dashboard shows for the
treasury: a real balance on `0x9560e8…`, a silent `0` on `0x3c8B65…`. The dashboard is not
misreading the treasury; it is correctly reporting that the treasury holds none of a token
it was never paid in.

### Settled against the protocol's own deployment list

`velodrome-finance/contracts` → `deployment-addresses/optimism.json`:

```json
{
  "VELO":         "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db",
  "VotingEscrow": "0xFAf8FD17D9840595845582fCB047DF13f006787d",
  "Voter":        "0x41C914ee0c7E1A5edCD0295623e6dC557B5aBf3C",
  "Router":       "0xa062aE8A9c5e11aaA026fc2670B0D65cCc8B2858",
  "Minter":       "0x6dc9E1C04eE59ed3531d73a72256C0da46D10982",
  "PoolFactory":  "0xF1046053aa5682b4F9a81b5481394DA16BE5FF5a"
}
```

That listed `Minter` matches what the V2 token reports on-chain (`minter()` →
`0x6dc9E1C0…46D10982`), while `0x3c8B65…` reports the V1 minter
(`0x3460Dc71…053a4102d`). The repo's list and the chain agree on which deployment is
current.

### Why "nothing in our code changed" is consistent with this

Nothing had to change. The migration happened on-chain, at the protocol. A hardcoded
address quietly stops describing reality the moment the protocol it names is superseded —
the constant keeps compiling, the call keeps succeeding, and the number keeps being wrong.
If the dashboard ever showed a correct non-zero figure, it did so before the desk's
position moved to V2; if it never did, the address was stale from the day it was written.

---

## What to change

```js
// Velodrome V2 — Optimism mainnet
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db";
```

Two follow-ups worth doing while you are in there:

1. **The locked position is not in `balanceOf`.** Liquid VELO and escrowed VELO are
   separate reads. For the veNFT, query the V2 `VotingEscrow` at
   `0xFAf8FD17D9840595845582fCB047DF13f006787d` (`balanceOf(owner)` for NFT count,
   `tokenOfOwnerByIndex` → `locked(tokenId)` for the underlying VELO amount). Reading only
   `balanceOf` on the token will still under-report the desk's true VELO exposure even
   after the address fix.

2. **Legacy V1 VELO may still be sitting somewhere.** The V1 escrow still holds ~1.737e27
   of the V1 token, so unmigrated positions do exist. Check the treasury and multisig
   against `0x3c8B65…` once to confirm there is nothing stranded there, then drop the
   address.

Re-check both addresses against the deployment list above and an Optimism explorer before
this touches anything that moves funds — these were verified on 2026-08-19 against
Optimism mainnet, and a dated table is a pointer, not a guarantee.
