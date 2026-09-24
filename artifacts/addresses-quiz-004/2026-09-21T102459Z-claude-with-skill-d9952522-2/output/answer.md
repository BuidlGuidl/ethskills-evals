# Why the dashboard reads 0 for VELO

## Short answer

`0x3c8B650257cFb5f272f799F5e2b4e65093a11a05` is the **Velodrome V1 VELO token**. It's an old contract that has been replaced. Velodrome V2 launched in mid-2023 with a **new VELO token**, and holders migrated to it. The desk's rewards are paid in the new token, and the locked position (veVELO) is backed by it too.

**Read this address instead:**

    const VELO = "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db"; // Velodrome V2 VELO, Optimism

## Reasoning

- **Nothing reverts, so nothing looks broken.** The V1 contract is still live on Optimism. It still has code, still answers `symbol()` with "VELO", and still answers `balanceOf`. So a successful call with the right symbol, on the right chain, with the right ABI proves only that *a* VELO contract exists at that address. It doesn't prove it's the *current* one.
- **Always 0, even for a wallet that clearly holds VELO.** This is the classic sign of reading a replaced deployment. The multisig holds V2 VELO, which is a separate contract with its own balances. Its balance on the V1 contract is 0 because it never held V1 tokens or already migrated them.
- **The explorer shows the new token.** A block explorer lists every token a wallet holds, so it shows the V2 VELO balance. Both tokens carry the "VELO" ticker, so they're easy to mix up.
- **"Nothing in our code changed" fits.** The code didn't change, but the protocol moved to a new token. The hardcoded address was probably copied from an old tutorial, token list, or config.

## On-chain checks (Optimism, `https://mainnet.optimism.io`)

| Check | Result |
|---|---|
| `symbol()` at `0x9560…88Db` | `"VELO"` |
| `totalSupply()` at `0x3c8B…1a05` (V1) | ~2.00e9 VELO: supply frozen after migration |
| `totalSupply()` at `0x9560…88Db` (V2) | ~2.62e9 VELO: still growing from weekly emissions (new tokens paid out as rewards) |
| `token()` on V2 VotingEscrow `0xFAf8FD17D9840595845582fCB047DF13f006787d` | `0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db` |

The last row settles it. The contract that holds locked veVELO positions says its underlying token is `0x9560…88Db`. That is the token the desk's locks and rewards are in.

## Also worth fixing

- **Locked VELO won't show in `balanceOf`, even at the correct address.** Tokens locked as veVELO sit in the VotingEscrow contract, not in the multisig's wallet. To report them, read the lock from VotingEscrow `0xFAf8FD17D9840595845582fCB047DF13f006787d`: find the multisig's lock NFTs, then read `locked(tokenId)` for each.
- **Unclaimed rewards aren't in the wallet yet.** VELO earned but not yet claimed from gauges (the contracts that pay out LP rewards) stays in the gauge until claimed. Read it with `earned(...)` on each gauge.
- **Check the address yourself before relying on it.** Confirm it against Velodrome's official contract list (docs, or the `velodrome-finance/contracts` repo). Dashboard reads carry low risk, but do this before any flow that moves funds uses the address.
