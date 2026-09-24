The hook was not failing on Base; it had no contract metadata to call.

`useScaffoldReadContract` does not take an address or ABI directly. It looks up `contractName` in Scaffold-ETH's contract registry for the selected chain, which is built from:

- `packages/nextjs/contracts/deployedContracts.ts`
- `packages/nextjs/contracts/externalContracts.ts`

When `USDC` was not registered for Base, `useDeployedContractInfo({ contractName: "USDC" })` could not find a contract entry, so the read hook ended up passing no real `address`/`abi` into wagmi's `useReadContract`. Wagmi/React Query treats that as an idle/incomplete query, not as a reverted contract call or failed HTTP request. So `data` stayed `undefined`, no RPC call was made, the Network tab showed no failed request, and no runtime exception appeared.

The teammate's fix worked only because pasting `USDC` into `packages/nextjs/contracts/deployedContracts.ts` temporarily put the metadata where the hook could find it. But that file is generated output. In the Hardhat flavor, `yarn deploy` regenerates `deployedContracts.ts` from the Hardhat deployment artifacts. Since USDC is an already-deployed external token, not a contract deployed by this repo, the generator did not know about it and overwrote the manual edit. The `USDC` entry disappeared by design.

The durable fix is to register USDC as an external contract in:

```ts
packages/nextjs/contracts/externalContracts.ts
```

For Base mainnet, chain ID `8453`, native USDC is:

```ts
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

After that, the existing page code is the right shape:

```ts
const { data: usdcBalance } = useScaffoldReadContract({
  contractName: "USDC",
  functionName: "balanceOf",
  args: [connectedAddress],
});
```

`deployedContracts.ts` is for contracts this app deploys. `externalContracts.ts` is for contracts that already exist on a network, such as USDC, Uniswap, Aave, and other protocol/token contracts.
