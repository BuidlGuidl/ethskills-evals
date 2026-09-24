import 'dotenv/config'

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  getAddress,
  http,
  isHash,
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

const PLACEHOLDER_TREASURY =
  '0x1111111111111111111111111111111111111111' as const

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
    l1StandardBridge: {
      [mainnet.id]: {
        address: '0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe',
      },
    },
    portal: {
      [mainnet.id]: {
        address: '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC',
      },
    },
  },
})

type Command = 'initiate' | 'status' | 'prove' | 'finalize'

type ParsedArgs = {
  command: Command
  amount?: string
  all: boolean
  reserve: string
  tx?: Hash
  execute: boolean
  wait: boolean
  proofSubmitter?: Address
}

function usage(): never {
  throw new Error(
    [
      'Usage:',
      '  npm run sweep -- initiate (--amount 123.45 | --all [--reserve 0.1]) [--execute]',
      '  npm run sweep -- status --tx 0x...',
      '  npm run sweep -- prove --tx 0x... [--wait] [--execute]',
      '  npm run sweep -- finalize --tx 0x... [--wait] [--proof-submitter 0x...] [--execute]',
      '',
      'Required env for initiate/prove/finalize: OPS_PRIVATE_KEY',
      'Required env for all commands: ETH_RPC_URL',
      'Optional env: CELO_RPC_URL, MAINNET_TREASURY',
    ].join('\n'),
  )
}

