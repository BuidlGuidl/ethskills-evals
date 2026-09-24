/**
 * One-click "WETH -> USDC (Uniswap V3) -> supply to Aave V3" from an existing EOA,
 * as ONE atomic mainnet transaction, using EIP-7702 (same address, nothing migrated).
 *
 * Modes (see NOTES.md for the full explanation):
 *   npx tsx entry.ts simulate <address>   # no key: dry-run the exact batch for any address
 *   npx tsx entry.ts run                  # sign + send from PRIVATE_KEY's account (asks "yes" first)
 *   npx tsx entry.ts revoke               # clear the account's 7702 delegation (asks "yes" first)
 *   npx tsx entry.ts deploy-helper        # one-time deploy of contracts/SupplyAllUSDC.sol
 *
 * Browser / MetaMask users: call `enterViaWallet()` (EIP-5792 wallet_sendCalls, atomic required).
 *
 * Env: RPC_URL (required), PRIVATE_KEY (run/revoke/deploy-helper only; never commit it),
 *      SUPPLY_HELPER (deployed SupplyAllUSDC address), SLIPPAGE_BPS (default 50),
 *      SEND_RPC_URL (optional private/MEV-protected RPC for broadcasting).
 */
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  http,
  isAddressEqual,
  keccak256,
  parseAbi,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

// ---------------------------------------------------------------------------
// Ethereum mainnet addresses (all verified to have code on mainnet)
// ---------------------------------------------------------------------------
export const ADDR = {
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  // Uniswap V3 SwapRouter02 and QuoterV2
  SWAP_ROUTER_02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  QUOTER_V2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  // Aave V3 Ethereum (core market) Pool proxy and aEthUSDC
  AAVE_POOL: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  A_USDC: '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c',
  // Chainlink ETH/USD (sanity check on the Uniswap quote)
  CHAINLINK_ETH_USD: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  // MetaMask Delegation Framework EIP7702StatelessDeleGator (audited; the same
  // delegate MetaMask itself uses for its "smart account" upgrade of an EOA).
  DELEGATOR: '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B',
} as const satisfies Record<string, Address>

// Runtime code hash of DELEGATOR as observed on mainnet. The script refuses to
// delegate the user's EOA to anything whose code does not match.
const DELEGATOR_CODEHASH = '0x0b77e469f5603ed1e9ff0e7ee56238b61a8cf7cb3185b33e53e2eeaad50109ab'

const FEE_TIERS = [500, 3000] as const // WETH/USDC 0.05% and 0.3% pools
const ORACLE_MAX_DEVIATION_BPS = 200n // quote must be within 2% of Chainlink
const ORACLE_MAX_AGE_S = 3900n // ETH/USD heartbeat is 1h, plus inclusion latency
const DEADLINE_S = 600n
const AUTH_GAS_OVERHEAD = 25_000n // EIP-7702 per-authorization cost (upper bound)

// ---------------------------------------------------------------------------
// ABIs
// ---------------------------------------------------------------------------
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
])
const swapRouter02Abi = parseAbi([
  'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)',
  'function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)',
])
const quoterV2Abi = parseAbi([
  'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
  'function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])
const helperAbi = parseAbi(['function supplyAll(address onBehalfOf, uint256 minAmount) returns (uint256 amount)'])
const chainlinkAbi = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
])
// ERC-7579 execute on the DeleGator. Only callable by the EntryPoint or by the account itself.
const delegatorAbi = parseAbi(['function execute(bytes32 mode, bytes executionCalldata) payable'])
// ERC-7579 ModeCode: callType 0x01 (batch), execType 0x00 (revert on any failure)
const MODE_BATCH_REVERT = '0x0100000000000000000000000000000000000000000000000000000000000000' as const

type Call = { to: Address; value: bigint; data: Hex }

// ---------------------------------------------------------------------------
// Plan: read state, quote, sanity-check, build the three calls
// ---------------------------------------------------------------------------
export type Plan = {
  owner: Address
  helper: Address
  wethIn: bigint
  fee: number
  quotedUsdc: bigint
  minUsdc: bigint
  oracleUsdPerEth: bigint // 8 decimals
  deadline: bigint
  calls: Call[]
}

