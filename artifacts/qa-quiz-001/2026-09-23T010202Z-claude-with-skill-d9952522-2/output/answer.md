# Why `useScaffoldReadContract` for USDC returned `undefined`, then broke on deploy

## 1. Why the hook failed silently

`useScaffoldReadContract` doesn't take an address and ABI — it takes a *name*
(`contractName: "USDC"`) and looks that name up in scaffold's contract registry,
which is the merge of:

- `packages/nextjs/contracts/deployedContracts.ts` — **generated** by `yarn deploy`
- `packages/nextjs/contracts/externalContracts.ts` — **hand-maintained**

both keyed by chain id. The lookup runs through `useDeployedContractInfo`, and
when the name isn't present for the connected chain the hook returns
`deployedContractData === undefined`. Scaffold then passes that through to
wagmi's `useReadContract` with the query disabled (`enabled: !!deployedContract`,
and `address`/`abi` undefined). wagmi will not fire a request for a read whose
address and ABI are missing — that's a guard, not an error path.

So all three symptoms follow from one cause:

- **`data` stays `undefined`** — the query never ran, so there's nothing to return.
- **No runtime error** — a missing registry entry is a disabled query, not a
  thrown exception. Nothing rejects, so no error boundary and no `onError`.
- **No failed request in the network tab** — there was no request at all. An
  unregistered contract produces *zero* RPC traffic, which is exactly why it
  looks like a rendering bug instead of a config bug.

The one place it does surface is a dev-mode console warning from
`useDeployedContractInfo` along the lines of *"contract USDC not found on chain
8453"* — easy to miss in a noisy dev console. Note also that the lookup is
per-chain: if the wallet is on a chain that isn't `targetNetworks[0]`, even a
correctly registered entry resolves to nothing.

Because `usdcBalance` is `undefined`, a render like `{usdcBalance?.toString()}`
or `{formatUnits(usdcBalance ?? 0n, 6)}` prints empty/zero rather than blowing
up — the failure is invisible all the way to the DOM.

## 2. Why the teammate's fix self-destructed

`deployedContracts.ts` is a **build artifact, not a source file**. In the hardhat
flavor, `yarn deploy` runs the hardhat-deploy scripts and then the
`generateTsAbis` script, which *rewrites the whole file* from
`packages/hardhat/deployments/` — the on-disk deployment JSON for contracts this
project actually deployed. The file even carries a header telling you not to
edit it.

USDC on Base is not deployed by this project, so it has no entry in
`packages/hardhat/deployments/base/`. The regeneration is a full overwrite, not a
merge, so the hand-pasted USDC block had nothing to survive on: the next
`yarn deploy` emitted a file containing only the project's own contracts and the
USDC entry was gone. It "worked all week" only because nobody deployed all week.

Anyone who re-pastes it is buying the same week-long fuse again — and worse, the
overwrite is silent and shows up in `git diff` as a legitimate-looking generated
change, so it tends to get committed without review.

## 3. The correct registration

External contracts — tokens, protocols, anything this repo did not deploy — go in
`packages/nextjs/contracts/externalContracts.ts`. That file is source, hand-maintained,
never touched by the generator, and scaffold merges it with `deployedContracts.ts`
so `contractName: "USDC"` resolves identically.

USDC on Base mainnet (chain id **8453**) is
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` — the native Circle USDC, 6 decimals,
not the bridged USDbC (`0xd9aA...`).

```typescript
// packages/nextjs/contracts/externalContracts.ts
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * @example
 * const externalContracts = {
 *   1: {
 *     DAI: { address: "0x...", abi: [...] },
 *   },
 * } as const;
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
        {
          type: "event",
          name: "Transfer",
          inputs: [
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "value", type: "uint256", indexed: false },
          ],
          anonymous: false,
        },
      ],
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
```

The ABI must be a literal in the file (`as const`), not imported JSON — that's
what gives `useScaffoldReadContract` its typed `functionName` and `args`. It only
needs the functions you call; the trimmed ERC-20 surface above is enough for a
payouts page. USDC on Base is a proxy, so if you paste a full ABI, take the
*implementation* ABI from the explorer's "Read as Proxy" tab, not the proxy's.

### Cleanup steps

1. Add the entry above to `externalContracts.ts`.
2. Revert `deployedContracts.ts` to its generated state — regenerate with
   `yarn deploy` (or `git checkout` the file), so nothing hand-edited remains.
3. Run `yarn next:check-types`. A typo in the contract name or a malformed ABI
   fails here rather than silently returning `undefined` at runtime.
4. Reload `/payouts` with a wallet on Base and confirm the balance renders and
   an `eth_call` appears in the network tab.

### The general rule

A scaffold hook that returns `undefined` with no error and no network request
means **the name isn't in the registry for the connected chain** — check
registration first, before the component. And anything under
`contracts/deployedContracts.ts` is generated: if a contract isn't deployed by
this repo's deploy scripts, its home is `externalContracts.ts`.
