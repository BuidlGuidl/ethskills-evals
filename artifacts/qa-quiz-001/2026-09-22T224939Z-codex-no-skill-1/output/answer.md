The hook was not failing at the RPC layer; it never had a real contract to call.

`useScaffoldReadContract` does not take a raw address and ABI. It resolves
`contractName: "USDC"` through Scaffold-ETH's contract registry, which is built
from `packages/nextjs/contracts/deployedContracts.ts` plus
`packages/nextjs/contracts/externalContracts.ts`. When `USDC` was not registered
for the active chain, `useDeployedContractInfo` returned `data: undefined`.
Then `useScaffoldReadContract` passed `undefined` for the address/ABI into the
wagmi read hook, so there was no valid `eth_call` to send. The observable result
was just `data === undefined`: no revert, no failed network request, and no
obvious runtime exception.

The pasted fix worked only because it accidentally put `USDC` into the registry
that the hook reads. But it was pasted into the wrong half of the registry.
`packages/nextjs/contracts/deployedContracts.ts` is generated from the app's own
Hardhat deployments. In the hardhat flavor, `yarn deploy` regenerates that file
from `packages/hardhat/deployments`, so any hand-written entry for an external
token is overwritten the next time contracts are deployed. USDC is not one of
this app's deployed contracts, so the generator quite correctly removed it.

Register USDC as an external contract instead, in:

```ts
// packages/nextjs/contracts/externalContracts.ts
import { erc20Abi } from "viem";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const externalContracts = {
  8453: {
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      abi: erc20Abi,
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
```

`8453` is Base mainnet, and `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is the
native USDC contract on Base. After that, `contractName: "USDC"` resolves through
Scaffold-ETH's normal merged contract map and survives future `yarn deploy` runs.
