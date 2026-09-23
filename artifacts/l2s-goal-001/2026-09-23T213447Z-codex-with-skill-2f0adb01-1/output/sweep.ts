import {
  createPublicClient,
  createWalletClient,
  formatEther,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseEther,
  type Address,
  type Chain,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import {
  getWithdrawals,
  publicActionsL1,
  publicActionsL2,
  walletActionsL1,
} from 'viem/op-stack'

const PLACEHOLDER_TREASURY = '0x1111111111111111111111111111111111111111' as const
const DEFAULT_CELO_RPC = 'https://forno.celo.org'
const DEFAULT_ETHEREUM_RPC = 'https://ethereum-rpc.publicnode.com'
const CELO_L2_TO_L1_MESSAGE_PASSER =
  '0x4200000000000000000000000000000000000016' as const

const celoOpStack = {
  id: 42220,
  name: 'Celo',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: [DEFAULT_CELO_RPC] },
    public: { http: [DEFAULT_CELO_RPC] },
  },
  blockExplorers: {
    default: { name: 'Celoscan', url: 'https://celoscan.io' },
  },
  sourceId: 1,
  contracts: {
    portal: {
      [mainnet.id]: { address: '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC' },
    },
    disputeGameFactory: {
      [mainnet.id]: { address: '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683' },
    },
    l1StandardBridge: {
      [mainnet.id]: { address: '0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe' },
    },
  },
} as const satisfies Chain

const messagePasserAbi = parseAbi([
  'function initiateWithdrawal(address target, uint256 gasLimit, bytes data) payable',
])

type Stage = 'initiate' | 'status' | 'prove' | 'finalize'

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function flag(name: string): boolean {
  return ['1', 'true', 'yes'].includes((process.env[name] ?? '').toLowerCase())
}

function privateKeyFromEnv(name: string): Hex {
  const value = env(name)
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 32-byte 0x-prefixed private key`)
  }
  return value as Hex
}

function optionalPrivateKey(name: string, fallbackName?: string): Hex | undefined {
  const value = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined)
  if (!value) return undefined
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 32-byte 0x-prefixed private key`)
  }
  return value as Hex
}

function stageFromEnv(): Stage {
  const stage = (process.env.SWEEP_STAGE ?? 'initiate').toLowerCase()
  if (!['initiate', 'status', 'prove', 'finalize'].includes(stage)) {
    throw new Error('SWEEP_STAGE must be one of: initiate, status, prove, finalize')
  }
  return stage as Stage
}

function hashFromEnv(): Hex {
  const value = env('WITHDRAWAL_TX_HASH')
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('WITHDRAWAL_TX_HASH must be a 32-byte transaction hash')
  }
  return value as Hex
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function treasuryFromEnv(broadcast: boolean): Address {
  const treasury = getAddress(process.env.TREASURY_ADDRESS ?? PLACEHOLDER_TREASURY)
  if (broadcast && treasury === getAddress(PLACEHOLDER_TREASURY) && !flag('ALLOW_PLACEHOLDER_TREASURY')) {
    throw new Error('Refusing to broadcast to the placeholder treasury address')
  }
  if (!isAddress(treasury)) throw new Error('TREASURY_ADDRESS is not a valid address')
  return treasury
}

