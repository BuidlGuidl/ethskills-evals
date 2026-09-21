# Why the VELO dashboard reads 0

## Short answer

`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05` is the **Velodrome V1** VELO token. It has been deprecated since Velodrome moved to V2 (mid-2023). The desk's rewards are now paid in **V2 VELO**, a different contract:

```ts
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db"; // Velodrome V2 VELO, Optimism
```

## Reasoning

1. **None of the symptoms point to a code or RPC bug.**
   - The call works and `symbol()` returns `"VELO"`, so there is a real ERC-20 at that address on Optimism.
   - `balanceOf` returns 0 for every tracked account, not just some. That fits "right chain, right function, wrong token contract". A data bug would give errors or random-looking values instead.

2. **Two different tokens are both called "VELO".**
   Velodrome V2 launched a new token, a new VotingEscrow, a new Voter and new gauges, and moved holders from V1 to V2. The V1 contract is still on-chain and still answers `symbol() = "VELO"`. But no rewards are paid in it anymore, and holders who migrated have no V1 balance left. Checking the symbol can't tell the two apart. Only the address can.

3. **Why the explorer disagrees.**
   The explorer's token list for the multisig shows the V2 VELO contract (`0x9560…88Db`). The "locked position" it shows is a veVELO NFT in the V2 VotingEscrow (`0xFAf8FD17D9840595845582fCB047DF13f006787d`). The dashboard is asking the old V1 contract, where these accounts hold nothing. The explorer and the dashboard are looking at two different tokens.

4. **"Nothing in our code changed."**
   True, and that is the cause. The address was hardcoded while V1 was current. The protocol moved to V2 and the code never followed.

## Fix

```ts
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db"; // Velodrome V2
const balance = await publicClient.readContract({
  address: VELO,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [treasury],
});
```

## Extra notes

- **Locked VELO won't appear in `balanceOf`.** VELO locked as veVELO sits inside the VotingEscrow contract, not in the multisig's wallet. To report it, read the VotingEscrow at `0xFAf8FD17D9840595845582fCB047DF13f006787d`:
  - `balanceOf(owner)` gives the number of veNFTs the account owns.
  - `ownerToNFTokenIdList(owner, i)` (or the enumerable equivalent) gives each NFT's token id.
  - `locked(tokenId)` gives the locked amount; `balanceOfNFT(tokenId)` gives the voting power, which shrinks over time.
- **Unclaimed rewards are also not in `balanceOf`.** LP rewards waiting in gauges only reach the wallet once they are claimed. Read `earned(account)` on each gauge to include them.
- **Check it on-chain before shipping:** `cast call 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db "balanceOf(address)(uint256)" <multisig> --rpc-url <optimism-rpc>`. The result should match the explorer's liquid VELO figure.
