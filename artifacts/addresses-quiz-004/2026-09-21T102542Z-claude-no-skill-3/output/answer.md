# Why the VELO dashboard reads 0

## Short answer

`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05` is the **old Velodrome V1 VELO** token. Velodrome moved to V2 in June 2023. V2 came with a **new VELO token**, and all rewards, liquidity, and locks now use that new token. The treasury holds the V2 token, so reading the V1 contract returns 0.

**Read this address instead (VELO V2, Optimism):**

```
0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db
```

## Reasoning

1. **The call succeeds and `symbol()` returns "VELO".** That only tells you the contract is a real ERC-20 named VELO. The V1 token still exists on Optimism with the same symbol. Nothing on-chain marks it as outdated, so the call never fails. It just returns the correct balance of a token your accounts no longer hold.
2. **"Nothing in our code changed."** That's right, and it's the reason for the bug: the protocol changed around your hardcoded address. During the V2 migration, V1 VELO was swapped 1:1 for V2 VELO, and V1 emissions stopped. LP rewards from V2 gauges are paid in V2 VELO. Any address that earned VELO after the migration (or swapped over) has 0 V1 VELO.
3. **The explorer shows VELO, but your code does not.** Explorers list every token an address holds. The multisig's "VELO" holding there is the `0x9560…88Db` contract. Clicking the token in the explorer shows that address, not `0x3c8B…1a05`.
4. **The explorer shows a "locked position", which `balanceOf` will never include, even on the right token.** Locked VELO is a veNFT (an NFT that represents the lock) in Velodrome's VotingEscrow contract. The VELO tokens themselves sit in the VotingEscrow contract, not in the multisig. So `VELO.balanceOf(treasury)` only returns **liquid** VELO. To include locked VELO:
   - V2 VotingEscrow: `0xFAf8FD17D9840595845582fCB047DF13f006787d`
   - Get the treasury's veNFT ids: `balanceOf(treasury)` + `ownerToNFTokenIdList(treasury, i)`
   - For each id, read `locked(tokenId)` to get the locked VELO amount. (`balanceOfNFT(tokenId)` gives voting power, which drops over time for non-permanent locks, so don't use it as the token amount.)
   - Unclaimed LP rewards (`gauge.earned(treasury)`) and unclaimed rebases (a rebase is the extra VELO paid to lockers) are also not in `balanceOf`. Add them if the dashboard should show everything earned.

## Fix

```ts
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db"; // Velodrome V2 VELO (Optimism)
const liquid = await publicClient.readContract({
  address: VELO,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [treasury],
});
// plus locked VELO from VotingEscrow 0xFAf8FD17D9840595845582fCB047DF13f006787d
```

Check this before switching: open the multisig's token list on Optimistic Etherscan and make sure the VELO entry links to `0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db`.
