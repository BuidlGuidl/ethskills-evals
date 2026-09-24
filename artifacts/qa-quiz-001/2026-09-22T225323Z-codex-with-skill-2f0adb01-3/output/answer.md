`useScaffoldReadContract` does not discover arbitrary onchain contracts from the
chain. In Scaffold-ETH 2 it resolves `contractName` through the frontend contract
registry, which is the merge of:

- `packages/nextjs/contracts/deployedContracts.ts`
- `packages/nextjs/contracts/externalContracts.ts`

So when the page asked for `contractName: "USDC"` but USDC was not registered for
the selected Base chain, the hook had no address or ABI to give wagmi. That leaves
the underlying read with nothing valid to call, so no RPC request is made, no
failed network request appears, and `data` stays `undefined`. It is a missing
frontend contract-registration problem, not a reverted `balanceOf` call.

The teammate's fix worked only because putting USDC into
`packages/nextjs/contracts/deployedContracts.ts` temporarily made the lookup
succeed. But that file is generated output in the hardhat Scaffold-ETH 2 flow.
`yarn deploy` rewrites it from the contracts actually deployed by the project.
USDC on Base is an already-deployed external token, not one of this app's deploy
artifacts, so the next deploy regenerated `deployedContracts.ts` and dropped the
manual USDC entry.

The durable fix is to register Base USDC in
`packages/nextjs/contracts/externalContracts.ts`:

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
          inputs: [{ name: "account", type: "address", internalType: "address" }],
          outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
        },
        {
          type: "function",
          name: "decimals",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
        },
        {
          type: "function",
          name: "symbol",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "", type: "string", internalType: "string" }],
        },
      ],
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
```

After that, `useScaffoldReadContract({ contractName: "USDC", ... })` resolves
USDC from the external registry. The entry survives future `yarn deploy` runs
because deploy regeneration only owns `deployedContracts.ts`.