async function main() {
  const stage = stageFromEnv()
  const broadcast = flag('BROADCAST')
  const wait = flag('WAIT')
  const celoRpcUrl = env('CELO_RPC_URL', DEFAULT_CELO_RPC)
  const ethereumRpcUrl = env('ETHEREUM_RPC_URL', DEFAULT_ETHEREUM_RPC)

  const publicClientL2 = createPublicClient({
    chain: { ...celoOpStack, rpcUrls: { default: { http: [celoRpcUrl] } } },
    transport: http(celoRpcUrl),
  }).extend(publicActionsL2())

  const publicClientL1 = createPublicClient({
    chain: { ...mainnet, rpcUrls: { default: { http: [ethereumRpcUrl] } } },
    transport: http(ethereumRpcUrl),
  }).extend(publicActionsL1())

  const [l2ChainId, l1ChainId] = await Promise.all([
    publicClientL2.getChainId(),
    publicClientL1.getChainId(),
  ])
  if (l2ChainId !== 42220) throw new Error(`CELO_RPC_URL is on chain ${l2ChainId}, expected 42220`)
  if (l1ChainId !== 1) throw new Error(`ETHEREUM_RPC_URL is on chain ${l1ChainId}, expected 1`)

  console.log(`Mode: ${broadcast ? 'BROADCAST' : 'DRY RUN'}`)
  console.log(`Stage: ${stage}`)

  if (stage === 'initiate') {
    const account = privateKeyToAccount(privateKeyFromEnv('PRIVATE_KEY'))
    const treasury = treasuryFromEnv(broadcast)
    const walletClientL2 = createWalletClient({
      account,
      chain: { ...celoOpStack, rpcUrls: { default: { http: [celoRpcUrl] } } },
      transport: http(celoRpcUrl),
    })

    const balance = await publicClientL2.getBalance({ address: account.address })
    const reserve = parseEther(process.env.SWEEP_RESERVE_CELO ?? '1')
    const amount = process.env.SWEEP_AMOUNT_CELO
      ? parseEther(process.env.SWEEP_AMOUNT_CELO)
      : balance - reserve

    if (amount <= 0n) {
      throw new Error(
        `Nothing to sweep: balance=${formatEther(balance)} CELO, reserve=${formatEther(reserve)} CELO`,
      )
    }
    if (balance <= amount) {
      throw new Error('Sweep amount leaves no CELO to pay the L2 withdrawal-initiation gas')
    }

    console.log(`Ops wallet: ${account.address}`)
    console.log(`Treasury: ${treasury}`)
    console.log(`Celo balance: ${formatEther(balance)} CELO`)
    console.log(`Sweep amount: ${formatEther(amount)} CELO`)
    console.log(`Reserve left on Celo: ${formatEther(balance - amount)} CELO`)

    const simulation = await publicClientL2.simulateContract({
      account,
      address: CELO_L2_TO_L1_MESSAGE_PASSER,
      abi: messagePasserAbi,
      functionName: 'initiateWithdrawal',
      args: [treasury, 21_000n, '0x'],
      value: amount,
    })

    if (!broadcast) {
      console.log('Dry run complete; no withdrawal initiated.')
      console.log(`To broadcast, set BROADCAST=true after confirming TREASURY_ADDRESS.`)
      return
    }

    const hash = await walletClientL2.writeContract(simulation.request)
    console.log(`Initiated withdrawal on Celo: ${hash}`)
    const receipt = await publicClientL2.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') throw new Error(`Withdrawal initiation failed: ${hash}`)
    const [withdrawal] = getWithdrawals(receipt)
    console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
    console.log('Save WITHDRAWAL_TX_HASH; prove this withdrawal once it is ready on Ethereum.')
    return
  }

  const withdrawalTxHash = hashFromEnv()
  const receipt = await publicClientL2.getTransactionReceipt({ hash: withdrawalTxHash })
  const [withdrawal] = getWithdrawals(receipt)
  if (!withdrawal) throw new Error(`No OP Stack withdrawal found in receipt ${withdrawalTxHash}`)

  const status = await publicClientL1.getWithdrawalStatus({
    receipt,
    targetChain: celoOpStack,
  })
  console.log(`Withdrawal tx: ${withdrawalTxHash}`)
  console.log(`Withdrawal hash: ${withdrawal.withdrawalHash}`)
  console.log(`Status: ${status}`)

  if (stage === 'status') {
    const timeToProve = await publicClientL1.getTimeToProve({ receipt, targetChain: celoOpStack })
    console.log(`Time to prove: ${timeToProve.seconds}s`)
    console.log('Finalization readiness is reported by Status after the withdrawal is proven.')
    return
  }

  const l1Key = optionalPrivateKey('L1_PRIVATE_KEY', 'PRIVATE_KEY')
  if (!l1Key) throw new Error(`${stage} requires L1_PRIVATE_KEY or PRIVATE_KEY`)
  const account = privateKeyToAccount(l1Key)
  const walletClientL1 = createWalletClient({
    account,
    chain: { ...mainnet, rpcUrls: { default: { http: [ethereumRpcUrl] } } },
    transport: http(ethereumRpcUrl),
  }).extend(walletActionsL1())

  if (stage === 'prove') {
    if (!wait && status !== 'ready-to-prove') {
      throw new Error(`Withdrawal is ${status}; set WAIT=true to wait, or rerun later`)
    }

    const proveData = await publicClientL1.waitToProve({ receipt, targetChain: celoOpStack })

    const args = await publicClientL2.buildProveWithdrawal({
      account,
      game: proveData.game,
      withdrawal: proveData.withdrawal,
    })
    if (!broadcast) {
      console.log('Dry run complete; withdrawal is buildable for prove. No L1 transaction sent.')
      return
    }

    const hash = await walletClientL1.proveWithdrawal(args)
    console.log(`Proved withdrawal on Ethereum: ${hash}`)
    const proveReceipt = await publicClientL1.waitForTransactionReceipt({ hash })
    if (proveReceipt.status !== 'success') throw new Error(`Prove transaction failed: ${hash}`)
    console.log('Proof accepted. Finalize after the challenge period has elapsed.')
    return
  }

  if (stage === 'finalize') {
    if (wait) {
      for (;;) {
        const currentStatus = await publicClientL1.getWithdrawalStatus({
          receipt,
          targetChain: celoOpStack,
        })
        if (currentStatus === 'ready-to-finalize') break
        if (currentStatus === 'finalized') {
          console.log('Withdrawal is already finalized.')
          return
        }
        console.log(`Withdrawal is ${currentStatus}; checking again in 60 seconds...`)
        await sleep(60_000)
      }
    } else if (status !== 'ready-to-finalize') {
      throw new Error(`Withdrawal is ${status}; set WAIT=true to wait, or rerun later`)
    }

    if (!broadcast) {
      console.log('Dry run complete; withdrawal is ready to finalize. No L1 transaction sent.')
      return
    }

    const hash = await walletClientL1.finalizeWithdrawal({
      account,
      targetChain: celoOpStack,
      withdrawal,
    })
    console.log(`Finalized withdrawal on Ethereum: ${hash}`)
    const finalizeReceipt = await publicClientL1.waitForTransactionReceipt({ hash })
    if (finalizeReceipt.status !== 'success') throw new Error(`Finalize transaction failed: ${hash}`)
    console.log('Sweep complete; CELO should now be in the Ethereum mainnet treasury wallet.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
