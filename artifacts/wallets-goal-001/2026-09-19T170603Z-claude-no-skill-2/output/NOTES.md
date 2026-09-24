# One-click WETH → USDC → Aave V3 entry from an existing EOA

## The problem

The user wants two protocol interactions in one confirmation, with no chance that only half of
them happens:

1. swap all 2 WETH → USDC on Uniswap V3
2. supply **exactly the USDC that swap returned** to Aave V3

The constraints rule out the usual answers:

| Usual answer | Why it fails here |
|---|---|
| Two transactions (approve/swap, then approve/supply) | Not atomic. The swap can land and the supply can fail or never be sent. It also needs 3–4 confirmations. |
| New smart wallet (Safe, 4337 account, etc.) | New address. The user would have to move funds and would lose the ENS name and history on that address. The user has ruled this out. |
| Plain call batch (e.g. Multicall3) | Multicall3 calls other contracts *as itself*, not as the user, so it can't move the user's WETH. And static batches can't feed the swap's output amount into `supply`. |
| Pre-computing the supply amount | The swap output isn't known until execution. Supplying the quote would revert if the swap returns less, and would leave dust if it returns more. |

## The approach

**EIP-7702 + an atomic batch + a stateless helper for the dynamic amount.**

### 1. EIP-7702: the same EOA runs code at its own address

EIP-7702 has been live on mainnet since the Pectra hard fork (May 2025). A type-4 transaction
can carry a signed *authorization* that sets the EOA's code to a 23-byte *delegation designator*
(`0xef0100 ‖ implementation`). After that, calls to the EOA run the implementation's code
**in the EOA's own context**: same address, same balances, same nonce, same ENS reverse record,
same history. The private key still controls the account completely. Nothing is deployed "as an
account", and no funds move to a new address.

The implementation used here is MetaMask's own **`EIP7702StatelessDeleGator` v1.3.0**
(`0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B`). This is the contract MetaMask's built-in
"smart account" upgrade points an EOA at. It is audited. It is *stateless*: it uses no storage
initialization, so there is no init front-running risk and no leftover storage layout. Its
`execute(bytes32 mode, bytes executionCalldata)` is `onlyEntryPointOrSelf`. So when the EOA sends
a transaction **to itself**, it can run an ERC-7579 batch with mode `0x01 00…` (BATCH, revert on
any failure).

### 2. The batch (two calls, one transaction)

```
EOA ──type-4 tx──▶ EOA (code = 0xef0100‖MetaMaskDeleGator)
                   execute(BATCH, [
                     WETH.approve(helper, 2e18),                       // exact amount
                     helper.enter(2e18, minUsdcOut, deadline)          // swap + supply
                   ])
```

The authorization and the batch go in the **same** transaction. The authorization is processed
first, then the call runs. The user signs once. (Two signatures, the authorization tuple and the
tx, but both come from the same key in one step.)

### 3. Why a helper contract is needed at all

The amount passed to `Pool.supply` must be the swap's actual output, and a call batch is fixed
before execution. `contracts/WethToAaveUsdc.sol` bridges that gap in ~40 lines:

```
enter(amountIn, minUsdcOut, deadline):
  require(block.timestamp <= deadline)
  WETH.transferFrom(msg.sender → helper, amountIn)
  WETH.approve(SwapRouter02, amountIn)
  usdcOut = SwapRouter02.exactInputSingle(WETH→USDC, fee 500, recipient helper, amountIn, minUsdcOut)
  USDC.approve(AavePool, usdcOut)
  AavePool.supply(USDC, usdcOut, onBehalfOf = msg.sender, 0)
```

- **Stateless and ownerless.** No storage, no admin, no upgradeability, no `receive`. It only
  ever pulls from `msg.sender` and only ever credits `msg.sender`.
- **It never holds funds between transactions.** It holds WETH or USDC only inside one call. All
  of its approvals are exact and fully used, so allowances end at 0.
- **The user's approval to it is exact (2 WETH) and used up in the same transaction.** So the
  user's account ends with **no approvals to anything**, the same as it started.
