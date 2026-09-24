# Why the dashboard reads 0 VELO

## Answer

The dashboard is reading the **old, deprecated Velodrome V1 VELO token**:

    0x3c8B650257cFb5f272f799F5e2b4e65093a11a05   // VELO V1 (deprecated)

It should read the **Velodrome V2 VELO token**:

    0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db   // VELO V2 (current)

```ts
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db";
```

## Reasoning

1. **Why the call "works".** The V1 contract still exists on Optimism. It's a normal
   ERC-20: `balanceOf` works and `symbol()` still returns `"VELO"`. So the RPC and
   chain are fine, and the symbol check tells you nothing. Two different contracts
   both call themselves "VELO".

2. **Why every balance is 0.** When Velodrome moved to V2 (mid-2023), it launched a
   new VELO token at a new address. V1 holders swapped their old VELO for V2 through a
   one-way swap contract. All emissions since then (the gauge rewards the desk earns
   for providing liquidity) are paid in **V2** VELO. No new V1 VELO has been paid
   out since, and the treasury's holdings are in the V2 token. So `balanceOf` on V1
   returns 0 for everyone we track.

3. **Why the explorer disagrees.** The explorer's token view for the multisig lists
   holdings of the V2 VELO contract (`0x9560…88Db`). The "locked position" is a veVELO
   NFT in the V2 VotingEscrow (`0xFAf8FD17D9840595845582fCB047DF13f006787d`), and it
   locks V2 VELO. Nothing in the V1 contract relates to either.

4. **"Nothing in our code changed."** That's the problem. The address was hardcoded
   back when V1 was current. The protocol moved to a new token and the code never
   followed.

## Also worth fixing

- **Locked VELO isn't in `balanceOf` of the token at all.** Once VELO is locked, the
  VotingEscrow holds it, and the multisig owns a veNFT. Even with the right token
  address, `balanceOf(multisig)` only shows *liquid* VELO. To track the lock, read the
  V2 VotingEscrow (`0xFAf8…787d`): list the NFTs the multisig owns, then read each
  one's `locked(tokenId)` amount (or `balanceOfNFT(tokenId)` for voting power).
- **Unclaimed gauge rewards** sit in the gauge contracts until claimed (`earned(account)`
  on each gauge). They won't appear in either balance.
- **Don't treat `symbol()` as proof of identity.** Pin token addresses in config, check
  them against the protocol's official deployment list
  (github.com/velodrome-finance/contracts), and add a sanity alert when a known-nonzero
  account reads 0.

Source for addresses: the verified-addresses reference (Velodrome V2 on Optimism),
which lists `0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db` as VELO (V2) and marks
`0x3c8B…1a05` as the deprecated V1 token.
