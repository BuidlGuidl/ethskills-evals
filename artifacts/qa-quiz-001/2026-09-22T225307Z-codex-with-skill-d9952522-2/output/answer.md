`useScaffoldReadContract` does not discover contracts on-chain from the
`contractName`. It looks up `USDC` in Scaffold-ETH's contract declarations for
the active chain, then passes the resolved `address` and `abi` to wagmi's read
hook.

When `USDC` was not registered for Base, that lookup produced no contract
metadata. The scaffold hook therefore had no address/ABI to call, so the wagmi
read was effectively disabled/not formed. That is why `data` stayed
`undefined`, there was no revert or JSON-RPC error to show, and the Network tab
did not show a failed request: no valid contract read was ever sent.

The teammate's patch worked only because they put the right data in a place the
hook reads from: `packages/nextjs/contracts/deployedContracts.ts`. But that file
is generated deployment output in the Hardhat flavor. `yarn deploy` rewrites it
from the project's own deployed contracts/artifacts. Since Base USDC is an
external token, not something this app deploys, the hand-pasted entry was
discarded the next time the generated file was rebuilt.

The persistent fix is to register USDC as an external contract:

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

`8453` is Base mainnet, and `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is the
Base USDC contract. After this, leave `deployedContracts.ts` generated-only; the
scaffold contract helpers will merge the deployed and external declarations and
`contractName: "USDC"` will continue to resolve after future deploys.
