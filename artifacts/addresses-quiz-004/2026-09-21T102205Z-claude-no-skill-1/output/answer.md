# Why the dashboard reads 0 VELO

## Short answer

`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05` is the **old Velodrome V1 VELO token**. Velodrome switched to V2 in June 2023 and launched a **new VELO token**. All current emissions, LP rewards and locks (veNFTs) use the V2 token.

Read this address instead (Velodrome V2 VELO, Optimism):

    const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db";

## Reasoning

1. **The call works and `symbol()` returns "VELO".** So the address is a real ERC-20 on Optimism and the RPC is fine. This doesn't show it's the *current* token, though. Both the V1 and V2 contracts report the symbol "VELO".
2. **Every tracked account shows 0, even the multisig the explorer shows holding VELO.** A result that is 0 for everyone points to the wrong contract, not to a problem with any one account. The token the explorer lists for that multisig is the V2 contract, `0x9560…88Db`, which is a different address.
3. **"Nothing in our code changed."** The protocol changed instead. In the V2 migration, V1 VELO was converted into V2 VELO through Velodrome's one-way converter (the "sink"). V1 emissions stopped, and V1 locks were moved to the new V2 VotingEscrow. Rewards the desk earns from LPing on current Velodrome pools are paid in V2 VELO. Any leftover V1 balances were converted or left dormant, so the V1 `balanceOf` gives 0 for these accounts.
4. **The "locked position" wouldn't appear in a token balance anyway.** Locked VELO is held by the VotingEscrow contract and represented as a veNFT. It never shows up in `balanceOf` on the VELO token, even on the right contract. Velodrome V2 VotingEscrow: `0xFAf8FD17D9840595845582fCB047DF13f006787d`. To report locked VELO:
   - list the multisig's veNFTs (`balanceOf(owner)` plus `ownerToNFTokenIdList(owner, i)` on the escrow)
   - read `locked(tokenId)` to get the amount (use `balanceOfNFT(tokenId)` for voting power)

## Fix

```ts
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db";          // Velodrome V2 VELO
const VOTING_ESCROW = "0xFAf8FD17D9840595845582fCB047DF13f006787d"; // veVELO (locks)
```

- Liquid VELO: `balanceOf(treasury)` on the V2 VELO address.
- Locked VELO: add up `locked(tokenId).amount` over the treasury's veNFTs on the VotingEscrow.
- Unclaimed LP/gauge rewards: these sit in the gauges until claimed (`earned(account)` on each gauge). They aren't in either balance.

Check against the explorer before shipping. The multisig's VELO holding should link to `0x9560…88Db`. Don't identify tokens by `symbol()`; pin them by address.
