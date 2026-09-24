# Deposit revert: "250" USDC → "transfer amount exceeds balance"

## Short answer

The teammate is wrong. viem does not know which token you mean. `parseEther(x)` is simply
`parseUnits(x, 18)`: it always uses 18 decimals, which is ETH's scale. USDC uses **6 decimals**.
So the contract was asked to move 10¹² times what the user meant.

## Arithmetic

**What the code sent** (`parseEther("250")`, 18 decimals):

```
250 × 10^18 = 250,000,000,000,000,000,000   (uint256 = 250000000000000000000)
```

**What the user intended** (250 USDC, 6 decimals):

```
250 × 10^6 = 250,000,000                    (uint256 = 250000000)
```

**Factor between them:**

```
250 × 10^18 / (250 × 10^6) = 10^(18−6) = 10^12 = 1,000,000,000,000
```

**What the contract read that as, in USDC:**

```
250,000,000,000,000,000,000 / 10^6 = 250,000,000,000,000 USDC   (250 trillion USDC)
```

**The user's balance:**

```
400 USDC = 400 × 10^6 = 400,000,000 base units
```

Then `transferFrom` checks `250000000000000000000 > 400000000`. That is true, so it reverts with
"transfer amount exceeds balance". The revert is correct. The user's 400 USDC easily covers the
250 they meant to deposit. The bug is in the frontend's unit conversion. The same bug hits every
input: any amount above 0.0004 USDC (0.0004 × 10^18 = 400,000,000,000,000 > 400,000,000)
will revert for this user.

## Correct conversion (deposit form)

Use `parseUnits` with the token's real decimals. Read `decimals` from the token contract once,
rather than guessing:

```ts
import { parseUnits, erc20Abi } from "viem";
import { useReadContract, useWriteContract } from "wagmi";

const { data: decimals } = useReadContract({
  address: USDC_ADDRESS,
  abi: erc20Abi,
  functionName: "decimals",
}); // 6 for USDC

const amount = parseUnits(depositInput, decimals!); // "250" -> 250000000n
writeContract({ ...vaultConfig, functionName: "deposit", args: [amount] });
```

(A hardcoded `parseUnits(depositInput, 6)` is also correct for USDC. Reading `decimals` keeps
the code correct if the token ever changes, for example on a chain where the bridged USDC uses
different decimals.)

Also:
- Disable submit until `decimals` has loaded.
- Validate the input before submitting: it must be a number > 0 with at most `decimals`
  digits after the dot (`parseUnits` throws on bad input, so catch that), and it must be
  `≤ balance`, compared as bigint base units. Show the reason next to the field.
- The ERC-20 `approve` amount must use the same `parseUnits(input, decimals)` value.
  Otherwise the approval will be too small or too large by the same 10¹² factor.

## Correct balance display

Use `formatUnits(value, decimals)` with the **same `decimals` value**. Never use
`formatEther`, and never render the raw bigint:

```ts
import { formatUnits } from "viem";

const { data: balance } = useReadContract({
  address: USDC_ADDRESS,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [account],
});

formatUnits(balance!, decimals!); // 250000000n -> "250"
```

What a 250 USDC position (`250000000n` onchain) looks like with the wrong helpers:

| Rendering                      | Arithmetic              | Shown              |
|--------------------------------|-------------------------|--------------------|
| raw bigint                     | —                       | `250000000`        |
| `formatEther(250000000n)`      | 250,000,000 / 10^18     | `0.00000000025`    |
| `formatUnits(250000000n, 6)`   | 250,000,000 / 10^6      | **`250`** ✅       |

Rule: parse and format with one shared `decimals` taken from the token itself, and keep amounts
as `bigint` base units everywhere in between. Convert only when the user types a value
(`parseUnits`) and when you show one (`formatUnits`). Then input, allowance, deposit, and
display all use the same scale, and 250 USDC always shows as 250. Show a fiat value next to it
(≈ $250), which also makes a decimals mistake easy to spot.
