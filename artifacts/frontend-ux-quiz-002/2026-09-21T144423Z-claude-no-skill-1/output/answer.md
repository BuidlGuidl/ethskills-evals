# USDC deposit revert: `parseEther` on a 6-decimal token

## Verdict
Teammate is wrong. viem doesn't know which token you're sending. `parseEther(x)` is just
`parseUnits(x, 18)`: it always scales by 10^18. USDC uses **6 decimals**.

## Arithmetic

**What the contract was asked to move**
```
parseEther("250") = 250 × 10^18
                  = 250,000,000,000,000,000,000   (2.5 × 10^20)
```

**What the user meant (250 USDC, 6 decimals)**
```
parseUnits("250", 6) = 250 × 10^6
                     = 250,000,000                (2.5 × 10^8)
```

**Factor**
```
(250 × 10^18) / (250 × 10^6) = 10^(18−6) = 10^12 = 1,000,000,000,000
```
The request was one trillion times too big.

**Against the user's balance**
```
balance (400 USDC)   = 400 × 10^6 = 400,000,000
requested            = 250,000,000,000,000,000,000
requested / balance  = 2.5e20 / 4e8 = 6.25 × 10^11
```
So `transferFrom` checks `balance < amount` → revert "transfer amount exceeds balance". The contract did its job. The bug is in the frontend.

(A revert was the lucky outcome. If the user had typed a tiny amount like "0.0000000001", `parseEther` gives
`10^8` raw units = 100 USDC, which fits in the balance, so 100 USDC would have moved with no error. Wrong
units only fail loudly when the number happens not to fit.)

## Correct input conversion
Use the token's decimals, read from the token contract (don't assume 18):

```ts
import { parseUnits } from "viem";
import { erc20Abi } from "viem";
import { useReadContract, useWriteContract } from "wagmi";

const { data: decimals } = useReadContract({
  address: usdcAddress,
  abi: erc20Abi,
  functionName: "decimals",   // → 6 for USDC
});

// in the handler
if (decimals === undefined) return;               // don't submit until known
const amount = parseUnits(depositInput.trim(), decimals); // "250" → 250_000_000n
writeContract({ ...vaultConfig, functionName: "deposit", args: [amount] });
```

- Use the same `amount` for the `approve` / allowance check.
- Validate before sending: `amount > 0n` and `amount <= balance` (both raw bigint values, compare as bigint).
- viem's `parseUnits` silently rounds input with more than `decimals` fraction digits. Reject inputs like "1.1234567" (7 decimals) in the form instead.

## Correct balance display
Raw `balanceOf` for a 250 USDC position is `250_000_000n`. Format it with the **same** decimals:

```ts
import { formatUnits } from "viem";

formatUnits(250_000_000n, 6)   // "250"   ✅
formatEther(250_000_000n)      // "0.00000000025"  ❌ (250e6 / 1e18 = 2.5e-10)
```

Rules for the display side:
- Always `formatUnits(rawBalance, decimals)`, where `decimals` comes from the token's `decimals()`.
  Never use `formatEther` for ERC-20s, and never hard-code 18.
- Keep balances as `bigint` for math and comparisons. Only convert to a string at render time.
  Never go through `Number(raw) / 1e6`, which loses precision for large values.
- Input and display must use the same `decimals` value (one hook or constant, shared by both), so that
  `formatUnits(parseUnits("250", d), d) === "250"` holds in both directions.
