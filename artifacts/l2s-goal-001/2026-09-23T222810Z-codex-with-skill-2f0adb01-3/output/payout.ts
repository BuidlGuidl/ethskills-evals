import { readFile } from 'node:fs/promises'
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatEther,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'

const CELO_CHAIN_ID = 42_220
const DEFAULT_CELO_RPC_URL = 'https://forno.celo.org'
const DEFAULT_USDC_ADDRESS = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'

type CsvRecipient = {
  amount: bigint
  line: number
  rawAmount: string
  recipient: Address
}

type Flags = {
  broadcast: boolean
  confirmations: bigint
  csv?: string
  expectedTotal?: string
  rpcUrl: string
  usdcAddress: Address
}

function usage(): never {
  console.error(`Usage:
  npm run payout -- --csv recipients.csv [--expected-total 123.45] [--broadcast]

CSV columns:
  recipient,amount

Environment:
  OPS_PRIVATE_KEY or PRIVATE_KEY       private key for the Celo ops wallet
  OPS_WALLET_ADDRESS                   optional expected ops wallet address
  CELO_RPC_URL                         optional Celo RPC override
  USDC_ADDRESS                         optional token override
`)
  process.exit(1)
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {
    broadcast: false,
    confirmations: 1n,
    rpcUrl: process.env.CELO_RPC_URL ?? DEFAULT_CELO_RPC_URL,
    usdcAddress: requireAddress(process.env.USDC_ADDRESS ?? DEFAULT_USDC_ADDRESS, 'USDC_ADDRESS'),
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => {
      const value = argv[++i]
      if (!value) usage()
      return value
    }

    if (arg === '--broadcast') flags.broadcast = true
    else if (arg === '--csv') flags.csv = next()
    else if (arg === '--expected-total') flags.expectedTotal = next()
    else if (arg === '--confirmations') flags.confirmations = BigInt(next())
    else if (arg === '--rpc') flags.rpcUrl = next()
    else if (arg === '--usdc') flags.usdcAddress = requireAddress(next(), '--usdc')
    else usage()
  }

  if (!flags.csv) usage()
  if (flags.confirmations < 1n) throw new Error('--confirmations must be at least 1')
  return flags
}

function requireAddress(value: string, name: string): Address {
  if (!isAddress(value)) throw new Error(`${name} is not a valid EVM address: ${value}`)
  return value
}

