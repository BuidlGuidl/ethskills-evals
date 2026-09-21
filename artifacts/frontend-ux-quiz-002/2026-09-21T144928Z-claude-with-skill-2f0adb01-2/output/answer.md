# USDC deposit revert — the teammate is wrong

## What the contract was asked to move

`parseEther` always scales by **18** decimals (ETH's decimals). It knows nothing about the token.

```
parseEther("250") = 250 × 10^18
                  = 250,000,000,000,000,000,000
                  = 250000000000000000000n   (uint256 sent to deposit)
```

## What the user intended

USDC has **6** decimals. 250 USDC in base units:

```
250 × 10^6 = 250,000,000 = 250000000n
```

## Factor between them

```
(250 × 10^18) / (250 × 10^6) = 10^(18−6) = 10^12 = 1,000,000,000,000
```

The tx asked for **one trillion times** what the user meant: 250,000,000,000,000 USDC
(250 trillion). The user holds 400 USDC = 400 × 10^6 = 400,000,000 base units, so
`250000000000000000000 > 400000000` → `"transfer amount exceeds balance"`.

"viem handles the units" is false: viem converts only the decimals you tell it.
`parseEther` hardcodes 18. The revert was actually the lucky outcome; with an
18-vs-6 mismatch in the other direction, funds move silently in the wrong amount.

## Correct conversion (deposit form)

Use `parseUnits` with the token's real decimals, ideally read from the token contract
instead of hardcoded:

```ts
import { parseUnits, erc20Abi } from "viem";
import { useReadContract } from "wagmi";

const { data: decimals } = useReadContract({
  address: USDC_ADDRESS,
  abi: erc20Abi,
  functionName: "decimals",
}); // 6 for USDC

const amount = parseUnits(depositInput, decimals!); // "250" → 250000000n
writeContract({ ...vaultConfig, functionName: "deposit", args: [amount] });
```

Check: `parseUnits("250", 6) = 250 × 10^6 = 250000000n` ✅ (≤ 400000000n balance).

Notes:
- Disable the button until `decimals` is loaded (don't fall back to 18).
- The ERC-20 `approve` amount for the vault must use the same `parseUnits(input, 6)` value,
  or the allowance check will fail/mismatch too.

## Balance display side

Use `formatUnits(balance, decimals)` with the same `decimals` (6) — never `formatEther`:

```ts
import { formatUnits } from "viem";

formatUnits(250000000n, 6); // "250"  ✅
```

What goes wrong otherwise:

```
formatEther(250000000n) = 250000000 / 10^18 = 0.00000000025   ❌ (off by 10^12)
raw bigint 250000000n rendered as "250000000"                  ❌ (off by 10^6)
```

Rule: one source of truth for `decimals` (read from the token), `parseUnits(input, decimals)`
going in, `formatUnits(value, decimals)` coming out. Then a 250 USDC position always
round-trips `"250" → 250000000n → "250"`.
