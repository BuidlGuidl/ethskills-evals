import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  getAddress,
  http,
  isAddress,
  parseEther,
  type Address,
  type Hash,
  type Hex,
  type TransactionReceipt,
} from 'viem'
import { config as loadEnv } from 'dotenv'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, mainnet } from 'viem/chains'
import {
  getWithdrawals,
  publicActionsL1,
  publicActionsL2,
  walletActionsL1,
  walletActionsL2,
} from 'viem/op-stack'

loadEnv({ quiet: true })

const CELO_CHAIN_ID = 42220
const MAINNET_CHAIN_ID = 1
const PLACEHOLDER_TREASURY = '0x1111111111111111111111111111111111111111' as const
const DEFAULT_SWEEP_RESERVE = '0.1'
const celoOpStack = defineChain({
  ...celo,
  contracts: {
    ...celo.contracts,
    portal: {
      [MAINNET_CHAIN_ID]: {
        address: '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC',
      },
    },
    disputeGameFactory: {
      [MAINNET_CHAIN_ID]: {
        address: '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683',
      },
    },
  },
})

function command(): string {
  return process.argv[2] ?? 'help'
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function privateKey(): Hex {
  const raw = requiredEnv('OPS_PRIVATE_KEY')
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex
}

function hashArg(): Hash {
  const hash = argValue('--l2-tx') ?? process.env.SWEEP_L2_TX
  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error('Pass --l2-tx 0x... or set SWEEP_L2_TX')
  }
  return hash as Hash
}

function treasuryAddress(execute: boolean): Address {
  const raw = process.env.TREASURY_ADDRESS ?? PLACEHOLDER_TREASURY
  if (!isAddress(raw)) throw new Error(`Invalid TREASURY_ADDRESS: ${raw}`)
  const address = getAddress(raw)
  if (execute && address === PLACEHOLDER_TREASURY && process.env.ALLOW_PLACEHOLDER_TREASURY !== 'true') {
    throw new Error('Refusing to execute with the placeholder treasury address')
  }
  return address
}

function executionEnabled(): boolean {
  return hasFlag('--execute') || process.env.EXECUTE === 'true'
}

function clients() {
  const account = privateKeyToAccount(privateKey())
  const publicClientL1 = createPublicClient({
    chain: mainnet,
    transport: http(requiredEnv('ETHEREUM_RPC_URL')),
  }).extend(publicActionsL1())
  const walletClientL1 = createWalletClient({
    account,
    chain: mainnet,
    transport: http(requiredEnv('ETHEREUM_RPC_URL')),
  }).extend(walletActionsL1())
  const publicClientL2 = createPublicClient({
    chain: celoOpStack,
    transport: http(requiredEnv('CELO_RPC_URL')),
  }).extend(publicActionsL2())
  const walletClientL2 = createWalletClient({
    account,
    chain: celoOpStack,
    transport: http(requiredEnv('CELO_RPC_URL')),
  }).extend(walletActionsL2())

  return { account, publicClientL1, walletClientL1, publicClientL2, walletClientL2 }
}

async function assertChains(
  publicClientL1: ReturnType<typeof clients>['publicClientL1'],
  publicClientL2: ReturnType<typeof clients>['publicClientL2'],
) {
  const [l1ChainId, l2ChainId] = await Promise.all([
    publicClientL1.getChainId(),
    publicClientL2.getChainId(),
  ])
  if (l1ChainId !== MAINNET_CHAIN_ID) {
    throw new Error(`ETHEREUM_RPC_URL returned chain ${l1ChainId}; expected mainnet ${MAINNET_CHAIN_ID}`)
  }
  if (l2ChainId !== CELO_CHAIN_ID) {
    throw new Error(`CELO_RPC_URL returned chain ${l2ChainId}; expected Celo mainnet ${CELO_CHAIN_ID}`)
  }
}

