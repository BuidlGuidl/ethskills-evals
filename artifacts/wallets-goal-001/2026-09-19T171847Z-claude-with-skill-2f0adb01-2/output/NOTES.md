# One-click WETH → USDC → Aave V3, from an existing EOA

## Approach

**EIP-7702 + an atomic batch + a small stateless "supply everything" helper.**

EIP-7702 has been live on mainnet since the Pectra upgrade (May 2025). It lets an ordinary EOA set a
*delegation designator* (`0xef0100 || implementation`) as its code. After that, calls to the EOA run
the implementation's code **in the EOA's own context**: same address, same balances, same nonce,
same ENS name and history, same private key. Nothing is deployed "as an account", and no funds move.

We delegate to **MetaMask's own `EIP7702StatelessDeleGator` v1.3.0**
(`0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B`, from MetaMask's audited Delegation Framework). This is
the contract MetaMask itself uses when it "upgrades" an account to a smart account, so the user ends up
in a state their wallet already understands. It is *stateless*: no initializer, no owner storage;
signatures are checked against the EOA's own key. So there is no initialization step for anyone to
front-run.

One transaction then does everything. The EOA sends a type-4 transaction **to itself** that carries
the authorization and calls `execute(mode = BATCH/revert-on-failure, Execution[])` (ERC-7579). The
batch is:

| # | Target | Call | Why |
|---|--------|------|-----|
| 1 | WETH `0xC02a…6Cc2` | `approve(SwapRouter02, amountIn)` | Exact amount. The swap uses it all, so the allowance is back to 0 afterwards. |
| 2 | Uniswap V3 SwapRouter02 `0x68b3…Fc45` | `exactInputSingle(WETH→USDC, fee 500, recipient = helper, amountIn, amountOutMinimum = minOut, 0)` | Swaps all of the WETH. The USDC goes straight to the helper. |
| 3 | `SupplyAllToAave` helper | `supplyAll(USDC, minOut)` | Reads its own USDC balance **at execution time**, approves the Aave Pool for that amount, and calls `Pool.supply(USDC, amount, onBehalfOf = msg.sender = EOA, 0)`. |

The aEthUSDC (`0x98C2…6F5c`) is minted directly to the user's EOA.

### Why a helper at all?

A batch of calls is *static calldata*. Aave V3 `supply()` needs an exact `amount`. Unlike
`withdraw`, it has no "max" sentinel. The swap output isn't known until the transaction runs.
Something has to read the balance on-chain between the swap and the supply. The options are:

* **Use a custom 7702 implementation with a `swapAndSupply()` function.** This puts bespoke,
  unaudited code in charge of the user's main account, and that delegation persists. It's also
  impossible from MetaMask, which only lets an account delegate to MetaMask's own DeleGator. Rejected.
* **Supply only `amountOutMinimum` and leave the dust.** This violates "supply every USDC". Rejected.
* **Use a tiny stateless helper that is only ever the swap recipient.** Chosen. It's 30 lines
  (`contracts/SupplyAllToAave.sol`), has no owner, no storage, no upgradeability, and the Aave Pool
  address is a constant. **It never receives any allowance from the user.** It only ever touches
  tokens that were sent to it inside the same atomic transaction. This is a periphery contract, like
  a router. It is not an account.

The helper is deployed once, permissionlessly, through the canonical CREATE2 factory
(`0x4e59b448…956C`) with salt 0. That makes its address, `0xEc1F50949836Cf6C7DdcDede24C59c13aEb564db`,
a function of its exact bytecode. `entry.ts` derives the address from the embedded init code, so if
there is code at that address, it is this code. **As of writing it is not yet deployed on mainnet.**
The developer runs `deploy-helper` once, from any funded key other than the user's.

## Why this meets the constraints

* **Same address, no new wallet.** 7702 only sets code on the existing EOA. `msg.sender` for the
  Uniswap and Aave calls is still `0xUser…`, and the aTokens land there. There's no Safe, no 4337
  account, no counterfactual address, and no transfer of funds.
* **Single confirmation.**
  * *Path A, local signer (`entry.ts` CLI):* one type-4 transaction. The same key signs the 7702
    authorization (`executor: 'self'`, so the authorization nonce is the tx nonce + 1) and the
    transaction.
  * *Path B, MetaMask (`sendWithInjectedWallet`):* EIP-5792 `wallet_sendCalls` with
    `forceAtomic: true`. MetaMask shows one confirmation that includes the account upgrade, and
    submits one transaction. The code refuses to proceed if the wallet doesn't report `atomic`
    capability as `supported`/`ready`, and after inclusion it checks `status.atomic`.
* **Atomic.** It's one transaction, and the DeleGator's default exec type reverts the whole batch if
  any call fails. If the swap succeeds but the supply fails, the swap is rolled back too. This was
  verified on a mainnet fork: forcing the supply leg to revert after a successful swap left
  WETH = 2, USDC = 0, aUSDC = 0 and allowance = 0.
* **Supplied amount = actual swap output.** The helper supplies `balanceOf(helper)`, read after the
  swap. On the fork, 2 WETH → 5304.745110 USDC gave +5304.745109 aEthUSDC (1 wei of aToken rounding),
  with 0 WETH, 0 loose USDC, 0 left in the helper and 0 residual allowance.

## What the developer must get right

1. **Delegation is persistent, and it survives a reverted batch.** The 7702 authorization is applied
   before execution. Even if the batch reverts, the account stays delegated to the DeleGator (this
   was verified on the fork). That's acceptable here because it's MetaMask's audited, stateless
   contract, and it's what MetaMask would install anyway. But tell the user. `entry.ts undelegate --send`
   resets the code to empty; in MetaMask, the user can switch back to a standard account.
2. **Only delegate to the known DeleGator, and never overwrite unknown delegations.** `entry.ts`
   aborts if the account already has a different designator. During testing, the well-known anvil
   key #0 turned out to be delegated to an unknown sweeper contract on real mainnet, and the guard
   caught it. Never delegate a user's main account to a contract that has an initializer, an owner
   slot, or upgradeable storage.
3. **Authorization chainId must be 1, not 0.** A chainId-0 authorization is valid on every chain.
   `entry.ts` passes `chainId: mainnet.id` and checks the RPC's chain id.
4. **Slippage protection is mandatory.** `minOut` comes from QuoterV2 (fee tier 500, the deepest
   pool, `0x88e6…5640`) minus `--slippage-bps` (default 50, capped at 300). It's enforced twice: in
   the swap (`amountOutMinimum`) and in `supplyAll(minAmount)`. For a real ~$5k trade, send through
   a private mempool/RPC (e.g. Flashbots Protect) to reduce sandwiching within that tolerance.
   Re-quote right before sending; a stale quote causes either a revert or a loose bound.
5. **Simulate first.** The default run is a dry run. It `estimateGas`es the exact type-4 transaction,
   authorization included, and only broadcasts after `--send` plus a typed "yes". It prints the
   account, amounts, min output, destination and gas cost.
6. **Verify the addresses yourself** before real funds (`cast code` / Etherscan). The values used:

   | Contract | Address |
   |---|---|
   | WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
   | USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
   | Uniswap V3 SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` |
   | Uniswap V3 QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |
   | Uniswap V3 USDC/WETH 0.05% pool | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` |
   | Aave V3 Pool (Core) | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |
   | aEthUSDC | `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c` |
   | MetaMask EIP7702StatelessDeleGator v1.3.0 | `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` |
   | CREATE2 factory | `0x4e59b44847b379578588920cA78FbF26c0B4956C` |
   | SupplyAllToAave helper (CREATE2, salt 0) | `0xEc1F50949836Cf6C7DdcDede24C59c13aEb564db` |

   Before using the helper, rebuild it and check that the init code matches `HELPER_INIT_CODE`:
   `forge build --contracts contracts --use 0.8.26 --optimize --optimizer-runs 200 --evm-version cancun --no-metadata -o out`.
   Ideally, verify it on Etherscan and have it reviewed. It's small, but it sits in the money path.
7. **Only use the helper inside an atomic batch.** Anything sitting in the helper between
   transactions can be supplied by the next caller to *their* account. Never set it as a swap
   recipient in a transaction that doesn't also call `supplyAll` in the same batch. The helper uses
   plain `approve`, which is fine for USDC. For a USDT-style token, switch to `forceApprove`.
8. **Aave state can make the supply revert.** A USDC supply cap, a paused or frozen reserve, or a
   gas estimate from a stale block will all cause a revert. Because the batch is atomic, a revert
   costs only gas; the user never ends up holding unsupplied USDC.
9. **Key handling.** The CLI reads `PRIVATE_KEY` from the environment for developer and fork use.
   Never commit it (`.gitignore` covers `.env*`). For the real user, whose key lives in MetaMask, use
   Path B so the key never leaves the wallet.
10. **Test on a fork first.**
    ```bash
    anvil --fork-url $MAINNET_RPC
    # fund a FRESH key (not anvil #0 — it is delegated on mainnet), wrap 2 ETH, then:
    RPC_URL=http://127.0.0.1:8545 DEPLOYER_PRIVATE_KEY=0x… npx tsx entry.ts deploy-helper --send
    RPC_URL=http://127.0.0.1:8545 PRIVATE_KEY=0x…          npx tsx entry.ts          # dry run
    RPC_URL=http://127.0.0.1:8545 PRIVATE_KEY=0x…          npx tsx entry.ts --send
    ```

Gas: about 410k for the first run, including the authorization. That's about 0.0007 ETH at current
fees, so the user's "enough ETH for gas" balance is sufficient. There is no approval transaction
beforehand; the user's account has no approvals before or after.
