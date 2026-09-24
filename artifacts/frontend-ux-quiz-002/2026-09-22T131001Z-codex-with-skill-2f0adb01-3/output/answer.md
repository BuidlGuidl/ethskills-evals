# USDC Deposit Unit Mismatch

The teammate is not right: `viem` handles unit conversion, but only for the unit you ask it to use.

`parseEther("250")` means 250 units with 18 decimals:

```text
250 * 10^18 = 250,000,000,000,000,000,000
```

So the contract was asked to move this exact `uint256`:

```text
250000000000000000000
```

USDC has 6 decimals, so the user intended 250 USDC:

```text
250 * 10^6 = 250,000,000
```

The submitted amount was too large by:

```text
(250 * 10^18) / (250 * 10^6)
= 10^12
= 1,000,000,000,000
```

So the transaction asked for one trillion times the intended USDC base-unit amount, which explains `transfer amount exceeds balance`.

The deposit form must convert with USDC decimals:

```ts
import { parseUnits } from "viem";

const amount = parseUnits(depositInput, 6);
writeContract({ ...vaultConfig, functionName: "deposit", args: [amount] });
```

If the token is configurable, read and use the token's ERC-20 `decimals()` value instead of hardcoding `6`.

The balance and position display side must use the same token decimals in reverse:

```ts
import { formatUnits } from "viem";

const displayBalance = formatUnits(usdcBalance, 6);
const displayPosition = formatUnits(usdcPosition, 6);
```

A 250 USDC position is stored as `250000000` base units and must be rendered with `formatUnits(value, 6)`, never `formatEther(value)`, so it displays as `250` USDC and not any 18-decimal interpretation.
