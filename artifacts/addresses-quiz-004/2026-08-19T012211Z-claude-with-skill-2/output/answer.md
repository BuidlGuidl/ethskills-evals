# Why the VELO dashboard reads 0

## Answer

`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05` is the **Velodrome V1** VELO token —
a superseded deployment. It is still live on Optimism and still answers `symbol()`
with `"VELO"`, but essentially nobody holds a balance on it any more. Velodrome V2
(June 2023) shipped a **new ERC-20 at a new address**, and every current VELO
balance and every `veVELO` lock lives there.

Read this instead:

```
VELO (Velodrome V2, Optimism, chainId 10)
0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db
```

Nothing in the dashboard code changed because nothing in the dashboard code was
wrong — the token underneath it was replaced. The address was correct when it was
written down; it stopped being correct without anything failing.

## Why it fails silently

This is the classic superseded-deployment signature: **right ABI, right chain,
wrong (older) deployment.** A wrong address here does not revert. `balanceOf` on
an ERC-20 with no entry for your account is a perfectly valid call that returns
`0`, so the RPC succeeds, viem decodes cleanly, and the dashboard renders a
confident zero. `symbol()` returning `"VELO"` felt like confirmation, but the
symbol only ever told you *what the contract calls itself*, not *whether it is the
current deployment*. The V1 contract answers that question identically to the V2
one.

The block explorer disagrees because it indexes `Transfer` events from the token
the multisig actually holds, and it resolves the ticker "VELO" to the V2 address.
The locked position is the giveaway: `veVELO` locks are held in the V2
`VotingEscrow`, which can only escrow the V2 token.

## Verification on Optimism

Both contracts are live and both claim the ticker:

| | V1 `0x3c8B…1a05` | V2 `0x9560…88Db` |
|---|---|---|
| `symbol()` | `"VELO"` | `"VELO"` |
| `name()` | `"Velodrome"` | `"VelodromeV2"` |
| `totalSupply()` | 1.99e27 | 2.58e27 |
| deployed code | yes (4,187 B) | yes (9,883 B) |

`name()` is the only cheap read that distinguishes them, and only by accident.

### Reproducing the bug against a known holder

The V2 `VotingEscrow` (`0xFAf8FD17D9840595845582fCB047DF13f006787d`) holds all
escrowed VELO — exactly the "holds VELO and a locked position" case:

```
balanceOf(0xFAf8…787d) on V1  -> 0
balanceOf(0xFAf8…787d) on V2  -> 1295111587504026011224779651   (~1.295e27)
```

Same pattern for arbitrary accounts sampled from recent V2 `Transfer` logs — every
one reads 0 through the address the dashboard uses:

```
0xc8c7b5ae61d97be7d02d606629059487066dc9cf   v1=0   v2=170760823579598674277344
0x5e9cc770b8feb8800c156b009063cb4939e30caf   v1=0   v2=1241009827976652405919062
0xa75127121d28a9bf848f3b70e7eea26570aa7700   v1=0   v2=337965517278060510415107
```

Not one call reverted. That is the whole failure mode.

### Confirming V2 is the current deployment

Two independent sources agree.

**On-chain, the V2 system is self-consistent and points at `0x9560…88Db`:**

```
Minter (0x6dc9E1C0…0982).velo()   -> 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db
Minter.ve()                       -> 0xFAf8FD17D9840595845582fCB047DF13f006787d
Voter  (0x41C914ee…bf3C).ve()     -> 0xFAf8FD17D9840595845582fCB047DF13f006787d
VotingEscrow.token()              -> 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db
```

**The protocol's own deployment list** (`velodrome-finance/contracts`,
`deployment-addresses/optimism.json`) lists:

```json
{
  "VELO":         "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db",
  "VotingEscrow": "0xFAf8FD17D9840595845582fCB047DF13f006787d",
  "Voter":        "0x41C914ee0c7E1A5edCD0295623e6dC557B5aBf3C",
  "Minter":       "0x6dc9E1C04eE59ed3531d73a72256C0da46D10982",
  "Router":       "0xa062aE8A9c5e11aaA026fc2670B0D65cCc8B2858",
  "PoolFactory":  "0xF1046053aa5682b4F9a81b5481394DA16BE5FF5a"
}
```

The V1 address appears nowhere in it.

### What is left on V1

1.737e27 of V1's 1.99e27 supply — about 87% — sits in the **V1** `VotingEscrow`
at `0x9c7305eb78a432ced5C4D14Cac27E8Ed569A2e26`: abandoned V1 locks that were
never migrated. That is why a dead token still shows a nine-figure supply and
still looks plausible. Note that V1 `totalSupply` is even still creeping upward
(1.978e27 → 1.991e27 over the last ~2M blocks), because the old minter was never
switched off — so "the contract still has activity" is not evidence either.

## The fix

```ts
// Velodrome V2 VELO — Optimism (chainId 10)
// Supersedes V1 0x3c8B650257cFb5f272f799F5e2b4e65093a11a05, which still
// answers symbol() == "VELO" but returns 0 for every real holder.
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db";
```

Two follow-ups worth doing while you are in there:

- **The locked position is not in `balanceOf` at all.** If the desk's VELO is
  escrowed as `veVELO`, the treasury's wallet balance will be 0 or near-0 even
  with the correct token. Read the locks from the `VotingEscrow` at
  `0xFAf8FD17D9840595845582fCB047DF13f006787d` (`balanceOf` there is the NFT
  count; use `ownerToNFTokenIdList` / `tokenOfOwnerByIndex` then `locked(tokenId)`
  for the underlying amount) and report wallet + locked separately.
- **Add a startup assertion**, so the next silent supersession is loud. Pin
  something the V1 token cannot fake — `name() == "VelodromeV2"`, or better,
  assert `VotingEscrow.token() == VELO` — and fail the dashboard boot if it
  drifts. A zero balance should never be indistinguishable from a
  misconfiguration.

## Before real funds move

These addresses were checked against Optimism mainnet on 2026-08-18 and against
the protocol's deployment list on the same day. Anyone deploying this — or reusing
these addresses on another chain, where Velodrome's Superchain deployments and
Aerodrome on Base use **different** addresses — must re-verify `cast code` and
`cast call … symbol()` on the target chain first. A "VELO" that answers is not a
VELO that is current.
