# USDC deposit revert: "transfer amount exceeds balance"

## Verdict

The teammate is wrong. viem does not know which token you mean. `parseEther(x)` is just
`parseUnits(x, 18)`: it always scales by 10^18. USDC uses **6** decimals.

## Arithmetic

| | Formula | uint256 |
|---|---|---|
| Sent to contract | `parseEther("250")` = 250 × 10^18 | **250000000000000000000** |
| User meant | `parseUnits("250", 6)` = 250 × 10^6 | **250000000** |
| User's balance | 400 × 10^6 | 400000000 |

Factor: (250 × 10^18) / (250 × 10^6) = 10^(18−6) = **10^12** (one trillion).

The token read 250000000000000000000 base units as
250000000000000000000 / 10^6 = **250,000,000,000,000 USDC** (250 trillion). The user holds
400 USDC, so `transferFrom` fails the balance check → "transfer amount exceeds balance".
The revert blocked it. Nothing was lost. The code is still broken for every deposit amount.

## Fix: input side

Convert with the token's real decimals. Read them from the token contract instead of
assuming 18:

```ts
import { parseUnits } from "viem";
import { useReadContract, useWriteContract } from "wagmi";
import { erc20Abi } from "viem";

const { data: decimals } = useReadContract({
  address: usdcAddress,
  abi: erc20Abi,
  functionName: "decimals", // USDC → 6
});

function onDeposit() {
  if (decimals === undefined) return;          // not loaded yet: keep button disabled
  let amount: bigint;
  try {
    amount = parseUnits(depositInput.trim(), decimals); // "250" → 250000000n
  } catch {
    setError("Enter a valid amount (max 6 decimal places)");
    return;
  }
  if (amount <= 0n) return setError("Amount must be greater than 0");
  if (amount > usdcBalance) return setError("Amount exceeds your USDC balance");
  writeContract({ ...vaultConfig, functionName: "deposit", args: [amount] });
}
```

Use the same `amount` (the same decimals) for the `approve` call. Otherwise the allowance is
also off by 10^12.

## Fix: display side

Every value you show must go through `formatUnits(value, decimals)` with the **same token
decimals (6)**. Never use `formatEther`, and never render the raw bigint:

```ts
import { formatUnits } from "viem";
formatUnits(250000000n, 6); // "250"  ✅
```

What goes wrong otherwise:

- `formatEther(250000000n)` = 250000000 / 10^18 = `"0.00000000025"` ❌ (10^12 too small)
- `balance.toString()` = `"250000000"` ❌ (raw base units)

Other rules for the display side:
- Read `decimals` from the token once and pass it to both `parseUnits` and `formatUnits`.
  Do not hardcode 18 anywhere.
- If the position is held as vault **shares** (for example ERC-4626), shares can have
  different decimals. Convert with `convertToAssets(shares)` first, then call
  `formatUnits(assets, usdcDecimals)`. That way 250 USDC deposited always shows as `250 USDC`.
- Show a USD value next to it from a real price feed. Label it if the price is stale.
