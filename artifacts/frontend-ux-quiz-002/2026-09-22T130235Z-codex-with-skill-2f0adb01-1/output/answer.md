# USDC Deposit Unit Bug

`parseEther("250")` means "250 with 18 decimals":

```text
250 * 10^18 = 250,000,000,000,000,000,000
```

So the contract was asked to move this `uint256`:

```text
250000000000000000000
```

USDC uses 6 decimals, so the user intended:

```text
250 * 10^6 = 250,000,000
```

The intended `uint256` was:

```text
250000000
```

The bad value divided by the correct USDC value:

```text
250,000,000,000,000,000,000 / 250,000,000
= 10^18 / 10^6
= 10^12
= 1,000,000,000,000
```

The transaction tried to deposit one trillion times more base units than intended. Interpreted as USDC base units, that is:

```text
250,000,000,000,000,000,000 / 10^6
= 250,000,000,000,000 USDC
```

That explains why a user with `400 USDC` saw `transfer amount exceeds balance`.

The form must parse with the token's decimals:

```ts
import { parseUnits } from "viem";

const usdcDecimals = 6;
const amount = parseUnits(depositInput, usdcDecimals); // "250" -> 250000000n

writeContract({
  ...vaultConfig,
  functionName: "deposit",
  args: [amount],
});
```

The balance and position display side must use the same token decimals in the opposite direction:

```ts
import { formatUnits } from "viem";

const displayAmount = formatUnits(rawUsdcBalance, usdcDecimals);
// 250000000n -> "250"
```

For USDC, never use `parseEther` or `formatEther`; those are 18-decimal ETH-style helpers. Use `parseUnits(value, 6)` and `formatUnits(value, 6)`, or read `decimals()` from the token and use that value consistently.
