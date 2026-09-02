/**
 * Deploys a compiled contract to Sepolia and prints the deployed address.
 *
 *   npm run compile
 *   npm run deploy -- Counter
 *   npm run deploy -- Counter 42            # constructor args, in order
 *   npm run deploy -- Counter 42 --yes      # skip the interactive prompt
 *
 * Reads DEPLOYER_PRIVATE_KEY and SEPOLIA_RPC_URL from .env (see .env.example).
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { encodeDeployData, getAddress, type Abi, type Hex } from "viem";
import {
  assertSepolia,
  confirm,
  deployer,
  eth,
  explorerAddress,
  explorerTx,
  publicClient,
} from "./config.js";

const ARTIFACT_DIR = "out";

type Artifact = { contractName: string; abi: Abi; bytecode: Hex; solcVersion?: string };

function loadArtifact(name: string): Artifact {
  const path = join(ARTIFACT_DIR, `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(`No artifact at ${path}. Run \`npm run compile\` first.`);
  }
  const artifact = JSON.parse(readFileSync(path, "utf8")) as Artifact;
  if (!artifact.bytecode || artifact.bytecode === "0x") {
    throw new Error(`${name} has no deployable bytecode (interface or abstract contract?).`);
  }
  return artifact;
}

/**
 * Constructor args come off the command line as strings. Turn them into the
 * types viem expects: JSON where it parses (numbers, bools, arrays), raw
 * string otherwise (addresses, strings). Integers become BigInt so that large
 * uint256 values survive the trip.
 */
function parseArg(raw: string): unknown {
  if (/^-?\d+$/.test(raw)) return BigInt(raw);
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== "--yes" && a !== "-y");
  const contractName = argv[0];
  if (!contractName) {
    console.error("Usage: npm run deploy -- <ContractName> [constructorArgs...] [--yes]");
    process.exit(1);
  }

  const artifact = loadArtifact(contractName);
  const args = argv.slice(1).map(parseArg);

  const client = publicClient();
  await assertSepolia(client);
  const { account, wallet } = deployer();

  const balance = await client.getBalance({ address: account.address });

  // Price the deploy against the live chain — estimate the gas this exact
  // deploy transaction needs, and take fees from the current block. Estimate
  // against bytecode *plus encoded constructor args*: a constructor that
  // reverts on bad input reverts here too, which catches the mistake before
  // any gas is spent.
  const data = encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode, args });
  const gas = await client.estimateGas({ account, data });
  const fees = await client.estimateFeesPerGas();
  const gasLimit = (gas * 120n) / 100n; // 20% headroom; unused gas is refunded
  const maxCost = gasLimit * fees.maxFeePerGas;

  console.log("");
  console.log(`Contract     ${artifact.contractName}${artifact.solcVersion ? `  (solc ${artifact.solcVersion})` : ""}`);
  console.log(`Constructor  ${args.length ? args.map(String).join(", ") : "(no args)"}`);
  console.log(`Network      Sepolia (chain 11155111)`);
  console.log(`Deployer     ${account.address}`);
  console.log(`Balance      ${eth(balance)}`);
  console.log(`Gas          ${gasLimit} units @ up to ${fees.maxFeePerGas} wei`);
  console.log(`Max cost     ${eth(maxCost)}`);
  console.log("");

  if (balance < maxCost) {
    throw new Error(
      `Deployer holds ${eth(balance)} but this deploy can cost up to ${eth(maxCost)}. ` +
        `Top it up from a Sepolia faucet.`,
    );
  }

  if (!(await confirm("Deploy this contract?"))) {
    console.log("Aborted. Nothing was sent.");
    process.exit(1);
  }

  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args,
    gas: gasLimit,
  });
  console.log(`\nSent  ${explorerTx(hash)}`);
  console.log("Waiting for confirmation...");

  const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`Deploy reverted. See ${explorerTx(hash)}`);
  }

  const spent = receipt.gasUsed * receipt.effectiveGasPrice;
  const address = getAddress(receipt.contractAddress); // EIP-55 form, safe to paste
  console.log("");
  console.log(`Deployed at  ${address}`);
  console.log(`Block        ${receipt.blockNumber}`);
  console.log(`Gas used     ${receipt.gasUsed} (${eth(spent)})`);
  console.log(`Explorer     ${explorerAddress(address)}`);
  console.log(`Remaining    ${eth(await client.getBalance({ address: account.address }))}`);

  // Record the deployment so teammates (and sweep.ts callers) can see what
  // this key has shipped without digging through terminal scrollback.
  mkdirSync("deployments", { recursive: true });
  const path = join("deployments", "sepolia.json");
  const log = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];
  log.push({
    contract: artifact.contractName,
    address,
    args: args.map(String),
    deployer: account.address,
    txHash: hash,
    blockNumber: Number(receipt.blockNumber),
    timestamp: new Date().toISOString(),
  });
  writeFileSync(path, `${JSON.stringify(log, null, 2)}\n`);
  console.log(`Recorded in  ${path}`);
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
