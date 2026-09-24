/**
 * Compile a Solidity contract and deploy it to Sepolia.
 *
 *   npm run deploy -- <path/to/Contract.sol> [ContractName] [constructor args as JSON array]
 *   npm run deploy -- contracts/Greeter.sol Greeter '["hello"]'
 *
 * Prints the estimated cost and waits for you to type "yes" before sending.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import solc from "solc";
import { encodeDeployData, isAddressEqual, type Abi, type Hex } from "viem";
import { BURNED_ACCOUNTS, chain, confirm, connect, eth, explorer, fail, gwei } from "./lib/common.js";

const [sourcePath, nameArg, argsJson] = process.argv.slice(2);
if (!sourcePath) {
  fail("Usage: npm run deploy -- <path/to/Contract.sol> [ContractName] ['[constructor, args]']");
}
if (!existsSync(sourcePath)) fail(`No such file: ${sourcePath}`);

// ---- Compile -----------------------------------------------------------------

function compile(file: string, contractName: string) {
  const input = {
    language: "Solidity",
    sources: { [basename(file)]: { content: readFileSync(file, "utf8") } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  // Resolve imports relative to the contract's folder, then node_modules (e.g. @openzeppelin/contracts).
  const findImports = (path: string) => {
    for (const candidate of [resolve(dirname(file), path), resolve("node_modules", path)]) {
      if (existsSync(candidate)) return { contents: readFileSync(candidate, "utf8") };
    }
    return { error: `Import not found: ${path}` };
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errors = (output.errors ?? []).filter((e: { severity: string }) => e.severity === "error");
  if (errors.length) fail(`Compilation failed:\n${errors.map((e: any) => e.formattedMessage).join("\n")}`);

  const contract = output.contracts?.[basename(file)]?.[contractName];
  if (!contract) {
    const found = Object.keys(output.contracts?.[basename(file)] ?? {}).join(", ") || "none";
    fail(`Contract "${contractName}" not found in ${file}. Contracts in that file: ${found}`);
  }
  const bytecode = `0x${contract.evm.bytecode.object}` as Hex;
  if (bytecode === "0x") fail(`"${contractName}" has no bytecode (is it abstract or an interface?).`);
  return { abi: contract.abi as Abi, bytecode };
}

const contractName = nameArg ?? basename(sourcePath, ".sol");
console.log(`Compiling ${contractName} (solc ${solc.version()})…`);
const { abi, bytecode } = compile(sourcePath, contractName);

// ---- Constructor args --------------------------------------------------------

let args: unknown[] = [];
if (argsJson) {
  try {
    args = JSON.parse(argsJson);
  } catch {
    fail(`Constructor args must be a JSON array, got: ${argsJson}`);
  }
  if (!Array.isArray(args)) fail("Constructor args must be a JSON array.");
}
type AbiConstructor = Extract<Abi[number], { type: "constructor" }>;
const ctor = abi.find((item): item is AbiConstructor => item.type === "constructor");
const inputs = ctor?.inputs ?? [];
if (inputs.length !== args.length) {
  const sig = inputs.map((i) => `${i.type} ${i.name ?? ""}`.trim()).join(", ");
  fail(`Constructor expects ${inputs.length} arg(s) (${sig}), got ${args.length}.`);
}
// JSON has no bigint: accept numbers or decimal strings for (u)int params.
args = args.map((value, i) =>
  /^u?int\d*$/.test(inputs[i].type) && (typeof value === "number" || typeof value === "string")
    ? BigInt(value)
    : value,
);

// ---- Estimate, confirm, deploy -----------------------------------------------

const { account, publicClient, walletClient } = await connect();
if (BURNED_ACCOUNTS.some((burned) => isAddressEqual(burned, account.address))) {
  fail(`${account.address} is a leaked key — do not deploy from it. Run \`npm run new-deployer\` (see README).`);
}
const data = encodeDeployData({ abi, bytecode, args });

const [balance, gas, fees] = await Promise.all([
  publicClient.getBalance({ address: account.address }),
  publicClient.estimateGas({ account, data }),
  publicClient.estimateFeesPerGas(),
]);
const maxCost = gas * fees.maxFeePerGas;

console.log(`
Network:        ${chain.name} (chain id ${chain.id})
Deployer:       ${account.address}
Balance:        ${eth(balance)}
Contract:       ${contractName} from ${sourcePath}
Constructor:    ${JSON.stringify(args, (_, v) => (typeof v === "bigint" ? v.toString() : v))}
Estimated gas:  ${gas}
Max fee/gas:    ${gwei(fees.maxFeePerGas)} (priority ${gwei(fees.maxPriorityFeePerGas)})
Max cost:       ${eth(maxCost)}`);

if (balance < maxCost) fail(`Deployer balance is too low to cover the max cost of ${eth(maxCost)}.`);
await confirm(`Deploy ${contractName} to ${chain.name}?`);

const hash = await walletClient.sendTransaction({
  data,
  gas,
  maxFeePerGas: fees.maxFeePerGas,
  maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
});
console.log(`\nSent: ${explorer("tx", hash)}\nWaiting for confirmation…`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) {
  fail(`Deployment reverted in block ${receipt.blockNumber}: ${explorer("tx", hash)}`);
}
const address = receipt.contractAddress;
const paid = receipt.gasUsed * receipt.effectiveGasPrice;

console.log(`
✔ ${contractName} deployed
  Address:  ${address}
  Explorer: ${explorer("address", address)}
  Block:    ${receipt.blockNumber}
  Gas paid: ${eth(paid)}`);

// Record the deployment so the team has the address and ABI in the repo.
mkdirSync("deployments", { recursive: true });
const outFile = `deployments/sepolia-${contractName}.json`;
writeFileSync(
  outFile,
  JSON.stringify(
    {
      contract: contractName,
      address,
      chainId: chain.id,
      txHash: hash,
      blockNumber: Number(receipt.blockNumber),
      deployer: account.address,
      deployedAt: new Date().toISOString(),
      abi,
    },
    null,
    2,
  ) + "\n",
);
console.log(`  Saved:    ${outFile}`);
