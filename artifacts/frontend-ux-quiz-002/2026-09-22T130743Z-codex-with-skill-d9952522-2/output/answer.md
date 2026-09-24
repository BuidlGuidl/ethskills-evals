# USDC Deposit Unit Bug

`parseEther("250")` does not mean "250 of whatever token this form is using".
It means `parseUnits("250", 18)`.

Arithmetic:

```text
parseEther("250")
= 250 * 10^18
= 250,000,000,000,000,000,000
```

So the contract was asked to move this `uint256`:

```text
250000000000000000000
```

USDC has 6 decimals, so the user intended:

```text
250 USDC
= 250 * 10^6
= 250,000,000
```

The intended `uint256` was:

```text
250000000
```

Factor between the submitted amount and intended amount:

```text
250,000,000,000,000,000,000 / 250,000,000
= 10^12
= 1,000,000,000,000
```

The transaction asked USDC to transfer one trillion times too much. Interpreted
as a 6-decimal USDC amount, `250000000000000000000` base units is:

```text
250,000,000,000,000 USDC
```

A user holding 400 USDC has only:

```text
400 * 10^6 = 400,000,000
```

base units, so `transfer amount exceeds balance` is expected.

The teammate is not right: viem handles the units you explicitly ask it to use,
and `parseEther` always uses 18 decimals.

Correct deposit conversion:

```ts
import { parseUnits } from "viem";

const amount = parseUnits(depositInput, 6); // USDC decimals
writeContract({ ...vaultConfig, functionName: "deposit", args: [amount] });
```

Prefer using the token's actual `decimals()` value instead of hardcoding `6`
unless this form is permanently USDC-only.

Balance and position display must use the matching conversion in reverse:

```ts
import { formatUnits } from "viem";

const displayBalance = formatUnits(usdcBalance, 6);
const displayPosition = formatUnits(usdcPosition, 6);
```

That guarantees a raw 250 USDC position renders as:

```text
formatUnits(250000000n, 6) = "250"
```

and never as an ETH-style 18-decimal value.
