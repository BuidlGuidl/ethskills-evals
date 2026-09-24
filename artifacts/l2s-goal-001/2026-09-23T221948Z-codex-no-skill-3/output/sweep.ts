import 'dotenv/config'

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

const PLACEHOLDER_TREASURY = '0x1111111111111111111111111111111111111111'
const CELO_CHAIN_ID = 42_220
const ETHEREUM_CHAIN_ID = 1

const celoL2 = defineChain({
  ...celo,
  sourceId: mainnet.id,
  contracts: {
    ...celo.contracts,
    disputeGameFactory: {
      [mainnet.id]: {
        address: '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683',
      },
    },
    portal: {
      [mainnet.id]: {
        address: '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC',
      },
    },
    l1StandardBridge: {
      [mainnet.id]: {
        address: '0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe',
      },
    },
  },
})

// Celo's current bridge docs expose portal + disputeGameFactory, while a few viem
// OP Stack helper types still require legacy l2OutputOracle metadata.
const celoOpTargetChain = celoL2 as never

function argValue(name: string): string | undefined {
  const prefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)

  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function command(): 'status' | 'initiate' | 'prove' | 'finalize' {
  const explicit = argValue('--phase')
  const positional = process.argv.find((arg) => ['status', 'initiate', 'prove', 'finalize'].includes(arg))
  const phase = explicit ?? positional ?? 'status'
  if (!['status', 'initiate', 'prove', 'finalize'].includes(phase)) {
    throw new Error(`Unknown phase "${phase}". Use status, initiate, prove, or finalize.`)
  }
  return phase as 'status' | 'initiate' | 'prove' | 'finalize'
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function privateKeyFromEnv(): Hex {
  const raw = requiredEnv('OPS_PRIVATE_KEY')
  const key = raw.startsWith('0x') ? raw : `0x${raw}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('OPS_PRIVATE_KEY must be a 32-byte hex private key')
  }
  return key as Hex
}

function hashFromInput(label: string, value: string | undefined): Hash {
  if (!value) throw new Error(`Missing ${label}`)
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${label} must be a transaction hash`)
  return value as Hash
}

function treasuryAddress(): Address {
  const raw = argValue('--treasury') ?? process.env.TREASURY_ADDRESS ?? PLACEHOLDER_TREASURY
  if (!isAddress(raw)) throw new Error(`Invalid treasury address: ${raw}`)
  return getAddress(raw)
}

function assertBroadcastAllowed(phase: string, treasury: Address): void {
  if (!hasFlag('--broadcast')) return
  if (process.env.SWEEP_CONFIRM_PRODUCTION !== 'true') {
    throw new Error(`Refusing to broadcast ${phase} unless SWEEP_CONFIRM_PRODUCTION=true`)
  }
  if (treasury.toLowerCase() === PLACEHOLDER_TREASURY.toLowerCase()) {
    throw new Error('Refusing to broadcast to the placeholder treasury address')
  }
}

function validateDecimal(value: string, label: string): void {
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) {
    throw new Error(`${label} must be a positive decimal string, got "${value}"`)
  }
}

