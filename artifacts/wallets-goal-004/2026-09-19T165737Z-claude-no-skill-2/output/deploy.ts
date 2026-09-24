/**
 * Compiles a Solidity contract and deploys it to Sepolia.
 *
 *   npm run deploy
 *
 * Config comes from .env (see .env.example). The deployed address is printed and
 * recorded in deployments/sepolia/<ContractName>.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { formatEther, type Abi, type Hex } from "viem";
import solc from "solc";
import { requireEnv, sepoliaClients } from "./env.js";

type SolcOutput = {
  errors?: { severity: "error" | "warning"; formattedMessage: string }[];
  contracts?: Record<string, Record<string, { abi: Abi; evm: { bytecode: { object: string } } }>>;
};

function compile(contractPath: string, contractName: string) {
  const sourceKey = basename(contractPath);
  const input = {
    language: "Solidity",
    sources: { [sourceKey]: { content: readFileSync(contractPath, "utf8") } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  // Resolve relative imports (and node_modules imports such as @openzeppelin/...).
  const findImports = (path: string) => {
    for (const candidate of [join(dirname(contractPath), path), join("node_modules", path)]) {
      try {
        return { contents: readFileSync(candidate, "utf8") };
      } catch {}
    }
    return { error: `File not found: ${path}` };
  };

  const output: SolcOutput = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errors = output.errors?.filter((e) => e.severity === "error") ?? [];
  for (const w of output.errors?.filter((e) => e.severity === "warning") ?? []) console.warn(w.formattedMessage);
  if (errors.length) throw new Error(`Compilation failed:\n${errors.map((e) => e.formattedMessage).join("\n")}`);

  const artifact = output.contracts?.[sourceKey]?.[contractName];
  if (!artifact) throw new Error(`Contract "${contractName}" not found in ${contractPath}.`);
  if (!artifact.evm.bytecode.object) throw new Error(`"${contractName}" has no bytecode (abstract or interface?).`);
  return { abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` as Hex };
}

function parseConstructorArgs(): unknown[] {
  const raw = process.env.CONSTRUCTOR_ARGS?.trim();
  if (!raw) return [];
  const args = JSON.parse(raw);
  if (!Array.isArray(args)) throw new Error("CONSTRUCTOR_ARGS must be a JSON array.");
  return args;
}

async function main() {
  const contractPath = resolve(requireEnv("CONTRACT_PATH"));
  const contractName = requireEnv("CONTRACT_NAME");
  const args = parseConstructorArgs();

  console.log(`Compiling ${contractName} (solc ${solc.version()})...`);
  const { abi, bytecode } = compile(contractPath, contractName);

  const { account, publicClient, walletClient } = await sepoliaClients();
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer: ${account.address} (${formatEther(balance)} SepoliaETH)`);
  if (balance === 0n) throw new Error("Deployer has no Sepolia ETH.");

  const hash = await walletClient.deployContract({ abi, bytecode, args });
  console.log(`Deploy tx: ${hash}`);
  console.log(`           https://sepolia.etherscan.io/tx/${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`Deployment reverted in block ${receipt.blockNumber}.`);
  }

  const address = receipt.contractAddress;
  const record = {
    contract: contractName,
    address,
    chainId: publicClient.chain.id,
    txHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    deployer: account.address,
    constructorArgs: args,
    compiler: solc.version(),
    deployedAt: new Date().toISOString(),
    abi,
  };
  const outDir = join("deployments", "sepolia");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${contractName}.json`);
  writeFileSync(outFile, JSON.stringify(record, null, 2) + "\n");

  console.log(`\n${contractName} deployed at ${address}`);
  console.log(`https://sepolia.etherscan.io/address/${address}`);
  console.log(`Gas used: ${receipt.gasUsed} (${formatEther(receipt.gasUsed * receipt.effectiveGasPrice)} ETH)`);
  console.log(`Saved ${outFile}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