function requirePrivateKey(): Hex {
  const raw = process.env.OPS_PRIVATE_KEY ?? process.env.PRIVATE_KEY
  if (!raw) throw new Error('Set OPS_PRIVATE_KEY or PRIVATE_KEY')
  const privateKey = raw.startsWith('0x') ? raw : `0x${raw}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error('Private key must be 32 bytes hex, with or without 0x prefix')
  }
  return privateKey as Hex
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') inQuotes = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (inQuotes) throw new Error('CSV has an unterminated quoted field')
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
}

function findColumn(headers: string[], names: string[]): number {
  const index = headers.findIndex((header) => names.includes(header.trim().toLowerCase()))
  if (index === -1) throw new Error(`CSV is missing one of these columns: ${names.join(', ')}`)
  return index
}

function parseRecipients(csv: string, decimals: number): CsvRecipient[] {
  const rows = parseCsv(csv)
  if (rows.length < 2) throw new Error('CSV must include a header and at least one recipient row')

  const headers = rows[0].map((cell) => cell.trim().toLowerCase())
  const recipientIndex = findColumn(headers, ['recipient', 'to', 'address'])
  const amountIndex = findColumn(headers, ['amount', 'amount_usdc', 'usdc'])
  const seenRecipients = new Set<string>()

  return rows.slice(1).map((cells, rowIndex) => {
    const line = rowIndex + 2
    const recipientRaw = cells[recipientIndex]?.trim() ?? ''
    const rawAmount = cells[amountIndex]?.trim() ?? ''

    if (!isAddress(recipientRaw)) throw new Error(`Line ${line}: invalid recipient address`)
    if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(rawAmount)) {
      throw new Error(`Line ${line}: amount must be a positive decimal string`)
    }
    const fractional = rawAmount.split('.')[1]?.length ?? 0
    if (fractional > decimals) {
      throw new Error(`Line ${line}: amount has ${fractional} decimals, token supports ${decimals}`)
    }

    const amount = parseUnits(rawAmount, decimals)
    if (amount <= 0n) throw new Error(`Line ${line}: amount must be greater than zero`)

    const normalized = recipientRaw.toLowerCase()
    if (seenRecipients.has(normalized)) {
      throw new Error(`Line ${line}: duplicate recipient ${recipientRaw}; merge duplicates before paying`)
    }
    seenRecipients.add(normalized)

    return { amount, line, rawAmount, recipient: recipientRaw as Address }
  })
}

async function main() {
  const flags = parseFlags(process.argv.slice(2))
  const account = privateKeyToAccount(requirePrivateKey())
  const publicClient = createPublicClient({
    chain: celo,
    transport: http(flags.rpcUrl),
  })
  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http(flags.rpcUrl),
  })

  const expectedOpsWallet = process.env.OPS_WALLET_ADDRESS
  if (expectedOpsWallet && account.address.toLowerCase() !== requireAddress(expectedOpsWallet, 'OPS_WALLET_ADDRESS').toLowerCase()) {
    throw new Error(`Loaded key resolves to ${account.address}, not OPS_WALLET_ADDRESS ${expectedOpsWallet}`)
  }

  const chainId = await publicClient.getChainId()
  if (chainId !== CELO_CHAIN_ID) throw new Error(`RPC is on chain ${chainId}, expected Celo ${CELO_CHAIN_ID}`)

  const [decimals, symbol, usdcBalance, celoBalance] = await Promise.all([
    publicClient.readContract({
      address: flags.usdcAddress,
      abi: erc20Abi,
      functionName: 'decimals',
    }),
    publicClient.readContract({
      address: flags.usdcAddress,
      abi: erc20Abi,
      functionName: 'symbol',
    }),
    publicClient.readContract({
      address: flags.usdcAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account.address],
    }),
    publicClient.getBalance({ address: account.address }),
  ])

  const recipients = parseRecipients(await readFile(flags.csv!, 'utf8'), decimals)
  const total = recipients.reduce((sum, row) => sum + row.amount, 0n)
  if (flags.expectedTotal) {
    const expected = parseUnits(flags.expectedTotal, decimals)
    if (expected !== total) {
      throw new Error(`CSV total ${formatUnits(total, decimals)} ${symbol} does not match --expected-total ${flags.expectedTotal}`)
    }
  }
  if (usdcBalance < total) {
    throw new Error(`Insufficient ${symbol}: have ${formatUnits(usdcBalance, decimals)}, need ${formatUnits(total, decimals)}`)
  }

  console.log(`Ops wallet: ${account.address}`)
  console.log(`Token: ${symbol} at ${flags.usdcAddress} (${decimals} decimals)`)
  console.log(`Recipients: ${recipients.length}`)
  console.log(`Total: ${formatUnits(total, decimals)} ${symbol}`)
  console.log(`Current ${symbol} balance: ${formatUnits(usdcBalance, decimals)}`)
  console.log(`Current CELO gas balance: ${formatEther(celoBalance)}`)

  const gasEstimates = await Promise.all(
    recipients.map((row) =>
      publicClient.estimateContractGas({
        account: account.address,
        address: flags.usdcAddress,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [row.recipient, row.amount],
      }),
    ),
  )
  const totalGas = gasEstimates.reduce((sum, gas) => sum + gas, 0n)
  console.log(`Estimated Celo gas units: ${totalGas}`)

  if (!flags.broadcast) {
    console.log('Dry run complete. Re-run with --broadcast to send transfers.')
    return
  }

  for (const [index, row] of recipients.entries()) {
    console.log(`Sending ${index + 1}/${recipients.length}: line ${row.line}, ${row.rawAmount} ${symbol} to ${row.recipient}`)
    const hash = await walletClient.writeContract({
      address: flags.usdcAddress,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [row.recipient, row.amount],
    })
    console.log(`  tx: ${hash}`)
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: Number(flags.confirmations),
    })
    if (receipt.status !== 'success') throw new Error(`Transfer failed: ${hash}`)
  }

  console.log('Payout batch complete.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
