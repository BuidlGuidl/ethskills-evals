# Why `useScaffoldReadContract({ contractName: "USDC" })` rendered nothing

## 1. Why the hook returned `undefined` and never threw

`useScaffoldReadContract` is not a thin wrapper around a contract call. It first
*resolves* `contractName` against the contract registry that Scaffold-ETH 2
assembles for the currently targeted chain — the merge of
`packages/nextjs/contracts/deployedContracts.ts` and
`packages/nextjs/contracts/externalContracts.ts`, keyed by chain id. Only once it
has an `{ address, abi }` pair does it hand the call down to wagmi's
`useReadContract`.

`"USDC"` was not in that registry, so:

- the lookup produced no `address` and no `abi`;
- with no address/abi, the hook passes `enabled: false` (via wagmi's `query`
  options) down to `useReadContract`, so wagmi **never issues an eth_call**;
- a disabled wagmi query is not an error state — it is simply idle. `data` is
  `undefined`, `error` is `null`, `isError` is `false`.

That is the whole explanation for the three symptoms you saw:

| Symptom | Cause |
| --- | --- |
| `usdcBalance` stayed `undefined` | query disabled, so no data ever arrives |
| no runtime error anywhere | unregistered contract is a *soft* miss, not a throw |
| no failed request in the network tab | there was no request at all, failed or otherwise |

The page destructured only `data`, which hid even the weak signal that exists.
Scaffold's contract hooks are typed off the registry, so an unregistered name is
normally caught at build time by `yarn next:check-types` — but `deployedContracts.ts`
being hand-edited (see below) is exactly what made the name type-check while
being absent at runtime after a regeneration. If you want a runtime tripwire in
the page itself, read `error`/`isLoading` too, or assert on
`useDeployedContractInfo` returning a contract before rendering.

**Debugging rule of thumb:** for a scaffold read hook, "undefined with no network
activity" means *registration*, not RPC, not ABI encoding, not the wallet.

## 2. Why the teammate's fix self-destructed on `yarn deploy`

`packages/nextjs/contracts/deployedContracts.ts` is a **generated artifact**. The
hardhat deploy pipeline (the `generateTsAbis` post-deploy script that
`yarn deploy` runs) reads `packages/hardhat/deployments/**` and *overwrites the
whole file* from those deployment JSONs. It does not merge, and it does not
preserve unknown keys.

USDC on Base is not something your project deploys, so there is no
`packages/hardhat/deployments/base/USDC.json` for the generator to emit. The
hand-pasted entry therefore existed only until the next write of that file. It
"worked all week" purely because nobody deployed during that week; `yarn deploy`
was the first regeneration, and it dropped the entry, putting the page straight
back into the silent-`undefined` state from §1.

Anything you hand-add to `deployedContracts.ts` is on a timer that expires at the
next deploy. Treat the file as read-only — ideally leave it in its generated state
and never touch it by hand.

## 3. The correct registration

Third-party / pre-existing contracts (tokens, protocols, anything you did not
deploy from `packages/hardhat`) go in
**`packages/nextjs/contracts/externalContracts.ts`**. That file is hand-authored,
is never regenerated, and is merged with the deployed contracts into the same
registry — so `contractName: "USDC"` resolves identically, with full type
inference and autocomplete on `functionName` and `args`.

```typescript
// packages/nextjs/contracts/externalContracts.ts
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * Contracts we don't deploy ourselves. Keyed by chain id.
 */
const externalContracts = {
  8453: {
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      abi: [
        {
          type: "function",
          name: "balanceOf",
          stateMutability: "view",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
        },
        {
          type: "function",
          name: "decimals",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "", type: "uint8" }],
        },
        {
          type: "function",
          name: "allowance",
          stateMutability: "view",
          inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
          ],
          outputs: [{ name: "", type: "uint256" }],
        },
        {
          type: "function",
          name: "approve",
          stateMutability: "nonpayable",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
        },
        {
          type: "function",
          name: "transfer",
          stateMutability: "nonpayable",
          inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
        },
      ],
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
```

Notes on the entry:

- **`8453`** is Base mainnet. The key must match the chain id in
  `targetNetworks` in `packages/nextjs/scaffold.config.ts` — if the app is
  pointed at Base Sepolia (`84532`) instead, register USDC under that id with the
  testnet address (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`); a mainnet-only
  entry is the same silent `undefined` on a testnet target. Both keys can coexist.
- **`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`** is native Circle USDC on Base.
  Do not confuse it with bridged USDbC (`0xd9aA...D22Ca`), a different token with a
  different balance.
- The ABI can be trimmed to the functions you call — it only needs to cover the
  reads and writes the frontend uses. `as const` is what gives you the typed
  `functionName`/`args`, so don't drop it or widen the ABI to `any`.
- Native USDC on Base is a proxy, so a block-explorer ABI fetch may hand you the
  *proxy's* ABI rather than the implementation's. Use the ERC-20 surface above (or
  the implementation ABI), not whatever the proxy page returns.

## 4. Finishing the cleanup

1. Add the entry above to `externalContracts.ts`.
2. Revert `deployedContracts.ts` to its generated state — either
   `git checkout -- packages/nextjs/contracts/deployedContracts.ts` if the
   generated version is committed, or re-run `yarn deploy` (it will regenerate
   cleanly, which is what already happened) and leave the file alone.
3. Run `yarn next:check-types`. With the contract registered, `"USDC"` and
   `"balanceOf"` type-check against the real ABI; a typo in either now fails the
   build instead of silently rendering nothing.
4. Reload `/payouts` and confirm an `eth_call` to
   `0x8335...2913` appears in the network tab. Format the result with
   `formatUnits(usdcBalance, 6)` — USDC is 6 decimals, not 18.

## One-line summary

The hook was silent because an unregistered `contractName` disables the query
rather than erroring; the fix evaporated because `deployedContracts.ts` is
regenerated from `packages/hardhat/deployments` on every `yarn deploy`; the
durable home for a contract you didn't deploy is
`packages/nextjs/contracts/externalContracts.ts`, keyed by chain id `8453` for
USDC on Base.
