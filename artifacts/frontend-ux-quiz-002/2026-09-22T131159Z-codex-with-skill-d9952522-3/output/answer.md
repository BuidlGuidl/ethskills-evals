# USDC Deposit Unit Math

`parseEther("250")` means "250 with 18 decimals":

```ts
parseEther("250") = 250 * 10^18
                  = 250_000_000_000_000_000_000n
```

So the contract was asked to move this `uint256`:

```text
250000000000000000000
```

USDC uses 6 decimals, so the user intended:

```text
250 USDC = 250 * 10^6
         = 250_000_000
```

The parsed amount was too large by:

```text
(250 * 10^18) / (250 * 10^6)
= 10^12
= 1_000_000_000_000x
```

A 400 USDC holder has only:

```text
400 * 10^6 = 400_000_000
```

but the transaction asked for:

```text
250_000_000_000_000_000_000
```

That is why the token transfer reverted with `transfer amount exceeds balance`. The teammate is wrong: viem handles the units you ask it to handle, and `parseEther` always applies 18 decimals.

The deposit form must convert using the token's decimals:

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

If the token may vary, read `decimals()` from the token contract and pass that value to `parseUnits`.

The balance and position display side must use the same token decimals in reverse:

```ts
import { formatUnits } from "viem";

const displayBalance = formatUnits(rawUsdcBalance, usdcDecimals);
const displayPosition = formatUnits(rawUsdcPosition, usdcDecimals);
```

For a raw position of `250_000_000`, `formatUnits(250_000_000n, 6)` renders `250`, so a 250 USDC position does not become `0.00000000025`, `250000000`, or any other wrong amount.