export async function buildPlan(
  client: PublicClient,
  owner: Address,
  helper: Address,
  slippageBps: bigint,
): Promise<Plan> {
  if (slippageBps <= 0n || slippageBps > 300n) throw new Error('SLIPPAGE_BPS must be in (0, 300]')

  const wethIn = await client.readContract({ address: ADDR.WETH, abi: erc20Abi, functionName: 'balanceOf', args: [owner] })
  if (wethIn === 0n) throw new Error(`${owner} holds no WETH`)

  // Quote every fee tier; use the best.
  let fee = 0
  let quotedUsdc = 0n
  for (const f of FEE_TIERS) {
    try {
      const { result } = await client.simulateContract({
        address: ADDR.QUOTER_V2,
        abi: quoterV2Abi,
        functionName: 'quoteExactInputSingle',
        args: [{ tokenIn: ADDR.WETH, tokenOut: ADDR.USDC, amountIn: wethIn, fee: f, sqrtPriceLimitX96: 0n }],
      })
      if (result[0] > quotedUsdc) [fee, quotedUsdc] = [f, result[0]]
    } catch {
      /* pool unusable for this size; skip */
    }
  }
  if (quotedUsdc === 0n) throw new Error('No Uniswap V3 WETH/USDC quote available')

  // Independent price check: a pool already pushed off-price at quote time would
  // otherwise make amountOutMinimum meaningless.
  const [, answer, , updatedAt] = await client.readContract({
    address: ADDR.CHAINLINK_ETH_USD,
    abi: chainlinkAbi,
    functionName: 'latestRoundData',
  })
  const block = await client.getBlock()
  if (answer <= 0n || block.timestamp - updatedAt > ORACLE_MAX_AGE_S) throw new Error('Chainlink ETH/USD is stale')
  const oracleUsdc = (wethIn * answer) / 10n ** 20n // 18 + 8 - 6 decimals
  if (quotedUsdc * 10_000n < oracleUsdc * (10_000n - ORACLE_MAX_DEVIATION_BPS)) {
    throw new Error(`Uniswap quote ${formatUnits(quotedUsdc, 6)} USDC is >2% below oracle ${formatUnits(oracleUsdc, 6)}; refusing`)
  }

  const minUsdc = (quotedUsdc * (10_000n - slippageBps)) / 10_000n
  const deadline = block.timestamp + DEADLINE_S

  const calls: Call[] = [
    // 1. Exact approval, fully consumed by the swap -> allowance ends at 0.
    {
      to: ADDR.WETH,
      value: 0n,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [ADDR.SWAP_ROUTER_02, wethIn] }),
    },
    // 2. Swap all WETH; USDC goes straight to the helper; reverts below minUsdc or after deadline.
    {
      to: ADDR.SWAP_ROUTER_02,
      value: 0n,
      data: encodeFunctionData({
        abi: swapRouter02Abi,
        functionName: 'multicall',
        args: [
          deadline,
          [
            encodeFunctionData({
              abi: swapRouter02Abi,
              functionName: 'exactInputSingle',
              args: [
                {
                  tokenIn: ADDR.WETH,
                  tokenOut: ADDR.USDC,
                  fee,
                  recipient: helper,
                  amountIn: wethIn,
                  amountOutMinimum: minUsdc,
                  sqrtPriceLimitX96: 0n,
                },
              ],
            }),
          ],
        ],
      }),
    },
    // 3. Helper supplies its ENTIRE USDC balance (= what the swap actually returned)
    //    to Aave V3 with onBehalfOf = owner, so aUSDC is minted to the user's EOA.
    {
      to: helper,
      value: 0n,
      data: encodeFunctionData({ abi: helperAbi, functionName: 'supplyAll', args: [owner, minUsdc] }),
    },
  ]

  return { owner, helper, wethIn, fee, quotedUsdc, minUsdc, oracleUsdPerEth: answer, deadline, calls }
}

/** Calldata for the EOA calling itself: DeleGator.execute(batch, abi.encode(Execution[])). */
export function encodeSelfExecute(calls: Call[]): Hex {
  const executions = encodeAbiParameters(
    [{ type: 'tuple[]', components: [{ name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'callData', type: 'bytes' }] }],
    [calls.map((c) => ({ target: c.to, value: c.value, callData: c.data }))],
  )
  return encodeFunctionData({ abi: delegatorAbi, functionName: 'execute', args: [MODE_BATCH_REVERT, executions] })
}

