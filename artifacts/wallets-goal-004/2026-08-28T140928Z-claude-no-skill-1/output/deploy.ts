/**
 * Deploy a contract to Sepolia and record the address.
 *
 *   npm run deploy
 *
 * Reads DEPLOYER_PRIVATE_KEY / SEPOLIA_RPC_URL from .env (see .env.example),
 * compiles contracts/<CONTRACT_NAME>.sol, deploys it, waits for the receipt,
 * and appends the result to deployments/sepolia.json.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { encodeDeployData, formatEther, getAddress, type Abi } from "viem";
import { compile, ROOT } from "./src/compile.js";
import { assertSepolia, loadConfig, reportFatal, UserError } from "./src/config.js";

const CONTRACT_NAME = process.env.CONTRACT_NAME?.trim() || "Counter";

/**
 * Constructor arguments, in ABI order. Edit this when you swap in the real
 * contract — everything else in this script is contract-agnostic.
 */
const CONSTRUCTOR_ARGS: readonly unknown[] = [
  BigInt(process.env.COUNTER_INITIAL_VALUE ?? "0"),
];

const EXPLORER = "https://sepolia.etherscan.io";

/** Fail before spending gas if the args obviously don't match the ABI. */
function assertArgsMatchAbi(abi: Abi, args: readonly unknown[]): void {
  const constructor = abi.find((item) => item.type === "constructor");
  const expected = constructor?.inputs?.length ?? 0;
  if (expected !== args.length) {
    throw new UserError(
      `${CONTRACT_NAME}'s constructor takes ${expected} argument(s) but ` +
        `CONSTRUCTOR_ARGS in deploy.ts has ${args.length}. Update deploy.ts.`,
    );
  }
}

function recordDeployment(entry: Record<string, unknown>): string {
  const dir = join(ROOT, "deployments");
  const file = join(dir, "sepolia.json");
  mkdirSync(dir, { recursive: true });

  const existing = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>)
    : {};
  existing[CONTRACT_NAME] = entry;
  writeFileSync(file, `${JSON.stringify(existing, null, 2)}\n`);
  return file;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const { account, publicClient, walletClient } = config;
  await assertSepolia(config);

  console.log(`Contract : ${CONTRACT_NAME}`);
  console.log(`Deployer : ${account.address}`);
  console.log(`RPC      : ${config.rpcUrl}\n`);

  const { abi, bytecode } = compile(CONTRACT_NAME);
  assertArgsMatchAbi(abi, CONSTRUCTOR_ARGS);

  // Estimate cost up front so an underfunded deployer fails cheaply and loudly.
  const data = encodeDeployData({ abi, bytecode, args: CONSTRUCTOR_ARGS });
  const [balance, gas, fees] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.estimateGas({ account, data }),
    publicClient.estimateFeesPerGas(),
  ]);
  const maxCost = gas * fees.maxFeePerGas;

  console.log(`Balance  : ${formatEther(balance)} ETH`);
  console.log(`Gas      : ${gas} @ up to ${fees.maxFeePerGas} wei`);
  console.log(`Max cost : ${formatEther(maxCost)} ETH\n`);

  if (balance < maxCost) {
    throw new UserError(
      `Deployer has ${formatEther(balance)} ETH but the deploy may cost up to ` +
        `${formatEther(maxCost)} ETH. Top it up from a Sepolia faucet ` +
        "(https://sepoliafaucet.com) and retry.",
    );
  }

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: CONSTRUCTOR_ARGS as never,
  });
  console.log(`Sent     : ${EXPLORER}/tx/${hash}`);
  console.log("Waiting for confirmation…");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(
      `Deploy transaction reverted. See ${EXPLORER}/tx/${hash} for details.`,
    );
  }

  const address = getAddress(receipt.contractAddress);
  const file = recordDeployment({
    address,
    transactionHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    deployer: account.address,
    constructorArgs: CONSTRUCTOR_ARGS.map(String),
    deployedAt: new Date().toISOString(),
  });

  console.log(`\n✓ ${CONTRACT_NAME} deployed`);
  console.log(`  Address : ${address}`);
  console.log(`  Explorer: ${EXPLORER}/address/${address}`);
  console.log(
    `  Gas used: ${receipt.gasUsed} ` +
      `(${formatEther(receipt.gasUsed * receipt.effectiveGasPrice)} ETH)`,
  );
  console.log(`  Recorded: ${file.replace(`${ROOT}/`, "")}`);
  console.log("\nDone. Run `npm run sweep` to return leftover ETH to the team account.");
}

main().catch(reportFatal);
