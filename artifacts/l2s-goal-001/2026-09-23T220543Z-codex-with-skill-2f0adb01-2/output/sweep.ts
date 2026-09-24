import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  formatEther,
  http,
  isAddress,
  parseEther,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'

const CELO_CHAIN_ID = 42220
const TREASURY_PLACEHOLDER = '0x1111111111111111111111111111111111111111' as const
const L2_TO_L1_MESSAGE_PASSER = '0x4200000000000000000000000000000000000016' as const

const l2ToL1MessagePasserAbi = [
  {
    type: 'function',
    name: 'initiateWithdrawal',
    stateMutability: 'payable',
    inputs: [
      { name: '_target', type: 'address' },
      { name: '_gasLimit', type: 'uint256' },
      { name: '_data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'MessagePassed',
    inputs: [
      { indexed: true, name: 'nonce', type: 'uint256' },
      { indexed: true, name: 'sender', type: 'address' },
      { indexed: false, name: 'target', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
      { indexed: false, name: 'gasLimit', type: 'uint256' },
      { indexed: false, name: 'data', type: 'bytes' },
      { indexed: false, name: 'withdrawalHash', type: 'bytes32' },
    ],
  },
] as const

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function boolEnv(name: string, fallback = false): boolean {
  const value = process.env[name]
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase())
}

function parseCeloAmount(name: string): bigint {
  const raw = env(name).trim()
  if (!/^\d+(\.\d{1,18})?$/.test(raw)) {
    throw new Error(`${name} must be a positive CELO value with at most 18 decimals`)
  }

  const parsed = parseEther(raw)
  if (parsed <= 0n) throw new Error(`${name} must be greater than zero`)
  return parsed
}

async function main() {
  const rpcUrl = env('CELO_RPC_URL', 'https://forno.celo.org')
  const account = privateKeyToAccount(env('OPS_PRIVATE_KEY') as Hex)
  const treasury = env('TREASURY_ADDRESS', TREASURY_PLACEHOLDER) as Address
  const broadcast = boolEnv('BROADCAST')
  const sweepAll = boolEnv('SWEEP_ALL')
  const retained = process.env.MIN_CELO_RETAINED ? parseCeloAmount('MIN_CELO_RETAINED') : 0n
  const l1GasLimit = BigInt(env('WITHDRAWAL_L1_GAS_LIMIT', '50000'))
  const confirmations = Number(env('WAIT_CONFIRMATIONS', '1'))

  if (!isAddress(treasury)) throw new Error('TREASURY_ADDRESS must be a valid EVM address')
  if (treasury.toLowerCase() === TREASURY_PLACEHOLDER.toLowerCase()) {
    throw new Error('TREASURY_ADDRESS is still the placeholder; set the real Ethereum mainnet treasury')
  }
  if (!process.env.SWEEP_AMOUNT_CELO && !sweepAll) {
    throw new Error('Set SWEEP_AMOUNT_CELO for an exact sweep, or set SWEEP_ALL=true to sweep the spendable balance')
  }

  const publicClient = createPublicClient({ chain: celo, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain: celo, transport: http(rpcUrl) })

  const chainId = await publicClient.getChainId()
  if (chainId !== CELO_CHAIN_ID) {
    throw new Error(`CELO_RPC_URL returned chain ${chainId}; expected Celo mainnet chain ${CELO_CHAIN_ID}`)
  }

  const balance = await publicClient.getBalance({ address: account.address })
  const calldata = encodeFunctionData({
    abi: l2ToL1MessagePasserAbi,
    functionName: 'initiateWithdrawal',
    args: [treasury, l1GasLimit, '0x'],
  })

  const gas = await publicClient.estimateGas({
    account: account.address,
    to: L2_TO_L1_MESSAGE_PASSER,
    data: calldata,
    value: process.env.SWEEP_AMOUNT_CELO ? parseCeloAmount('SWEEP_AMOUNT_CELO') : 1n,
  })
  const fees = await publicClient.estimateFeesPerGas()
  const maxFeePerGas = fees.maxFeePerGas ?? fees.gasPrice
  if (maxFeePerGas === undefined) throw new Error('RPC did not return a usable gas price')
  const estimatedFee = gas * maxFeePerGas

  const amount = process.env.SWEEP_AMOUNT_CELO
    ? parseCeloAmount('SWEEP_AMOUNT_CELO')
    : balance - retained - estimatedFee

  if (amount <= 0n) {
    throw new Error(
      `No sweepable CELO after retained balance and estimated gas. ` +
        `balance=${formatEther(balance)} retained=${formatEther(retained)} estimatedFee=${formatEther(estimatedFee)}`,
    )
  }
  if (balance < amount + estimatedFee) {
    throw new Error(
      `Insufficient CELO: need amount ${formatEther(amount)} plus estimated gas ${formatEther(estimatedFee)}, ` +
        `wallet has ${formatEther(balance)}`,
    )
  }

  console.log(`Ops wallet: ${account.address}`)
  console.log(`Treasury on Ethereum mainnet: ${treasury}`)
  console.log(`Withdrawal amount: ${formatEther(amount)} CELO`)
  console.log(`L1 finalization target gas limit: ${l1GasLimit}`)
  console.log(`Mode: ${broadcast ? 'BROADCAST' : 'DRY RUN'}`)

  await publicClient.call({
    account: account.address,
    to: L2_TO_L1_MESSAGE_PASSER,
    data: calldata,
    value: amount,
  })

  if (!broadcast) {
    console.log('Dry run complete. Set BROADCAST=true to initiate the Celo -> Ethereum withdrawal.')
    return
  }

  const hash = await walletClient.sendTransaction({
    to: L2_TO_L1_MESSAGE_PASSER,
    data: calldata,
    value: amount,
  })
  console.log(`SENT withdrawal hash=${hash}`)

  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations })
  if (receipt.status !== 'success') throw new Error(`Withdrawal initiation failed: ${hash}`)

  const message = receipt.logs
    .map((log) => {
      try {
        return decodeEventLog({ abi: l2ToL1MessagePasserAbi, ...log })
      } catch {
        return undefined
      }
    })
    .find((event) => event?.eventName === 'MessagePassed')

  console.log(`CONFIRMED block=${receipt.blockNumber} hash=${hash}`)
  if (message?.eventName === 'MessagePassed') {
    console.log(`WITHDRAWAL_HASH ${message.args.withdrawalHash}`)
  }
  console.log('Next step: prove on Ethereum mainnet after the output/dispute game is available, then finalize after the challenge period.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