function formatEta(seconds: number, timestamp?: number): string {
  const readyAtSeconds = timestamp ?? Math.floor(Date.now() / 1000) + seconds
  const readyAt = new Date(readyAtSeconds * 1000).toISOString()
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${seconds}s (${hours}h ${minutes}m), ready around ${readyAt}`
}

function publicClients() {
  const publicClientL1 = createPublicClient({
    chain: mainnet,
    transport: http(requiredEnv('ETHEREUM_RPC_URL')),
  }).extend(publicActionsL1())

  const publicClientL2 = createPublicClient({
    chain: celoL2,
    transport: http(requiredEnv('CELO_RPC_URL')),
  }).extend(publicActionsL2())

  return { publicClientL1, publicClientL2 }
}

function walletClients(account: ReturnType<typeof privateKeyToAccount>) {
  const walletClientL1 = createWalletClient({
    account,
    chain: mainnet,
    transport: http(requiredEnv('ETHEREUM_RPC_URL')),
  }).extend(walletActionsL1())

  const walletClientL2 = createWalletClient({
    account,
    chain: celoL2,
    transport: http(requiredEnv('CELO_RPC_URL')),
  }).extend(walletActionsL2())

  return { walletClientL1, walletClientL2 }
}

async function assertChains(clients: ReturnType<typeof publicClients>) {
  const [l1ChainId, l2ChainId] = await Promise.all([
    clients.publicClientL1.getChainId(),
    clients.publicClientL2.getChainId(),
  ])
  if (l1ChainId !== ETHEREUM_CHAIN_ID) {
    throw new Error(`ETHEREUM_RPC_URL returned chainId ${l1ChainId}; expected ${ETHEREUM_CHAIN_ID}`)
  }
  if (l2ChainId !== CELO_CHAIN_ID) {
    throw new Error(`CELO_RPC_URL returned chainId ${l2ChainId}; expected ${CELO_CHAIN_ID}`)
  }
}

async function getInitiationReceipt(publicClientL2: ReturnType<typeof publicClients>['publicClientL2']) {
  const txHash = hashFromInput('--initiate-tx or INITIATE_TX_HASH', argValue('--initiate-tx') ?? process.env.INITIATE_TX_HASH)
  const receipt = await publicClientL2.getTransactionReceipt({ hash: txHash })
  const [withdrawal] = getWithdrawals({ logs: receipt.logs })
  if (!withdrawal) throw new Error(`Transaction ${txHash} does not contain a Celo withdrawal`)
  return { txHash, receipt, withdrawal }
}

async function runStatus(clients: ReturnType<typeof publicClients>) {
  const { txHash, receipt, withdrawal } = await getInitiationReceipt(clients.publicClientL2)
  const status = await clients.publicClientL1.getWithdrawalStatus({
    receipt,
    targetChain: celoOpTargetChain,
  })

  console.log(`Initiate tx: ${txHash}`)
  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`Target: ${withdrawal.target}`)
  console.log(`Value: ${formatEther(withdrawal.value)} CELO`)
  console.log(`Status: ${status}`)

  if (status === 'waiting-to-prove') {
    const time = await clients.publicClientL1.getTimeToProve({ receipt, targetChain: celoOpTargetChain })
    console.log(`Time to prove: ${formatEta(time.seconds, time.timestamp)}`)
  }
  if (status === 'waiting-to-finalize') {
    const time = await clients.publicClientL1.getTimeToFinalize({
      withdrawalHash: withdrawal.withdrawalHash,
      targetChain: celoOpTargetChain,
    })
    console.log(`Time to finalize: ${formatEta(time.seconds, time.timestamp)}`)
  }
}

async function runInitiate(clients: ReturnType<typeof publicClients>, treasury: Address) {
  const broadcast = hasFlag('--broadcast')
  const account = privateKeyToAccount(privateKeyFromEnv())
  const { walletClientL2 } = walletClients(account)
  const gasReserveRaw = argValue('--gas-reserve') ?? process.env.CELO_L2_GAS_RESERVE ?? '0.05'
  validateDecimal(gasReserveRaw, 'CELO_L2_GAS_RESERVE')
  const gasReserve = parseEther(gasReserveRaw)
  const balance = await clients.publicClientL2.getBalance({ address: account.address })

  const amountRaw = argValue('--amount') ?? process.env.SWEEP_AMOUNT_CELO
  let amount: bigint
  if (!amountRaw || amountRaw === 'all') {
    amount = balance - gasReserve
  } else {
    validateDecimal(amountRaw, 'SWEEP_AMOUNT_CELO')
    amount = parseEther(amountRaw)
  }

  if (amount <= 0n) throw new Error('Sweep amount is zero after gas reserve')
  if (balance - amount < gasReserve) {
    throw new Error(
      `Sweep would leave less than ${formatEther(gasReserve)} CELO on Celo for gas. Balance ${formatEther(balance)}, amount ${formatEther(amount)}.`,
    )
  }

  const args = await clients.publicClientL1.buildInitiateWithdrawal({
    account,
    to: treasury,
    value: amount,
  })

  console.log(`Ops wallet: ${account.address}`)
  console.log(`Treasury on Ethereum mainnet: ${treasury}`)
  console.log(`Celo balance: ${formatEther(balance)} CELO`)
  console.log(`Sweep amount: ${formatEther(amount)} CELO`)
  console.log(`Celo gas reserve: ${formatEther(balance - amount)} CELO`)
  console.log(`Mode: ${broadcast ? 'BROADCAST' : 'DRY RUN'}`)

  if (!broadcast) {
    console.log('Dry run complete. Re-run initiate with --broadcast to submit the L2 withdrawal initiation.')
    return
  }

  const hash = await walletClientL2.initiateWithdrawal(args)
  console.log(`Initiated withdrawal on Celo: ${hash}`)

  const receipt = await clients.publicClientL2.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`Initiation reverted: ${hash}`)

  const [withdrawal] = getWithdrawals({ logs: receipt.logs })
  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log('Next phase: prove after the withdrawal is ready.')
}

async function runProve(clients: ReturnType<typeof publicClients>, treasury: Address) {
  const broadcast = hasFlag('--broadcast')
  const wait = hasFlag('--wait')
  const account = privateKeyToAccount(privateKeyFromEnv())
  const { walletClientL1 } = walletClients(account)
  const { receipt, withdrawal } = await getInitiationReceipt(clients.publicClientL2)
  const status = await clients.publicClientL1.getWithdrawalStatus({ receipt, targetChain: celoOpTargetChain })

  if (!['ready-to-prove', 'waiting-to-prove'].includes(status)) {
    throw new Error(`Withdrawal status is ${status}; prove is not the next action`)
  }
  if (status === 'waiting-to-prove' && !wait) {
    const time = await clients.publicClientL1.getTimeToProve({ receipt, targetChain: celoOpTargetChain })
    console.log(`Not ready to prove. Time to prove: ${formatEta(time.seconds, time.timestamp)}. Re-run with --wait to block.`)
    return
  }

  const ethBalance = await clients.publicClientL1.getBalance({ address: account.address })
  if (broadcast && ethBalance === 0n) throw new Error('Ops wallet has no ETH on mainnet to pay prove gas')

  const proof = await clients.publicClientL1.waitToProve({ receipt, targetChain: celoOpTargetChain })
  const proveArgs = await clients.publicClientL2.buildProveWithdrawal(proof as never)

  console.log(`Ops wallet: ${account.address}`)
  console.log(`Treasury on Ethereum mainnet: ${treasury}`)
  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`Value: ${formatEther(withdrawal.value)} CELO`)
  console.log(`Mainnet ETH gas balance: ${formatEther(ethBalance)} ETH`)
  console.log(`Mode: ${broadcast ? 'BROADCAST' : 'DRY RUN'}`)

  if (!broadcast) {
    console.log(`Dry run proof built. L2 output index: ${proveArgs.l2OutputIndex}; proof nodes: ${proveArgs.withdrawalProof.length}`)
    return
  }

  const hash = await walletClientL1.proveWithdrawal(proveArgs)
  console.log(`Submitted prove tx on Ethereum: ${hash}`)

  const proveReceipt = await clients.publicClientL1.waitForTransactionReceipt({ hash })
  if (proveReceipt.status !== 'success') throw new Error(`Prove transaction reverted: ${hash}`)
  console.log('Next phase: finalize after the fault challenge period.')
}

async function runFinalize(clients: ReturnType<typeof publicClients>, treasury: Address) {
  const broadcast = hasFlag('--broadcast')
  const wait = hasFlag('--wait')
  const account = privateKeyToAccount(privateKeyFromEnv())
  const { walletClientL1 } = walletClients(account)
  const { receipt, withdrawal } = await getInitiationReceipt(clients.publicClientL2)
  const status = await clients.publicClientL1.getWithdrawalStatus({ receipt, targetChain: celoOpTargetChain })

  if (!['ready-to-finalize', 'waiting-to-finalize'].includes(status)) {
    throw new Error(`Withdrawal status is ${status}; finalize is not the next action`)
  }
  if (status === 'waiting-to-finalize' && !wait) {
    const time = await clients.publicClientL1.getTimeToFinalize({
      withdrawalHash: withdrawal.withdrawalHash,
      targetChain: celoOpTargetChain,
    })
    console.log(`Not ready to finalize. Time to finalize: ${formatEta(time.seconds, time.timestamp)}. Re-run with --wait to block.`)
    return
  }

  const ethBalance = await clients.publicClientL1.getBalance({ address: account.address })
  if (broadcast && ethBalance === 0n) throw new Error('Ops wallet has no ETH on mainnet to pay finalize gas')

  await clients.publicClientL1.waitToFinalize({
    withdrawalHash: withdrawal.withdrawalHash,
    targetChain: celoOpTargetChain,
  })

  console.log(`Ops wallet: ${account.address}`)
  console.log(`Treasury on Ethereum mainnet: ${treasury}`)
  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`Value: ${formatEther(withdrawal.value)} CELO`)
  console.log(`Mainnet ETH gas balance: ${formatEther(ethBalance)} ETH`)
  console.log(`Mode: ${broadcast ? 'BROADCAST' : 'DRY RUN'}`)

  if (!broadcast) {
    console.log('Dry run complete. Re-run finalize with --broadcast to submit the Ethereum finalization tx.')
    return
  }

  const hash = await walletClientL1.finalizeWithdrawal({
    targetChain: celoOpTargetChain,
    withdrawal,
  })
  console.log(`Submitted finalize tx on Ethereum: ${hash}`)

  const finalizeReceipt = await clients.publicClientL1.waitForTransactionReceipt({ hash })
  if (finalizeReceipt.status !== 'success') throw new Error(`Finalize transaction reverted: ${hash}`)
  console.log('Sweep complete. CELO should now be available to the treasury on Ethereum mainnet.')
}

async function main() {
  const phase = command()
  const treasury = treasuryAddress()
  assertBroadcastAllowed(phase, treasury)

  const clients = publicClients()
  await assertChains(clients)

  if (phase === 'status') return runStatus(clients)
  if (phase === 'initiate') return runInitiate(clients, treasury)
  if (phase === 'prove') return runProve(clients, treasury)
  return runFinalize(clients, treasury)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
