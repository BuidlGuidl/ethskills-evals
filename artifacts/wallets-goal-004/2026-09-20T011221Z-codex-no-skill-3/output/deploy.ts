import "dotenv/config";

import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

type SolcOutput = {
  contracts?: Record<string, Record<string, { abi: Abi; evm: { bytecode: { object: string } } }>>;
  errors?: Array<{ severity: "error" | "warning" | string; formattedMessage: string }>;
};

const repoRoot = process.cwd();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env or export it before running this script.`);
  }
  return value;
}

function getPrivateKey(): Hex {
  const privateKey = requireEnv("DEPLOYER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key prefixed with 0x.");
  }
  return privateKey as Hex;
}

function getConstructorArgs(): unknown[] {
  const raw = process.env.CONSTRUCTOR_ARGS?.trim();
  if (!raw) return [];

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("CONSTRUCTOR_ARGS must be a JSON array, for example: '[\"hello\",123]'.");
  }
  return parsed;
}

function resolveImport(importPath: string): { contents: string } | { error: string } {
  const candidates = [
    path.resolve(repoRoot, importPath),
    path.resolve(repoRoot, "contracts", importPath),
    path.resolve(repoRoot, "node_modules", importPath),
  ];

  for (const candidate of candidates) {
    try {
      return { contents: readFileSync(candidate, "utf8") };
    } catch {
      // Try the next candidate.
    }
  }

  return { error: `Import not found: ${importPath}` };
}

async function compile(contractPath: string, contractName: string) {
  const absoluteContractPath = path.resolve(repoRoot, contractPath);
  const source = await readFile(absoluteContractPath, "utf8");
  const sourceKey = path.relative(repoRoot, absoluteContractPath).replaceAll(path.sep, "/");

  const input = {
    language: "Solidity",
    sources: {
      [sourceKey]: {
        content: source,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: resolveImport })) as SolcOutput;
  const errors = output.errors ?? [];
  const fatalErrors = errors.filter((error) => error.severity === "error");

  for (const warning of errors.filter((error) => error.severity !== "error")) {
    console.warn(warning.formattedMessage);
  }

  if (fatalErrors.length > 0) {
    throw new Error(fatalErrors.map((error) => error.formattedMessage).join("\n"));
  }

  const compiled = output.contracts?.[sourceKey]?.[contractName];
  if (!compiled) {
    throw new Error(`Contract ${contractName} was not found in ${contractPath}.`);
  }

  const bytecode = compiled.evm.bytecode.object;
  if (!bytecode) {
    throw new Error(`Contract ${contractName} compiled without deployment bytecode.`);
  }

  return {
    abi: compiled.abi,
    bytecode: `0x${bytecode}` as Hex,
  };
}

async function main() {
  const rpcUrl = requireEnv("SEPOLIA_RPC_URL");
  const contractPath = process.env.CONTRACT_PATH?.trim() || "contracts/TeamContract.sol";
  const contractName = process.env.CONTRACT_NAME?.trim() || "TeamContract";
  const constructorArgs = getConstructorArgs();

  const account = privateKeyToAccount(getPrivateKey());
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) {
    throw new Error(`RPC endpoint is connected to chain ${chainId}, expected Sepolia (${sepolia.id}).`);
  }

  const { abi, bytecode } = await compile(contractPath, contractName);

  console.log(`Deploying ${contractName} from ${account.address} to Sepolia...`);
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: constructorArgs,
  });

  console.log(`Deployment transaction: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    throw new Error(`Deployment transaction ${hash} did not create a contract.`);
  }

  await mkdir("deployments", { recursive: true });
  const deployment = {
    chain: "sepolia",
    chainId: sepolia.id,
    contractName,
    contractPath,
    address: receipt.contractAddress,
    transactionHash: hash,
    deployer: account.address,
    blockNumber: receipt.blockNumber.toString(),
    constructorArgs,
    deployedAt: new Date().toISOString(),
  };
  await writeFile("deployments/sepolia.json", `${JSON.stringify(deployment, null, 2)}\n`);

  console.log(`Deployed address: ${receipt.contractAddress}`);
  console.log("Saved deployment metadata to deployments/sepolia.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
