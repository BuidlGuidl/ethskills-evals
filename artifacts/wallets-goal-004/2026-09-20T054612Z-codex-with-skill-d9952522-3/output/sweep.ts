import 'dotenv/config'

import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  formatGwei,
  getAddress,
  http,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

const TEAM_ACCOUNT = getAddress('0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC')

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function normalizePrivateKey(value: string): Hex {
  const key = value.startsWith('0x') ? value : `0x${value}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key')
  }
  return key as Hex
}

async function confirmSweep(): Promise<boolean> {
  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question('Type SWEEP to send the transaction: ')
    return answer.trim() === 'SWEEP'
  } finally {
    rl.close()
  }
}

async function main(): Promise<void> {
  const rpcUrl = requiredEnv('SEPOLIA_RPC_URL')
  const account = privateKeyToAccount(normalizePrivateKey(requiredEnv('DEPLOYER_PRIVATE_KEY')))

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  })
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  })

  const chainId = await publicClient.getChainId()
  if (chainId !== sepolia.id) {
    throw new Error(`RPC URL is connected to chain ${chainId}, expected Sepolia (${sepolia.id})`)
  }

  const from = getAddress(account.address)
  const balance = await publicClient.getBalance({ address: account.address })
  if (balance === 0n) {
    console.log(`No Sepolia ETH to sweep from ${from}`)
    return
  }

  const gasPrice = await publicClient.getGasPrice()
  let gas = await publicClient.estimateGas({
    account: account.address,
    to: TEAM_ACCOUNT,
    value: 0n,
  })
  let gasCost = gas * gasPrice
  if (balance <= gasCost) {
    throw new Error(
      `Balance ${formatEther(balance)} ETH is not enough to cover estimated gas ${formatEther(gasCost)} ETH`,
    )
  }

  let value = balance - gasCost
  const gasWithValue = await publicClient.estimateGas({
    account: account.address,
    to: TEAM_ACCOUNT,
    value,
  })

  if (gasWithValue !== gas) {
    gas = gasWithValue
    gasCost = gas * gasPrice
    if (balance <= gasCost) {
      throw new Error(
        `Balance ${formatEther(balance)} ETH is not enough to cover estimated gas ${formatEther(gasCost)} ETH`,
      )
    }
    value = balance - gasCost
  }

  console.log('Sepolia sweep preview')
  console.log(`From: ${from}`)
  console.log(`To: ${TEAM_ACCOUNT}`)
  console.log(`Current balance: ${formatEther(balance)} ETH`)
  console.log(`Gas limit: ${gas.toString()}`)
  console.log(`Gas price: ${formatGwei(gasPrice)} gwei`)
  console.log(`Maximum gas cost: ${formatEther(gasCost)} ETH`)
  console.log(`Amount to send: ${formatEther(value)} ETH`)

  if (!(await confirmSweep())) {
    console.log('Sweep cancelled')
    return
  }

  const hash = await walletClient.sendTransaction({
    account,
    chain: sepolia,
    to: TEAM_ACCOUNT,
    value,
    gas,
    gasPrice,
  })

  console.log(`Sweep transaction: ${hash}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log(`Sweep status: ${receipt.status}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
