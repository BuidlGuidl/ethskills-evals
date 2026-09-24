# USDC deposit revert: `parseEther` vs 6 decimals

## Verdict: teammate is wrong

viem doesn't "handle the units". `parseEther(x)` is just `parseUnits(x, 18)`. It hardcodes 18 decimals and knows nothing about the token. USDC uses **6** decimals.

## Arithmetic

**What the contract was asked to move:**

```
parseEther("250") = 250 × 10^18
                  = 250,000,000,000,000,000,000   (uint256: 250000000000000000000)
```

**What the user meant (250 USDC, 6 decimals):**

```
parseUnits("250", 6) = 250 × 10^6
                     = 250,000,000                (uint256: 250000000)
```

**Factor:**

```
(250 × 10^18) / (250 × 10^6) = 10^12 = 1,000,000,000,000   (one trillion ×)
```

**What the contract saw, in USDC terms:**

```
250 × 10^18 / 10^6 = 250 × 10^12 = 250,000,000,000,000 USDC   (250 trillion USDC)
```

**User's balance on-chain:**

```
400 USDC = 400 × 10^6 = 400,000,000 raw
```

The call asked for 250,000,000,000,000,000,000 raw units, but the balance is 400,000,000 raw. It is over the balance by about 6.25 × 10^11 times, so `transferFrom` reverts with "transfer amount exceeds balance". The revert was the lucky outcome. If the vault or token had not checked the balance, the wrong number could have been used in accounting.

## Correct conversion for the deposit form

Use `parseUnits` with the token's own decimals. Read decimals from the token contract, don't hardcode them (USDC is 6 on Ethereum and most L2s, but "USDC" on BNB Chain is 18):

```ts
import { parseUnits, erc20Abi } from "viem";
import { useReadContract, useWriteContract } from "wagmi";

const { data: decimals } = useReadContract({
  address: USDC_ADDRESS,
  abi: erc20Abi,
  functionName: "decimals",
}); // 6 for USDC

const { writeContract } = useWriteContract();

function onDeposit() {
  if (decimals === undefined) return;          // don't guess while loading
  const amount = parseUnits(depositInput, decimals); // "250" -> 250_000_000n
  writeContract({ ...vaultConfig, functionName: "deposit", args: [amount] });
}
```

Notes:
- Use the same `amount` in the `approve` call, so the allowance and the deposit match.
- Validate the input before calling `parseUnits`: it must be a non-empty decimal string with no more than `decimals` fractional digits. `parseUnits` rounds extra digits, so it's better to reject them than to change the amount without telling the user. The amount must also be > 0 and ≤ balance. Disable the button when any check fails.

## Balance display side

Format raw amounts with `formatUnits(raw, decimals)`, using the **same** token decimals. Never use `formatEther`:

```ts
import { formatUnits } from "viem";

const { data: balance } = useReadContract({
  address: USDC_ADDRESS,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [account],
});

const display =
  balance !== undefined && decimals !== undefined
    ? formatUnits(balance, decimals)   // 250_000_000n, 6 -> "250"
    : "…";
```

What goes wrong with the wrong helper:

```
formatUnits(250000000n, 6) = 250000000 / 10^6  = "250"            ✅
formatEther(250000000n)    = 250000000 / 10^18 = "0.00000000025"  ❌ (10^12 too small)
```

Rules so a 250 USDC position always shows as 250:
1. The raw value stays a `bigint` all the way through. Do math in raw units, and only convert to a string at the edge with `formatUnits`. Don't use `Number()` or float math on raw amounts.
2. Use one source of decimals (`decimals()` from the token, or a per-chain token config) for both `parseUnits` on input and `formatUnits` on output. The two sides are then exact inverses: `formatUnits(parseUnits("250", 6), 6) === "250"`.
3. The "Max" button should set the input to `formatUnits(balance, decimals)`, so a round trip gives back exactly the on-chain balance.
