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
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, mainnet } from 'viem/chains'
import {
  getTimeToFinalize,
  getTimeToProve,
  getWithdrawals,
  publicActionsL1,
  publicActionsL2,
  walletActionsL1,
  walletActionsL2,
} from 'viem/op-stack'

const CELO_CHAIN_ID = 42220
const ETHEREUM_CHAIN_ID = 1
const PLACEHOLDER_TREASURY = '0x1111111111111111111111111111111111111111'
const DEFAULT_L1_GAS_LIMIT = 100_000n

const sourceId = 1
const celoWithBridgeContracts = defineChain({
  ...celo,
  contracts: {
    ...celo.contracts,
    portal: {
      [sourceId]: {
        address: '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC',
      },
    },
    disputeGameFactory: {
      [sourceId]: {
        address: '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683',
      },
    },
    l1StandardBridge: {
      [sourceId]: {
        address: '0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe',
      },
    },
  },
  sourceId,
})
const celoOpStackTarget = celoWithBridgeContracts as any

function usage(exitCode = 1): never {
  console.error(`Usage:
  npm run sweep -- initiate --amount 123.45 [--execute]
  npm run sweep -- initiate --max --reserve 1 [--execute]
  npm run sweep -- status --initiate-tx 0x...
  npm run sweep -- prove --initiate-tx 0x... [--execute]
  npm run sweep -- finalize --initiate-tx 0x... [--proof-submitter 0x...] [--execute]

Environment:
  OPERATOR_PRIVATE_KEY  Ops wallet key. Needs CELO on Celo and ETH on Ethereum for prove/finalize gas.
  CELO_RPC_URL          Celo mainnet RPC URL
  ETH_RPC_URL           Ethereum mainnet RPC URL
  TREASURY_ADDRESS      Ethereum mainnet CELO treasury recipient`)
  process.exit(exitCode)
}

function args() {
  return process.argv.slice(2)
}

function command(): string {
  const [cmd] = args()
  if (cmd === '--help' || cmd === '-h') usage(0)
  if (!cmd) usage()
  return cmd
}

function hasFlag(name: string): boolean {
  return args().includes(name)
}

