import 'dotenv/config'

import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  type Abi,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

type ContractArtifact = {
  abi?: unknown
  bytecode?: string | { object?: string }
  evm?: {
    bytecode?: {
      object?: string
    }
  }
  contractName?: string
}

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

function artifactBytecode(artifact: ContractArtifact): Hex {
  const raw =
    typeof artifact.bytecode === 'string'
      ? artifact.bytecode
      : artifact.bytecode?.object ?? artifact.evm?.bytecode?.object

  const bytecode = raw?.startsWith('0x') ? raw : raw ? `0x${raw}` : undefined
  if (!bytecode || bytecode === '0x') {
    throw new Error('Contract artifact does not contain deployable bytecode')
  }

  return bytecode as Hex
}

function constructorArgs(): readonly unknown[] {
  const raw = process.env.CONSTRUCTOR_ARGS?.trim()
  if (!raw) {
    return []
  }

  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error('CONSTRUCTOR_ARGS must be a JSON array')
  }

  return parsed
}

async function loadArtifact(path: string): Promise<{ abi: Abi; bytecode: Hex; name: string }> {
  const artifact = JSON.parse(await readFile(path, 'utf8')) as ContractArtifact

  if (!Array.isArray(artifact.abi)) {
    throw new Error('Contract artifact does not contain an ABI array')
  }

  return {
    abi: artifact.abi as Abi,
    bytecode: artifactBytecode(artifact),
    name: artifact.contractName ?? basename(path),
  }
}

async function main(): Promise<void> {
  const rpcUrl = requiredEnv('SEPOLIA_RPC_URL')
  const artifactPath = requiredEnv('CONTRACT_ARTIFACT')
  const account = privateKeyToAccount(normalizePrivateKey(requiredEnv('DEPLOYER_PRIVATE_KEY')))
  const artifact = await loadArtifact(artifactPath)
  const args = constructorArgs()

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

  console.log(`Deploying ${artifact.name} to Sepolia`)
  console.log(`Deployer: ${getAddress(account.address)}`)
  console.log(`Artifact: ${artifactPath}`)
  console.log(`Constructor args: ${JSON.stringify(args)}`)

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args,
  })

  console.log(`Deployment transaction: ${hash}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })

  if (receipt.status !== 'success' || !receipt.contractAddress) {
    throw new Error(`Deployment failed in transaction ${hash}`)
  }

  console.log(`Deployed address: ${getAddress(receipt.contractAddress)}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
