# USDC Deposit Unit Math

The teammate is wrong: `viem` handles units only for the helper you choose. `parseEther` always parses as an 18-decimal ETH-style amount, but USDC uses 6 decimals.

Given:

```ts
const amount = parseEther("250");
```

`parseEther("250")` computes:

```text
250 * 10^18
= 250,000,000,000,000,000,000
```

So the contract was asked to move this exact `uint256`:

```text
250000000000000000000
```

For USDC, the user intended 250 USDC, and USDC has 6 decimals:

```text
250 * 10^6
= 250,000,000
```

So the intended `uint256` was:

```text
250000000
```

The factor between them is:

```text
250,000,000,000,000,000,000 / 250,000,000
= 10^12
= 1,000,000,000,000
```

The transaction tried to transfer one trillion times too much USDC. A wallet holding 400 USDC has a base-unit balance of:

```text
400 * 10^6 = 400,000,000
```

but the transaction requested:

```text
250,000,000,000,000,000,000
```

That is why the ERC-20 transfer reverted with `transfer amount exceeds balance`.

The correct deposit conversion for this form is:

```ts
import { parseUnits } from "viem";

const amount = parseUnits(depositInput, 6); // USDC decimals

writeContract({
  ...vaultConfig,
  functionName: "deposit",
  args: [amount],
});
```

The balance and position display side must use the inverse conversion with the same token decimals:

```ts
import { formatUnits } from "viem";

const displayBalance = formatUnits(usdcBalance, 6);
const displayPosition = formatUnits(usdcPosition, 6);
```

So a stored position of:

```text
250000000
```

renders as:

```text
250
```

and never as `0.00000000025`, `250000000`, or any other ETH-decimal/base-unit value.
