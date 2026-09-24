# USDC deposit revert: the units are wrong

## What the contract was asked to move

`parseEther(x)` means `x × 10^18`. It always assumes 18 decimals, because that's what ETH uses. It never looks at the token.

```
parseEther("250") = 250 × 10^18
                  = 250_000_000_000_000_000_000   (uint256 sent as `amount`)
```

## What the user meant

USDC has **6 decimals**. So 1 USDC = 10^6 base units (the smallest whole unit the contract counts in).

```
250 USDC = 250 × 10^6 = 250_000_000               (intended uint256)
```

User's balance: `400 × 10^6 = 400_000_000`.

## The factor

```
250 × 10^18 / 250 × 10^6 = 10^12   (one trillion)
```

In USDC terms the contract was told to pull
`250_000_000_000_000_000_000 / 10^6 = 250_000_000_000_000 USDC`, which is **250 trillion USDC**.
The balance is `400_000_000` base units, so `250e18 > 400e6` and the token's `transferFrom` reverts with "transfer amount exceeds balance".

**The teammate is wrong.** viem converts units only when you tell it the decimals. `parseEther` hardcodes 18. With USDC the amount is off by 10^12.

## Correct conversion for the form

Use `parseUnits` with the token's actual decimals. Read the decimals from the token contract instead of assuming them, because "USDC" isn't 6 decimals everywhere (Binance-Peg USDC on BNB Chain, for example, uses 18):

```ts
import { parseUnits } from "viem";
import { useReadContract, useWriteContract } from "wagmi";
import { erc20Abi } from "viem";

const { data: decimals } = useReadContract({
  address: usdcAddress,
  abi: erc20Abi,
  functionName: "decimals",
}); // 6 for USDC on Ethereum mainnet

// in the handler; don't allow submit until decimals is loaded
const amount = parseUnits(depositInput, decimals!); // "250" -> 250_000_000n
writeContract({ ...vaultConfig, functionName: "deposit", args: [amount] });
```

Check: `parseUnits("250", 6) = 250 × 10^6 = 250_000_000n` ✓. That's at most 400_000_000, so no revert.

Other rules for the form:
- Any `approve` call must use the same `parseUnits(input, decimals)` value. Don't use `parseEther` there either.
- `parseUnits` throws on bad input, such as more than 6 decimal places (`"1.0000001"`) or an empty string. Validate the input first and show a clear message instead of crashing.
- Compare `amount` with the onchain balance (raw bigint against raw bigint) before submitting, and disable the button with a reason if it's too large.

## Balance display

Use `formatUnits(rawBalance, decimals)` with **the same decimals value** from the token. Never show the raw bigint, and never use `formatEther`:

```ts
import { formatUnits } from "viem";

const { data: raw } = useReadContract({
  address: usdcAddress, abi: erc20Abi,
  functionName: "balanceOf", args: [userAddress],
});

const display = formatUnits(raw!, decimals!); // 250_000_000n, 6 -> "250"
```

Why each wrong choice fails for a 250 USDC position (raw `250_000_000`):

| method | math | shows |
|---|---|---|
| raw bigint | none | `250000000` (10^6 too big) |
| `formatEther(raw)` | 250_000_000 / 10^18 | `0.00000000025` (10^12 too small) |
| **`formatUnits(raw, 6)`** | 250_000_000 / 10^6 | **`250`** ✓ |

Rule: one `decimals` value, read from the token contract, feeds both `parseUnits` (input → uint256) and `formatUnits` (uint256 → display). That way the input side and the display side always match. Don't use `parseEther`/`formatEther` for any token except ETH or a token you've confirmed has 18 decimals.