function parseArgs(argv: string[]): ParsedArgs {
  const command = argv.shift() as Command | undefined
  if (!command || !['initiate', 'status', 'prove', 'finalize'].includes(command)) {
    usage()
  }

  const args: ParsedArgs = {
    command,
    all: false,
    reserve: '0.1',
    execute: false,
    wait: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--amount') args.amount = requireValue(argv, ++i, '--amount')
    else if (arg === '--all') args.all = true
    else if (arg === '--reserve') args.reserve = requireValue(argv, ++i, '--reserve')
    else if (arg === '--tx') {
      const value = requireValue(argv, ++i, '--tx')
      if (!isHash(value)) throw new Error('--tx must be a transaction hash')
      args.tx = value
    } else if (arg === '--execute') args.execute = true
    else if (arg === '--wait') args.wait = true
    else if (arg === '--proof-submitter') {
      args.proofSubmitter = getAddress(requireValue(argv, ++i, '--proof-submitter'))
    } else {
      usage()
    }
  }

  if (command === 'initiate' && Number(args.all) + Number(Boolean(args.amount)) !== 1) {
    throw new Error('initiate requires exactly one of --amount or --all')
  }
  if (command !== 'initiate' && !args.tx) {
    throw new Error(`${command} requires --tx`)
  }

  return args
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index]
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`)
  }
  return value
}

function requirePrivateKey(): Hex {
  const value = process.env.OPS_PRIVATE_KEY
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('OPS_PRIVATE_KEY must be a 0x-prefixed 32-byte private key')
  }
  return value as Hex
}

function treasury(): Address {
  return getAddress(process.env.MAINNET_TREASURY ?? PLACEHOLDER_TREASURY)
}

function parseCeloAmount(raw: string, label: string): bigint {
  try {
    const amount = parseEther(raw)
    if (amount <= 0n) throw new Error()
    return amount
  } catch {
    throw new Error(`${label} must be a positive CELO amount`)
  }
}

function clients(account?: ReturnType<typeof privateKeyToAccount>) {
  const celoRpc = process.env.CELO_RPC_URL ?? 'https://forno.celo.org'
  const ethRpc = process.env.ETH_RPC_URL
  if (!ethRpc) throw new Error('ETH_RPC_URL is required for sweep operations')

  const celoPublic = createPublicClient({
    chain: celoL2,
    transport: http(celoRpc),
  }).extend(publicActionsL2())
  const ethPublic = createPublicClient({
    chain: mainnet,
    transport: http(ethRpc),
  }).extend(publicActionsL1())

  const celoWallet = account
    ? createWalletClient({
        account,
        chain: celoL2,
        transport: http(celoRpc),
      }).extend(walletActionsL2())
    : undefined
  const ethWallet = account
    ? createWalletClient({
        account,
        chain: mainnet,
        transport: http(ethRpc),
      }).extend(walletActionsL1())
    : undefined

  return { celoPublic, ethPublic, celoWallet, ethWallet }
}

async function assertChains() {
  const { celoPublic, ethPublic } = clients()
  const [celoChainId, ethChainId] = await Promise.all([
    celoPublic.getChainId(),
    ethPublic.getChainId(),
  ])
  if (celoChainId !== celo.id) {
    throw new Error(`CELO_RPC_URL is on chain ${celoChainId}, expected ${celo.id}`)
  }
  if (ethChainId !== mainnet.id) {
    throw new Error(`ETH_RPC_URL is on chain ${ethChainId}, expected ${mainnet.id}`)
  }
}

async function initiate(args: ParsedArgs) {
  const account = privateKeyToAccount(requirePrivateKey())
  const to = treasury()
  if (args.execute && to === PLACEHOLDER_TREASURY) {
    throw new Error('Set MAINNET_TREASURY before executing; placeholder treasury is blocked')
  }

  const { celoPublic, celoWallet } = clients(account)
  if (!celoWallet) throw new Error('Internal error: missing Celo wallet client')

  const balance = await celoPublic.getBalance({ address: account.address })
  const amount = args.all
    ? balance - parseCeloAmount(args.reserve, '--reserve')
    : parseCeloAmount(args.amount!, '--amount')

  if (amount <= 0n) throw new Error('Sweep amount is zero after reserve')
  if (amount >= balance) {
    throw new Error(
      `Insufficient CELO: amount ${formatEther(amount)}, balance ${formatEther(balance)}`,
    )
  }

  const request = {
    gas: 21_000n,
    to,
    value: amount,
  }
  const gas = await celoPublic.estimateInitiateWithdrawalGas({
    account: account.address,
    request,
  })

  console.log(`Ops wallet: ${account.address}`)
  console.log(`Mainnet treasury: ${to}`)
  console.log(`Celo balance: ${formatEther(balance)} CELO`)
  console.log(`Withdrawal amount: ${formatEther(amount)} CELO`)
  console.log(`Estimated Celo gas: ${gas}`)
  console.log(args.execute ? 'Mode: EXECUTE' : 'Mode: DRY RUN (no broadcasts)')

  if (!args.execute) return

  const hash = await celoWallet.initiateWithdrawal({ request })
  console.log(`Initiated withdrawal on Celo: ${hash}`)
  console.log('Next: run status until ready-to-prove, then run prove.')
}

async function withdrawalFromReceipt(tx: Hash) {
  const { celoPublic } = clients()
  const receipt = await celoPublic.getTransactionReceipt({ hash: tx })
  const [withdrawal] = getWithdrawals({ logs: [...receipt.logs] })
  if (!withdrawal) throw new Error(`Transaction ${tx} contains no withdrawal`)
  return { receipt, withdrawal }
}

async function status(args: ParsedArgs) {
  const { receipt, withdrawal } = await withdrawalFromReceipt(args.tx!)
  const { ethPublic } = clients()
  const current = await ethPublic.getWithdrawalStatus({
    receipt,
    targetChain: celoL2,
  })

  console.log(`Withdrawal tx: ${args.tx}`)
  console.log(`L2 block: ${receipt.blockNumber}`)
  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`Target: ${withdrawal.target}`)
  console.log(`Value: ${formatEther(withdrawal.value)} CELO`)
  console.log(`Status: ${current}`)
}

async function prove(args: ParsedArgs) {
  const account = privateKeyToAccount(requirePrivateKey())
  const { receipt } = await withdrawalFromReceipt(args.tx!)
  const { celoPublic, ethPublic, ethWallet } = clients(account)
  if (!ethWallet) throw new Error('Internal error: missing Ethereum wallet client')

  const current = await ethPublic.getWithdrawalStatus({
    receipt,
    targetChain: celoL2,
  })
  if (current !== 'ready-to-prove' && !args.wait) {
    throw new Error(`Withdrawal is ${current}; rerun with --wait or try later`)
  }

  const { game, withdrawal } = await ethPublic.waitToProve({
    receipt,
    targetChain: celoL2,
  })
  const proveRequest = await celoPublic.buildProveWithdrawal({
    account: account.address,
    game,
    withdrawal,
  })

  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`Dispute game index: ${game.index}`)
  console.log(args.execute ? 'Mode: EXECUTE' : 'Mode: DRY RUN (no broadcasts)')

  if (!args.execute) return

  const hash = await ethWallet.proveWithdrawal(proveRequest)
  console.log(`Proved withdrawal on Ethereum: ${hash}`)
  console.log('Next: run status until ready-to-finalize, then run finalize.')
}

async function finalize(args: ParsedArgs) {
  const account = privateKeyToAccount(requirePrivateKey())
  const { receipt, withdrawal } = await withdrawalFromReceipt(args.tx!)
  const { ethPublic, ethWallet } = clients(account)
  if (!ethWallet) throw new Error('Internal error: missing Ethereum wallet client')

  let current = await ethPublic.getWithdrawalStatus({
    receipt,
    targetChain: celoL2,
  })
  while (current !== 'ready-to-finalize' && args.wait) {
    console.log(`Withdrawal is ${current}; waiting 60s before checking again`)
    await new Promise((resolve) => setTimeout(resolve, 60_000))
    current = await ethPublic.getWithdrawalStatus({
      receipt,
      targetChain: celoL2,
    })
  }
  if (current !== 'ready-to-finalize') {
    throw new Error(`Withdrawal is ${current}; rerun with --wait or try later`)
  }

  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`Final recipient: ${withdrawal.target}`)
  console.log(`Value: ${formatEther(withdrawal.value)} CELO`)
  console.log(args.execute ? 'Mode: EXECUTE' : 'Mode: DRY RUN (no broadcasts)')

  if (!args.execute) return

  const hash = await ethWallet.finalizeWithdrawal({
    account: account.address,
    proofSubmitter: args.proofSubmitter,
    targetChain: celoL2,
    withdrawal,
  })
  console.log(`Finalized withdrawal on Ethereum: ${hash}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await assertChains()

  if (args.command === 'initiate') await initiate(args)
  else if (args.command === 'status') await status(args)
  else if (args.command === 'prove') await prove(args)
  else await finalize(args)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
