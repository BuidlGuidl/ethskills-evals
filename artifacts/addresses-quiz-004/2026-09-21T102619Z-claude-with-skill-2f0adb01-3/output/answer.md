# Why the VELO dashboard reads 0

## Short answer

`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05` is the **Velodrome V1 VELO token**, which is no longer used.
Velodrome V2 launched a **new VELO token at a new address**. All emissions, LP rewards and locks since then are in V2 VELO. The dashboard is reading the old token's ledger, so it gets 0 for every account.

**Read this instead (Optimism, VELO V2):**

```ts
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db";
```

## Reasoning

1. **The call works, so the RPC, ABI and chain are fine.** A wrong chain or an address with no contract would revert or return empty data. It wouldn't return a clean `0`.
2. **`symbol()` returning "VELO" doesn't prove it's the right token.** V1 and V2 both call themselves "VELO". The symbol can't tell you which version you're reading. Only the address can.
3. **The V1 address is deprecated.** In the verified address list, `0x3c8B…1a05` is flagged as the old V1 VELO, and `0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db` is the current VELO (V2) on Optimism.
4. **Why the balance is 0 for everyone.** With V2, Velodrome sent all emissions (LP gauge rewards, rebases) to the new token, and V1 holders were moved over to V2. A desk earning VELO from LPing today receives V2 VELO. The treasury has nothing on the V1 contract, so `balanceOf` correctly returns 0 there.
5. **Why the block explorer shows a balance.** The explorer lists *all* tokens a wallet holds and picks up the V2 VELO contract. Your code asks only the V1 contract. Same name, different contract.
6. **"Nothing in our code changed."** True, but the protocol changed underneath it. A hard-coded token address stays pointed at the old contract after a protocol migration.

## Second gap: the locked position

The locked position the explorer shows is **veVELO**. It's an NFT held in the Velodrome V2 VotingEscrow (`0xFAf8FD17D9840595845582fCB047DF13f006787d`). Locked VELO sits in that contract, **not** in the wallet. So even with the right token address, `VELO.balanceOf(treasury)` gives only the *liquid* VELO. To include locked VELO:

- `VotingEscrow.balanceOf(treasury)` returns how many veNFTs the treasury owns.
- `ownerToNFTokenIdList(treasury, i)` returns each token id.
- `locked(tokenId)` returns the locked amount and end time. `balanceOfNFT(tokenId)` returns voting power, which drops over time, so it's not the principal.

Unclaimed LP rewards stay in the gauges until claimed (`gauge.earned(treasury)`). Include them if the dashboard should show earned-but-unclaimed VELO.

## Fix

```ts
const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db"; // Velodrome V2 VELO, Optimism
```

Before deploying, check it on Optimistic Etherscan: the contract should hold the treasury's balance there.