function getFlagValue(name: string): string | undefined {
  const index = args().indexOf(name)
  if (index === -1) return undefined
  return args()[index + 1]
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function asPrivateKey(value: string): Hex {
  const normalized = value.startsWith('0x') ? value : `0x${value}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error('OPERATOR_PRIVATE_KEY must be a 32-byte hex private key')
  }
  return normalized as Hex
}

function asAddress(value: string, label: string): Address {
  if (!isAddress(value)) throw new Error(`${label} is not a valid address`)
  return getAddress(value)
}

function parseCeloAmount(value: string | undefined, label: string): bigint | undefined {
  if (value === undefined) return undefined
  if (!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(value)) {
    throw new Error(`${label} must be a plain positive CELO decimal with at most 18 decimals`)
  }
  const parsed = parseEther(value)
  if (parsed <= 0n) throw new Error(`${label} must be greater than zero`)
  return parsed
}

function requireHash(name: string): Hex {
  const value = getFlagValue(name)
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`Missing or invalid ${name}`)
  }
  return value as Hex
}

function formatTimestamp(timestamp: number | undefined): string {
  return timestamp === undefined ? 'not available' : new Date(timestamp * 1000).toISOString()
}

function createClients() {
  const account = privateKeyToAccount(asPrivateKey(requireEnv('OPERATOR_PRIVATE_KEY')))
  const publicClientL1 = createPublicClient({
    chain: mainnet,
    transport: http(requireEnv('ETH_RPC_URL')),
  }).extend(publicActionsL1())
  const walletClientL1 = createWalletClient({
    account,
    chain: mainnet,
    transport: http(requireEnv('ETH_RPC_URL')),
  }).extend(walletActionsL1())
  const publicClientL2 = createPublicClient({
    chain: celoWithBridgeContracts,
    transport: http(requireEnv('CELO_RPC_URL')),
  }).extend(publicActionsL2())
  const walletClientL2 = createWalletClient({
    account,
    chain: celoWithBridgeContracts,
    transport: http(requireEnv('CELO_RPC_URL')),
  }).extend(walletActionsL2())

  return { account, publicClientL1, walletClientL1, publicClientL2, walletClientL2 }
}

async function assertChains(clients: ReturnType<typeof createClients>) {
  const [l1ChainId, l2ChainId] = await Promise.all([
    clients.publicClientL1.getChainId(),
    clients.publicClientL2.getChainId(),
  ])
  if (l1ChainId !== ETHEREUM_CHAIN_ID) {
    throw new Error(`ETH_RPC_URL returned chain id ${l1ChainId}; expected ${ETHEREUM_CHAIN_ID}`)
  }
  if (l2ChainId !== CELO_CHAIN_ID) {
    throw new Error(`CELO_RPC_URL returned chain id ${l2ChainId}; expected ${CELO_CHAIN_ID}`)
  }
}

async function initiate(execute: boolean) {
  const clients = createClients()
  await assertChains(clients)

  const treasury = asAddress(process.env.TREASURY_ADDRESS ?? PLACEHOLDER_TREASURY, 'TREASURY_ADDRESS')
  if (execute && treasury.toLowerCase() === PLACEHOLDER_TREASURY.toLowerCase()) {
    throw new Error('Refusing to execute with the placeholder TREASURY_ADDRESS')
  }

  const balance = await clients.publicClientL2.getBalance({ address: clients.account.address })
  const explicitAmount = parseCeloAmount(getFlagValue('--amount') ?? process.env.CELO_SWEEP_AMOUNT, '--amount')
  const reserve = parseCeloAmount(getFlagValue('--reserve') ?? process.env.CELO_SWEEP_RESERVE ?? '1', '--reserve') ?? 0n
  const amount = explicitAmount ?? (hasFlag('--max') ? balance - reserve : undefined)
  const l1GasLimit = BigInt(getFlagValue('--l1-gas-limit') ?? DEFAULT_L1_GAS_LIMIT.toString())

  if (amount === undefined) throw new Error('Use --amount, CELO_SWEEP_AMOUNT, or --max with an explicit reserve')
  if (amount <= 0n) throw new Error('Sweep amount is zero after reserve')
  if (balance <= amount) {
    throw new Error(
      `Celo balance ${formatEther(balance)} CELO must exceed sweep amount ${formatEther(amount)} CELO so L2 gas can be paid`,
    )
  }

  console.log(`${execute ? 'Initiating' : 'Dry run'} CELO withdrawal`)
  console.log(`From Celo ops wallet: ${clients.account.address}`)
  console.log(`To Ethereum treasury: ${treasury}`)
  console.log(`Amount: ${formatEther(amount)} CELO`)
  console.log(`L1 execution gas limit: ${l1GasLimit}`)

  if (!execute) {
    console.log('Dry run complete. Re-run with --execute to broadcast the L2 withdrawal initiation.')
    return
  }

  const hash = await clients.walletClientL2.initiateWithdrawal({
    request: {
      to: treasury,
      gas: l1GasLimit,
      data: '0x',
      value: amount,
    },
  })
  console.log(`Submitted initiate transaction on Celo: ${hash}`)
  const receipt = await clients.publicClientL2.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`Initiate transaction failed: ${hash}`)
  const [withdrawal] = getWithdrawals(receipt)
  console.log(`Confirmed in Celo block ${receipt.blockNumber}`)
  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
}

async function getInitiateReceipt(clients: ReturnType<typeof createClients>) {
  return clients.publicClientL2.getTransactionReceipt({ hash: requireHash('--initiate-tx') })
}

async function status() {
  const clients = createClients()
  await assertChains(clients)

  const receipt = await getInitiateReceipt(clients)
  const [withdrawal] = getWithdrawals(receipt)
  const current = await clients.publicClientL1.getWithdrawalStatus({
    receipt,
    targetChain: celoWithBridgeContracts,
  })

  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`Status: ${current}`)

  if (current === 'waiting-to-prove') {
    const timing = await getTimeToProve(clients.publicClientL1, {
      receipt,
      targetChain: celoWithBridgeContracts,
    })
    console.log(`Estimated prove readiness: ${formatTimestamp(timing.timestamp)}`)
  }

  if (current === 'waiting-to-finalize') {
    const timing = await getTimeToFinalize(clients.publicClientL1, {
      withdrawalHash: withdrawal.withdrawalHash,
      targetChain: celoOpStackTarget,
    })
    console.log(`Estimated finalize readiness: ${formatTimestamp(timing.timestamp)}`)
  }
}

async function prove(execute: boolean) {
  const clients = createClients()
  await assertChains(clients)
  const receipt = await getInitiateReceipt(clients)
  const current = await clients.publicClientL1.getWithdrawalStatus({
    receipt,
    targetChain: celoWithBridgeContracts,
  })
  if (current !== 'ready-to-prove') throw new Error(`Withdrawal is ${current}; cannot prove yet`)

  const { game, withdrawal } = await clients.publicClientL1.waitToProve({
    receipt,
    targetChain: celoWithBridgeContracts,
  })
  const proveArgs = await clients.publicClientL2.buildProveWithdrawal({
    account: clients.account,
    game,
    withdrawal,
  })

  console.log(`${execute ? 'Proving' : 'Dry run'} withdrawal ${withdrawal.withdrawalHash}`)
  if (!execute) {
    console.log('Dry run complete. Re-run with --execute to broadcast the L1 prove transaction.')
    return
  }

  const hash = await clients.walletClientL1.proveWithdrawal({
    ...proveArgs,
    targetChain: celoWithBridgeContracts,
  })
  console.log(`Submitted prove transaction on Ethereum: ${hash}`)
  const proveReceipt = await clients.publicClientL1.waitForTransactionReceipt({ hash })
  if (proveReceipt.status !== 'success') throw new Error(`Prove transaction failed: ${hash}`)
  console.log(`Confirmed in Ethereum block ${proveReceipt.blockNumber}`)
}

async function finalize(execute: boolean) {
  const clients = createClients()
  await assertChains(clients)
  const receipt = await getInitiateReceipt(clients)
  const [withdrawal] = getWithdrawals(receipt)
  const current = await clients.publicClientL1.getWithdrawalStatus({
    receipt,
    targetChain: celoWithBridgeContracts,
  })
  if (current !== 'ready-to-finalize') throw new Error(`Withdrawal is ${current}; cannot finalize yet`)

  const proofSubmitterRaw = getFlagValue('--proof-submitter')
  const proofSubmitter = proofSubmitterRaw
    ? asAddress(proofSubmitterRaw, '--proof-submitter')
    : undefined

  console.log(`${execute ? 'Finalizing' : 'Dry run'} withdrawal ${withdrawal.withdrawalHash}`)
  if (!execute) {
    console.log('Dry run complete. Re-run with --execute to broadcast the L1 finalize transaction.')
    return
  }

  const hash = await clients.walletClientL1.finalizeWithdrawal({
    proofSubmitter,
    targetChain: celoWithBridgeContracts,
    withdrawal,
  })
  console.log(`Submitted finalize transaction on Ethereum: ${hash}`)
  const finalizeReceipt = await clients.publicClientL1.waitForTransactionReceipt({ hash })
  if (finalizeReceipt.status !== 'success') throw new Error(`Finalize transaction failed: ${hash}`)
  console.log(`Confirmed in Ethereum block ${finalizeReceipt.blockNumber}`)
}

async function main() {
  const cmd = command()
  const execute = hasFlag('--execute')

  if (cmd === 'initiate') return initiate(execute)
  if (cmd === 'status') return status()
  if (cmd === 'prove') return prove(execute)
  if (cmd === 'finalize') return finalize(execute)
  usage()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
