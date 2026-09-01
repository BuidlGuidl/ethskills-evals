/**
 * Deploys a contract to Sepolia with viem and reports the deployed address.
 *
 *   npm run deploy                      # uses deploy.config.ts
 *   npm run deploy -- --contract Vault --args '["0xabc...", 100]'
 *   npm run deploy -- --dry-run         # estimate cost, broadcast nothing
 *
 * Requires DEPLOYER_PRIVATE_KEY (and ideally SEPOLIA_RPC_URL) in .env.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { encodeDeployData, formatEther, getAddress, type Abi, type Hex } from "viem";

import { loadArtifact } from "./compile.js";
import { deployConfig } from "./deploy.config.js";
import {
  addressUrl,
  assertCorrectChain,
  chain,
  eth,
  getDeployerAccount,
  getPublicClient,
  getWalletClient,
  reportFatal,
  txUrl,
} from "./lib/config.js";

const { values } = parseArgs({
  options: {
    contract: { type: "string" },
    args: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
  allowPositionals: false,
});

function constructorArgs(): unknown[] {
  if (values.args === undefined) return deployConfig.args;
  let parsed: unknown;
  try {
    parsed = JSON.parse(values.args);
  } catch {
    throw new Error(`--args must be a JSON array, e.g. --args '["gm", 42]'. Got: ${values.args}`);
  }
  if (!Array.isArray(parsed)) throw new Error("--args must be a JSON array.");
  return parsed;
}

async function main() {
  const contractName = values.contract ?? deployConfig.contract;
  const args = constructorArgs();

  console.log(`Compiling ${contractName}…`);
  const artifact = loadArtifact(contractName);

  const account = getDeployerAccount();
  const publicClient = getPublicClient();
  await assertCorrectChain(publicClient);

  const balance = await publicClient.getBalance({ address: account.address });

  console.log(`
Network   ${chain.name} (chain ${chain.id})
Deployer  ${account.address}
Balance   ${eth(balance)}
Contract  ${contractName}  [${artifact.sourceName}, solc ${artifact.compiler.split("+")[0]}]
Args      ${args.length ? JSON.stringify(args) : "(none)"}`);

  // viem tolerates a missing argument and the deploy then reverts on-chain with
  // no useful reason, so check the arity against the ABI ourselves first.
  const ctor = (artifact.abi as Abi).find((item) => item.type === "constructor");
  const expectedArgs = ctor && "inputs" in ctor ? ctor.inputs.length : 0;
  if (args.length !== expectedArgs) {
    const signature = ctor && "inputs" in ctor ? ctor.inputs.map((i) => `${i.type} ${i.name}`).join(", ") : "";
    throw new Error(
      `${contractName}'s constructor takes ${expectedArgs} argument(s) (${signature || "none"}), ` +
        `but ${args.length} were given. Fix \`args\` in deploy.config.ts.`,
    );
  }

  // Encoding here (rather than letting deployContract do it) surfaces a
  // constructor-argument mismatch before we spend anything on gas.
  let data: Hex;
  try {
    data = encodeDeployData({
      abi: artifact.abi as Abi,
      bytecode: artifact.bytecode,
      args: args as never,
    });
  } catch (error) {
    throw new Error(
      `Constructor arguments do not match ${contractName}'s constructor. ` +
        `Check deploy.config.ts.\n  ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const gas = await publicClient.estimateGas({ account, data }).catch((error) => {
    throw new Error(
      `Gas estimation failed — the deployment would revert or the deployer is out of funds.\n  ${
        error instanceof Error ? error.message.split("\n")[0] : String(error)
      }`,
    );
  });
  const fees = await publicClient.estimateFeesPerGas();
  const maxCost = gas * (fees.maxFeePerGas ?? 0n);

  console.log(`Gas       ${gas.toLocaleString("en-US")} units · up to ${eth(maxCost)} at current fees`);

  if (balance < maxCost) {
    throw new Error(
      `Deployer has ${eth(balance)} but the deploy may cost up to ${eth(maxCost)}.\n` +
        `  Fund ${account.address} from a Sepolia faucet (see README.md) and retry.`,
    );
  }

  if (values["dry-run"]) {
    console.log("\n--dry-run: nothing broadcast.\n");
    return;
  }

  const walletClient = getWalletClient(account);
  const hash = await walletClient.deployContract({
    abi: artifact.abi as Abi,
    bytecode: artifact.bytecode,
    args: args as never,
  });
  console.log(`\nSent ${hash}\n  ${txUrl(hash)}\nWaiting for confirmation…`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`Deployment transaction reverted. See ${txUrl(hash)}`);
  }

  const spent = receipt.gasUsed * receipt.effectiveGasPrice;
  const address = getAddress(receipt.contractAddress); // EIP-55 checksummed for copy/paste

  console.log(`
✔ ${contractName} deployed

  Address   ${address}
  Block     ${receipt.blockNumber}
  Gas used  ${receipt.gasUsed.toLocaleString("en-US")} (${formatEther(spent)} ETH)
  Explorer  ${addressUrl(address)}
`);

  recordDeployment({
    contract: contractName,
    address,
    txHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    deployer: account.address,
    constructorArgs: args,
    compiler: artifact.compiler,
    timestamp: new Date().toISOString(),
  });

  // Lets CI or a follow-up script pick the address up without scraping stdout.
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `contract_address=${address}\n`);
  }
}

/** Appends to deployments/<chain>.json so the team has a record of what shipped. */
function recordDeployment(entry: Record<string, unknown>) {
  const dir = "deployments";
  const file = `${dir}/${chain.name.toLowerCase().replace(/\s+/g, "-")}.json`;
  mkdirSync(dir, { recursive: true });
  const existing: unknown[] = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
  existing.push(entry);
  writeFileSync(file, `${JSON.stringify(existing, null, 2)}\n`);
  console.log(`  Recorded in ${file} — commit it so the team knows what is live.\n`);
}

main().catch(reportFatal);
