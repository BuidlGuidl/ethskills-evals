# One-click WETH → USDC → Aave V3, from the user's existing EOA

## The approach

**EIP-7702 batching (live on mainnet since Pectra, May 2025) plus a tiny stateless helper contract.**

The user's own address sends **one transaction**. Through a 7702 delegation, that transaction runs a
two-call batch *as the user's address*:

| # | target | call | why |
|---|--------|------|-----|
| 1 | WETH `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | `approve(helper, wethIn)` | exact amount; the next call uses all of it |
| 2 | helper (`contracts/WethToAaveUsdc.sol`) | `enter(wethIn, minUsdcOut, 500, deadline)` | swap, then supply what the swap returned |

Inside `enter`, which runs in the same transaction:

1. `WETH.transferFrom(msg.sender → helper, wethIn)`
2. `SwapRouter02.exactInputSingle(WETH→USDC, fee 0.05%, recipient = helper, amountOutMinimum = minUsdcOut)` on Uniswap V3 SwapRouter02 `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`
3. `USDC.approve(Pool, amountOut)`, then `Pool.supply(USDC, amountOut, onBehalfOf = msg.sender, 0)` on the Aave V3 Pool `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`

### Why a helper contract is needed

The supplied amount is only known once the swap has run. A plain batch of calls (7702, EIP-5792 or
anything else) is **static calldata**: `Pool.supply(USDC, amount, …)` needs `amount` written into
it before signing. None of the options without a helper meet the requirements:
- Supplying the quoted minimum leaves USDC idle in the wallet, which breaks "supply every USDC".
- `exactOutput` for a fixed amount leaves WETH unswapped, which breaks "swap all 2 WETH".
- Aave V3 `supply` does not accept `type(uint256).max`.

The helper reads the swap's return value on-chain and supplies exactly that amount. It is **not an
account**:
- It has no owner, no storage, no upgradeability and no admin functions.
- It holds tokens only for the duration of one call.
- The source of funds and the beneficiary are both `msg.sender`. No parameter can redirect them,
  so anyone calling it can only spend their own approved WETH.

It is deployed **once by the developer, for all users**, from any funded key; that key gains no
privileges. The user deploys nothing.

Other addresses used: USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, aEthUSDC
`0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c` (post-check only), Uniswap QuoterV2
`0x61fFE014bA17989E743c5F6cB21bF9697530B21e` (off-chain quote), Simple7702Account
`0x4Cd241E8d1510e30b2076397afc7508Ae59C66c9`.

## Two ways to sign, same calls

**A. The real user in MetaMask: `enterWithWallet()`** (EIP-5792 `wallet_sendCalls`, `atomicRequired: true`).
- MetaMask offers to switch the account to its own audited 7702 delegator ("smart account"). The
  user sees **one confirmation** for the whole batch.
- The key never leaves MetaMask.
- The code checks `wallet_getCapabilities` → `atomic.status` and refuses if the wallet cannot run
  the batch atomically. viem's `forceAtomic` throws rather than falling back to separate
  transactions.
- MetaMask does not let dapps request a 7702 delegation to an arbitrary contract. That is correct
  behaviour, and it is why this path goes through `wallet_sendCalls` rather than a raw authorization.

**B. The CLI (`npx tsx entry.ts`) with `PRIVATE_KEY`.** For developers, fork testing, or a key you
already hold outside a browser wallet.
- It sends a type-4 transaction to the user's own address, carrying an authorization that delegates
  it to eth-infinitism's audited **Simple7702Account** (account-abstraction v0.8).
- The transaction calls `executeBatch([...])`. Only the account itself (or the EntryPoint, with a
  signature from the same key) can call `executeBatch`.
- **Do not export the user's MetaMask key to run this.** A two-year-old key pasted into a terminal,
  `.env` file or chat has left the wallet. For that user, use path A.

## Why it meets the constraints

- **Same address, same ENS and history.** 7702 attaches code to the existing EOA. `msg.sender` for
  every call is the user's address, and the Aave position (aUSDC) is minted to it. No funds move
  to another account.
- **No new wallet, nothing that is "an account" gets deployed.** The delegate is an existing, shared,
  audited contract, and the user deploys nothing. The helper is shared plumbing deployed by the
  developer.
- **Single atomic action.**
  - The approve, swap and supply all execute inside one transaction.
  - `executeBatch` bubbles up any inner revert, and so does the helper. Slippage beyond
    `minUsdcOut`, a paused or frozen Aave reserve, a reached supply cap or an expired deadline all
    revert **the whole transaction**. That includes the approval.
  - A state where the swap landed but the supply did not cannot occur.
- **No prior approvals needed.** The approval is the first call in the batch, for the exact amount,
  and the batch uses all of it. The residual allowance afterwards is 0.
- **Only ETH for gas.** No ETH value is sent. Measured gas is ~458k including the delegation, about
  0.0005 ETH at 1.1 gwei on the day tested.

### Verified on an anvil mainnet fork (block ~26,013,205)
- A fresh EOA with 2 WETH and no code: one transaction swapped 2 WETH → 5289.968044 USDC, all of it
  supplied. aEthUSDC went 0 → 5289.968042 (Aave index rounding). WETH left: 0. Allowance left: 0.
- Forced failure (impossible `minUsdcOut`): the transaction reverted. The WETH stayed in the wallet
  and the approval was rolled back to 0.
- Another address calling `executeBatch` on the delegated EOA: reverted.
- `revoke-delegation`: the account's code went back to `0x`.
- The MetaMask path (A) typechecks, but was not exercised against a real MetaMask.

## What the developer must get right

1. **The delegation persists.** It is not scoped to this transaction. It stays after the batch, and
   it stays even if the batch reverts. From then on the address runs Simple7702Account's code (or
   MetaMask's delegator on path A). Tell the user this. To remove it, sign a new authorization to
   `0x0000000000000000000000000000000000000000` (`npx tsx entry.ts revoke-delegation`, or MetaMask's
   "switch back to standard account"). Nothing done to the delegate contract removes it.
2. **Delegate only to audited, well-known code, and verify it.**
   - A 7702 delegate has full control of the EOA's assets.
   - Never delegate to a freshly written contract, and never to anything that exposes an
     unauthenticated `execute`.
   - The CLI refuses to overwrite an existing delegation to some other contract. During testing,
     anvil's well-known dev account turned out to be delegated on mainnet to a sweeper, which is
     exactly the case that guard catches.
3. **Pin and verify the helper.** `HELPER_ADDRESS` is checked by comparing `keccak256(code)` with
   the hash of the compiled `WethToAaveUsdc` before anything is signed. A wrong address fails
   closed. If you change the Solidity, recompile it (solc 0.8.20, `--optimize --optimize-runs 200
   --evm-version shanghai`) and update `HELPER_CREATION_BYTECODE` / `HELPER_RUNTIME_KECCAK`.
4. **Slippage and MEV.**
   - `minUsdcOut` comes from a live QuoterV2 quote minus `SLIPPAGE_BPS` (default 50, capped at 300).
   - The deadline is 5 minutes, enforced in the helper, because SwapRouter02's
     `exactInputSingle` has none.
   - A public-mempool swap can be sandwiched up to the slippage limit. Broadcast through a private
     RPC: set `SEND_RPC_URL=https://rpc.flashbots.net` (Flashbots Protect) or equivalent.
