import 'dotenv/config'

import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  isAddress,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'

const NATIVE_USDC_ON_CELO =
  '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as const

type Args = {
  csvPath: string
  execute: boolean
  confirmations: number
}

type CsvRow = Record<string, string | undefined>

type Payout = {
  row: number
  recipient: Address
  amount: bigint
}

function usage(): never {
  throw new Error(
    [
      'Usage: npm run payout -- --csv recipients.csv [--execute] [--confirmations 1]',
      '',
      'CSV columns: recipient,amount',
      'Aliases accepted: address for recipient, usdc_amount for amount.',
      '',
      'Required env: OPS_PRIVATE_KEY',
      'Optional env: CELO_RPC_URL, USDC_ADDRESS',
    ].join('\n'),
  )
}

function parseArgs(argv: string[]): Args {
  const args: Args = { csvPath: '', execute: false, confirmations: 1 }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--csv') args.csvPath = requireValue(argv, ++i, '--csv')
    else if (arg === '--execute') args.execute = true
    else if (arg === '--confirmations') {
      const raw = requireValue(argv, ++i, '--confirmations')
      args.confirmations = Number.parseInt(raw, 10)
      if (!Number.isInteger(args.confirmations) || args.confirmations < 1) {
        throw new Error('--confirmations must be a positive integer')
      }
    } else {
      usage()
    }
  }

  if (!args.csvPath) usage()
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

function parseTokenAmount(raw: string, decimals: number, row: number): bigint {
  const value = raw.trim()
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) {
    throw new Error(`Row ${row}: invalid amount "${raw}"`)
  }

  const parts = value.split('.')
  const whole = parts[0]!
  const fraction = parts[1] ?? ''
  if (fraction.length > decimals) {
    throw new Error(
      `Row ${row}: amount "${raw}" has more than ${decimals} decimal places`,
    )
  }

  const base = 10n ** BigInt(decimals)
  const units =
    BigInt(whole) * base + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals))

  if (units <= 0n) throw new Error(`Row ${row}: amount must be greater than zero`)
  return units
}

function parseCsv(path: string, decimals: number): Payout[] {
  const csv = readFileSync(path, 'utf8')
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[]

  if (rows.length === 0) throw new Error('CSV has no payout rows')

  return rows.map((row, index) => {
    const csvRowNumber = index + 2
    const recipientRaw = row.recipient ?? row.address
    const amountRaw = row.amount ?? row.usdc_amount

    if (!recipientRaw) throw new Error(`Row ${csvRowNumber}: missing recipient`)
    if (!amountRaw) throw new Error(`Row ${csvRowNumber}: missing amount`)
    if (!isAddress(recipientRaw)) {
      throw new Error(`Row ${csvRowNumber}: invalid recipient "${recipientRaw}"`)
    }

    return {
      row: csvRowNumber,
      recipient: getAddress(recipientRaw),
      amount: parseTokenAmount(amountRaw, decimals, csvRowNumber),
    }
  })
}

function sum(payouts: Payout[]): bigint {
  return payouts.reduce((total, payout) => total + payout.amount, 0n)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const account = privateKeyToAccount(requirePrivateKey())
  const usdcAddress = getAddress(process.env.USDC_ADDRESS ?? NATIVE_USDC_ON_CELO)
  const rpcUrl = process.env.CELO_RPC_URL ?? 'https://forno.celo.org'

  const publicClient = createPublicClient({
    chain: celo,
    transport: http(rpcUrl),
  })
  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http(rpcUrl),
  })

  const chainId = await publicClient.getChainId()
  if (chainId !== celo.id) {
    throw new Error(`RPC is on chain ${chainId}, expected Celo mainnet ${celo.id}`)
  }

  const [decimals, symbol] = await Promise.all([
    publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'decimals',
    }),
    publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'symbol',
    }),
  ])

  const payouts = parseCsv(args.csvPath, decimals)
  const total = sum(payouts)
  const balance = await publicClient.readContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  })

  if (balance < total) {
    throw new Error(
      `Insufficient ${symbol}: need ${formatUnits(total, decimals)}, have ${formatUnits(
        balance,
        decimals,
      )}`,
    )
  }

  console.log(`Ops wallet: ${account.address}`)
  console.log(`Token: ${symbol} at ${usdcAddress}`)
  console.log(`Rows: ${payouts.length}`)
  console.log(`Total: ${formatUnits(total, decimals)} ${symbol}`)
  console.log(args.execute ? 'Mode: EXECUTE' : 'Mode: DRY RUN (no broadcasts)')

  for (const payout of payouts) {
    const { request } = await publicClient.simulateContract({
      account,
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [payout.recipient, payout.amount],
    })

    const label = `row ${payout.row}: ${formatUnits(payout.amount, decimals)} ${symbol} -> ${
      payout.recipient
    }`

    if (!args.execute) {
      console.log(`simulated ${label}`)
      continue
    }

    const hash = await walletClient.writeContract(request)
    console.log(`broadcast ${label}: ${hash}`)
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: args.confirmations,
    })
    if (receipt.status !== 'success') throw new Error(`Transfer failed: ${hash}`)
    console.log(`confirmed ${hash} in block ${receipt.blockNumber}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
