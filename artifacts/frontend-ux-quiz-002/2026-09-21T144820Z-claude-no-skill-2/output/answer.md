# USDC deposit revert: `parseEther` on a 6-decimal token

## TL;DR
Teammate is wrong. viem does **not** know what token you're sending. `parseEther(x)` means
`parseUnits(x, 18)`, always. USDC has **6** decimals. So the contract was asked to move
10^12 times more than the user meant.

## What was sent

```
parseEther("250") = 250 × 10^18
                  = 250,000,000,000,000,000,000   (uint256 sent as `amount`)
```

## What the user meant

```
250 USDC = 250 × 10^6
         = 250,000,000                            (uint256 that should have been sent)
```

## Factor

```
(250 × 10^18) / (250 × 10^6) = 10^(18−6) = 10^12  (one trillion)
```

In USDC terms the tx asked to move:

```
250,000,000,000,000,000,000 / 10^6 = 250,000,000,000,000 USDC  (250 trillion USDC)
```

User balance on-chain: `400 × 10^6 = 400,000,000`.
`250,000,000,000,000,000,000 > 400,000,000` → USDC `transferFrom` reverts with
"transfer amount exceeds balance". Revert is correct behavior; the bug is in the frontend.

(Note: USDC's total supply is far below 250 trillion, so no USDC holder could ever succeed
with this code. The bug only "worked" in tests with 18-decimal mock tokens.)

## Correct conversion (deposit form)

Use `parseUnits` with the token's real decimals, read from the token contract, not hardcoded
to 18 and not assumed.

```ts
import { parseUnits, erc20Abi } from "viem";
import { useReadContract, useWriteContract } from "wagmi";

const { data: decimals } = useReadContract({
  address: USDC_ADDRESS,
  abi: erc20Abi,
  functionName: "decimals",   // returns 6 for USDC
});

function onDeposit(depositInput: string) {
  if (decimals === undefined) return;          // don't submit until decimals known
  const amount = parseUnits(depositInput, decimals);
  // parseUnits("250", 6) = 250 × 10^6 = 250_000_000n
  writeContract({ ...vaultConfig, functionName: "deposit", args: [amount] });
}
```

Extras:
- `parseUnits` throws on too many fraction digits for 6 decimals (e.g. `"1.1234567"`).
  Validate input / catch and show an error instead of crashing.
- Disable submit if `amount > balance` (compare bigints, `250_000_000n <= 400_000_000n`).
- Allowance: vault pulls USDC via `transferFrom`, so `approve(vault, amount)` must use the
  same `parseUnits(..., 6)` value, otherwise approve is also off by 10^12.

## Balance display

Use `formatUnits(raw, decimals)` with the **same** decimals (6) read from the token.
Never `formatEther` for USDC.

```ts
import { formatUnits } from "viem";

formatUnits(250_000_000n, 6)  // "250"      ✅
formatUnits(400_000_000n, 6)  // "400"      ✅

formatEther(250_000_000n)     // 250,000,000 / 10^18 = "0.00000000025"  ❌
```

Rules so a 250 USDC position always renders as "250":
- One source of truth for decimals: `decimals()` from the token contract (6), used by both
  `parseUnits` (input side) and `formatUnits` (display side).
- Keep amounts as `bigint` until the final `formatUnits`; don't `Number()` raw values
  (precision loss above 2^53).
- For vault positions: vault **shares** may have different decimals than USDC (ERC-4626
  can add a decimals offset). Show the position in USDC by calling
  `convertToAssets(shares)` (or `previewRedeem`) and format that result with USDC's 6
  decimals; if you show shares, format them with the **vault's** `decimals()`.