async function withdrawalReceipt(
  publicClientL2: ReturnType<typeof clients>['publicClientL2'],
  hash: Hash,
): Promise<{ receipt: TransactionReceipt; l2Timestamp: bigint }> {
  const receipt = await publicClientL2.getTransactionReceipt({ hash })
  const withdrawals = getWithdrawals(receipt)
  if (withdrawals.length === 0) throw new Error(`${hash} is not a Celo withdrawal initiation transaction`)
  const block = await publicClientL2.getBlock({ blockNumber: receipt.blockNumber })
  return { receipt, l2Timestamp: block.timestamp }
}

function firstWithdrawal(receipt: TransactionReceipt) {
  const [withdrawal] = getWithdrawals(receipt)
  if (!withdrawal) throw new Error('Withdrawal receipt did not contain a withdrawal message')
  return withdrawal
}

function formatReadyTime(timestamp: number | undefined): string {
  if (!timestamp) return 'now'
  return new Date(timestamp).toISOString()
}

async function start() {
  const execute = executionEnabled()
  const { account, publicClientL1, publicClientL2, walletClientL2 } = clients()
  await assertChains(publicClientL1, publicClientL2)

  const treasury = treasuryAddress(execute)
  const balance = await publicClientL2.getBalance({ address: account.address })
  const explicitAmount = argValue('--amount') ?? process.env.SWEEP_AMOUNT_CELO
  const useMax = hasFlag('--max') || process.env.SWEEP_MAX === 'true'

  if (!explicitAmount && !useMax) {
    throw new Error('Pass --amount CELO, set SWEEP_AMOUNT_CELO, or pass --max to sweep balance minus reserve')
  }

  const amount = explicitAmount
    ? parseEther(explicitAmount)
    : balance - parseEther(process.env.CELO_SWEEP_RESERVE ?? DEFAULT_SWEEP_RESERVE)

  if (amount <= 0n) {
    throw new Error(`Sweep amount is not positive. Balance is ${formatEther(balance)} CELO.`)
  }
  if (amount >= balance) {
    throw new Error('Sweep amount must leave enough CELO on Celo for the L2 initiation gas')
  }

  const args = await publicClientL1.buildInitiateWithdrawal({
    to: treasury,
    value: amount,
  })

  console.log(`Ops wallet: ${account.address}`)
  console.log(`Treasury: ${treasury}`)
  console.log(`Amount: ${formatEther(amount)} CELO`)
  console.log(`Celo balance before sweep: ${formatEther(balance)} CELO`)
  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`)

  if (!execute) {
    console.log('[dry-run] withdrawal initiation built successfully; no transaction sent')
    return
  }

  const hash = await walletClientL2.initiateWithdrawal(args)
  console.log(`Celo withdrawal initiated: ${hash}`)
  const receipt = await publicClientL2.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`Withdrawal initiation failed: ${hash}`)
  console.log(`Next: run npm run sweep -- status --l2-tx ${hash}`)
}

async function status() {
  const { publicClientL1, publicClientL2 } = clients()
  await assertChains(publicClientL1, publicClientL2)
  const hash = hashArg()
  const { receipt, l2Timestamp } = await withdrawalReceipt(publicClientL2, hash)
  const withdrawal = firstWithdrawal(receipt)

  const withdrawalStatus = await publicClientL1.getWithdrawalStatus({
    receipt,
    l2Timestamp,
    targetChain: celoOpStack,
  })

  console.log(`Withdrawal tx: ${hash}`)
  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`Status: ${withdrawalStatus}`)

  try {
    const prove = await publicClientL1.getTimeToProve({
      receipt,
      l2Timestamp,
      targetChain: celoOpStack,
    })
    console.log(`Time to prove: ${prove.seconds}s, ready around ${formatReadyTime(prove.timestamp)}`)
  } catch {
    console.log('Time to prove: already provable or not available')
  }

  try {
    const finalize = await publicClientL1.getTimeToFinalize({
      withdrawalHash: withdrawal.withdrawalHash,
      targetChain: celoOpStack as any,
    })
    console.log(`Time to finalize: ${finalize.seconds}s, ready around ${formatReadyTime(finalize.timestamp)}`)
  } catch {
    console.log('Time to finalize: not available until proved, or already finalizable')
  }
}

async function prove() {
  const execute = executionEnabled()
  const { publicClientL1, publicClientL2, walletClientL1 } = clients()
  await assertChains(publicClientL1, publicClientL2)
  const hash = hashArg()
  const { receipt, l2Timestamp } = await withdrawalReceipt(publicClientL2, hash)
  const withdrawalStatus = await publicClientL1.getWithdrawalStatus({
    receipt,
    l2Timestamp,
    targetChain: celoOpStack,
  })

  if (withdrawalStatus !== 'ready-to-prove') {
    throw new Error(`Withdrawal is ${withdrawalStatus}, not ready-to-prove`)
  }

  const { output, withdrawal } = await publicClientL1.waitToProve({
    receipt,
    l2Timestamp,
    targetChain: celoOpStack,
  })
  const args = await publicClientL2.buildProveWithdrawal({ output, withdrawal })

  console.log(`Withdrawal tx: ${hash}`)
  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`)
  if (!execute) {
    console.log('[dry-run] prove transaction built successfully; no transaction sent')
    return
  }

  const proveHash = await walletClientL1.proveWithdrawal(args)
  console.log(`Mainnet prove tx: ${proveHash}`)
  const proveReceipt = await publicClientL1.waitForTransactionReceipt({ hash: proveHash })
  if (proveReceipt.status !== 'success') throw new Error(`Prove transaction failed: ${proveHash}`)
  console.log(`Next: run npm run sweep -- status --l2-tx ${hash}`)
}

