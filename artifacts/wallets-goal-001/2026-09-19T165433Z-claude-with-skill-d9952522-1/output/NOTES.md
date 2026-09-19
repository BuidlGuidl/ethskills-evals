# One-click WETH → USDC → Aave V3, from an existing EOA

## Approach: one EIP-7702 transaction the account sends to itself

Since the Pectra upgrade (May 2025), an ordinary EOA on Ethereum mainnet can
sign an **EIP-7702 authorization** that makes its address run a contract's
code. The authorization goes inside a **type-4 transaction**, and it is applied
*before* that transaction's call runs. So one transaction can both give the
account code and use it:

```
type-4 tx   from: user EOA   to: user EOA   data: enter(wethIn, minUsdcOut, fee, deadline)
            authorizationList: [ sign(chainId=1, WethToAaveEntry, nonce) ]

  in the EOA's own context (address(this) == the user's address):
    WETH.approve(SwapRouter02, wethIn)                     // exact amount, fully used
    out = SwapRouter02.exactInputSingle(WETH→USDC, wethIn, minUsdcOut, recipient = self)
    USDC.approve(AavePool, out)                            // exact amount, fully used
    AavePool.supply(USDC, out, onBehalfOf = self, 0)       // `out` is only known at runtime
    require(both allowances == 0)
```

- `src/WethToAaveEntry.sol` is the delegate code. It has no storage, no owner,
  no initializer and no upgrade path. `enter` reverts unless
  `msg.sender == address(this)`, which only holds when the account's own key
  signed the transaction.
- `entry.ts` checks the setup, gets a quote, runs a dry-run simulation, shows a
  confirmation step, then signs and sends the transaction with viem
  (`signAuthorization` + `sendTransaction({ authorizationList })`). It also has
  `status` and `clear` commands.

### Why an ordinary batch is not enough

The supplied amount is whatever the swap returns. A wallet batch
(EIP-5792 `wallet_sendCalls`, Multicall, and similar) signs fixed calldata up
front and cannot feed one call's return value into the next. Aave V3 `supply`
also has no "use my whole balance" setting: it transfers exactly `amount`.
Something must read the swap's output while the transaction runs and pass it to
`supply`. Here that is the delegate code, running as the user's account.

## How it meets the user's constraints

| Constraint | How |
|---|---|
| Same address, same history, same ENS name | Nothing moves. The swap's `recipient` and Aave's `onBehalfOf` are the user's own address, so the aUSDC is minted there. The ENS name, nonce and history are unchanged. |
| No new wallet and no deployed "account" | 7702 gives the existing EOA code. No smart-wallet proxy is created, no counterfactual address exists and no funds move. The one deployed contract, `WethToAaveEntry`, is shared, ownerless logic. It never holds funds and is not an account (like a library, anyone can deploy it). The same key still controls the account fully. |
| No prior approvals, single confirmation | Both approvals happen inside the same transaction, for exact amounts, and are used up. The contract checks that both are back to 0. There is no separate approve or Permit2 setup step. |
| Atomic | It is one transaction. If the swap misses `minUsdcOut`, Aave rejects the supply (pause, freeze, supply cap) or the deadline has passed, the whole call reverts. The user keeps their 2 WETH and pays only gas. "Swapped but not supplied" is not a possible end state. |
| Supply = actual swap output | `supply` receives `exactInputSingle`'s return value at runtime. Using that value rather than `balanceOf` also leaves any USDC the account already held untouched. |

**Tested on a mainnet fork** (anvil, Prague, `scripts/fork-test.sh`, throwaway keys):
- A fresh EOA with 2 WETH and 0.2 ETH sent one type-4 tx (≈344k gas). Result: WETH 2 → 0, aEthUSDC 0 → 5295.62, USDC left in the wallet 0, both allowances 0.
- A second test forced the minimum output too high. The tx reverted, the WETH stayed at 2, **and the delegation was still set** (see below).
- A direct call to `enter` from another address reverts with `OnlySelf`.
- `clear` returned the account to a plain EOA.

All addresses were also checked on mainnet (code present, and cross-checked with
`router.WETH9()`, `router.factory()`, `aToken.POOL()`,
`aToken.UNDERLYING_ASSET_ADDRESS()` and `pool.getReserveAToken(USDC)`):

| | Address |
|---|---|
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Uniswap V3 SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` |
| Uniswap V3 QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |
| Uniswap V3 Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` (WETH/USDC 0.05% pool `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640`) |
| Aave V3 Pool (Core market) | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |
| aEthUSDC | `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c` |

## Running it

```bash
npm install
forge build                                   # produces the artifact entry.ts checks against
FORK_URL=<mainnet rpc> scripts/fork-test.sh   # rehearse first

# deploy the delegate once (from any funded deployer, not necessarily the user):
forge create src/WethToAaveEntry.sol:WethToAaveEntry --rpc-url $RPC_URL --account <deployer-keystore> --broadcast

export RPC_URL=... ENTRY_CONTRACT=0x...       # PRIVATE_KEY: see "Key handling"
npx tsx entry.ts status
npx tsx entry.ts enter                        # prints the full plan, waits for "yes"
npx tsx entry.ts clear                        # recommended right after
```

