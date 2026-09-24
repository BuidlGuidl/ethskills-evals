import { config } from 'dotenv'
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  getAddress,
  http,
  parseEther,
  type Hash,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, mainnet } from 'viem/chains'
import {
  getWithdrawals,
  publicActionsL1,
  publicActionsL2,
  walletActionsL1,
  walletActionsL2,
} from 'viem/op-stack'

config({ quiet: true })

const CELO_CHAIN_ID = 42_220
const MAINNET_CHAIN_ID = 1
const DEFAULT_TREASURY = '0x1111111111111111111111111111111111111111'

const sourceId = MAINNET_CHAIN_ID
const celoWithdrawalChain = defineChain({
  ...celo,
  sourceId,
  contracts: {
    ...celo.contracts,
    portal: {
      [sourceId]: {
        address: '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC',
        blockCreated: 22_128_103,
      },
    },
    disputeGameFactory: {
      [sourceId]: {
        address: '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683',
        blockCreated: 22_128_103,
      },
    },
    l2OutputOracle: {
      [sourceId]: {
        address: '0x7617b249AEb1F06c90BDF9C4F6C903C09a6a4220',
        blockCreated: 22_128_103,
      },
    },
    l1StandardBridge: {
      [sourceId]: {
        address: '0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe',
        blockCreated: 22_128_103,
      },
    },
  },
})

function env(name: string, fallback?: string) {
  return process.env[name] || fallback
}

function requireEnv(name: string) {
  const value = env(name)
  if (!value) throw new Error(`Missing required env var ${name}`)
  return value
}

function asPrivateKey(value: string, name: string): Hex {
  const key = value.startsWith('0x') ? value : `0x${value}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(`${name} must be a 32-byte hex private key`)
  }
  return key as Hex
}

function argValue(name: string) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`))
  return arg?.slice(name.length + 1)
}

