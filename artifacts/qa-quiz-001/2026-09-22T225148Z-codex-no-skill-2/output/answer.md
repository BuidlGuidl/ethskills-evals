The page was asking Scaffold-ETH for a contract named `USDC`, but `useScaffoldReadContract` does not discover arbitrary on-chain contracts by name. It looks up `USDC` in Scaffold-ETH's contract registry, which is built by merging:

- `packages/nextjs/contracts/deployedContracts.ts`
- `packages/nextjs/contracts/externalContracts.ts`

When `USDC` was not registered, `useDeployedContractInfo` could not return contract info for that name. Then `useScaffoldReadContract` passed `undefined` for the contract `address` and `abi` into wagmi's read hook. That leaves `data` as `undefined`; it is not a reverted `balanceOf` call, so there is no failed RPC request to see. Unless the component explicitly renders `error` / `isError` from the hook, the failure mode can look like "nothing happened".

The teammate's fix worked only because putting `USDC` into `deployedContracts.ts` temporarily made the Scaffold-ETH lookup succeed. But that file is generated output. In the hardhat flavor, `yarn deploy` regenerates `packages/nextjs/contracts/deployedContracts.ts` from the contracts deployed by the local Hardhat deployment scripts. Since Circle's USDC on Base was not deployed by this app, the generator had no reason to preserve that hand-written entry, so the next deploy overwrote it.

The correct place for USDC is `packages/nextjs/contracts/externalContracts.ts`, because USDC is an already-deployed external contract. For Base mainnet, chain id `8453`, the native Circle USDC address is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

The registration can be as small as the ABI your app needs:

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

After that, `useScaffoldReadContract({ contractName: "USDC", functionName: "balanceOf", args: [connectedAddress] })` has a real address and ABI to call on Base, and future `yarn deploy` runs will not delete the USDC registration.