// ---------------------------------------------------------------------------
// Safety checks on the code we route through
// ---------------------------------------------------------------------------
type DelegationState = 'none' | 'ours' | { other: Address }

async function delegationOf(client: PublicClient, eoa: Address): Promise<DelegationState> {
  const code = await client.getCode({ address: eoa })
  if (!code || code === '0x') return 'none'
  // EIP-7702 delegation designator: 0xef0100 || address
  if (code.length === 48 && code.toLowerCase().startsWith('0xef0100')) {
    const target = getAddress(`0x${code.slice(8)}`)
    return isAddressEqual(target, ADDR.DELEGATOR) ? 'ours' : { other: target }
  }
  throw new Error(`${eoa} has contract code that is not a 7702 delegation; this tool is for EOAs only`)
}

async function assertDelegatorCode(client: PublicClient): Promise<Hex> {
  const code = await client.getCode({ address: ADDR.DELEGATOR })
  if (!code || keccak256(code) !== DELEGATOR_CODEHASH) throw new Error('DeleGator code hash mismatch; refusing to delegate')
  return code
}

function helperArtifact(): { bytecode: Hex; deployedBytecode: Hex } {
  return JSON.parse(readFileSync(new URL('./contracts/SupplyAllUSDC.json', import.meta.url), 'utf8'))
}

async function assertHelperCode(client: PublicClient, helper: Address) {
  const code = await client.getCode({ address: helper })
  if (!code || keccak256(code) !== keccak256(helperArtifact().deployedBytecode)) {
    throw new Error(`SUPPLY_HELPER ${helper} does not contain the reviewed SupplyAllUSDC bytecode`)
  }
}

// ---------------------------------------------------------------------------
// Human gate
// ---------------------------------------------------------------------------
async function confirm(lines: string[]): Promise<boolean> {
  console.log('\n' + lines.join('\n'))
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question('\nType "yes" to sign and broadcast: ')
  rl.close()
  return answer.trim() === 'yes'
}

function usd(weiAmount: bigint, usdPerEth8: bigint) {
  return `$${formatUnits((weiAmount * usdPerEth8) / 10n ** 18n, 8).replace(/(\.\d{2})\d*/, '$1')}`
}