function requireHash(value: string | undefined, label: string): Hash {
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label} must be a transaction hash`)
  }
  return value as Hash
}

function secondsText(seconds: number) {
  if (seconds <= 0) return 'now'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  return `${days}d ${hours}h ${minutes}m`
}

async function clients() {
  const l2Account = privateKeyToAccount(
    asPrivateKey(requireEnv('PRIVATE_KEY'), 'PRIVATE_KEY'),
  )
  const l1Account = privateKeyToAccount(
    asPrivateKey(
      env('L1_PRIVATE_KEY', requireEnv('PRIVATE_KEY'))!,
      'L1_PRIVATE_KEY',
    ),
  )

  const publicClientL1 = createPublicClient({
    chain: mainnet,
    transport: http(env('ETHEREUM_RPC_URL')),
  }).extend(publicActionsL1())
  const walletClientL1 = createWalletClient({
    account: l1Account,
    chain: mainnet,
    transport: http(env('ETHEREUM_RPC_URL')),
  }).extend(walletActionsL1())
  const publicClientL2 = createPublicClient({
    chain: celoWithdrawalChain,
    transport: http(env('CELO_RPC_URL', 'https://forno.celo.org')),
  }).extend(publicActionsL2())
  const walletClientL2 = createWalletClient({
    account: l2Account,
    chain: celoWithdrawalChain,
    transport: http(env('CELO_RPC_URL', 'https://forno.celo.org')),
  }).extend(walletActionsL2())

  const [l1ChainId, l2ChainId] = await Promise.all([
    publicClientL1.getChainId(),
    publicClientL2.getChainId(),
  ])
  if (l1ChainId !== MAINNET_CHAIN_ID) {
    throw new Error(`ETHEREUM_RPC_URL returned chain id ${l1ChainId}, expected 1`)
  }
  if (l2ChainId !== CELO_CHAIN_ID) {
    throw new Error(`CELO_RPC_URL returned chain id ${l2ChainId}, expected 42220`)
  }

  return {
    l1Account,
    l2Account,
    publicClientL1,
    walletClientL1,
    publicClientL2,
    walletClientL2,
  }
}

async function loadWithdrawal(initiateHash: Hash) {
  const { publicClientL1, publicClientL2 } = await clients()
  const receipt = await publicClientL2.getTransactionReceipt({
    hash: initiateHash,
  })
  const block = await publicClientL2.getBlock({
    blockNumber: receipt.blockNumber,
  })
  const [withdrawal] = getWithdrawals({ logs: receipt.logs })
  if (!withdrawal) {
    throw new Error(`Transaction ${initiateHash} did not emit a withdrawal message`)
  }
  return { publicClientL1, publicClientL2, receipt, block, withdrawal }
}

async function initiate() {
  const broadcast =
    process.argv.includes('--broadcast') || env('BROADCAST') === 'true'
  if (broadcast && env('CONFIRM_PRODUCTION') !== 'celo-mainnet') {
    throw new Error(
      'Refusing to broadcast without CONFIRM_PRODUCTION=celo-mainnet',
    )
  }

  const { l2Account, publicClientL1, publicClientL2, walletClientL2 } =
    await clients()
  const treasury = getAddress(env('TREASURY_ADDRESS', DEFAULT_TREASURY)!)
  const balance = await publicClientL2.getBalance({ address: l2Account.address })
  const reserve = parseEther(env('SWEEP_RESERVE_CELO', '1')!)
  const amount = env('SWEEP_AMOUNT_CELO')
    ? parseEther(env('SWEEP_AMOUNT_CELO')!)
    : balance - reserve

  if (amount <= 0n) {
    throw new Error(
      `Sweep amount is ${formatEther(amount)} CELO. Lower SWEEP_RESERVE_CELO or set SWEEP_AMOUNT_CELO.`,
    )
  }
  if (balance < amount) {
    throw new Error(
      `Insufficient CELO: need ${formatEther(amount)}, have ${formatEther(balance)}`,
    )
  }
  if (balance - amount < reserve && env('ALLOW_LOW_CELO_RESERVE') !== 'true') {
    throw new Error(
      `Sweep would leave ${formatEther(
        balance - amount,
      )} CELO, below SWEEP_RESERVE_CELO=${formatEther(reserve)}. Set ALLOW_LOW_CELO_RESERVE=true only after ops approves.`,
    )
  }
  if (
    treasury === getAddress(DEFAULT_TREASURY) &&
    env('ALLOW_PLACEHOLDER_TREASURY') !== 'true'
  ) {
    throw new Error(
      'TREASURY_ADDRESS is still the placeholder; set the real treasury or ALLOW_PLACEHOLDER_TREASURY=true for rehearsal',
    )
  }

  const args = await publicClientL1.buildInitiateWithdrawal({
    to: treasury,
    value: amount,
  })

  console.log(`Ops wallet: ${l2Account.address}`)
  console.log(`Mainnet treasury: ${treasury}`)
  console.log(`Celo balance: ${formatEther(balance)} CELO`)
  console.log(`Sweep amount: ${formatEther(amount)} CELO`)
  console.log(`Retained reserve: ${formatEther(balance - amount)} CELO`)
  console.log(`Mode: ${broadcast ? 'BROADCAST' : 'DRY RUN'}`)

  if (!broadcast) {
    console.log('dry-run initiate args:')
    console.log(args)
    return
  }

  const hash = await walletClientL2.initiateWithdrawal(args)
  console.log(`initiate tx: ${hash}`)
  const receipt = await publicClientL2.waitForTransactionReceipt({ hash })
  console.log(`included in Celo block ${receipt.blockNumber}`)
}

async function status(initiateHash: Hash) {
  const { publicClientL1, receipt, block, withdrawal } =
    await loadWithdrawal(initiateHash)
  const current = await publicClientL1.getWithdrawalStatus({
    receipt,
    l2Timestamp: block.timestamp,
    targetChain: celoWithdrawalChain,
  })

  console.log(`withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`status: ${current}`)

  if (current === 'waiting-to-prove') {
    const time = await publicClientL1.getTimeToProve({
      receipt,
      l2Timestamp: block.timestamp,
      targetChain: celoWithdrawalChain,
    })
    console.log(`ready to prove in: ${secondsText(time.seconds)}`)
    if (time.timestamp) {
      console.log(`ready to prove at: ${new Date(time.timestamp).toISOString()}`)
    }
  }

  if (current === 'waiting-to-finalize') {
    const time = await publicClientL1.getTimeToFinalize({
      withdrawalHash: withdrawal.withdrawalHash,
      targetChain: celoWithdrawalChain,
    })
    console.log(`ready to finalize in: ${secondsText(time.seconds)}`)
    console.log(`ready to finalize at: ${new Date(time.timestamp).toISOString()}`)
  }
}

