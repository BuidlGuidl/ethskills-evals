import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { config } from 'dotenv'
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

config({ quiet: true })

const CELO_CHAIN_ID = 42_220
const DEFAULT_USDC_ADDRESS = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'

const erc20Abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
])

type Recipient = {
  row: number
  address: Address
  amount: bigint
  amountText: string
}

function argValue(name: string) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`))
  return arg?.slice(name.length + 1)
}

function env(name: string, fallback?: string) {
  return process.env[name] || fallback
}

function requireEnv(name: string) {
  const value = env(name)
  if (!value) throw new Error(`Missing required env var ${name}`)
  return value
}

function asPrivateKey(value: string): Hex {
  const key = value.startsWith('0x') ? value : `0x${value}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('PRIVATE_KEY must be a 32-byte hex private key')
  }
  return key as Hex
}

function parseRecipients(csvPath: string, decimals: number): Recipient[] {
  const records = parse(readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[]

  if (records.length === 0) throw new Error(`CSV ${csvPath} has no rows`)

  const recipients = records.map((record, index) => {
    const rawAddress = record.address ?? record.recipient ?? record.to
    const rawAmount = record.amount ?? record.amount_usdc ?? record.usdc

    if (!rawAddress || !isAddress(rawAddress)) {
      throw new Error(`Row ${index + 2}: invalid recipient address`)
    }
    if (!rawAmount || Number(rawAmount) <= 0) {
      throw new Error(`Row ${index + 2}: amount must be greater than zero`)
    }

    return {
      row: index + 2,
      address: getAddress(rawAddress),
      amount: parseUnits(rawAmount, decimals),
      amountText: rawAmount,
    }
  })

  const seen = new Map<Address, number>()
  for (const recipient of recipients) {
    const previous = seen.get(recipient.address)
    if (previous) {
      throw new Error(
        `Duplicate recipient ${recipient.address} on rows ${previous} and ${recipient.row}`,
      )
    }
    seen.set(recipient.address, recipient.row)
  }

  return recipients
}

async function main() {
  const csvPath = argValue('--csv') ?? env('PAYOUT_CSV')
  if (!csvPath) {
    throw new Error('Usage: npm run payout -- --csv=recipients.csv')
  }

  const broadcast =
    process.argv.includes('--broadcast') || env('BROADCAST') === 'true'
  if (broadcast && env('CONFIRM_PRODUCTION') !== 'celo-mainnet') {
    throw new Error(
      'Refusing to broadcast without CONFIRM_PRODUCTION=celo-mainnet',
    )
  }

  const account = privateKeyToAccount(asPrivateKey(requireEnv('PRIVATE_KEY')))
  const rpcUrl = env('CELO_RPC_URL', 'https://forno.celo.org')
  const usdcAddress = getAddress(env('USDC_ADDRESS', DEFAULT_USDC_ADDRESS)!)

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
    throw new Error(`CELO_RPC_URL returned chain id ${chainId}, expected 42220`)
  }

  const [symbol, decimals, balance] = await Promise.all([
    publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'symbol',
    }),
    publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'decimals',
    }),
    publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account.address],
    }),
  ])

  if (symbol !== 'USDC') {
    throw new Error(`Token at ${usdcAddress} reports symbol ${symbol}, not USDC`)
  }
  if (decimals !== 6 && env('ALLOW_NON_6_DECIMALS') !== 'true') {
    throw new Error(
      `USDC decimals are ${decimals}; set ALLOW_NON_6_DECIMALS=true only after verifying the token address`,
    )
  }

  const recipients = parseRecipients(csvPath, decimals)
  const total = recipients.reduce((sum, recipient) => sum + recipient.amount, 0n)
  if (balance < total) {
    throw new Error(
      `Insufficient USDC: need ${formatUnits(total, decimals)}, have ${formatUnits(
        balance,
        decimals,
      )}`,
    )
  }

  console.log(`Ops wallet: ${account.address}`)
  console.log(`USDC token: ${usdcAddress}`)
  console.log(`Recipients: ${recipients.length}`)
  console.log(`Total: ${formatUnits(total, decimals)} USDC`)
  console.log(`Mode: ${broadcast ? 'BROADCAST' : 'DRY RUN'}`)

  let nonce = broadcast
    ? await publicClient.getTransactionCount({
        address: account.address,
        blockTag: 'pending',
      })
    : undefined

  for (const recipient of recipients) {
    const simulation = await publicClient.simulateContract({
      account,
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient.address, recipient.amount],
    })

    if (!broadcast) {
      console.log(
        `dry-run row ${recipient.row}: ${recipient.amountText} USDC -> ${recipient.address}`,
      )
      continue
    }

    const hash = await walletClient.writeContract({
      ...simulation.request,
      nonce,
    })
    nonce = nonce === undefined ? undefined : nonce + 1
    console.log(`sent row ${recipient.row}: ${hash}`)

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(`Transfer failed for row ${recipient.row}: ${hash}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
