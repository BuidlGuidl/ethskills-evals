# Why the dashboard reads 0 VELO

## Short answer

`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05` is the **old Velodrome V1 VELO token**. Velodrome V2 (mid-2023) launched a **new VELO token** at a new address, and V1 VELO was moved over to it (through a one-way converter called the "sink"). Emissions (the rewards paid to liquidity providers) have been paid in the V2 token since then. So the desk's VELO is in the V2 token, and the V1 contract correctly reports 0.

Read this instead (Optimism, chain 10):

```ts
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db"; // Velodrome V2 VELO
```

## Reasoning

1. **The symptoms match an old deployment, not a broken call.** The call doesn't fail, the ABI is correct, the chain is correct, and the result is 0 for *every* account, including one that clearly holds VELO. Wrong chain or wrong ABI would usually fail or return garbage. A result of 0 for everyone points to a real contract that nobody uses anymore.
2. **`symbol() == "VELO"` proves nothing.** Old contracts stay on-chain and keep answering `symbol()`. Both V1 and V2 return `"VELO"`. The name tells you the brand, not which version is current. Only the protocol's contract list tells you that.
3. **The explorer is showing a different contract.** When the explorer shows the multisig "holding VELO", it's listing the token the explorer tags as VELO, which is the V2 token. Our code queries V1. Same ticker, different contract.
4. **"Nothing in our code changed"** is exactly the problem: the address was hardcoded back in the V1 era, and the protocol moved on without it.

## Second issue: the locked position won't show up either

Changing the address fixes the **liquid** (unlocked) balance only. Locked VELO is held by the **VotingEscrow** contract as a veNFT (an NFT representing the lock), not by the multisig. So `VELO.balanceOf(multisig)` will never include it. To count it:

- V2 VotingEscrow: `0xFAf8FD17D9840595845582fCB047DF13f006787d`
- `balanceOf(multisig)` on it gives the number of veNFTs → `ownerToNFTokenIdList(multisig, i)` gives each token id → `locked(tokenId)` gives the locked VELO amount (or `balanceOfNFT(tokenId)` for the decaying voting power, which is not the same as the principal).

Also count unclaimed rewards (gauge `earned(account)`) if the dashboard should show everything the desk has earned.

## Verify before relying on it

I wrote these addresses from memory. Check them against Velodrome's official contract list (docs / `velodrome-finance/contracts` repo deployments) and Optimistic Etherscan before shipping:

```bash
RPC=<optimism rpc>
cast call 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db "symbol()(string)" --rpc-url $RPC
cast call 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db "balanceOf(address)(uint256)" <multisig> --rpc-url $RPC   # should be non-zero
cast call 0xFAf8FD17D9840595845582fCB047DF13f006787d "token()(address)" --rpc-url $RPC   # should return the V2 VELO address
```