async function prove(initiateHash: Hash) {
  const broadcast =
    process.argv.includes('--broadcast') || env('BROADCAST') === 'true'
  if (broadcast && env('CONFIRM_PRODUCTION') !== 'celo-mainnet') {
    throw new Error(
      'Refusing to broadcast without CONFIRM_PRODUCTION=celo-mainnet',
    )
  }

  const { l1Account, publicClientL1, walletClientL1 } = await clients()
  const { publicClientL2, receipt, block } = await loadWithdrawal(initiateHash)
  const current = await publicClientL1.getWithdrawalStatus({
    receipt,
    l2Timestamp: block.timestamp,
    targetChain: celoWithdrawalChain,
  })
  if (current !== 'ready-to-prove') {
    throw new Error(`Withdrawal is ${current}, not ready-to-prove`)
  }

  const { game, withdrawal } = await publicClientL1.waitToProve({
    receipt,
    l2Timestamp: block.timestamp,
    targetChain: celoWithdrawalChain,
  })
  const proveArgs = await publicClientL2.buildProveWithdrawal({
    account: l1Account.address,
    game,
    withdrawal,
  })

  console.log(`L1 prover: ${l1Account.address}`)
  console.log(`withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`Mode: ${broadcast ? 'BROADCAST' : 'DRY RUN'}`)

  if (!broadcast) {
    console.log('dry-run prove args:')
    console.log(proveArgs)
    return
  }

  const hash = await walletClientL1.proveWithdrawal(proveArgs)
  console.log(`prove tx: ${hash}`)
  await publicClientL1.waitForTransactionReceipt({ hash })
}

async function finalize(initiateHash: Hash) {
  const broadcast =
    process.argv.includes('--broadcast') || env('BROADCAST') === 'true'
  if (broadcast && env('CONFIRM_PRODUCTION') !== 'celo-mainnet') {
    throw new Error(
      'Refusing to broadcast without CONFIRM_PRODUCTION=celo-mainnet',
    )
  }

  const { l1Account, publicClientL1, walletClientL1 } = await clients()
  const { receipt, block, withdrawal } = await loadWithdrawal(initiateHash)
  const current = await publicClientL1.getWithdrawalStatus({
    receipt,
    l2Timestamp: block.timestamp,
    targetChain: celoWithdrawalChain,
  })
  if (current === 'finalized') {
    console.log('Withdrawal is already finalized')
    return
  }
  if (current !== 'ready-to-finalize') {
    throw new Error(`Withdrawal is ${current}, not ready-to-finalize`)
  }

  const proofSubmitter = env('PROOF_SUBMITTER')
    ? getAddress(env('PROOF_SUBMITTER')!)
    : undefined

  console.log(`L1 finalizer: ${l1Account.address}`)
  console.log(`withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`Mode: ${broadcast ? 'BROADCAST' : 'DRY RUN'}`)

  if (!broadcast) return

  const hash = await walletClientL1.finalizeWithdrawal({
    proofSubmitter,
    targetChain: celoWithdrawalChain,
    withdrawal,
  })
  console.log(`finalize tx: ${hash}`)
  await publicClientL1.waitForTransactionReceipt({ hash })
}

async function main() {
  const command = process.argv[2]
  if (!command || !['initiate', 'status', 'prove', 'finalize'].includes(command)) {
    throw new Error(
      'Usage: npm run sweep -- <initiate|status|prove|finalize> [--tx=0x...]',
    )
  }

  if (command === 'initiate') return initiate()

  const tx = requireHash(argValue('--tx') ?? env('INITIATE_TX_HASH'), 'initiate tx')
  if (command === 'status') return status(tx)
  if (command === 'prove') return prove(tx)
  return finalize(tx)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