async function finalize() {
  const execute = executionEnabled()
  const { publicClientL1, publicClientL2, walletClientL1 } = clients()
  await assertChains(publicClientL1, publicClientL2)
  const hash = hashArg()
  const { receipt, l2Timestamp } = await withdrawalReceipt(publicClientL2, hash)
  const withdrawal = firstWithdrawal(receipt)
  const withdrawalStatus = await publicClientL1.getWithdrawalStatus({
    receipt,
    l2Timestamp,
    targetChain: celoOpStack,
  })

  if (withdrawalStatus !== 'ready-to-finalize') {
    throw new Error(`Withdrawal is ${withdrawalStatus}, not ready-to-finalize`)
  }

  console.log(`Withdrawal tx: ${hash}`)
  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`)
  if (!execute) {
    console.log('[dry-run] finalize transaction checked successfully; no transaction sent')
    return
  }

  const finalizeHash = await walletClientL1.finalizeWithdrawal({
    targetChain: celoOpStack,
    withdrawal,
  })
  console.log(`Mainnet finalize tx: ${finalizeHash}`)
  const finalizeReceipt = await publicClientL1.waitForTransactionReceipt({ hash: finalizeHash })
  if (finalizeReceipt.status !== 'success') throw new Error(`Finalize transaction failed: ${finalizeHash}`)
}

function help() {
  console.log(`Usage:
  npm run sweep -- start --amount 123.45 [--execute]
  npm run sweep -- start --max [--execute]
  npm run sweep -- status --l2-tx 0x...
  npm run sweep -- prove --l2-tx 0x... [--execute]
  npm run sweep -- finalize --l2-tx 0x... [--execute]

Environment:
  OPS_PRIVATE_KEY       private key for the Celo ops wallet
  CELO_RPC_URL          Celo mainnet RPC URL
  ETHEREUM_RPC_URL      Ethereum mainnet RPC URL
  TREASURY_ADDRESS      mainnet treasury recipient, defaults to placeholder
`)
}

async function main() {
  switch (command()) {
    case 'start':
      return start()
    case 'status':
      return status()
    case 'prove':
      return prove()
    case 'finalize':
      return finalize()
    case 'help':
    case '--help':
    case '-h':
      return help()
    default:
      throw new Error(`Unknown command: ${command()}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
