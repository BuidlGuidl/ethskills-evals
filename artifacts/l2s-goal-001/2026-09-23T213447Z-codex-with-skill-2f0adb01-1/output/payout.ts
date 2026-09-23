import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'

const CELO_CHAIN_ID = 42220
const DEFAULT_CELO_RPC = 'https://forno.celo.org'
const NATIVE_CIRCLE_USDC_ON_CELO =
  '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as const

const erc20Abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
])

type RawCsvRow = Record<string, string | undefined>

type Payout = {
  row: number
  recipient: Address
  amount: bigint
  amountText: string
  reference?: string
}

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

function readPayouts(path: string, decimals: number): Payout[] {
  const rows = parse(readFileSync(path, 'utf8'), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as RawCsvRow[]

  const seen = new Set<Address>()
  return rows.map((row, index) => {
    const rowNumber = index + 2
    const recipientText = row.recipient ?? row.address ?? row.to
    const amountText = row.amount ?? row.amount_usdc ?? row.usdc

    if (!recipientText || !isAddress(recipientText)) {
      throw new Error(`CSV row ${rowNumber}: recipient/address/to is not a valid address`)
    }
    if (!amountText || !/^\d+(\.\d+)?$/.test(amountText)) {
      throw new Error(`CSV row ${rowNumber}: amount must be a positive decimal string`)
    }

    const recipient = getAddress(recipientText)
    if (seen.has(recipient) && !flag('ALLOW_DUPLICATES')) {
      throw new Error(
        `CSV row ${rowNumber}: duplicate recipient ${recipient}; set ALLOW_DUPLICATES=true only if intentional`,
      )
    }
    seen.add(recipient)

    const amount = parseUnits(amountText, decimals)
    if (amount <= 0n) throw new Error(`CSV row ${rowNumber}: amount must be greater than zero`)

    return {
      row: rowNumber,
      recipient,
      amount,
      amountText,
      reference: row.reference ?? row.memo ?? row.id,
    }
  })
}

async function main() {
  const rpcUrl = env('CELO_RPC_URL', DEFAULT_CELO_RPC)
  const csvPath = env('PAYOUT_CSV')
  const broadcast = flag('BROADCAST')
  const account = privateKeyToAccount(privateKeyFromEnv('PRIVATE_KEY'))
  const usdcAddress = getAddress(process.env.USDC_ADDRESS ?? NATIVE_CIRCLE_USDC_ON_CELO)

  const publicClient = createPublicClient({
    chain: { ...celo, rpcUrls: { default: { http: [rpcUrl] } } },
    transport: http(rpcUrl),
  })
  const walletClient = createWalletClient({
    account,
    chain: { ...celo, rpcUrls: { default: { http: [rpcUrl] } } },
    transport: http(rpcUrl),
  })

  const chainId = await publicClient.getChainId()
  if (chainId !== CELO_CHAIN_ID) {
    throw new Error(`RPC is connected to chain ${chainId}, expected Celo mainnet ${CELO_CHAIN_ID}`)
  }

  const [decimals, symbol] = await Promise.all([
    publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: 'decimals' }),
    publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: 'symbol' }),
  ])
  if (decimals !== 6 || symbol !== 'USDC') {
    throw new Error(
      `USDC contract sanity check failed at ${usdcAddress}: symbol=${symbol}, decimals=${decimals}`,
    )
  }

  const payouts = readPayouts(csvPath, decimals)
  const total = payouts.reduce((sum, payout) => sum + payout.amount, 0n)
  const balance = await publicClient.readContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  })

  console.log(`Mode: ${broadcast ? 'BROADCAST' : 'DRY RUN'}`)
  console.log(`Ops wallet: ${account.address}`)
  console.log(`USDC: ${usdcAddress}`)
  console.log(`Payouts: ${payouts.length}`)
  console.log(`Total: ${formatUnits(total, decimals)} USDC`)
  console.log(`Wallet balance: ${formatUnits(balance, decimals)} USDC`)

  if (balance < total) {
    throw new Error(
      `Insufficient USDC: need ${formatUnits(total, decimals)}, have ${formatUnits(balance, decimals)}`,
    )
  }

  for (const payout of payouts) {
    const label = payout.reference ? ` (${payout.reference})` : ''
    const simulation = await publicClient.simulateContract({
      account,
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [payout.recipient, payout.amount],
    })

    console.log(
      `row ${payout.row}: ${payout.amountText} USDC -> ${payout.recipient}${label}`,
    )

    if (!broadcast) continue

    const hash = await walletClient.writeContract(simulation.request)
    console.log(`  tx: ${hash}`)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(`Transfer failed for row ${payout.row}: ${hash}`)
    }
  }

  console.log(broadcast ? 'Payout batch complete.' : 'Dry run complete; no transactions sent.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