5. **Authorization nonce.**
   - When the sender signs its own authorization, the authorization must carry the transaction
     nonce + 1. The CLI pins both.
   - If any other transaction from the account lands between signing and inclusion (for example
     the user clicks something in MetaMask meanwhile), the authorization becomes invalid **but the
     transaction still "succeeds"**. It becomes a no-op call to a plain EOA.
   - The CLI re-checks the nonce after confirmation. It also checks the outcome afterwards (the
     `Entered` event, aUSDC balance and leftover WETH/allowance) rather than trusting `status`.
   - An authorization is a signature anyone could broadcast. Here it only points at
     Simple7702Account, but don't sign authorizations you won't use.
6. **The human gate.**
   - Before signing, the CLI prints the WETH amount and the quoted and minimum USDC.
   - It prints every checksummed address involved: helper, router, pool, delegate, and
     `onBehalfOf` (which is the user's own address).
   - It prints the live gas estimate and fee, and the cost in ETH. The USD figure is derived from
     this same quote, not from a remembered price.
   - It then waits for a typed `yes`. With no TTY it refuses to send.
   - It also checks that the chain is mainnet and that the gas balance is sufficient.
7. **Secrets.**
   - `PRIVATE_KEY` / `DEPLOYER_PRIVATE_KEY` are read only from the environment; nothing is
     hardcoded, and there are no defaults.
   - `.gitignore` covers `.env*` — keep it that way before the first push.
   - A key that has appeared in a chat, ticket or commit is burned: rotate it, and don't fund it.
8. **Aave specifics.**
   - The supply can revert on the USDC supply cap or if the reserve is paused or frozen. Because
     the action is atomic, that is safe; the simulation (`eth_call` with the authorization) shows
     it before signing.
   - Supplying USDC does not enable borrowing against anything by itself. USDC is enabled as
     collateral by default on first supply, which only matters if the user later borrows.

## Running

```bash
npm install
# once, by the developer (any funded key; it gains nothing):
RPC_URL=https://... DEPLOYER_PRIVATE_KEY=0x... npm run deploy-helper
# the entry (interactive confirmation):
RPC_URL=https://... SEND_RPC_URL=https://rpc.flashbots.net \
  PRIVATE_KEY=0x... HELPER_ADDRESS=0x... SLIPPAGE_BPS=50 npm run enter
# optional, afterwards:
RPC_URL=https://... PRIVATE_KEY=0x... npm run revoke-delegation
```

Fork test: run `anvil --fork-url <mainnet rpc> --chain-id 1`, point `RPC_URL` at it, and use a
**fresh random key**, not anvil's default accounts (see point 2).
