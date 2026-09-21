# USDC deposit revert: "transfer amount exceeds balance"

## TL;DR
Teammate is wrong. `parseEther` always scales by 10^18 (ETH decimals). USDC uses **6** decimals. Contract was asked to move 10^12 times what the user meant.

## Arithmetic

`parseEther(x)` = `parseUnits(x, 18)` = x × 10^18.
USDC `decimals()` = 6, so 1 USDC = 10^6 base units.

| | Formula | uint256 |
|---|---|---|
| Sent (bug) | `parseEther("250")` = 250 × 10^18 | **250000000000000000000** (2.5 × 10^20) |
| Intended | `parseUnits("250", 6)` = 250 × 10^6 | **250000000** (2.5 × 10^8) |
| Factor | 10^18 / 10^6 | **10^12** (1,000,000,000,000×) |

Check: 250000000 × 1000000000000 = 250000000000000000000 ✓

What the contract saw, in USDC terms:
250000000000000000000 / 10^6 = 250,000,000,000,000 USDC (250 trillion USDC).

User balance: 400 USDC = 400 × 10^6 = 400000000 base units.
250000000000000000000 > 400000000 → `transferFrom` reverts with "transfer amount exceeds balance". Revert is expected, not flaky.

(If the user had also approved via `parseEther`, allowance would pass; balance check is what fails. Either way the tx can never succeed.)

## Why "viem handles the units" is wrong
viem converts **strings ↔ bigint with the decimals you give it**. It does not know which token you're talking to. `parseEther` hardcodes 18. Only correct for ETH / 18-decimal tokens.

## Correct conversion (deposit form)

Read decimals from the token itself, don't hardcode 18 (or even 6 — decimals differ per token/chain):

```ts
import { parseUnits, erc20Abi } from "viem";
import { useReadContract, useWriteContract } from "wagmi";

const { data: decimals } = useReadContract({
  address: USDC_ADDRESS,
  abi: erc20Abi,
  functionName: "decimals",
}); // 6 for USDC

// in submit handler
if (decimals === undefined) return; // don't submit until known
const amount = parseUnits(depositInput.trim(), decimals); // "250" -> 250000000n
writeContract({ ...vaultConfig, functionName: "deposit", args: [amount] });
```

Also:
- Approval must use same `amount` (`parseUnits(..., decimals)`), not `parseEther`.
- Validate before sending: `amount > 0n && amount <= balance` → disable Deposit + show "Insufficient balance" instead of letting the tx revert.
- `parseUnits` throws on too many fractional digits (e.g. "1.1234567" with 6 decimals) → catch and show input error.

## Balance display side

Must use `formatUnits(raw, decimals)` with the **same token decimals** (6):

```ts
import { formatUnits } from "viem";

const { data: balance } = useReadContract({
  address: USDC_ADDRESS,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [userAddress],
});

formatUnits(balance, decimals); // 250000000n -> "250"
```

What goes wrong otherwise, for a 250 USDC position (raw = 250000000):
- `formatEther(250000000n)` = 250000000 / 10^18 = **"0.00000000025"** (off by 10^12 the other way)
- Raw bigint shown → **"250000000"** (off by 10^6)
- `formatUnits(250000000n, 6)` = 250000000 / 10^6 = **"250"** ✓

Rule: one `decimals` value, read from the token contract, used for both `parseUnits` (input → chain) and `formatUnits` (chain → display). Never `parseEther`/`formatEther` for non-ETH tokens. Add USD context next to it (e.g. `250 USDC (~$250.00)`).
