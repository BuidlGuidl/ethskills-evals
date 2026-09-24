The hook did not fail at the RPC layer. It never had a real contract to call.

`useScaffoldReadContract` does not take an arbitrary address and ABI from the call site. It looks up `contractName` in Scaffold-ETH's contract registry, which is built from `packages/nextjs/contracts/deployedContracts.ts` plus `packages/nextjs/contracts/externalContracts.ts`. With `contractName: "USDC"` missing from that registry for Base, `useDeployedContractInfo` resolved to `undefined`. Then the read hook was invoked with no resolved `address` / `abi`, so wagmi had no valid `readContract` request to send. The result was just `data === undefined`: no revert, no failed HTTP request, and often no visible runtime error.

The teammate's change worked only because they temporarily put USDC into one half of that registry. But `packages/nextjs/contracts/deployedContracts.ts` is generated output in the hardhat Scaffold-ETH flow. It represents contracts deployed by your app's deploy scripts. When the team later ran `yarn deploy`, Scaffold-ETH regenerated that file from the current deployment artifacts, so the hand-pasted third-party USDC entry was overwritten. That file is not the place for contracts you did not deploy.

Base USDC belongs in:

```text
packages/nextjs/contracts/externalContracts.ts
```

For the Base mainnet USDC balance read, the entry can be a minimal ERC-20 ABI fragment like this:

```ts
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
      ],
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
```

After that, `contractName: "USDC"` resolves on chain ID `8453`, the hook has an address and ABI, and `balanceOf(connectedAddress)` can produce an actual onchain read instead of an inert `undefined`.
