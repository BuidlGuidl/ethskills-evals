/**
 * One-click WETH -> USDC (Uniswap V3) -> Aave V3 supply, from the user's EXISTING EOA,
 * as ONE atomic EIP-7702 (type-4) transaction on Ethereum mainnet.
 *
 *   npx tsx entry.ts status   # read-only: balances, current delegation, quote
 *   npx tsx entry.ts enter    # quote, simulate, gate, then send the single atomic tx
 *   npx tsx entry.ts clear    # remove the 7702 delegation (recommended right after `enter`)
 *
 * Environment (see .env.example and NOTES.md):
 *   RPC_URL          mainnet RPC (ideally a private/MEV-protected endpoint for `enter`)
 *   ENTRY_CONTRACT   deployed src/WethToAaveEntry.sol; its runtime code must match `forge build`
 *   PRIVATE_KEY      the user's existing account key, supplied at run time only
 *   SLIPPAGE_BPS     optional, default 50 (0.50%)
 */
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  formatEther,
  formatGwei,
  formatUnits,
  getAddress,
  http,
  isAddressEqual,
  parseAbi,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

// ---------------------------------------------------------------------------
// Ethereum mainnet addresses (each verified on-chain: code present, and
// cross-checked — router.WETH9(), router.factory(), aToken.POOL(),
// aToken.UNDERLYING_ASSET_ADDRESS(), pool.getReserveAToken(USDC)).
// ---------------------------------------------------------------------------
const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const UNISWAP_V3_FACTORY: Address = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
const UNISWAP_SWAP_ROUTER_02: Address = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'
const UNISWAP_QUOTER_V2: Address = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
const AAVE_V3_POOL: Address = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
const AAVE_A_USDC: Address = '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c' // aEthUSDC

const FEE_TIERS = [500, 3000] as const // 0.05% (deepest WETH/USDC pool) and 0.30%
const DEADLINE_SECONDS = 600n
const MAX_ORACLE_DEVIATION_BPS = 200n // refuse if the Uniswap quote is >2% below Aave's oracle
const GAS_BUFFER_BPS = 12_000n // +20% over the estimate
const ARTIFACT_PATH = new URL('./out/WethToAaveEntry.sol/WethToAaveEntry.json', import.meta.url)

// 7702 delegation indicator: code of a delegated EOA is 0xef0100 || delegate address.
const DELEGATION_PREFIX = '0xef0100'

// ---------------------------------------------------------------------------
// ABIs of exactly the calls this tool relies on
// ---------------------------------------------------------------------------
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
])
const quoterV2Abi = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])
const factoryAbi = parseAbi(['function getPool(address, address, uint24) view returns (address)'])
const aavePoolAbi = parseAbi([
  'function ADDRESSES_PROVIDER() view returns (address)',
  'function getReserveAToken(address asset) view returns (address)',
])
const addressesProviderAbi = parseAbi(['function getPriceOracle() view returns (address)'])
const aaveOracleAbi = parseAbi(['function getAssetPrice(address asset) view returns (uint256)'])
const entryAbi = parseAbi([
  'function enter(uint256 wethIn, uint256 minUsdcOut, uint24 fee, uint256 deadline) returns (uint256 usdcSupplied)',
  'event Entered(uint256 wethIn, uint256 usdcSupplied, uint24 fee)',
  'error OnlySelf()',
  'error Expired()',
  'error ZeroAmount()',
  'error ApproveFailed()',
  'error AllowanceLeft()',
])

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
function env(name: string, required = true): string | undefined {
  const v = process.env[name]?.trim()
  if (required && !v) throw new Error(`Missing ${name} (see .env.example / NOTES.md)`)
  return v || undefined
}

const rpcUrl = env('RPC_URL')!
const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) })

function loadAccount() {
  const pk = env('PRIVATE_KEY') as Hex
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) throw new Error('PRIVATE_KEY must be a 0x-prefixed 32-byte hex key')
  const account = privateKeyToAccount(pk)
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpcUrl) })
  return { account, walletClient }
}

async function assertMainnet() {
  const id = await publicClient.getChainId()
  if (id !== mainnet.id) throw new Error(`RPC is on chain ${id}, expected Ethereum mainnet (1)`)
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question(`${question} Type "yes" to proceed: `)).trim().toLowerCase()
  rl.close()
  return answer === 'yes'
}

