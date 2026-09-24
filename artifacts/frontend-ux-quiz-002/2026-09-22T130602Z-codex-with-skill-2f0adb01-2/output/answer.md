The teammate is not right: `parseEther` handles ether-style 18-decimal units, not arbitrary ERC-20 token decimals.

For `depositInput = "250"`:

```ts
parseEther("250") = 250 * 10^18
                  = 250000000000000000000
```

So the contract was asked to move this `uint256`:

```txt
250000000000000000000
```

USDC has 6 decimals, so the user intended:

```ts
parseUnits("250", 6) = 250 * 10^6
                     = 250000000
```

The factor between the submitted amount and the intended amount is:

```txt
250000000000000000000 / 250000000 = 1000000000000
```

That is `10^12` times too large.

Interpreted as USDC base units, the submitted value represents:

```txt
250000000000000000000 / 10^6 = 250000000000000 USDC
```

The user only had:

```txt
400 USDC = 400 * 10^6 = 400000000 base units
```

So the revert `transfer amount exceeds balance` is expected.

The deposit form must parse USDC with the token's decimals:

```ts
import { parseUnits } from "viem";

const amount = parseUnits(depositInput, 6);

writeContract({
  ...vaultConfig,
  functionName: "deposit",
  args: [amount],
});
```

If the app reads `decimals()` from the token contract, use that value instead of hardcoding `6`.

The balance and position display side must use the matching conversion in the other direction:

```ts
import { formatUnits } from "viem";

const displayBalance = formatUnits(usdcBalance, 6);
const displayPosition = formatUnits(usdcPosition, 6);
```

That guarantees a raw 250 USDC position:

```txt
250000000 base units / 10^6 = 250 USDC
```

renders as `250`, not as a 18-decimal ether-style value.
