# One-click WETH → USDC → Aave V3 entry

## What this is for

A user has 2 WETH in the MetaMask EOA they have used for years. They have no approvals and only
enough ETH for gas. With **one confirmation** they want to swap all of the WETH to USDC on
Uniswap V3 and supply **exactly the USDC the swap returns** to Aave V3. It has to happen as a
**single atomic mainnet transaction**, from the **same address**.

Files:

| File | Purpose |
|---|---|
| `entry.ts` | viem implementation: quoting, safety checks, the two ways to send (wallet / local key), post-trade checks, CLI |
| `contracts/WethToAaveUsdc.sol` | ~40-line stateless helper that turns the swap output into the supply amount (its bytecode is embedded in `entry.ts`) |

## Two problems to solve

1. **Several calls, one confirmation, all-or-nothing, from an EOA.** A normal EOA sends one call
   per transaction. Doing `approve`, then `swap`, then `supply` as separate transactions means
   several confirmations, and the account can be left half-done (e.g. the swap lands but the
   supply doesn't). WETH has no `permit`, so we can't skip the approval with a signature.
2. **The supply amount only exists at runtime.** `Pool.supply(asset, amount, …)` needs an exact
   amount. Unlike `withdraw`/`repay`, Aave's `supply` does not accept `type(uint256).max`. Any
   list of calls whose calldata is fixed in advance can't pass "whatever the swap returned" into
   the next call.

## The approach

### 1. EIP-7702: batching from the existing EOA

EIP-7702 has been live on mainnet since the Pectra upgrade (May 2025). An EOA signs an
*authorization* that sets its code to a delegation designator (`0xef0100 ‖ delegate`). After that,
calls **to the EOA's own address** run the delegate's code **in the EOA's own context**. It has
the same address, balance, nonce, ENS reverse record and history. The private key keeps full
control, and nothing is deployed "as an account".

We delegate to **MetaMask's `EIP7702StatelessDeleGator` v1.3.0**
(`0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B`). This is the audited contract MetaMask itself uses
for its "smart account" upgrade. It has no storage, so there is nothing to initialize and no
storage layout to collide with. Its `execute(bytes32 mode, bytes calls)` accepts calls only from
the account itself (or the 4337 EntryPoint). So nobody else can push calls through the user's
account.

We use ERC-7579 mode `0x01 00 …`, which means **batch, default exec type**. If any inner call
reverts, the whole transaction reverts. (The "try" exec type `0x01 01 …` would allow a partial
result and must never be used here.)

### 2. A stateless helper for the runtime amount

`WethToAaveUsdc.swapAndSupply(amountIn, fee, minUsdcOut, deadline)`:

1. checks the deadline,
2. runs `WETH.transferFrom(msg.sender → helper, amountIn)`,
3. calls Uniswap V3 `SwapRouter02.exactInputSingle(WETH→USDC, recipient = helper, amountOutMinimum = minUsdcOut)` and gets `usdcOut`,
4. runs `USDC.approve(AavePool, usdcOut)` (exact amount; Aave consumes all of it),
5. calls `AavePool.supply(USDC, usdcOut, onBehalfOf = msg.sender, 0)`, so **aEthUSDC is minted
   directly to the user's EOA**.

The helper has no owner, no storage, no admin functions and no way to withdraw. It only pulls from
`msg.sender` and only credits `msg.sender`, so nobody can use it to spend another person's
approval. It holds tokens only inside a single call. Anyone can deploy it: it isn't the user's
account and never custodies anything between transactions. `entry.ts` refuses to use a helper
whose runtime codehash doesn't match the embedded artifact.

### The batch (one transaction)

```
EOA ──type-4 tx (to = self, authorizationList = [EOA → MetaMask delegator])──▶ EOA.execute(BATCH_DEFAULT, [
   WETH.approve(helper, 2e18),
   helper.swapAndSupply(2e18, 500, minUsdcOut, deadline)
])
```

Inside `execute`, `msg.sender` for both inner calls is the EOA. After the transaction the user
holds 0 WETH, about 2 WETH-worth of **aEthUSDC** at their usual address, and **zero outstanding
allowances**: the exact approval is fully consumed.

### How it's sent

- **Real user, in MetaMask:** `enterViaWallet()` sends an EIP-5792 `wallet_sendCalls` with
  `atomicRequired: true` (viem `forceAtomic: true`, `experimental_fallback: false`). MetaMask
  does the 7702 upgrade to its own delegator and shows **one** confirmation, which on first use
  includes the "switch to smart account" consent. Dapps can't ask MetaMask to sign a raw 7702
  authorization, and shouldn't: the wallet choosing its own audited delegate is the safe design.
  The code first checks `wallet_getCapabilities` for `atomic: supported|ready`, and **refuses
  rather than falling back to sequential transactions**. Afterwards it asserts that the bundle
  reports `atomic: true` and produced exactly one receipt.
- **Developer with a local key:** `npx tsx entry.ts enter` signs the authorization itself
  (`executor: 'self'`, explicit `chainId: 1`), and sends one type-4 transaction from the EOA to
  itself. This path produces the same on-chain result.

## Addresses and calls

| Contract | Address | Calls used |
|---|---|---|
| WETH9 | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | `approve`, `transferFrom`, `balanceOf`, `allowance` |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | `approve` (in helper), `balanceOf` |
| Uniswap V3 SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` | `exactInputSingle((tokenIn,tokenOut,fee,recipient,amountIn,amountOutMinimum,sqrtPriceLimitX96))` |
| Uniswap V3 QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` | `quoteExactInputSingle` (off-chain, via `eth_call`) |
| Uniswap V3 WETH/USDC 0.05% pool | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` | (used by the router; 0.3% tier also quoted) |
| Aave V3 Pool (Ethereum core) | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` | `supply(asset, amount, onBehalfOf, referralCode)` |
| aEthUSDC | `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c` | `balanceOf` (verification) |
| MetaMask EIP7702StatelessDeleGator v1.3.0 | `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` | `execute(bytes32 mode, bytes executionCalldata)` |

I checked every address on mainnet (code present, `NAME()`/`VERSION()` of the delegator, and the
aToken address from `Pool.getReserveData(USDC)`).

## Why this meets the constraints

- **Same address, no new wallet, no moved funds.** The EOA keeps its address, key, ENS name and
  history. 7702 adds a code pointer to the existing account; it doesn't create a new one. aTokens
  are minted to that same address. The only thing deployed is the helper: a shared, stateless
  utility that is not the user's account.
- **One confirmation.** One `wallet_sendCalls` in MetaMask, or one signed type-4 transaction for
  the local-key path.
- **Atomic.** It is one transaction, and the batch mode reverts everything on any failure. The
  swap-then-supply step is also a single helper call. If the supply fails (supply cap reached,
  reserve paused or frozen, etc.), the swap unwinds with it.
- **Supplies exactly what the swap returned.** The helper passes the router's returned `amountOut`
  to `supply`, so it isn't estimated in advance.

### Tested on an anvil mainnet fork (Prague rules, fresh EOA, 2 WETH, 0.01 ETH)

- Happy path: one tx. WETH went 2 → 0 and the account got about 5287.42 aEthUSDC (equal to the
  swap output, minus about 1 wei from aToken rounding). Afterwards: 0 USDC in the account, 0
  tokens left in the helper, 0 WETH allowance, and account code
  `0xef0100 ‖ 63c0…e32b`.
- Failure path: I set Aave's USDC supply cap to 1 via governance impersonation, so the swap
  succeeds but `supply` fails. The CLI's preflight simulation refused to send. I then forced the
  transaction on-chain anyway with a fixed gas limit: it was **mined as reverted**, and the account
  still had exactly 2 WETH, 0 USDC, 0 aUSDC and 0 allowance.

## What the developer must get right

1. **Batch mode must revert on failure.** Use `0x01` + 31 zero bytes, never the "try" exec type.
   In the wallet path, require `atomicRequired` and **never** enable the sequential fallback. A
   wallet that can't do atomic batches must cause an error, not a multi-transaction flow.
2. **Slippage and deadline.** `minUsdcOut` comes from a fresh QuoterV2 quote minus `SLIPPAGE_BPS`
   (default 0.5%, capped at 3%). The deadline is enforced on-chain by the helper. Without these,
   the swap can be sandwiched. Send through a private/MEV-protected route (MetaMask Smart
   Transactions, Flashbots Protect RPC). A quote is only a snapshot, so the on-chain minimum is
   what actually protects the user.
3. **Delegate choice is the security boundary of the whole account.** Whatever address the EOA
   delegates to can run arbitrary code as that account for as long as the delegation is in place.
   Only use an audited delegate (here MetaMask's, which is also what MetaMask's UI uses). Always
   sign authorizations with the **real chainId (1)**: `chainId: 0` is valid on every chain. Never
   sign authorizations a dapp hands you. The script refuses to overwrite an existing delegation
   to a different contract.
4. **Delegation persists, even if the transaction reverts.** 7702 authorizations are processed
   before execution; the fork test confirmed this. So after the first run, the account keeps the
   delegation to MetaMask's delegator. This is harmless with that delegate, since only the key
   holder can trigger `execute`. The user should still know that their address now has code. A
   few contracts treat "has code" as "is a contract" (`extcodesize` checks, some ERC-721
   `safeTransfer` flows). To revert to a plain EOA: MetaMask → account → "Switch back to regular
   account", or sign an authorization to `address(0)` and send a type-4 transaction.
5. **Helper integrity.** Deploy `WethToAaveUsdc` from the embedded bytecode (`entry.ts deploy`)
   or from source with the same solc settings (0.8.20, optimizer 200 runs, `--evm-version shanghai`,
   `--metadata-hash none`). `entry.ts` checks its runtime codehash before approving anything to
   it. Verify it on Etherscan so users can read what they are approving. Approve the **exact**
   amount, never unlimited.
6. **Aave reserve state.** USDC supply caps, pause/freeze and isolation-mode settings change via
   governance. If supply would fail, the whole transaction reverts (safe, but the user loses gas).
   Always simulate first. `entry.ts` runs `eth_simulateV1` with `msg.sender` = the EOA (the same
   context the batch has under 7702), and the local path's gas estimation simulates the full
   delegated transaction. Note that the first Aave supply of an asset normally enables it as
   collateral automatically. That doesn't matter for a supply-only position, but it does if the
   user later borrows.
7. **Chain and amounts.** The code asserts chainId 1 and uses the account's live WETH balance.
   Hard-coded addresses are mainnet-only. USDC has 6 decimals and WETH has 18.
8. **Gas.** A first-time type-4 transaction costs an extra ~25k gas for the authorization. The
   rest of the batch (approve, swap, Aave supply) is a few hundred thousand gas. Make sure the "only enough ETH for gas" balance
   really covers that at current base fees; the code lets viem estimate.
9. **Wallet support.** The one-confirmation MetaMask flow needs a MetaMask version with EIP-5792
   atomic batching on mainnet, and a keyring that can sign 7702 authorizations. Some
   hardware-wallet setups may report `atomic: unsupported`. In that case the tool stops instead
   of degrading.

## Running it

```bash
npm install
npm run typecheck

# one-time: deploy the helper (any funded key; not the user's account)
RPC_URL=https://... PRIVATE_KEY=0x<deployer> npx tsx entry.ts deploy

# dry run: quote, min-out, simulation, current delegation
RPC_URL=https://... PRIVATE_KEY=0x<user> HELPER=0x<helper> npx tsx entry.ts quote

# execute (one type-4 transaction)
RPC_URL=https://... PRIVATE_KEY=0x<user> HELPER=0x<helper> SLIPPAGE_BPS=50 npx tsx entry.ts enter
```

In a dapp (MetaMask), call `enterViaWallet(createWalletClient({ chain: mainnet, transport:
custom(window.ethereum) }), publicClient, HELPER)`. Test against an anvil fork first:
`anvil --fork-url $RPC_URL`, then point `RPC_URL` at it.
