The hook did not fail at the RPC layer. `useScaffoldReadContract` is a thin wrapper around wagmi's `useReadContract`, but before it can call `balanceOf` it first looks up the contract by `contractName`.

In Scaffold-ETH 2 that lookup comes from the merged contract registry:

- `packages/nextjs/contracts/deployedContracts.ts`
- `packages/nextjs/contracts/externalContracts.ts`

If `"USDC"` is not registered for the selected chain, `useDeployedContractInfo({ contractName: "USDC" })` returns `undefined`. Then `useScaffoldReadContract` passes `address: deployedContract?.address` and `abi: deployedContract?.abi` into wagmi. With no address or ABI, wagmi has no valid read to execute, so `data` remains `undefined`. That is why the page saw a blank balance, no revert, and no failed request in the network tab: the call was never a real `eth_call`.

The teammate's change worked because pasting USDC into `packages/nextjs/contracts/deployedContracts.ts` temporarily made `"USDC"` visible to the Scaffold-ETH hooks. But that file is generated from the local hardhat deployment artifacts when `yarn deploy` runs. It is for contracts the app deployed through the Scaffold-ETH hardhat package. Manual edits there are not durable. On the next deploy, Scaffold-ETH regenerated `deployedContracts.ts` from the actual deployment output, and since Base USDC is an already-existing external token, not one of this repo's deployed contracts, the pasted entry disappeared.

The correct place is:

```ts
// packages/nextjs/contracts/externalContracts.ts
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

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
          name: "symbol",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "", type: "string" }],
        },
      ],
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
```

`8453` is Base mainnet, and `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is native USDC on Base. Once this lives in `externalContracts.ts`, the same hook call can keep using `contractName: "USDC"`, and future `yarn deploy` runs will not erase it.
