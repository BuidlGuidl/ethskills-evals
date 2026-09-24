The teammate is not right: `parseEther` handles ether-style 18 decimal units, not arbitrary token units.

USDC uses 6 decimals.

The handler did this:

```ts
parseEther("250")
```

That produces:

```text
250 * 10^18 = 250000000000000000000
```

So the contract was asked to move this `uint256`:

```text
250000000000000000000
```

The user intended 250 USDC, which should be represented in USDC base units as:

```text
250 * 10^6 = 250000000
```

The factor between the sent value and the intended value is:

```text
(250 * 10^18) / (250 * 10^6)
= 10^12
= 1000000000000
```

So the transaction asked for one trillion times too many USDC base units. A wallet with 400 USDC has:

```text
400 * 10^6 = 400000000
```

That is far less than:

```text
250000000000000000000
```

Correct deposit conversion:

```ts
import { parseUnits } from "viem";

const amount = parseUnits(depositInput, 6);
writeContract({ ...vaultConfig, functionName: "deposit", args: [amount] });
```

Or, better, use the token's actual `decimals()` value instead of hard-coding `6` if the form can support multiple assets.

The balance display must use the matching inverse conversion:

```ts
import { formatUnits } from "viem";

const displayBalance = formatUnits(balance, 6);
```

That way a 250 USDC position stored as `250000000` base units renders as:

```text
formatUnits(250000000n, 6) = "250"
```