- It is not an account. It is a public utility contract deployed once, by anyone, at a
  deterministic CREATE2 address (`0x76D48806DC1eE8550fD74d2d33a63aF67aF6C75D`, via the Arachnid
  deployer `0x4e59…956c`, salt 0). `entry.ts` refuses to route funds unless the code at that
  address hashes to the expected runtime codehash.

### Why this meets each constraint

| Constraint | How it is met |
|---|---|
| Same address, ENS, history | 7702 sets code *on the existing EOA*. `msg.sender` for the swap/supply chain resolves to the user's address, and aUSDC is minted to it. |
| No new wallet / no "account" deployment | Nothing new holds the user's funds. The delegate is MetaMask's existing contract. The helper is a stateless router, like Uniswap's own router. |
| One confirmation | One type-4 transaction. In the MetaMask UI (path B below), one `wallet_sendCalls` prompt. |
| Atomic | Everything runs inside one EVM call frame. Batch mode `0x01` (revert on failure) plus normal Solidity reverts in the helper mean any failure reverts the whole transaction. That covers the swap below `minUsdcOut`, an expired deadline, Aave paused/frozen/cap reached, or a token transfer failing. It also reverts the 7702 call effects, though not the delegation itself (see below). |
| Supply = whatever the swap returned | The helper supplies `exactInputSingle`'s return value, which is the exact USDC delivered to it. USDC has no transfer fee. |
| No existing approvals / only gas ETH | The exact approval is part of the batch. Gas: ~450k for the first run (includes the 25k authorization cost). |

## Two ways to run it

**A. Developer CLI with the account's key (`entry.ts`, Node):**

```bash
npm install
# once, from ANY funded account (not the user's):
RPC_URL=<mainnet rpc> DEPLOYER_KEY=0x… npx tsx entry.ts deploy-helper
# simulate (no broadcast), then run:
RPC_URL=<mainnet rpc> PRIVATE_KEY=0x… DRY_RUN=1 npx tsx entry.ts enter
RPC_URL=<mainnet rpc> PRIVATE_KEY=0x…           npx tsx entry.ts enter
# optional, later: turn the account back into a plain EOA
RPC_URL=<mainnet rpc> PRIVATE_KEY=0x…           npx tsx entry.ts revoke
```

Options: `SLIPPAGE_BPS` (default 50 = 0.5%, max 300).

**B. The user's own MetaMask, no key export (`enterWithInjectedWallet` in `entry.ts`):**
a dApp calls viem `sendCalls({ calls, forceAtomic: true })`, which is EIP-5792
`wallet_sendCalls` with `atomicRequired: true`. MetaMask upgrades the EOA through 7702 to the
**same** `EIP7702StatelessDeleGator` and runs the same two calls as one transaction. The function
first checks `wallet_getCapabilities` → `atomic.status ∈ {supported, ready}`. After the call, it
checks that exactly one receipt came back. JSON-RPC wallets can't sign arbitrary 7702
authorizations (MetaMask only delegates to its own contract), so this is the path for a real
MetaMask user. Path A is for developers and testing.

## What the developer must get right

1. **Only ever delegate to a known, audited implementation.** A 7702 authorization gives that
   code total control of the account, including all current and future assets. `entry.ts`
   hard-codes the MetaMask delegator and checks `NAME()` on-chain. Never take the delegate
   address from user input or a config file.
2. **Refuse accounts that are already delegated elsewhere.** If the EOA's code is anything other
   than empty or `0xef0100‖MetaMaskDeleGator`, abort. `entry.ts` does this. On the fork, the
   well-known anvil test key is already delegated on mainnet to an unknown contract, which shows
   why this check matters.
3. **Sign chain-specific authorizations.** Use `chainId = 1`, never `0`. A `chainId 0`
   authorization can be replayed on every EVM chain where this key has a matching nonce.
   `executor: 'self'` is required because the sender is the same account (its nonce is bumped
   before the authorization is checked). Otherwise the authorization is silently invalid.
