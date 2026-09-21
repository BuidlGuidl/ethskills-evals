# Why the dashboard reads 0 VELO

## Short answer

`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05` is the **old Velodrome V1 VELO token**. Velodrome V2 (June 2023) launched a **new VELO token**. V1 VELO was migrated 1:1 into it, and V1 emissions stopped. Everything the desk earns now, and the locked veNFT, is in V2 VELO. So the V1 contract gives 0 for your accounts.

**Read this address instead (VELO v2, Optimism):**

```
0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db
```

## Reasoning

1. **The call works and `symbol()` returns "VELO".** So the address is a real ERC-20 on the right chain. The problem is not the RPC or the ABI. Both the V1 and V2 tokens are named "VELO", so the symbol check can't tell them apart.
2. **Every account reads 0, including one the explorer shows holding VELO.** This happens when the dashboard reads a different contract than the one the explorer shows. On the explorer, the multisig's VELO holding links to token `0x9560e8…88Db`, not `0x3c8B65…1a05`.
3. **Nothing in our code changed.** The protocol changed, not our code. V2 moved to a new token plus new contracts:
   - V1 VELO (`0x3c8B…1a05`): legacy. Holders were migrated out through the sink/converter. It gets no new emissions.
   - V2 VELO (`0x9560…88Db`): current token. LP gauge rewards are paid in it.
   - V2 VotingEscrow / veVELO NFT: `0xFAf8FD17D9840595845582fCB047DF13f006787d`
4. **The "locked position" is not an ERC-20 balance in any case.** Locked VELO sits in the VotingEscrow contract as a veNFT. `VELO.balanceOf(multisig)` only counts liquid VELO, even on the correct token. To track locked VELO, read the VotingEscrow:
   - `balanceOf(owner)` returns the number of veNFTs owned
   - `ownerToNFTokenIdList(owner, i)` returns the token IDs
   - `locked(tokenId)` returns `(amount, end, isPermanent)`, which is the locked VELO amount
   - `balanceOfNFT(tokenId)` returns voting power, which decays unless the lock is permanent

## Fix

```ts
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db"; // Velodrome V2 VELO
const VE_VELO = "0xFAf8FD17D9840595845582fCB047DF13f006787d"; // V2 VotingEscrow (veNFT)

const liquid = await publicClient.readContract({
  address: VELO, abi: erc20Abi, functionName: "balanceOf", args: [treasury],
});
// locked: count veNFTs → token IDs → locked(tokenId).amount, then sum
```

Check it: after the change, the multisig's liquid VELO should match the explorer's token page for `0x9560…88Db`. Liquid VELO plus the summed `locked().amount` should give the full position.