function describePlan(p: Plan, delegation: DelegationState): string[] {
  return [
    `Account (sender, stays the same address): ${getAddress(p.owner)}`,
    delegation === 'ours'
      ? `7702 delegation: already set to DeleGator ${ADDR.DELEGATOR}`
      : `7702 delegation: WILL BE SET to MetaMask EIP7702StatelessDeleGator ${ADDR.DELEGATOR} (persists after this tx)`,
    `Swap:   ${formatEther(p.wethIn)} WETH -> USDC on Uniswap V3 (fee ${p.fee / 10_000}%) via SwapRouter02 ${ADDR.SWAP_ROUTER_02}`,
    `        quote ${formatUnits(p.quotedUsdc, 6)} USDC, minimum ${formatUnits(p.minUsdc, 6)} USDC (else the whole tx reverts)`,
    `        USDC recipient: SupplyAllUSDC helper ${getAddress(p.helper)} (same tx)`,
    `Supply: all swapped USDC -> Aave V3 Pool ${ADDR.AAVE_POOL}, aUSDC minted to ${getAddress(p.owner)}`,
    `Deadline: ${new Date(Number(p.deadline) * 1000).toISOString()}`,
  ]
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------
function env(name: string, required = true): string | undefined {
  const v = process.env[name]
  if (required && !v) throw new Error(`Missing env ${name}`)
  return v
}

function publicClient(): PublicClient {
  return createPublicClient({ chain: mainnet, transport: http(env('RPC_URL')) })
}

function loadAccount() {
  const pk = env('PRIVATE_KEY') as Hex
  return privateKeyToAccount(pk)
}

/** Dry-run the exact batch as `owner` (no key needed) by overriding its code with the DeleGator's. */
async function simulate(owner: Address) {
  const client = publicClient()
  const delegatorCode = await assertDelegatorCode(client)
  // Without a deployed helper, simulate it at a placeholder address via state override.
  const helper = (process.env.SUPPLY_HELPER as Address | undefined) ?? '0x00000000000000000000000000000000C0FFEE01'
  const plan = await buildPlan(client, owner, helper, BigInt(process.env.SLIPPAGE_BPS ?? '50'))
  const data = encodeSelfExecute(plan.calls)
  const stateOverrides = [
    { address: owner, code: delegatorCode },
    ...(process.env.SUPPLY_HELPER ? [] : [{ address: helper, code: helperArtifact().deployedBytecode }]),
  ]
  const readBal = (token: Address) => ({
    from: owner,
    to: token,
    data: encodeFunctionData({ abi: erc20Abi, functionName: 'balanceOf', args: [owner] }),
  })

  console.log(describePlan(plan, await delegationOf(client, owner)).join('\n'))
  const [block] = await client.simulateBlocks({
    blocks: [
      {
        stateOverrides,
        calls: [readBal(ADDR.A_USDC), { from: owner, to: owner, data }, readBal(ADDR.A_USDC), readBal(ADDR.WETH)],
      },
    ],
  })
  const [before, exec, after, wethAfter] = block.calls
  if (exec.status !== 'success') throw new Error(`Batch reverted in simulation: ${exec.error?.message ?? exec.data}`)
  const dec = (d: Hex) => BigInt(d)
  console.log(`\nSimulation OK. gasUsed=${exec.gasUsed}`)
  console.log(`  aUSDC: ${formatUnits(dec(before.data), 6)} -> ${formatUnits(dec(after.data), 6)}`)
  console.log(`  WETH left in account: ${formatEther(dec(wethAfter.data))}`)
}

async function run() {
  const client = publicClient()
  const account = loadAccount()
  const helper = getAddress(env('SUPPLY_HELPER')!)
  const wallet = createWalletClient({ account, chain: mainnet, transport: http(process.env.SEND_RPC_URL ?? env('RPC_URL')) })

  const delegatorCode = await assertDelegatorCode(client)
  await assertHelperCode(client, helper)
  const delegation = await delegationOf(client, account.address)
  if (typeof delegation === 'object') {
    throw new Error(`Account is already delegated to ${delegation.other}. Not overwriting someone else's delegation; review it first.`)
  }

  const plan = await buildPlan(client, account.address, helper, BigInt(process.env.SLIPPAGE_BPS ?? '50'))
  const data = encodeSelfExecute(plan.calls)

  // Estimate with the delegation simulated via state override, so no authorization
  // is signed before the human says yes.
  const execGas = await client.estimateGas({
    account: account.address,
    to: account.address,
    data,
    stateOverride: delegation === 'none' ? [{ address: account.address, code: delegatorCode }] : undefined,
  })
  const gas = ((execGas + (delegation === 'none' ? AUTH_GAS_OVERHEAD : 0n)) * 125n) / 100n
  const fees = await client.estimateFeesPerGas()
  const maxCost = gas * fees.maxFeePerGas
  const ethBal = await client.getBalance({ address: account.address })
  if (ethBal < maxCost) throw new Error(`Need up to ${formatEther(maxCost)} ETH for gas, have ${formatEther(ethBal)}`)

  const ok = await confirm([
    ...describePlan(plan, delegation),
    `Gas: limit ${gas}, maxFeePerGas ${formatUnits(fees.maxFeePerGas, 9)} gwei -> at most ${formatEther(maxCost)} ETH (~${usd(maxCost, plan.oracleUsdPerEth)} at Chainlink ETH/USD now)`,
    `ETH balance: ${formatEther(ethBal)}`,
  ])
  if (!ok) return console.log('Aborted. Nothing was signed.')

  // Sign the authorization only now. executor 'self' => nonce = current + 1,
  // because this same account's tx consumes the current nonce first. chainId pinned to 1.
  const authorizationList =
    delegation === 'none'
      ? [await wallet.signAuthorization({ account, contractAddress: ADDR.DELEGATOR, chainId: mainnet.id, executor: 'self' })]
      : undefined

  const hash = await wallet.sendTransaction({
    account,
    chain: mainnet,
    to: account.address, // the EOA calls itself; its delegated code runs the batch
    data,
    authorizationList,
    gas,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  })
  console.log(`Sent: ${hash}`)
  const receipt = await client.waitForTransactionReceipt({ hash })
  // Note: if the inner batch reverted, no swap or supply happened, but a 7702
  // authorization in a mined tx still takes effect.
  if (receipt.status !== 'success') throw new Error(`Transaction reverted (${hash}); no funds moved. Delegation may now be set.`)

  const [aUsdc, wethLeft, after] = await Promise.all([
    client.readContract({ address: ADDR.A_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
    client.readContract({ address: ADDR.WETH, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
    delegationOf(client, account.address),
  ])
  console.log(`Done in block ${receipt.blockNumber}. aUSDC balance: ${formatUnits(aUsdc, 6)}, WETH left: ${formatEther(wethLeft)}, delegation: ${JSON.stringify(after)}`)
}

/** Clear the EIP-7702 delegation (authorization to address(0)). A separate, explicit action. */
async function revoke() {
  const client = publicClient()
  const account = loadAccount()
  const wallet = createWalletClient({ account, chain: mainnet, transport: http(process.env.SEND_RPC_URL ?? env('RPC_URL')) })
  const state = await delegationOf(client, account.address)
  if (state === 'none') return console.log('No delegation set; nothing to do.')
  const ok = await confirm([`Clear 7702 delegation of ${getAddress(account.address)} (currently ${JSON.stringify(state)})`])
  if (!ok) return console.log('Aborted.')
  const auth = await wallet.signAuthorization({ account, contractAddress: zeroAddress, chainId: mainnet.id, executor: 'self' })
  const hash = await wallet.sendTransaction({ account, chain: mainnet, to: account.address, authorizationList: [auth] })
  await client.waitForTransactionReceipt({ hash })
  console.log(`Cleared: ${hash}; delegation now ${JSON.stringify(await delegationOf(client, account.address))}`)
}

/** One-time deploy of the stateless helper (by the developer; not the user's account). */
async function deployHelper() {
  const client = publicClient()
  const account = loadAccount()
  const wallet = createWalletClient({ account, chain: mainnet, transport: http(env('RPC_URL')) })
  const { bytecode } = helperArtifact()
  const gas = await client.estimateGas({ account: account.address, data: bytecode })
  const fees = await client.estimateFeesPerGas()
  const ok = await confirm([
    `Deploy SupplyAllUSDC from ${getAddress(account.address)}`,
    `Gas: ${gas}, at most ${formatEther(gas * fees.maxFeePerGas)} ETH`,
  ])
  if (!ok) return console.log('Aborted.')
  const hash = await wallet.deployContract({ abi: helperAbi, bytecode, account, chain: mainnet })
  const receipt = await client.waitForTransactionReceipt({ hash })
  console.log(`SupplyAllUSDC deployed at ${receipt.contractAddress} — verify it on Etherscan, then set SUPPLY_HELPER.`)
}

// ---------------------------------------------------------------------------
// Browser path for a MetaMask user: EIP-5792 wallet_sendCalls with atomicity REQUIRED.
// MetaMask performs the 7702 upgrade (to this same DeleGator) itself; dapps cannot
// ask MetaMask to sign arbitrary 7702 authorizations.
// ---------------------------------------------------------------------------
export async function enterViaWallet(wallet: WalletClient, client: PublicClient, owner: Address, helper: Address, slippageBps = 50n) {
  await assertHelperCode(client, helper)
  const caps = await wallet.getCapabilities({ account: owner, chainId: mainnet.id })
  const atomic = (caps as { atomic?: { status?: string } }).atomic?.status
  if (atomic !== 'supported' && atomic !== 'ready') {
    throw new Error('Wallet cannot guarantee atomic execution on mainnet; refusing to send the calls non-atomically')
  }
  const plan = await buildPlan(client, owner, helper, slippageBps)
  const { id } = await wallet.sendCalls({
    account: owner,
    chain: mainnet,
    calls: plan.calls,
    forceAtomic: true, // atomicRequired: the wallet must run all calls or none
  })
  return wallet.waitForCallsStatus({ id })
}

// ---------------------------------------------------------------------------
const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  const [mode, arg] = process.argv.slice(2)
  const task =
    mode === 'simulate' && arg ? simulate(getAddress(arg))
    : mode === 'run' ? run()
    : mode === 'revoke' ? revoke()
    : mode === 'deploy-helper' ? deployHelper()
    : Promise.reject(new Error('usage: entry.ts simulate <address> | run | revoke | deploy-helper'))
  task.catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