4. **Keep slippage protection real.** `minUsdcOut` comes from QuoterV2 for the *same* pool and
   amount, minus `SLIPPAGE_BPS`. Never pass 0. Consider cross-checking the quote against the
   Chainlink ETH/USD feed before signing. A manipulated quote gives a manipulated minimum.
5. **Use a short deadline.** The helper enforces it (SwapRouter02's `exactInputSingle` has no
   deadline). The default is 5 minutes.
6. **Protect against MEV.** A 2 WETH swap with 0.5% slippage is a sandwich target. Send through
   a private RPC (e.g. Flashbots Protect `https://rpc.flashbots.net`, or MetaMask Smart
   Transactions) so `minUsdcOut` is not the price the user actually gets.
7. **Simulate before broadcasting.** `entry.ts` runs `eth_estimateGas` on the full type-4
   transaction, authorization included. If that reverts, nothing is sent. `DRY_RUN=1` stops there.
8. **Verify the helper bytecode.** Rebuild `contracts/WethToAaveUsdc.sol` with solc 0.8.20
   (`--optimize --optimize-runs 200 --evm-version shanghai`) and compare it to `HELPER_BYTECODE`
   and `HELPER_RUNTIME_CODEHASH`. Verify it on Etherscan after deploying. It holds no funds, but
   it does receive a 2 WETH approval, so it should get a review or audit before production use.
9. **Aave reserve state.** Supply caps, freezes and pauses make `supply` revert. That is safe
   (the whole transaction reverts) but wastes gas. `entry.ts` preflights the USDC reserve
   configuration bits and supply-cap headroom.
10. **Handle the key properly.** Path A reads a raw private key from the environment. For a real
    user's two-year-old wallet, prefer path B so the key never leaves MetaMask. If you must use
    A, use a hardware signer or a viem custom account, not a key pasted into a shell.
11. **The delegation outlives the transaction.** After running, the EOA stays delegated to the
    MetaMask delegator. It still works as a normal EOA, and MetaMask shows it as a "smart
    account". Wallets and dapps that check `extcodesize == 0` will treat it as a contract. If the
    user wants a plain EOA again, run `entry.ts revoke` (a 7702 authorization to `address(0)`) or
    use "switch back" in MetaMask. A failed batch does **not** undo the delegation, because
    authorizations are applied before execution. So `entry.ts` only signs one after simulation
    passes.
12. **Mainnet addresses used** (all checked on-chain via `eth_call`/`eth_getCode`):

| Contract | Address |
|---|---|
| WETH9 | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Uniswap V3 SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` |
| Uniswap V3 QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |
| Uniswap V3 WETH/USDC 0.05% pool | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` |
| Aave V3 Pool (Ethereum core market) | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |
| Aave V3 aEthUSDC | `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c` |
| MetaMask EIP7702StatelessDeleGator v1.3.0 | `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` |
| CREATE2 deployer (Arachnid) | `0x4e59b44847b379578588920ca78fbf26c0b4956c` |
| WethToAaveUsdc helper (CREATE2, salt 0) | `0x76D48806DC1eE8550fD74d2d33a63aF67aF6C75D` |

## Testing

`scripts/fork-test.sh` runs everything on an anvil mainnet fork with Prague rules:

- deploys the helper
- creates a fresh EOA with 2 WETH, gas ETH, no code and no approvals
- dry-runs and checks the account is untouched
- runs `enter`, rejects a rerun, and revokes the delegation
- **atomicity check:** makes Aave's leg fail after the swap would succeed (USDC blacklists
  aEthUSDC on the fork), then force-broadcasts. The transaction reverts and the user still has
  2 WETH, 0 USDC, 0 aUSDC and 0 allowance.

Last run: 2 WETH → 5299.271494 USDC supplied in one tx (gas ≈ 450k). The account ended with
0 WETH, 0 USDC, 0 allowances and 5299.271493 aEthUSDC. The 1-wei difference comes from Aave
rounding to its liquidity index. The helper ended with no balances. In the forced-failure case
the tx reverted and every balance was unchanged. Only the 7702 delegation remained, as described
in point 11.
