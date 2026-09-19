# One-click WETH → USDC → Aave V3, from the user's existing EOA

## The approach

**EIP-7702 (live on mainnet since Pectra, May 2025) with one atomic batch. A tiny stateless helper handles the "unknown amount" step.**

A single type-4 transaction, signed and sent by the user's existing EOA:

1. **Authorization.** The EOA signs an EIP-7702 authorization that sets its code to the delegation
   designator `0xef0100 || 0x4Cd241E8d1510e30b2076397afc7508Ae59C66c9`. That address is eth-infinitism's
   **Simple7702Account** (account-abstraction v0.8.0). It is small and audited, and it has **no storage and no initializer**.
2. **Call.** The same transaction calls the EOA itself (`to = user`) with `executeBatch(calls)`. Simple7702Account
   only allows `executeBatch` when `msg.sender == address(this)` (or the v0.8 EntryPoint with a signature from the
   same key). Each inner call therefore runs with **`msg.sender` = the user's address**:

| # | target | call | why |
|---|--------|------|-----|
| 1 | WETH `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | `approve(SwapRouter02, amountIn)` | exact amount; fully used by step 2, so the allowance ends at 0 |
| 2 | Uniswap SwapRouter02 `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` | `multicall(deadline, [exactInputSingle(WETH→USDC, fee 500, recipient = helper, amountIn, amountOutMinimum = minOut, 0)])` | swaps the whole WETH balance in the 0.05% pool; the deadline comes from the `multicall` wrapper because SwapRouter02's struct has no deadline field |
| 3 | Helper `SupplyAllToAaveV3` | `supplyAll(USDC, minOut)` | reads **its own balance** (= exactly what the swap returned), approves Aave for that exact amount, and calls `Pool.supply(USDC, amount, onBehalfOf = msg.sender, 0)` |

Aave V3 Pool: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`. aEthUSDC: `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c`.

### Why a helper is needed
`Pool.supply` needs an exact `amount`, and unlike `withdraw` or `repay` it does **not** accept `type(uint256).max`. A
static batch is encoded before the transaction runs, so it cannot pass the swap's return value to the next call. There are three ways around this:

- **Supply the quoted minimum.** This leaves leftover USDC in the wallet, so it breaks "supply every USDC."
- **Use an exact-output swap.** This leaves leftover WETH, so it breaks "swap all 2 WETH."
- **Send the swap output to a contract that supplies "whatever I hold."** This is what we do.

`contracts/SupplyAllToAaveV3.sol` is about 30 lines. It has no owner, no storage and no upgrade path. It credits only
`msg.sender` and never holds funds between transactions. It is **not an account**: it holds nothing of the user's and
has no authority over the user. Tokens are in it only between calls 2 and 3 of the same transaction. It is deployed once, by anyone,
through the deterministic CREATE2 factory (`npx tsx entry.ts deploy-helper`). `entry.ts` refuses to run unless the
on-chain runtime code hash matches the compiled source embedded in the script.

## Why this meets the constraints

- **Same address.** The transaction is sent *from* the user's EOA, and the aUSDC is minted *to* it. The ENS name,
  history and nonce don't change. 7702 does not create a new account; it attaches code to the existing one. The key
  keeps full control, and the EOA can still send normal transactions.
- **No new wallet, nothing the user deploys as "an account."** Simple7702Account is already deployed and shared by
  everyone. The helper is a public utility, and anyone (the developer, not the user) deploys it once.
