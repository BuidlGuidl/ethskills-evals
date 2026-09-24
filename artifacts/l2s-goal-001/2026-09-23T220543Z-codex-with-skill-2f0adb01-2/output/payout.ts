import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'

const CELO_CHAIN_ID = 42220
const USDC_ADDRESS = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as const
const USDC_DECIMALS = 6

type CsvRecipient = {
  row: number
  recipient: Address
  amount: bigint
  rawAmount: string
}

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function boolEnv(name: string, fallback = false): boolean {
  const value = process.env[name]
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase())
}

function parsePositiveUsdc(value: unknown, row: number): bigint {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`Row ${row}: amount must be present`)
  }

  const raw = String(value).trim()
  if (!/^\d+(\.\d{1,6})?$/.test(raw)) {
    throw new Error(`Row ${row}: amount "${raw}" must be a positive USDC value with at most 6 decimals`)
  }

  const parsed = parseUnits(raw, USDC_DECIMALS)
  if (parsed <= 0n) throw new Error(`Row ${row}: amount must be greater than zero`)
  return parsed
}

function readRecipients(path: string): CsvRecipient[] {
  const rows = parse(readFileSync(path), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[]

  const recipients = rows.map((record, index) => {
    const row = index + 2
    const recipient = record.recipient ?? record.address ?? record.to
    const amountValue = record.amount ?? record.amount_usdc ?? record.usdc

    if (!recipient || !isAddress(recipient)) {
      throw new Error(`Row ${row}: recipient/address/to must be a valid EVM address`)
    }

    return {
      row,
      recipient,
      amount: parsePositiveUsdc(amountValue, row),
      rawAmount: String(amountValue).trim(),
    }
  })

  if (recipients.length === 0) throw new Error('CSV has no payout rows')
  return recipients
}

function enforceNoDuplicates(recipients: CsvRecipient[]) {
  const seen = new Map<string, number>()
  for (const recipient of recipients) {
    const key = recipient.recipient.toLowerCase()
    const firstRow = seen.get(key)
    if (firstRow !== undefined) {
      throw new Error(
        `Duplicate recipient ${recipient.recipient} on rows ${firstRow} and ${recipient.row}. ` +
          'Set ALLOW_DUPLICATES=true only after finance confirms this is intentional.',
      )
    }
    seen.set(key, recipient.row)
  }
}

async function main() {
  const rpcUrl = env('CELO_RPC_URL', 'https://forno.celo.org')
  const csvPath = env('PAYOUT_CSV')
  const account = privateKeyToAccount(env('OPS_PRIVATE_KEY') as Hex)
  const broadcast = boolEnv('BROADCAST')
  const allowDuplicates = boolEnv('ALLOW_DUPLICATES')
  const startRow = BigInt(env('PAYOUT_START_ROW', '1'))
  const maxRows = process.env.PAYOUT_MAX_ROWS ? BigInt(process.env.PAYOUT_MAX_ROWS) : undefined
  const confirmations = Number(env('WAIT_CONFIRMATIONS', '1'))

  if (startRow < 1n) throw new Error('PAYOUT_START_ROW must be 1 or greater')

  const publicClient = createPublicClient({ chain: celo, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain: celo, transport: http(rpcUrl) })

  const chainId = await publicClient.getChainId()
  if (chainId !== CELO_CHAIN_ID) {
    throw new Error(`CELO_RPC_URL returned chain ${chainId}; expected Celo mainnet chain ${CELO_CHAIN_ID}`)
  }

  const allRecipients = readRecipients(csvPath)
  if (!allowDuplicates) enforceNoDuplicates(allRecipients)

  const recipients = allRecipients.filter((_, index) => {
    const oneBased = BigInt(index + 1)
    if (oneBased < startRow) return false
    if (maxRows !== undefined && oneBased >= startRow + maxRows) return false
    return true
  })
  if (recipients.length === 0) throw new Error('No payout rows selected after PAYOUT_START_ROW/PAYOUT_MAX_ROWS')

  const [symbol, decimals, usdcBalance, celoBalance] = await Promise.all([
    publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'symbol' }),
    publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'decimals' }),
    publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account.address],
    }),
    publicClient.getBalance({ address: account.address }),
  ])

  if (symbol !== 'USDC' || decimals !== USDC_DECIMALS) {
    throw new Error(`Unexpected token metadata at ${USDC_ADDRESS}: symbol=${symbol} decimals=${decimals}`)
  }

  const total = recipients.reduce((sum, recipient) => sum + recipient.amount, 0n)
  if (usdcBalance < total) {
    throw new Error(
      `Insufficient USDC: need ${formatUnits(total, USDC_DECIMALS)}, ` +
        `wallet has ${formatUnits(usdcBalance, USDC_DECIMALS)}`,
    )
  }
  if (celoBalance === 0n) throw new Error('Ops wallet has no CELO to pay Celo gas')

  console.log(`Ops wallet: ${account.address}`)
  console.log(`Rows selected: ${recipients.length}`)
  console.log(`Total USDC: ${formatUnits(total, USDC_DECIMALS)}`)
  console.log(`Mode: ${broadcast ? 'BROADCAST' : 'DRY RUN'}`)

  for (const recipient of recipients) {
    await publicClient.simulateContract({
      account,
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient.recipient, recipient.amount],
    })
  }

  if (!broadcast) {
    for (const recipient of recipients) {
      console.log(`DRY row=${recipient.row} to=${recipient.recipient} amount=${recipient.rawAmount}`)
    }
    console.log('Dry run complete. Set BROADCAST=true to send transactions.')
    return
  }

  let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' })
  for (const recipient of recipients) {
    const hash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient.recipient, recipient.amount],
      nonce,
    })
    console.log(`SENT row=${recipient.row} nonce=${nonce} hash=${hash}`)
    nonce += 1

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations,
    })
    if (receipt.status !== 'success') throw new Error(`Transfer failed for row ${recipient.row}: ${hash}`)
    console.log(`CONFIRMED row=${recipient.row} block=${receipt.blockNumber} hash=${hash}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
