import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http,
  isAddress,
  isHash,
  parseEther,
  type Address,
  type Hash,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, mainnet } from 'viem/chains'
import {
  buildProveWithdrawal,
  estimateInitiateWithdrawalGas,
  finalizeWithdrawal,
  getTimeToFinalize,
  getTimeToProve,
  getWithdrawals,
  initiateWithdrawal,
  proveWithdrawal,
  waitToFinalize,
  waitToProve,
} from 'viem/op-stack'

const CELO_CHAIN_ID = 42_220
const ETHEREUM_CHAIN_ID = 1
const DEFAULT_CELO_RPC_URL = 'https://forno.celo.org'
const DEFAULT_TREASURY = '0x1111111111111111111111111111111111111111'
const SOURCE_ID = 1
const L1_CELO_TOKEN = '0x057898f3C43F129a17517B9056D23851F124b19f'
const ANCHOR_STATE_REGISTRY = '0x8fE58d2168b5412Cf1Bd212cE6137f8b7300222d'
const OPTIMISM_PORTAL = '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC'
const DISPUTE_GAME_FACTORY = '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683'
const L1_STANDARD_BRIDGE = '0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe'
const CELO_FAULT_PROOF_CONTRACTS = {
  disputeGameFactoryAddress: DISPUTE_GAME_FACTORY,
  portalAddress: OPTIMISM_PORTAL,
} as const
const CELO_FINALIZE_CONTRACTS = {
  l2OutputOracleAddress: ANCHOR_STATE_REGISTRY,
  portalAddress: OPTIMISM_PORTAL,
} as const

const celoMainnet = defineChain({
  ...celo,
  sourceId: SOURCE_ID,
  contracts: {
    ...celo.contracts,
    disputeGameFactory: {
      [SOURCE_ID]: { address: DISPUTE_GAME_FACTORY },
    },
    l1StandardBridge: {
      [SOURCE_ID]: { address: L1_STANDARD_BRIDGE },
    },
    l2OutputOracle: {
      [SOURCE_ID]: { address: ANCHOR_STATE_REGISTRY },
    },
    portal: {
      [SOURCE_ID]: { address: OPTIMISM_PORTAL },
    },
  },
})

type Command = 'initiate' | 'prove' | 'finalize' | 'status'

type Flags = {
  amount?: string
  broadcast: boolean
  celoRpcUrl: string
  command: Command
  ethRpcUrl?: string
  l1Gas: bigint
  l2Tx?: Hash
  leave: string
  max: boolean
  pollingInterval: number
  proofSubmitter?: Address
  treasury: Address
  wait: boolean
}

function usage(): never {
  console.error(`Usage:
  npm run sweep -- initiate --amount 123.45 --treasury 0x... [--broadcast]
  npm run sweep -- initiate --max --leave 0.10 --treasury 0x... [--broadcast]
  npm run sweep -- prove --l2-tx 0x... [--broadcast] [--wait]
  npm run sweep -- finalize --l2-tx 0x... [--broadcast] [--wait]
  npm run sweep -- status --l2-tx 0x...

Environment:
  OPS_PRIVATE_KEY or PRIVATE_KEY          key for initiating the Celo withdrawal
  SETTLEMENT_PRIVATE_KEY                  optional L1 gas payer key for prove/finalize
  OPS_WALLET_ADDRESS                      optional expected initiator address
  CELO_RPC_URL                            optional Celo RPC override
  ETH_RPC_URL                             required for prove/finalize/status
  MAINNET_TREASURY_ADDRESS                required before broadcasting initiate
`)
  process.exit(1)
}

