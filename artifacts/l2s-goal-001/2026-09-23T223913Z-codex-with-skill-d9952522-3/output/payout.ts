import { readFile } from 'node:fs/promises'
import { parse } from 'csv-parse/sync'
import { config as loadEnv } from 'dotenv'
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'

loadEnv({ quiet: true })

const CELO_CHAIN_ID = 42220
const USDC_DECIMALS = 6
const DEFAULT_CELO_USDC =
  '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as const

type Recipient = {
  line: number
  recipient: Address
  amount: bigint
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

function parseAmount(value: string, line: number): bigint {
  const normalized = value.trim()
  if (!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(normalized)) {
    throw new Error(
      `Invalid USDC amount on CSV line ${line}: ${value}. Use a positive decimal with at most 6 places.`,
    )
  }

  const amount = parseUnits(normalized, USDC_DECIMALS)
  if (amount <= 0n) throw new Error(`Amount must be greater than zero on CSV line ${line}`)
  return amount
}

async function loadRecipients(path: string): Promise<Recipient[]> {
  const input = await readFile(path, 'utf8')
  const rows = parse(input, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>

  if (rows.length === 0) throw new Error(`No payouts found in ${path}`)

  return rows.map((row, index) => {
    const line = index + 2
    const rawRecipient = row.recipient ?? row.address
    const rawAmount = row.amount ?? row.amount_usdc

    if (!rawRecipient) throw new Error(`Missing recipient/address on CSV line ${line}`)
    if (!rawAmount) throw new Error(`Missing amount/amount_usdc on CSV line ${line}`)
    if (!isAddress(rawRecipient)) throw new Error(`Invalid recipient on CSV line ${line}: ${rawRecipient}`)

    return {
      line,
      recipient: getAddress(rawRecipient),
      amount: parseAmount(rawAmount, line),
    }
  })
}

async function main() {
  const csvPath = argValue('--csv') ?? process.env.PAYOUT_CSV
  if (!csvPath) throw new Error('Pass --csv recipients.csv or set PAYOUT_CSV')

  const execute = hasFlag('--execute') || process.env.EXECUTE === 'true'
  const rpcUrl = requiredEnv('CELO_RPC_URL')
  const account = privateKeyToAccount(privateKey())
  const usdc = getAddress(process.env.CELO_USDC_ADDRESS ?? DEFAULT_CELO_USDC)
  const recipients = await loadRecipients(csvPath)
  const total = recipients.reduce((sum, item) => sum + item.amount, 0n)

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
  if (chainId !== CELO_CHAIN_ID) {
    throw new Error(`CELO_RPC_URL returned chain ${chainId}; expected Celo mainnet ${CELO_CHAIN_ID}`)
  }

  const balance = await publicClient.readContract({
    address: usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  })
  if (balance < total) {
    throw new Error(
      `Insufficient USDC. Need ${formatUnits(total, USDC_DECIMALS)}, wallet has ${formatUnits(balance, USDC_DECIMALS)}.`,
    )
  }

  console.log(`Ops wallet: ${account.address}`)
  console.log(`USDC token: ${usdc}`)
  console.log(`CSV: ${csvPath}`)
  console.log(`Recipients: ${recipients.length}`)
  console.log(`Total USDC: ${formatUnits(total, USDC_DECIMALS)}`)
  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`)

  for (const payout of recipients) {
    const amount = formatUnits(payout.amount, USDC_DECIMALS)
    const simulation = await publicClient.simulateContract({
      account,
      address: usdc,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [payout.recipient, payout.amount],
    })

    if (!execute) {
      console.log(`[dry-run] line ${payout.line}: transfer ${amount} USDC to ${payout.recipient}`)
      continue
    }

    const hash = await walletClient.writeContract(simulation.request)
    console.log(`line ${payout.line}: sent ${amount} USDC to ${payout.recipient}: ${hash}`)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(`Transfer failed for CSV line ${payout.line}: ${hash}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