## What the developer must get right

1. **The delegation outlasts the transaction.** A 7702 delegation stays until
   another authorization replaces or clears it. It is not limited to the
   transaction that set it. A transaction whose call *reverted* still leaves
   the delegation in place (seen in the fork test). Destroying or ignoring the
   delegate contract does not remove it; only a new signed authorization does.
   `entry.ts clear` signs an authorization to `address(0)`, which resets the
   account's code. Run it after `enter`, whether `enter` succeeded or failed.
   Clearing is a second transaction, but it moves no funds and does not affect
   atomicity.

2. **Delegate code has full power over the account.** Whatever the account
   delegates to can move everything it holds, now and later. So:
   - Only delegate to bytecode you have reviewed. `entry.ts` refuses unless the
     on-chain runtime code at `ENTRY_CONTRACT` matches the local
     `forge build` output byte for byte. Keep `foundry.toml` settings unchanged
     so the match is reproducible.
   - Keep the contract stateless and self-call-only. With 7702, storage belongs
     to the EOA and survives changes of delegate. An initializer or owner slot
     could be front-run or collide with a later delegate. Do not add either.
   - Get the code audited before it goes near real users. It is ~100 lines and
     makes calls only to fixed WETH/USDC/Uniswap/Aave addresses, but it is still
     code acting as a user's wallet.

3. **While delegated, the account has code, so it behaves differently.**
   Contracts that check `code.length` will treat it as a contract. In
   particular, ERC-1271 signature checks (Permit2, Seaport, many
   `SignatureChecker` users) will call `isValidSignature`, which this contract
   does not implement. The user's off-chain signatures to those protocols fail
   until the delegation is cleared. The contract does implement `receive()` and
   the ERC-721/1155 receiver hooks, so incoming ETH and NFTs still arrive.
   Clearing removes all of these differences.

4. **The authorization must be scoped correctly.** Its `chainId` must be `1`,
   never `0` (0 is valid on every chain). The script checks this. Because the
   same account signs the authorization and sends the transaction, the
   authorization nonce must be the account nonce + 1. viem's
   `executor: 'self'` handles that. If the account already delegates to
   something else (for example MetaMask's own smart-account delegator), this
   transaction **replaces** it. The script prints a warning at the confirmation
   step. Tell the user to never sign a 7702 authorization for code they have not
   verified. That is now one of the most dangerous things a wallet can be asked
   to sign.

5. **Key handling.** viem's `signAuthorization` needs a local account, and
   MetaMask's extension will not sign a 7702 authorization for a third-party
   contract over RPC. So this script needs the account's private key.
   - Supply it only at run time (`read -s PRIVATE_KEY; export PRIVATE_KEY`) on
     a machine you trust. Never put it in the repo, in `.env.example`, in a
     script default or in shell history. `.gitignore` covers `.env*`, but do not
     rely on that.
   - A key that has been pasted into a chat, prompt, ticket or log is
     compromised. Rotate it rather than use it.
   - Exporting a two-year-old MetaMask key onto a dev machine increases its
     exposure. For a real product, the in-wallet route is MetaMask's own 7702
     smart account via `wallet_sendCalls` with `atomicRequired: true`. Because
     that batch is fixed calldata, it would need a small helper contract that
     receives the swap output and calls `supply(onBehalfOf = user)`. That design
     keeps custom code off the account itself. It is not implemented here.

6. **Price protection.** The swap has a floor: `minUsdcOut` = QuoterV2 quote
   minus `SLIPPAGE_BPS` (default 0.5%, capped at 3%). The script also refuses
   if the quote is more than 2% below Aave's Chainlink-backed oracle, and the
   contract enforces a 10-minute `deadline`. The transaction is still
   sandwichable up to the slippage limit if it goes to the public mempool, so
   send it through a private / MEV-protected RPC (for example Flashbots
   Protect) as `RPC_URL`.

7. **Gas is checked at send time.** The script estimates gas with the real
   authorization attached (7702 adds 25k per authorization), adds a 20% buffer,
   prices it with current `estimateFeesPerGas`, and aborts if the account's ETH
   cannot cover the worst case. Costs are shown in ETH, not converted from a
   remembered USD price. It used ≈344k gas on the fork (≈55k for `clear`).

8. **The confirmation step is the safety check.** Before anything is broadcast,
   the script prints the account and its ENS name, the checksummed delegate,
   router and pool addresses, the exact WETH in, the quoted, minimum and
   simulated USDC, the deadline, gas, and worst-case cost. It then waits for
   `yes`. The authorization is signed in memory before this step so gas can be
   estimated, but it is not sent unless the user confirms.

9. **Smaller details.** The aUSDC balance can read 1 unit below the supplied
   amount because of Aave's scaled-balance rounding; this is expected. If Aave
   pauses or freezes USDC, or its supply cap is reached, between simulation and
   inclusion, the transaction reverts atomically. Only the WETH/USDC pair on the
   Aave Core market is supported; the addresses are constants in both files and
   must stay in sync.