function parseFlags(argv: string[]): Flags {
  const command = argv[0] as Command | undefined
  if (!command || !['initiate', 'prove', 'finalize', 'status'].includes(command)) usage()

  const flags: Flags = {
    broadcast: false,
    celoRpcUrl: process.env.CELO_RPC_URL ?? DEFAULT_CELO_RPC_URL,
    command,
    ethRpcUrl: process.env.ETH_RPC_URL,
    l1Gas: 21_000n,
    leave: '0.10',
    max: false,
    pollingInterval: 30_000,
    treasury: requireAddress(process.env.MAINNET_TREASURY_ADDRESS ?? DEFAULT_TREASURY, 'MAINNET_TREASURY_ADDRESS'),
    wait: false,
  }

  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => {
      const value = argv[++i]
      if (!value) usage()
      return value
    }

    if (arg === '--amount') flags.amount = next()
    else if (arg === '--broadcast') flags.broadcast = true
    else if (arg === '--celo-rpc') flags.celoRpcUrl = next()
    else if (arg === '--eth-rpc') flags.ethRpcUrl = next()
    else if (arg === '--l1-gas') flags.l1Gas = BigInt(next())
    else if (arg === '--l2-tx') flags.l2Tx = requireHash(next(), '--l2-tx')
    else if (arg === '--leave') flags.leave = next()
    else if (arg === '--max') flags.max = true
    else if (arg === '--polling-interval-ms') flags.pollingInterval = Number(next())
    else if (arg === '--proof-submitter') flags.proofSubmitter = requireAddress(next(), '--proof-submitter')
    else if (arg === '--treasury') flags.treasury = requireAddress(next(), '--treasury')
    else if (arg === '--wait') flags.wait = true
    else usage()
  }

  if (flags.command === 'initiate') {
    if (flags.amount && flags.max) throw new Error('Use either --amount or --max, not both')
    if (!flags.amount && !flags.max) throw new Error('initiate requires --amount or --max')
    if (flags.broadcast && flags.treasury.toLowerCase() === DEFAULT_TREASURY.toLowerCase()) {
      throw new Error('Refusing to broadcast to the placeholder treasury. Set --treasury or MAINNET_TREASURY_ADDRESS.')
    }
  } else if (!flags.l2Tx) {
    throw new Error(`${flags.command} requires --l2-tx`)
  }

  if (['prove', 'finalize', 'status'].includes(flags.command) && !flags.ethRpcUrl) {
    throw new Error(`${flags.command} requires ETH_RPC_URL or --eth-rpc`)
  }
  if (flags.pollingInterval <= 0) throw new Error('--polling-interval-ms must be positive')

  return flags
}

function requireAddress(value: string, name: string): Address {
  if (!isAddress(value)) throw new Error(`${name} is not a valid EVM address: ${value}`)
  return value
}

function requireHash(value: string, name: string): Hash {
  if (!isHash(value)) throw new Error(`${name} is not a valid transaction hash: ${value}`)
  return value
}

