`parseEther` is the wrong conversion for USDC.

The handler did this:

```ts
const amount = parseEther("250");
```

`parseEther` converts using 18 decimals:

```text
250 * 10^18 = 250,000,000,000,000,000,000
```

So the contract was asked to move this exact `uint256`:

```text
250000000000000000000
```

But USDC uses 6 decimals, so the user's intended `250 USDC` amount is:

```text
250 * 10^6 = 250,000,000
```

The intended `uint256` was:

```text
250000000
```

The submitted value was too large by:

```text
250,000,000,000,000,000,000 / 250,000,000 = 1,000,000,000,000
```

That is a factor of:

```text
10^12
```

A wallet holding `400 USDC` has a raw token balance of:

```text
400 * 10^6 = 400,000,000
```

The transaction tried to transfer:

```text
250,000,000,000,000,000,000
```

which is far greater than:

```text
400,000,000
```

so the revert `transfer amount exceeds balance` is expected.

The correct deposit conversion is:

```ts
import { parseUnits } from "viem";

const amount = parseUnits(depositInput, 6);
writeContract({ ...vaultConfig, functionName: "deposit", args: [amount] });
```

Better yet, use the token's actual decimals instead of hard-coding when the form can support multiple assets:

```ts
const amount = parseUnits(depositInput, tokenDecimals);
```

The balance display must use the matching inverse conversion:

```ts
import { formatUnits } from "viem";

const displayBalance = formatUnits(rawUsdcBalance, 6);
```

or, for a dynamic asset:

```ts
const displayBalance = formatUnits(rawTokenBalance, tokenDecimals);
```

For USDC, a raw balance or position of:

```text
250000000
```

must be rendered as:

```text
250
```

because:

```text
250,000,000 / 10^6 = 250
```
