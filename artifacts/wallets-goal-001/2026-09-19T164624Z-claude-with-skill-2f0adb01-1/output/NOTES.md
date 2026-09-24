# One-click WETH → USDC → Aave V3 entry from an existing EOA

## TL;DR

The tool uses **EIP-7702** (live on mainnet since Pectra, May 2025). It sends **one type-4 transaction** from
the user's existing EOA **to itself**. That transaction:

1. carries a signed authorization that points the EOA's code at MetaMask's audited
   `EIP7702StatelessDeleGator`, and
2. calls `execute(batchMode, [approve, swap, approve, supplyAll, revoke])` on the EOA itself.

Every inner call runs with `msg.sender == the user's address`. The DeleGator's batch mode uses
"revert on failure", so if any step fails the whole transaction reverts. The user can't end up with
the swap done and the supply not done.

A tiny stateless helper, `SupplyAll`, handles the "amount unknown until runtime" part. It reads the
EOA's USDC balance **on-chain, after the swap** and supplies all of it to Aave with
`onBehalfOf = EOA`.

```
EOA (0xUser, same address, same ENS, same history)
 └─ type-4 tx  to: 0xUser   authorizationList: [0xUser → DeleGator 0x63c0…E32B]
     └─ DeleGator.execute(0x01…00, Execution[]), executed AS 0xUser:
         1. WETH.approve(SwapRouter02, 2e18)                       exact amount, fully consumed → 0
         2. SwapRouter02.multicall(deadline, [exactInputSingle(WETH→USDC, 0.05%, recipient=0xUser, minOut)])
         3. USDC.approve(SupplyAll, max)
         4. SupplyAll.supplyAll(USDC, minOut)   → balanceOf(0xUser) → transferFrom → Pool.supply(onBehalfOf=0xUser)
         5. USDC.approve(SupplyAll, 0)                             revoked in the same tx
```

## Addresses used (Ethereum mainnet, code presence checked on-chain 2026-09-19)