function privateKeyFromEnv(primaryName: 'OPS_PRIVATE_KEY' | 'SETTLEMENT_PRIVATE_KEY'): Hex {
  const raw =
    process.env[primaryName] ??
    (primaryName === 'SETTLEMENT_PRIVATE_KEY'
      ? process.env.PRIVATE_KEY
      : process.env.OPS_PRIVATE_KEY ?? process.env.PRIVATE_KEY)
  if (!raw) throw new Error(`Set ${primaryName}${primaryName === 'SETTLEMENT_PRIVATE_KEY' ? ' or PRIVATE_KEY' : ' or PRIVATE_KEY'}`)
  const privateKey = raw.startsWith('0x') ? raw : `0x${raw}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error(`${primaryName} must be 32 bytes hex, with or without 0x prefix`)
  }
  return privateKey as Hex
}

function parseCeloAmount(value: string, name: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) throw new Error(`${name} must be a positive decimal string`)
  const fractional = value.split('.')[1]?.length ?? 0
  if (fractional > 18) throw new Error(`${name} has more than 18 decimals`)
  return parseEther(value)
}

async function makeCeloPublicClient(rpcUrl: string) {
  const client = createPublicClient({
    chain: celoMainnet,
    transport: http(rpcUrl),
  })
  const chainId = await client.getChainId()
  if (chainId !== CELO_CHAIN_ID) throw new Error(`Celo RPC is on chain ${chainId}, expected ${CELO_CHAIN_ID}`)
  return client
}

async function makeEthPublicClient(rpcUrl: string) {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  })
  const chainId = await client.getChainId()
  if (chainId !== ETHEREUM_CHAIN_ID) throw new Error(`Ethereum RPC is on chain ${chainId}, expected ${ETHEREUM_CHAIN_ID}`)
  return client
}

async function initiate(flags: Flags) {
  const account = privateKeyToAccount(privateKeyFromEnv('OPS_PRIVATE_KEY'))
  const publicCelo = await makeCeloPublicClient(flags.celoRpcUrl)
  const walletCelo = createWalletClient({
    account,
    chain: celoMainnet,
    transport: http(flags.celoRpcUrl),
  })

  const expectedOpsWallet = process.env.OPS_WALLET_ADDRESS
  if (expectedOpsWallet && account.address.toLowerCase() !== requireAddress(expectedOpsWallet, 'OPS_WALLET_ADDRESS').toLowerCase()) {
    throw new Error(`Loaded key resolves to ${account.address}, not OPS_WALLET_ADDRESS ${expectedOpsWallet}`)
  }

  const balance = await publicCelo.getBalance({ address: account.address })
  const leave = parseCeloAmount(flags.leave, '--leave')
  const dryRunValue = flags.amount ? parseCeloAmount(flags.amount, '--amount') : balance > leave ? balance - leave : 0n
  const request = { gas: flags.l1Gas, to: flags.treasury, value: dryRunValue }
  const [gas, fees] = await Promise.all([
    estimateInitiateWithdrawalGas(publicCelo, {
      account: account.address,
      request,
    }),
    publicCelo.estimateFeesPerGas(),
  ])
  const gasPrice = fees.maxFeePerGas ?? (await publicCelo.getGasPrice())
  const gasReserve = gas * gasPrice
  const amount = flags.amount ? dryRunValue : balance - leave - gasReserve

  if (amount <= 0n) throw new Error(`Nothing to sweep after --leave and estimated gas. Balance: ${formatEther(balance)} CELO`)
  if (balance < amount + gasReserve) {
    throw new Error(`Insufficient CELO for amount plus gas. Balance: ${formatEther(balance)}, amount: ${formatEther(amount)}, gas reserve: ${formatEther(gasReserve)}`)
  }

  console.log(`Ops wallet: ${account.address}`)
  console.log(`Treasury: ${flags.treasury}`)
  console.log(`L1 CELO token: ${L1_CELO_TOKEN}`)
  console.log(`OptimismPortal: ${OPTIMISM_PORTAL}`)
  console.log(`Balance: ${formatEther(balance)} CELO`)
  console.log(`Withdrawal amount: ${formatEther(amount)} CELO`)
  console.log(`Estimated L2 gas units: ${gas}`)
  console.log(`Estimated gas reserve: ${formatEther(gasReserve)} CELO`)

  if (!flags.broadcast) {
    console.log('Dry run complete. Re-run with --broadcast to initiate the Celo->Ethereum withdrawal.')
    return
  }

  const hash = await initiateWithdrawal(walletCelo, {
    request: {
      gas: flags.l1Gas,
      to: flags.treasury,
      value: amount,
    },
  })
  console.log(`Initiated withdrawal on Celo: ${hash}`)
}

async function getWithdrawalFromL2Tx(flags: Flags) {
  const publicCelo = await makeCeloPublicClient(flags.celoRpcUrl)
  const receipt = await publicCelo.getTransactionReceipt({ hash: flags.l2Tx! })
  const [withdrawal] = getWithdrawals({ logs: receipt.logs })
  if (!withdrawal) throw new Error(`No withdrawal log found in ${flags.l2Tx}`)
  return { publicCelo, receipt, withdrawal }
}

async function status(flags: Flags) {
  const publicEth = await makeEthPublicClient(flags.ethRpcUrl!)
  const { receipt, withdrawal } = await getWithdrawalFromL2Tx(flags)

  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`L2 tx block: ${receipt.blockNumber}`)
  console.log(`Target treasury: ${withdrawal.target}`)
  console.log(`Amount: ${formatEther(withdrawal.value)} CELO`)

  const prove = await getTimeToProve(publicEth, {
    ...CELO_FAULT_PROOF_CONTRACTS,
    receipt,
  })
  console.log(`Time to prove: ${prove.seconds}s`)

  const finalize = await getTimeToFinalize(publicEth, {
    ...CELO_FINALIZE_CONTRACTS,
    withdrawalHash: withdrawal.withdrawalHash,
  }).catch((error) => error)
  if (finalize instanceof Error) console.log('Time to finalize: not proven yet')
  else console.log(`Time to finalize: ${finalize.seconds}s`)
}

async function prove(flags: Flags) {
  const account = privateKeyToAccount(privateKeyFromEnv('SETTLEMENT_PRIVATE_KEY'))
  const publicEth = await makeEthPublicClient(flags.ethRpcUrl!)
  const walletEth = createWalletClient({
    account,
    chain: mainnet,
    transport: http(flags.ethRpcUrl!),
  })
  const { publicCelo, receipt } = await getWithdrawalFromL2Tx(flags)

  const time = await getTimeToProve(publicEth, {
    ...CELO_FAULT_PROOF_CONTRACTS,
    receipt,
  })
  if (time.seconds > 0 && !flags.wait) {
    throw new Error(`Withdrawal is not ready to prove for about ${time.seconds}s. Re-run later or add --wait.`)
  }

  const ready = await waitToProve(publicEth, {
    ...CELO_FAULT_PROOF_CONTRACTS,
    receipt,
    pollingInterval: flags.pollingInterval,
  })
  const proveArgs = await buildProveWithdrawal(publicCelo, {
    account: account.address,
    game: ready.game,
    withdrawal: ready.withdrawal,
  })

  console.log(`Settlement account: ${account.address}`)
  console.log(`Withdrawal hash: ${ready.withdrawal.withdrawalHash}`)
  console.log(`Dispute game/output index: ${proveArgs.l2OutputIndex}`)

  if (!flags.broadcast) {
    console.log('Dry run complete. Re-run with --broadcast to prove on Ethereum.')
    return
  }

  const { targetChain: _targetChain, ...proveRequest } = proveArgs
  const hash = await proveWithdrawal(walletEth, {
    ...proveRequest,
    portalAddress: OPTIMISM_PORTAL,
  })
  console.log(`Proved withdrawal on Ethereum: ${hash}`)
}

async function finalize(flags: Flags) {
  const account = privateKeyToAccount(privateKeyFromEnv('SETTLEMENT_PRIVATE_KEY'))
  const publicEth = await makeEthPublicClient(flags.ethRpcUrl!)
  const walletEth = createWalletClient({
    account,
    chain: mainnet,
    transport: http(flags.ethRpcUrl!),
  })
  const { withdrawal } = await getWithdrawalFromL2Tx(flags)

  const time = await getTimeToFinalize(publicEth, {
    ...CELO_FINALIZE_CONTRACTS,
    withdrawalHash: withdrawal.withdrawalHash,
  })
  if (time.seconds > 0 && !flags.wait) {
    throw new Error(`Withdrawal is not ready to finalize for about ${time.seconds}s. Re-run later or add --wait.`)
  }

  await waitToFinalize(publicEth, {
    ...CELO_FINALIZE_CONTRACTS,
    withdrawalHash: withdrawal.withdrawalHash,
  })

  console.log(`Settlement account: ${account.address}`)
  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`Final recipient: ${withdrawal.target}`)
  console.log(`Amount: ${formatEther(withdrawal.value)} CELO`)

  if (!flags.broadcast) {
    console.log('Dry run complete. Re-run with --broadcast to finalize on Ethereum.')
    return
  }

  const hash = await finalizeWithdrawal(walletEth, {
    portalAddress: OPTIMISM_PORTAL,
    proofSubmitter: flags.proofSubmitter,
    withdrawal,
  })
  console.log(`Finalized withdrawal on Ethereum: ${hash}`)
}

async function main() {
  const flags = parseFlags(process.argv.slice(2))
  if (flags.command === 'initiate') await initiate(flags)
  else if (flags.command === 'prove') await prove(flags)
  else if (flags.command === 'finalize') await finalize(flags)
  else await status(flags)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
