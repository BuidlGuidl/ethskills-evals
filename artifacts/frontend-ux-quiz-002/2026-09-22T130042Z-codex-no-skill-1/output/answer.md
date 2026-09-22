# USDC deposit unit check

`parseEther("250")` means "250 units with 18 decimal places":

```text
250 * 10^18
= 250,000,000,000,000,000,000
```

So the contract was asked to move this `uint256`:

```text
250000000000000000000
```

But USDC has 6 decimals. A user intending to deposit `250 USDC` means:

```text
250 * 10^6
= 250,000,000
```

So the intended raw `uint256` was:

```text
250000000
```

The factor between the submitted value and the intended value is:

```text
250,000,000,000,000,000,000 / 250,000,000
= 10^12
= 1,000,000,000,000
```

The transaction tried to transfer one trillion times too much USDC. For a wallet holding `400 USDC`, the raw balance is only:

```text
400 * 10^6
= 400,000,000
```

So `250000000000000000000` correctly exceeds the user's USDC balance.

## Correct conversion

For a USDC deposit form, use `parseUnits` with the token's decimals:

```ts
import { parseUnits } from "viem";

const usdcDecimals = 6;
const amount = parseUnits(depositInput, usdcDecimals);

writeContract({
  ...vaultConfig,
  functionName: "deposit",
  args: [amount],
});
```

If the token can vary, read the ERC-20 `decimals()` value and pass that instead of hard-coding `6`.

## Correct display

The balance and position display must use the matching inverse conversion:

```ts
import { formatUnits } from "viem";

const displayAmount = formatUnits(rawUsdcAmount, 6);
```

That way a raw value of `250000000` always renders as `250` USDC, not as an ETH-style 18-decimal amount.