- **One confirmation, atomic.** One signature from the user (the key signs the authorization and the transaction in the
  same step). All three calls run inside one call frame of one transaction. If anything reverts (slippage, deadline, Aave
  supply cap, paused reserve, the helper's `minAmount`), **the whole batch reverts**. The state "swap landed but supply
  didn't" can't happen.
- **No approvals beforehand, and none left afterwards.** Mainnet WETH9 has no `permit`, and Permit2 would need a
  prior approval transaction. With 7702, the approval runs in the same atomic batch, for the exact amount, and is used up.
- **The supplied amount is set at execution time.** The helper supplies `balanceOf(helper)` at that moment.

### Tested on an anvil mainnet fork (block ~26.01M), using a fresh EOA holding 2 WETH and 0.01 ETH
- The EOA's code went from `0x` to `0xef01004cd241…66c9`, and the tx went from the user to the user.
- **2 WETH → +5288.666252 aUSDC** (the quote was 5288.666253, a 1-wei aToken rounding difference). WETH left: 0. USDC left
  in the EOA: 0. USDC left in the helper: 0. WETH→router allowance: 0. Gas: 315,763 (including the authorization).
- **Atomicity check:** a batch whose swap would succeed but whose `supplyAll` minimum can't be met reverted as a whole.
  The WETH stayed in the EOA, the allowance stayed at 0, and the helper stayed empty.
- On a second run with the account already delegated, the script skips the authorization and succeeds (261,666 gas).
- A third party calling `executeBatch` on the delegated EOA reverts with `not from self or EntryPoint`.
- **Real-world finding:** anvil's well-known dev key #0 is *already delegated on mainnet* to someone else's contract
  (sweeper bots). The script's "refuse to overwrite an existing delegation" guard caught this.

## What the developer must get right

1. **The delegation target is the most important security decision.** While the delegation is active, the delegate
   code can do anything the EOA can do. Only delegate to audited code whose address you've checked. That code must
   have no initializer (an initializer can be front-run) and no storage layout that could clash with a later
   delegate. Simple7702Account meets these requirements. **Never** delegate to an unaudited or upgradeable contract,
   or to your own freshly written "7702 wallet."
2. **The delegation persists.** It stays after the transaction, *even if the transaction reverts*. It remains until
   the user signs a new authorization. Removing it (delegating to `address(0)`) takes a second transaction; it can't
   happen in the same one. Say this clearly to the user. Keeping it is safe with Simple7702Account, which only
   accepts calls from the key itself.
3. **Don't clobber an existing delegation.** If `getCode(user)` shows another `0xef0100…` (for example MetaMask's
   smart-account upgrade), overwriting it changes the wallet's behaviour. The script aborts in that case.
4. **Authorization details.** Use chainId **1**, not 0 (0 means "valid on every chain"). When the same EOA both signs
   and sends, the authorization nonce must be `txNonce + 1`; viem's `executor: 'self'` handles this. The transaction
   `to` is the user's own address.
5. **Slippage and MEV.** The minimum output is the lower of the QuoterV2 quote and the Chainlink ETH/USD price
   (`0x5f4e…8419`, with a staleness check), minus `SLIPPAGE_BPS`. The script aborts if the pool quote is more than
   `MAX_ORACLE_DEVIATION_BPS` below the oracle price. This assumes USDC ≈ $1. The minimum is enforced twice, by
   Uniswap and by the helper. There's also a 10-minute deadline. **Send through a private, MEV-protected RPC** (for
   example Flashbots Protect; first confirm it accepts type-4 transactions). A $5k swap in the public mempool is a
   sandwich target.
6. **Verify every address and the helper's code.** The addresses in `ADDR` were checked on chain. Keep the
   helper's code-hash check. If you change the source or compiler settings, the CREATE2 address changes too. Never
   send tokens to the helper outside the batch: anyone can call `supplyAll`, which would credit *them*.
7. **Aave side effects.** The reserve can be frozen or paused, or its supply cap reached; the tx then reverts
   atomically, which is the correct outcome. The first supply of an asset turns it on as collateral. That's harmless
   with no borrows, but the user should know.
8. **Simulate, then confirm, then sign.** The script first simulates the exact batch without signing anything, by
   overriding the EOA's code with the 7702 designator. It shows the amounts, minimum and addresses, and waits for a
   typed `yes`. Only after that does it sign the authorization, estimate gas, check `MAX_GAS_ETH`, and send. It
   reports the actual aUSDC change afterwards. Keep this order.
9. **Key handling.** `PRIVATE_KEY` in an environment variable is for fork testing only. Never commit it; `.gitignore`
   covers `.env*`. A two-year-old MetaMask account shouldn't have its key exported at all. For the real user, use
   `sendWithWallet()`. It sends the same three calls through **EIP-5792 `wallet_sendCalls` with `forceAtomic: true`**
   after checking that `atomic` is `supported` or `ready`. MetaMask then upgrades the same EOA to its own audited
   delegator (MetaMask Smart Account) and runs the batch after one confirmation. Wallets do not let dapps inject
   arbitrary 7702 authorizations. This wallet path is written against viem's API but was **not** run here, because it
   needs a browser wallet. Test it on a fork or testnet with MetaMask before shipping.
10. **Test on a fork first.** Before touching real funds, run
    `anvil --fork-url $MAINNET_RPC` and then `RPC_URL=http://127.0.0.1:8545 npx tsx entry.ts --send` with a throwaway key.

## Files
- `entry.ts` has the whole implementation: `buildPlan` (read state, get price, build the batch), the local-key CLI path using an explicit 7702 authorization, `deploy-helper`, and `sendWithWallet` (EIP-5792).
- `contracts/SupplyAllToAaveV3.sol` is the helper source. Compile with solc 0.8.20 `--optimize --optimize-runs 200 --evm-version shanghai --metadata-hash none`.
- Run it: `npm install`, then `RPC_URL=… PRIVATE_KEY=… npx tsx entry.ts [--send | deploy-helper]`.