| What | Address |
|---|---|
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Uniswap V3 SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` |
| Uniswap V3 QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |
| Uniswap V3 WETH/USDC 0.05% pool (reference) | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` |
| Aave V3 Pool (core market) | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |
| Aave V3 aEthUSDC | `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c` |
| Chainlink ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` |
| MetaMask `EIP7702StatelessDeleGator` v1.3.0 | `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` (`NAME()`/`VERSION()` return `"EIP7702StatelessDeleGator"`/`"1.3.0"`) |
| `SupplyAll` helper | **you deploy it** (`contracts/SupplyAll.sol`), then pass it as `SUPPLY_ALL` |

Contract calls relied on:
- `WETH/USDC.approve(address,uint256)`, `balanceOf`, `allowance`
- `SwapRouter02.multicall(uint256 deadline, bytes[])` wrapping `exactInputSingle((tokenIn,tokenOut,fee,recipient,amountIn,amountOutMinimum,sqrtPriceLimitX96))`. SwapRouter02's struct has no deadline field, so the deadline goes through `multicall`.
- `QuoterV2.quoteExactInputSingle((tokenIn,tokenOut,amountIn,fee,sqrtPriceLimitX96))`, called via `eth_call`
- `Pool.supply(asset, amount, onBehalfOf, referralCode)` and `Pool.getConfiguration(asset)`
- `DeleGator.execute(bytes32 mode, bytes executionCalldata)`. This is the ERC-7579 batch: mode `0x01` followed by 31 zero bytes, and the calldata is `abi.encode(Execution[])`, where `Execution = (address target, uint256 value, bytes callData)`. The function is `onlyEntryPointOrSelf`, which is why the tx is sent **to the EOA itself**.

## Why this meets the user's constraints

**Same address, no new wallet, no fund movement.** EIP-7702 doesn't create an account. The EOA
keeps its address, ENS name, nonce, history and private key. The only change is that its code
field is set to a 23-byte delegation designator (`0xef0100 ‖ DeleGator`). WETH goes straight from
the EOA to the Uniswap pool. USDC comes back to the EOA, and aUSDC is minted to the EOA. At no point
do funds sit at another address the user controls. The user deploys nothing: the DeleGator is
already deployed, and `SupplyAll` is a public utility with no owner and no storage. It can be
deployed once by the developer and shared by every user, and it is not "an account".

**One confirmation, one on-chain action.** It is one signed transaction (a type-4 tx whose
authorization is signed by the same key). In MetaMask the user sees one `wallet_sendCalls` prompt.

**Atomic.** All five calls run inside a single EVM call frame of a single transaction, with
revert-on-failure. If the swap misses `amountOutMinimum`, the deadline passes, Aave is paused or
frozen, the supply cap is hit, or anything else reverts, the whole transaction reverts. The user
keeps the 2 WETH and only loses gas. This was tested on a mainnet fork. I sabotaged only step 4 (the
supply), so the swap step had already succeeded inside the tx. The tx reverted and the account still
held exactly 2 WETH, 0 USDC and 0 aUSDC.

**Supplies exactly what the swap returned.** A batch is static calldata, and Aave V3 `supply` has
no "whole balance" sentinel (unlike `withdraw` and `repay`). So step 4 goes through `SupplyAll`,
which calls `balanceOf(msg.sender)` at execution time. `entry.ts` refuses to run if the account
already holds USDC. That means "whole USDC balance" equals "exactly the swap output". On the fork
the result was 2 WETH → 5290.586516 USDC → 5290.586515 aUSDC (Aave's 1-wei rounding), with 0 USDC left.

## Two ways to run it

**A. Dapp + MetaMask (recommended for the real user: the key never leaves MetaMask).**
Call `sendWithInjectedWallet(publicClient, walletClient, { supplyAll })`. It uses EIP-5792
`wallet_sendCalls` with `forceAtomic: true` (`atomicRequired`). MetaMask either runs the batch
atomically by upgrading the EOA to the same DeleGator (MetaMask shows its own "smart account"
consent) or rejects it. The code checks `wallet_getCapabilities` first. After the call it asserts
that the result is `atomic: true` with exactly one receipt. **Never** set viem's
`experimental_fallback`: it sends the calls as separate transactions, which is exactly the
half-done state the user forbids.

**B. CLI with a local key (developer / fork rehearsal).**

```bash
npm install
forge create contracts/SupplyAll.sol:SupplyAll --rpc-url $RPC_URL --account deployer --broadcast   # once
export RPC_URL=...  SUPPLY_ALL=0x...  PRIVATE_KEY=0x...   # PRIVATE_KEY: fork/testing only, never commit
npx tsx entry.ts plan       # quotes, checks, signs auth locally, simulates full batch; sends NOTHING
npx tsx entry.ts execute    # same, then asks you to type "yes", sends ONE tx, verifies post-conditions
npx tsx entry.ts undelegate # optional: clears the 7702 delegation (separate tx)
```

Fork rehearsal (this is how the code was tested):
```bash
anvil --fork-url $MAINNET_RPC --hardfork prague --port 8547
# fresh key, give it ETH, wrap 2 WETH, reduce ETH to gas money, deploy SupplyAll, then run plan/execute against http://127.0.0.1:8547
```
Measured on the fork: about 369k gas used, including the first-time delegation.

## What the developer must get right

1. **Delegate target = audited code you have verified.** Whatever the EOA delegates to has
   *full control* of the account, including every future asset and for as long as the delegation
   lasts. Verify `0x63c0…E32B` yourself against MetaMask's delegation-framework deployments and
   source (`NAME()`, `VERSION()`, Etherscan-verified source) before use. Never make the delegate
   address configurable from user input or a URL.
2. **Don't overwrite an existing delegation.** `entry.ts` aborts if the EOA is already delegated to
   anything other than the DeleGator. That guard fired in testing: anvil's well-known test account
   #0 is 7702-delegated on real mainnet to an unknown contract, which is almost certainly a sweeper.
   If the account shows up as delegated to something unexpected, treat it as compromised.
3. **Authorization hygiene.** Sign the authorization with `chainId: 1`, never `0`, because chainId 0
   is valid on every chain. Use `executor: 'self'` (auth nonce = tx nonce + 1) because the EOA sends
   the tx itself. Never ask users to sign raw 7702 authorizations inside a dapp. Wallets rightly
   refuse to do this, which is why path A goes through `wallet_sendCalls`.
4. **The delegation persists.** It survives the transaction, **even if the transaction reverts**
   (confirmed on the fork). That is normally fine: it's the same state as MetaMask's own smart
   account upgrade, and the account still works as a normal EOA. Tell the user about it anyway.
   `entry.ts undelegate` resets it with an authorization to `address(0)`, which is a separate tx.
5. **Slippage / MEV.** `amountOutMinimum` is the tighter of two bounds: the quote minus slippage
   (default 0.5%), and the Chainlink value minus slippage and the pool fee. The script aborts if the
   Uniswap quote deviates from Chainlink by more than 1.5%, because a pool manipulated at quote
   time makes a quote-derived minimum meaningless. The swap output is passed through to
   `supplyAll(minAmount)` as a second guard. The deadline is 10 minutes. On mainnet, send through a
   private RPC (e.g. Flashbots Protect) to avoid sandwiches. A revert only costs gas.
6. **Approvals end at zero.** WETH is approved for exactly the amount swapped, and the swap consumes
   all of it. The USDC max-approval to `SupplyAll` is revoked in step 5 of the same tx. Even if it
   weren't revoked, `SupplyAll` can only pull from `msg.sender` and only supplies on behalf of
   `msg.sender`, so no third party could use that allowance. `execute` asserts both allowances are
   0 afterwards.
7. **`SupplyAll` is the only new code: review it and deploy it once.** It is about 30 lines with no
   owner, no storage and no upgrade path, and it hardcodes the Aave Pool. `entry.ts` checks that the
   configured address has code and that `POOL()` returns the Aave V3 Pool. Get it reviewed, and
   verify the source on Etherscan.
8. **Pre-existing USDC.** `supplyAll` supplies the *entire* USDC balance, so the script refuses to
   run if the account already holds USDC. Keep that check if you adapt the code.
9. **Simulate before sending.** `eth_estimateGas` with the authorization list runs the full batch.
   Any revert (bad encoding, slippage, cap, paused reserve) throws before anything is broadcast.
   Check that the account's ETH covers `gasLimit × maxFeePerGas`, since the user only has gas money.
10. **Keys.** `PRIVATE_KEY` from the environment is for fork testing only. For the real user, use
    path A (MetaMask signs), a hardware wallet or an encrypted keystore. Never commit keys; `.env*`
    is in `.gitignore`. Show the user the amount, the minimum out, the target addresses and the gas
    cost, and get an explicit "yes" before sending. `execute` does this.
11. **Rehearse on an anvil fork (`--hardfork prague`) with the same code** before running on mainnet.
