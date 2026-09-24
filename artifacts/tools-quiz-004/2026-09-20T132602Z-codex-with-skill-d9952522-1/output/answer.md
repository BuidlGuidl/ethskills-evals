# Fastest Path

Use Scaffold-ETH 2. It gives you one Solidity contract, Hardhat local chain, React/Next frontend, RainbowKit wallet connect, and typed wagmi/viem contract hooks wired to the deployed ABI.

I verified today, 2026-09-20, that `create-eth@latest` resolves on npm to `2.0.23`, and `npx create-eth@2.0.23 --help` works. I also generated a skipped-install app and confirmed these scripts exist: `yarn chain`, `yarn deploy`, and `yarn start`. The generated app declares Yarn `4.13.0`, and Corepack resolves that version inside the app.

```bash
corepack enable
npx create-eth@2.0.23 eth-week-demo --solidity-framework hardhat
cd eth-week-demo
```

Terminal 1:

```bash
yarn chain
```

Terminal 2:

```bash
cd eth-week-demo
yarn deploy
```

Terminal 3:

```bash
cd eth-week-demo
yarn start
```

Open:

```text
http://localhost:3000/debug
```

The default contract is at:

```text
packages/hardhat/contracts/YourContract.sol
```

The generated frontend already includes typed contract hooks:

```ts
import {
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";

const { data: greeting } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "greeting",
});

const { writeContractAsync } = useScaffoldWriteContract({
  contractName: "YourContract",
});

await writeContractAsync({
  functionName: "setGreeting",
  args: ["hello users"],
});
```

For this week, do not start from `create-eth-app` or `create-scaffold-eth`; use `create-eth`.