/** The delegate address an EOA currently points at, or null if it has no code. */
async function currentDelegation(addr: Address): Promise<Address | null> {
  const code = await publicClient.getCode({ address: addr })
  if (!code || code === '0x') return null
  if (code.toLowerCase().startsWith(DELEGATION_PREFIX) && code.length === 2 + 23 * 2) {
    return getAddress(`0x${code.slice(8)}`)
  }
  throw new Error(`${addr} has non-delegation code; it is a contract, not an EOA`)
}

/**
 * Refuse to delegate the user's account to anything but the code in src/: the
 * on-chain runtime bytecode must equal what `forge build` produces locally.
 */
async function verifyEntryContract(): Promise<{ address: Address; runtime: Hex }> {
  const address = getAddress(env('ENTRY_CONTRACT')!)
  let artifact: { deployedBytecode: { object: Hex } }
  try {
    artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'))
  } catch {
    throw new Error('Compiled artifact not found; run `forge build` first')
  }
  const expected = artifact.deployedBytecode.object.toLowerCase()
  const onchain = ((await publicClient.getCode({ address })) ?? '0x').toLowerCase()
  if (onchain !== expected) {
    throw new Error(`ENTRY_CONTRACT ${address} runtime code does not match src/WethToAaveEntry.sol — refusing to delegate to it`)
  }
  return { address, runtime: onchain as Hex }
}

async function verifyStaticAddresses() {
  const [aToken, uniPool] = await Promise.all([
    publicClient.readContract({ address: AAVE_V3_POOL, abi: aavePoolAbi, functionName: 'getReserveAToken', args: [USDC] }),
    publicClient.readContract({ address: UNISWAP_V3_FACTORY, abi: factoryAbi, functionName: 'getPool', args: [WETH, USDC, 500] }),
  ])
  if (!isAddressEqual(aToken, AAVE_A_USDC)) throw new Error(`Aave USDC aToken is ${aToken}, expected ${AAVE_A_USDC}`)
  if (isAddressEqual(uniPool, zeroAddress)) throw new Error('Uniswap V3 WETH/USDC 0.05% pool not found')
}

// ---------------------------------------------------------------------------
// Quote: best Uniswap V3 fee tier, sanity-checked against Aave's price oracle
// ---------------------------------------------------------------------------
async function quote(wethIn: bigint) {
  const results = await Promise.all(
    FEE_TIERS.map(async (fee) => {
      try {
        const { result } = await publicClient.simulateContract({
          address: UNISWAP_QUOTER_V2,
          abi: quoterV2Abi,
          functionName: 'quoteExactInputSingle',
          args: [{ tokenIn: WETH, tokenOut: USDC, amountIn: wethIn, fee, sqrtPriceLimitX96: 0n }],
        })
        return { fee, amountOut: result[0] }
      } catch {
        return { fee, amountOut: 0n }
      }
    }),
  )
  const best = results.reduce((a, b) => (b.amountOut > a.amountOut ? b : a))
  if (best.amountOut === 0n) throw new Error('No Uniswap V3 quote available for WETH -> USDC')

  // Independent reference price: Aave's oracle (Chainlink-backed, USD with 8 decimals).
  const provider = await publicClient.readContract({ address: AAVE_V3_POOL, abi: aavePoolAbi, functionName: 'ADDRESSES_PROVIDER' })
  const oracle = await publicClient.readContract({ address: provider, abi: addressesProviderAbi, functionName: 'getPriceOracle' })
  const [wethUsd, usdcUsd] = await Promise.all([
    publicClient.readContract({ address: oracle, abi: aaveOracleAbi, functionName: 'getAssetPrice', args: [WETH] }),
    publicClient.readContract({ address: oracle, abi: aaveOracleAbi, functionName: 'getAssetPrice', args: [USDC] }),
  ])
  // WETH (18 dec) -> USDC (6 dec) at oracle prices.
  const oracleUsdcOut = (wethIn * wethUsd) / usdcUsd / 10n ** 12n
  const floor = (oracleUsdcOut * (10_000n - MAX_ORACLE_DEVIATION_BPS)) / 10_000n
  if (best.amountOut < floor) {
    throw new Error(
      `Uniswap quote ${formatUnits(best.amountOut, 6)} USDC is more than ${Number(MAX_ORACLE_DEVIATION_BPS) / 100}% ` +
        `below the Aave oracle value ${formatUnits(oracleUsdcOut, 6)} USDC — refusing (pool may be manipulated or illiquid)`,
    )
  }
  return { ...best, oracleUsdcOut, all: results }
}

async function readPosition(addr: Address) {
  const [eth, weth, usdc, aUsdc] = await Promise.all([
    publicClient.getBalance({ address: addr }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [addr] }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [addr] }),
    publicClient.readContract({ address: AAVE_A_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [addr] }),
  ])
  return { eth, weth, usdc, aUsdc }
}

