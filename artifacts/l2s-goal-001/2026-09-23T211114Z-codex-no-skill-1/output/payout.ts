import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'csv-parse/sync'
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

const CELO_CHAIN_ID = 42220
const USDC_ON_CELO = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'
const USDC_DECIMALS = 6

type Payout = {
  line: number
  recipient: Address
  amount: bigint
  amountText: string
}

function usage(exitCode = 1): never {
  console.error(`Usage:
  npm run payout -- --csv payouts.csv [--execute]

CSV columns:
  recipient,amount

Environment:
  OPERATOR_PRIVATE_KEY  Private key for the Celo ops wallet
  CELO_RPC_URL          Celo mainnet RPC URL
  USDC_ADDRESS          Optional override for USDC on Celo`)
  process.exit(exitCode)
}

function getFlagValue(name: string): string | undefined {
  const args = process.argv.slice(2)
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name)
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function asPrivateKey(value: string): Hex {
  const normalized = value.startsWith('0x') ? value : `0x${value}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error('OPERATOR_PRIVATE_KEY must be a 32-byte hex private key')
  }
  return normalized as Hex
}

function parseAmount(value: unknown, line: number): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(value)) {
    throw new Error(
      `Invalid amount on CSV line ${line}: use a plain positive USDC decimal with at most 6 decimals`,
    )
  }
  const amount = parseUnits(value, USDC_DECIMALS)
  if (amount <= 0n) throw new Error(`Invalid zero amount on CSV line ${line}`)
  return amount
}

function readPayouts(csvPath: string): Payout[] {
  const contents = readFileSync(csvPath, 'utf8')
  const records = parse(contents, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[]

  if (records.length === 0) throw new Error('CSV has no payout rows')

  return records.map((row, index) => {
    const line = index + 2
    const recipientRaw = row.recipient ?? row.address ?? row.to
    const amountText = row.amount ?? row.usdc_amount

    if (!recipientRaw || !isAddress(recipientRaw)) {
      throw new Error(`Invalid recipient address on CSV line ${line}`)
    }
    if (!amountText) throw new Error(`Missing amount on CSV line ${line}`)

    return {
      line,
      recipient: getAddress(recipientRaw),
      amount: parseAmount(amountText, line),
      amountText,
    }
  })
}

async function main() {
  const csvArg =
    getFlagValue('--csv') ?? process.argv.slice(2).find((arg) => !arg.startsWith('--'))
  if (hasFlag('--help') || hasFlag('-h')) usage(0)
  if (!csvArg) usage()

  const execute = hasFlag('--execute')
  const account = privateKeyToAccount(asPrivateKey(requireEnv('OPERATOR_PRIVATE_KEY')))
  const rpcUrl = requireEnv('CELO_RPC_URL')
  const usdc = getAddress(process.env.USDC_ADDRESS ?? USDC_ON_CELO)
  const payouts = readPayouts(resolve(csvArg))
  const total = payouts.reduce((sum, payout) => sum + payout.amount, 0n)

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
    throw new Error(`CELO_RPC_URL returned chain id ${chainId}; expected ${CELO_CHAIN_ID}`)
  }

  const [symbol, decimals, balance] = await Promise.all([
    publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: 'symbol' }),
    publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: 'decimals' }),
    publicClient.readContract({
      address: usdc,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account.address],
    }),
  ])

  if (decimals !== USDC_DECIMALS) {
    throw new Error(`USDC contract ${usdc} reports ${decimals} decimals; expected ${USDC_DECIMALS}`)
  }
  if (balance < total) {
    throw new Error(
      `Insufficient ${symbol}: need ${formatUnits(total, decimals)}, have ${formatUnits(balance, decimals)}`,
    )
  }

  console.log(`${execute ? 'Executing' : 'Dry run'} ${payouts.length} payouts from ${account.address}`)
  console.log(`Token: ${symbol} ${usdc}`)
  console.log(`Total: ${formatUnits(total, decimals)} ${symbol}`)

  for (const payout of payouts) {
    const simulation = await publicClient.simulateContract({
      account,
      address: usdc,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [payout.recipient, payout.amount],
    })

    console.log(
      `line ${payout.line}: ${payout.amountText} ${symbol} -> ${payout.recipient}`,
    )

    if (!execute) continue

    const hash = await walletClient.writeContract(simulation.request)
    console.log(`  submitted ${hash}`)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(`Transfer failed for CSV line ${payout.line}: ${hash}`)
    }
    console.log(`  confirmed in block ${receipt.blockNumber}`)
  }

  if (!execute) {
    console.log('Dry run complete. Re-run with --execute to broadcast these transfers.')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
