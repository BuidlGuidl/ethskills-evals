# USDC deposit revert: `parseEther` on a 6-decimal token

## Verdict
Teammate is wrong. viem does **not** know which token you mean. `parseEther(x)` is just
`parseUnits(x, 18)`: it always multiplies by 10^18. USDC uses **6 decimals**.

## What the contract was asked to move
```
parseEther("250") = 250 × 10^18
                  = 250_000_000_000_000_000_000   (250000000000000000000)
```
Read as USDC (6 decimals): 250 × 10^18 / 10^6 = 250 × 10^12 = **250,000,000,000,000 USDC** (250 trillion).

## What the user meant
```
250 USDC = 250 × 10^6
         = 250_000_000   (250000000)
```
User's balance: 400 × 10^6 = 400_000_000.

## Factor
```
(250 × 10^18) / (250 × 10^6) = 10^(18 − 6) = 10^12 = 1,000,000,000,000
```
Asked amount was **one trillion times** too large. 250,000,000,000,000,000,000 > 400,000,000
→ `transferFrom` fails with "transfer amount exceeds balance". The contract did its job; the frontend sent the wrong number.

## Correct conversion (deposit form)
Use `parseUnits` with the token's real decimals. Read them from the token contract (or use a
checked constant 6 for USDC), never assume 18:

```ts
import { parseUnits } from "viem";
import { useReadContract } from "wagmi";
import { erc20Abi } from "viem";

const { data: decimals } = useReadContract({
  address: USDC_ADDRESS,
  abi: erc20Abi,
  functionName: "decimals",
}); // 6 for USDC

const amount = parseUnits(depositInput, decimals); // "250" → 250_000_000n
writeContract({ ...vaultConfig, functionName: "deposit", args: [amount] });
```
Disable the button until `decimals` has loaded. Use the same `amount` for the ERC-20
`approve` call so allowance and deposit match (approve 250 × 10^6, not 250 × 10^18).

## Balance display
Use `formatUnits(raw, decimals)` with the **same** decimals value, never `formatEther`:

```ts
import { formatUnits } from "viem";
formatUnits(250_000_000n, 6)  // "250"   ✅
formatEther(250_000_000n)     // "0.00000000025"  ❌ (250×10^6 / 10^18 = 2.5×10^-10)
```
One source of truth for decimals (from `decimals()` on the token) feeds both
`parseUnits` (input → raw) and `formatUnits` (raw → display), so a raw `250000000`
always renders as 250 USDC (≈ $250) and "250" typed always becomes `250000000n`.

Also worth adding: compare `amount` against the user's raw balance before sending and
show "Insufficient balance" instead of letting the tx revert.