async function ensName(addr: Address): Promise<string> {
  try {
    return (await publicClient.getEnsName({ address: addr })) ?? '(none)'
  } catch {
    return '(lookup failed)'
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
async function status() {
  await assertMainnet()
  const { account } = loadAccount()
  const p = await readPosition(account.address)
  console.log(`Account     ${account.address}  ENS: ${await ensName(account.address)}`)
  console.log(`Delegation  ${(await currentDelegation(account.address)) ?? 'none (plain EOA)'}`)
  console.log(`ETH ${formatEther(p.eth)} | WETH ${formatEther(p.weth)} | USDC ${formatUnits(p.usdc, 6)} | aEthUSDC ${formatUnits(p.aUsdc, 6)}`)
  if (p.weth > 0n) {
    const q = await quote(p.weth)
    console.log(`Quote       ${formatUnits(q.amountOut, 6)} USDC via ${q.fee / 10_000}% pool (oracle ${formatUnits(q.oracleUsdcOut, 6)})`)
  }
}

async function enter() {
  await assertMainnet()
  await verifyStaticAddresses()
  const { account, walletClient } = loadAccount()
  const self = account.address
  const entry = await verifyEntryContract()
  const before = await readPosition(self)
  const priorDelegate = await currentDelegation(self)

  const wethIn = before.weth // "all of it"
  if (wethIn === 0n) throw new Error('Account holds no WETH')

  const slippageBps = BigInt(env('SLIPPAGE_BPS', false) ?? '50')
  if (slippageBps < 1n || slippageBps > 300n) throw new Error('SLIPPAGE_BPS must be between 1 and 300')

  const q = await quote(wethIn)
  const minUsdcOut = (q.amountOut * (10_000n - slippageBps)) / 10_000n
  const block = await publicClient.getBlock()
  const deadline = block.timestamp + DEADLINE_SECONDS
  const args = [wethIn, minUsdcOut, q.fee, deadline] as const

  // Dry run the exact call in the account's own context: override the EOA's code
  // with the delegate's runtime code, which is what 7702 does on-chain.
  const { result: simulatedUsdc } = await publicClient.simulateContract({
    account: self,
    address: self,
    abi: entryAbi,
    functionName: 'enter',
    args,
    stateOverride: [{ address: self, code: entry.runtime }],
  })

  // Sign the 7702 authorization (in memory only; nothing is broadcast before the gate).
  // executor 'self' => nonce = account nonce + 1, because this same account sends the tx.
  // chainId comes from the client (1), so the authorization is NOT valid on other chains.
  const authorization = await walletClient.signAuthorization({
    account,
    contractAddress: entry.address,
    executor: 'self',
  })
  if (authorization.chainId !== mainnet.id) throw new Error('Authorization must be bound to chainId 1')

  const data = encodeFunctionData({ abi: entryAbi, functionName: 'enter', args })
  const gasEstimate = await publicClient.estimateGas({
    account,
    to: self,
    data,
    authorizationList: [authorization],
  })
  const gas = (gasEstimate * GAS_BUFFER_BPS) / 10_000n
  const fees = await publicClient.estimateFeesPerGas()
  const expectedCost = gas * (block.baseFeePerGas! + fees.maxPriorityFeePerGas)
  const maxCost = gas * fees.maxFeePerGas
  if (before.eth < maxCost) {
    throw new Error(`Not enough ETH for gas: have ${formatEther(before.eth)}, worst case needs ${formatEther(maxCost)}`)
  }

  console.log('\n=== One transaction, signed by your existing account ===')
  console.log(`From / to (self)   ${self}  ENS: ${await ensName(self)}`)
  console.log(`Delegate code      ${entry.address} (runtime code verified against src/WethToAaveEntry.sol)`)
  console.log(`Current delegation ${priorDelegate ?? 'none'}${priorDelegate && !isAddressEqual(priorDelegate, entry.address) ? '  <-- WILL BE REPLACED' : ''}`)
  console.log(`(a) Swap           ${formatEther(wethIn)} WETH -> USDC on Uniswap V3 ${q.fee / 10_000}% pool via SwapRouter02 ${UNISWAP_SWAP_ROUTER_02}`)
  console.log(`    Quote          ${formatUnits(q.amountOut, 6)} USDC (Aave oracle: ${formatUnits(q.oracleUsdcOut, 6)})`)
  console.log(`    Minimum        ${formatUnits(minUsdcOut, 6)} USDC (${Number(slippageBps) / 100}% slippage) — below this, NOTHING happens`)
  console.log(`(b) Supply         all USDC the swap returns (simulated now: ${formatUnits(simulatedUsdc, 6)}) to Aave V3 Pool ${AAVE_V3_POOL}`)
  console.log(`    aTokens to     ${self} (you); approvals left behind: none`)
  console.log(`Deadline           ${new Date(Number(deadline) * 1000).toISOString()}`)
  console.log(`Gas                ${gas} @ max ${formatGwei(fees.maxFeePerGas)} gwei`)
  console.log(`Gas cost           ~${formatEther(expectedCost)} ETH expected, ${formatEther(maxCost)} ETH max (you have ${formatEther(before.eth)} ETH)`)
  console.log('After this, your account stays delegated to the code above until you run `clear`.\n')

  if (!(await confirm('Send this single atomic transaction?'))) {
    console.log('Aborted. Nothing was sent.')
    return
  }

  const hash = await walletClient.sendTransaction({
    account,
    chain: mainnet,
    to: self,
    data,
    authorizationList: [authorization],
    gas,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  })
  console.log(`Sent ${hash}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  const after = await readPosition(self)

  if (receipt.status !== 'success') {
    console.log('Transaction REVERTED: the swap and supply both rolled back; your WETH is untouched.')
    console.log('The 7702 delegation itself was still applied. Run `clear` to remove it.')
    process.exitCode = 1
    return
  }

  const log = receipt.logs.find((l) => isAddressEqual(l.address, self))
  const entered = log && decodeEventLog({ abi: entryAbi, data: log.data, topics: log.topics })
  const [wethAllowance, usdcAllowance] = await Promise.all([
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'allowance', args: [self, UNISWAP_SWAP_ROUTER_02] }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'allowance', args: [self, AAVE_V3_POOL] }),
  ])
  console.log(`Confirmed in block ${receipt.blockNumber}, gas used ${receipt.gasUsed}`)
  if (entered?.eventName === 'Entered') {
    console.log(`Swapped ${formatEther(entered.args.wethIn)} WETH, supplied ${formatUnits(entered.args.usdcSupplied, 6)} USDC`)
  }
  console.log(`WETH ${formatEther(before.weth)} -> ${formatEther(after.weth)}`)
  console.log(`aEthUSDC ${formatUnits(before.aUsdc, 6)} -> ${formatUnits(after.aUsdc, 6)}`)
  console.log(`USDC in wallet ${formatUnits(before.usdc, 6)} -> ${formatUnits(after.usdc, 6)} (unchanged: all swap output was supplied)`)
  console.log(`Remaining allowances: WETH->router ${wethAllowance}, USDC->Aave ${usdcAllowance}`)
  console.log('\nRecommended next step: `npx tsx entry.ts clear` to return the account to a plain EOA.')
}

async function clear() {
  await assertMainnet()
  const { account, walletClient } = loadAccount()
  const self = account.address
  const delegate = await currentDelegation(self)
  if (!delegate) {
    console.log(`${self} has no delegation; nothing to clear.`)
    return
  }
  // An authorization to the zero address resets the account's code to empty (EIP-7702).
  const authorization = await walletClient.signAuthorization({ account, contractAddress: zeroAddress, executor: 'self' })
  const gas = ((await publicClient.estimateGas({ account, to: self, data: '0x', authorizationList: [authorization] })) * GAS_BUFFER_BPS) / 10_000n
  const fees = await publicClient.estimateFeesPerGas()
  const eth = await publicClient.getBalance({ address: self })

  console.log(`\nClear 7702 delegation of ${self} (currently -> ${delegate})`)
  console.log(`Moves no funds. Gas ${gas}, max cost ${formatEther(gas * fees.maxFeePerGas)} ETH (you have ${formatEther(eth)} ETH)\n`)
  if (!(await confirm('Send the clearing transaction?'))) {
    console.log('Aborted. Nothing was sent.')
    return
  }
  const hash = await walletClient.sendTransaction({
    account,
    chain: mainnet,
    to: self,
    data: '0x',
    authorizationList: [authorization],
    gas,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log(`${receipt.status} ${hash}; delegation now: ${(await currentDelegation(self)) ?? 'none (plain EOA)'}`)
}

const commands: Record<string, () => Promise<void>> = { status, enter, clear }
const cmd = process.argv[2] ?? 'status'
if (!commands[cmd]) {
  console.error(`Usage: tsx entry.ts [status|enter|clear]`)
  process.exit(2)
}
commands[cmd]().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
