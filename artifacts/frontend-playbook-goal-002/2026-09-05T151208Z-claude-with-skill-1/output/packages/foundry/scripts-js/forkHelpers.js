import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

/** Circle's native USDC. Same address on Base and on a Base fork. */
export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/**
 * Aave's aBasUSDC reserve, which holds tens of millions of USDC on Base.
 * Impersonating an existing holder beats deploying a mock: the app then meets the same
 * token contract locally that it will meet on Base.
 */
export const USDC_WHALE = "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB";

export const ONE_ETH_HEX = "0xde0b6b3a7640000";

export const cast = (args) =>
  execFileSync("cast", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

export const rpc = (method, params = []) =>
  cast(["rpc", "--rpc-url", RPC_URL, method, ...params.map(String)]);

/** Refuse to run against anything that is not a local anvil node. */
export function assertLocalFork() {
  let chainId;
  try {
    chainId = cast(["chain-id", "--rpc-url", RPC_URL]);
  } catch {
    throw new Error(
      `No node answering at ${RPC_URL}. Start one with \`yarn fork --network base\` (or set RPC_URL).`
    );
  }

  if (chainId !== "31337") {
    throw new Error(
      `Refusing to run: ${RPC_URL} reports chain id ${chainId}, not a local anvil fork (31337).`
    );
  }

  if (cast(["code", USDC, "--rpc-url", RPC_URL]) === "0x") {
    throw new Error(
      `No USDC at ${USDC} on ${RPC_URL}. This needs a Base fork (\`yarn fork --network base\`), not a bare \`yarn chain\`.`
    );
  }
}

/** Address of a contract deployed by the last `yarn deploy` run against chain 31337. */
export function deployedAddress(contractName) {
  const broadcast = join(
    __dirname,
    "..",
    "broadcast",
    "Deploy.s.sol",
    "31337",
    "run-latest.json"
  );
  if (!existsSync(broadcast)) {
    throw new Error(
      "No deployment found for chain 31337. Run `yarn deploy` first."
    );
  }

  const { transactions = [] } = JSON.parse(readFileSync(broadcast, "utf8"));
  const creation = transactions.find(
    (tx) => tx.transactionType === "CREATE" && tx.contractName === contractName
  );

  if (!creation?.contractAddress) {
    throw new Error(
      `No ${contractName} deployment found in the latest broadcast. Run \`yarn deploy\` first.`
    );
  }

  return creation.contractAddress;
}

/** Make sure `account` can pay for gas without disturbing a balance it already has. */
export function ensureGas(account) {
  const balance = cast(["balance", account, "--rpc-url", RPC_URL]);
  if (BigInt(balance) === 0n) {
    rpc("anvil_setBalance", [account, ONE_ETH_HEX]);
  }
}

/** Move USDC from the whale to `recipient`. `amount` is in whole USDC. */
export function fundUsdc(recipient, amount) {
  const units = BigInt(Math.round(Number(amount) * 1e6));
  if (units <= 0n) throw new Error(`Invalid amount: ${amount}`);

  const whaleBalance = BigInt(
    cast([
      "call",
      USDC,
      "balanceOf(address)(uint256)",
      USDC_WHALE,
      "--rpc-url",
      RPC_URL,
    ]).split(/\s+/)[0]
  );
  if (whaleBalance < units) {
    throw new Error(
      `Whale ${USDC_WHALE} only holds ${whaleBalance} USDC units, need ${units}.`
    );
  }

  ensureGas(USDC_WHALE);
  rpc("anvil_impersonateAccount", [USDC_WHALE]);
  try {
    cast([
      "send",
      USDC,
      "transfer(address,uint256)",
      recipient,
      units.toString(),
      "--from",
      USDC_WHALE,
      "--unlocked",
      "--rpc-url",
      RPC_URL,
    ]);
  } finally {
    rpc("anvil_stopImpersonatingAccount", [USDC_WHALE]);
  }

  ensureGas(recipient);
  return units;
}

export function usdcBalance(account) {
  return BigInt(
    cast([
      "call",
      USDC,
      "balanceOf(address)(uint256)",
      account,
      "--rpc-url",
      RPC_URL,
    ]).split(/\s+/)[0]
  );
}

export const formatUsdc = (units) =>
  (Number(units) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2 });
