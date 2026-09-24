import 'dotenv/config'

import { readFileSync } from 'node:fs'
import { parse as parseCsv } from 'csv-parse/sync'
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatEther,
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

const USDC_CELO = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'
const CELO_CHAIN_ID = 42_220

type Recipient = {
  rowNumber: number
  recipient: Address
  amountDecimal: string
  amountUnits: bigint
}

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

function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.trim().toLowerCase().replace(/\s+/g, '_'),
      String(value ?? '').trim(),
    ]),
  )
}

function pick(row: Record<string, string>, names: string[]): string | undefined {
  for (const name of names) {
    const value = row[name]
    if (value) return value
  }
  return undefined
}

function validateDecimal(value: string, label: string): void {
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) {
    throw new Error(`${label} must be a positive decimal string, got "${value}"`)
  }
}

function loadRecipients(path: string, decimals: number): Recipient[] {
  const content = readFileSync(path, 'utf8')
  const rows = parseCsv(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[]

  if (rows.length === 0) throw new Error(`CSV ${path} has no recipient rows`)

  return rows.map((rawRow, index) => {
    const rowNumber = index + 2
    const row = normalizeRow(rawRow)
    const recipientRaw = pick(row, ['recipient', 'to', 'address', 'wallet'])
    const amountDecimal = pick(row, ['amount', 'amount_usdc', 'usdc'])

    if (!recipientRaw) throw new Error(`Row ${rowNumber}: missing recipient/to/address`)
    if (!isAddress(recipientRaw)) throw new Error(`Row ${rowNumber}: invalid recipient ${recipientRaw}`)
    if (!amountDecimal) throw new Error(`Row ${rowNumber}: missing amount`)

    validateDecimal(amountDecimal, `Row ${rowNumber} amount`)
    const amountUnits = parseUnits(amountDecimal, decimals)
    if (amountUnits <= 0n) throw new Error(`Row ${rowNumber}: amount must be greater than zero`)

    return {
      rowNumber,
      recipient: getAddress(recipientRaw),
      amountDecimal,
      amountUnits,
    }
  })
}

async function main() {
  const csvPath = argValue('--csv') ?? process.env.PAYOUT_CSV
  if (!csvPath) throw new Error('Set PAYOUT_CSV or pass --csv ./recipients.csv')

  const broadcast = hasFlag('--broadcast')
  if (broadcast && process.env.PAYOUT_CONFIRM_PRODUCTION !== 'true') {
    throw new Error('Refusing to broadcast unless PAYOUT_CONFIRM_PRODUCTION=true')
  }

  const account = privateKeyToAccount(privateKeyFromEnv())
  const publicClient = createPublicClient({
    chain: celo,
    transport: http(requiredEnv('CELO_RPC_URL')),
  })
  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http(requiredEnv('CELO_RPC_URL')),
  })

  const chainId = await publicClient.getChainId()
  if (chainId !== CELO_CHAIN_ID) {
    throw new Error(`CELO_RPC_URL returned chainId ${chainId}; expected ${CELO_CHAIN_ID}`)
  }

  const [symbol, decimals, nativeBalance] = await Promise.all([
    publicClient.readContract({ address: USDC_CELO, abi: erc20Abi, functionName: 'symbol' }),
    publicClient.readContract({ address: USDC_CELO, abi: erc20Abi, functionName: 'decimals' }),
    publicClient.getBalance({ address: account.address }),
  ])

  const recipients = loadRecipients(csvPath, decimals)
  const total = recipients.reduce((sum, recipient) => sum + recipient.amountUnits, 0n)
  const tokenBalance = await publicClient.readContract({
    address: USDC_CELO,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  })

  if (tokenBalance < total) {
    throw new Error(
      `Insufficient ${symbol}: need ${formatUnits(total, decimals)}, have ${formatUnits(tokenBalance, decimals)}`,
    )
  }

  const seen = new Map<Address, bigint>()
  for (const recipient of recipients) {
    seen.set(recipient.recipient, (seen.get(recipient.recipient) ?? 0n) + recipient.amountUnits)
  }

  console.log(`Ops wallet: ${account.address}`)
  console.log(`CSV: ${csvPath}`)
  console.log(`Recipients: ${recipients.length} (${seen.size} unique addresses)`)
  console.log(`Total: ${formatUnits(total, decimals)} ${symbol}`)
  console.log(`USDC balance: ${formatUnits(tokenBalance, decimals)} ${symbol}`)
  console.log(`CELO gas balance: ${formatEther(nativeBalance)} CELO`)
  console.log(`Mode: ${broadcast ? 'BROADCAST' : 'DRY RUN'}`)

  let nonce = broadcast
    ? await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' })
    : undefined

  for (const recipient of recipients) {
    const simulation = await publicClient.simulateContract({
      account,
      address: USDC_CELO,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient.recipient, recipient.amountUnits],
    })

    if (!simulation.result) {
      throw new Error(`Row ${recipient.rowNumber}: transfer simulation returned false`)
    }

    const gas = await publicClient.estimateContractGas({
      account: account.address,
      address: USDC_CELO,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient.recipient, recipient.amountUnits],
    })

    if (!broadcast) {
      console.log(
        `DRY row ${recipient.rowNumber}: ${recipient.amountDecimal} ${symbol} -> ${recipient.recipient}; estimated gas ${gas}`,
      )
      continue
    }

    const hash = await walletClient.writeContract({
      address: USDC_CELO,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient.recipient, recipient.amountUnits],
      gas,
      nonce,
    })
    nonce = nonce === undefined ? undefined : nonce + 1

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(`Row ${recipient.rowNumber}: transaction reverted: ${hash}`)
    }
    console.log(`SENT row ${recipient.rowNumber}: ${recipient.amountDecimal} ${symbol} -> ${recipient.recipient}; ${hash}`)
  }

  console.log(broadcast ? 'Payout batch complete.' : 'Dry run complete. Re-run with --broadcast to send.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
