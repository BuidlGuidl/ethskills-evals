import { execFileSync } from "child_process";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DEFAULT_RECIPIENT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const DEFAULT_AMOUNT = "1000";
const FALLBACK_HOLDERS = [
  "0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59",
  "0x6ea77f83ec8693666866ece250411c974ab962a8",
];

const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
const recipient = process.argv[2] || DEFAULT_RECIPIENT;
const amount = parseUsdc(process.argv[3] || DEFAULT_AMOUNT);

function run(args) {
  return execFileSync(args[0], args.slice(1), {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
}

function parseUsdc(value) {
  const [whole, fraction = ""] = value.split(".");
  const paddedFraction = `${fraction}000000`.slice(0, 6);
  return BigInt(whole || "0") * 1_000_000n + BigInt(paddedFraction);
}

function topicToAddress(topic) {
  return `0x${topic.slice(-40)}`;
}

function tokenBalance(holder) {
  const output = run([
    "cast",
    "call",
    "--rpc-url",
    rpcUrl,
    USDC,
    "balanceOf(address)(uint256)",
    holder,
  ]);

  return BigInt(output.split(/\s+/)[0]);
}

function discoverHolders() {
  const latest = Number(run(["cast", "block-number", "--rpc-url", rpcUrl]));
  const fromBlock = Math.max(0, latest - 25);
  const output = run([
    "cast",
    "logs",
    "--json",
    "--rpc-url",
    rpcUrl,
    "--from-block",
    String(fromBlock),
    "--to-block",
    "latest",
    "--address",
    USDC,
    "Transfer(address,address,uint256)",
  ]);
  const logs = JSON.parse(output || "[]");
  const candidates = new Set();

  for (const log of logs.reverse()) {
    if (log.topics?.[1]) candidates.add(topicToAddress(log.topics[1]));
    if (log.topics?.[2]) candidates.add(topicToAddress(log.topics[2]));
  }

  candidates.delete("0x0000000000000000000000000000000000000000");
  candidates.delete(recipient.toLowerCase());
  return [...candidates];
}

function findHolder() {
  for (const holder of FALLBACK_HOLDERS) {
    try {
      if (tokenBalance(holder) >= amount) {
        return holder;
      }
    } catch {
      // Fall through to event-based discovery.
    }
  }

  for (const holder of discoverHolders()) {
    try {
      if (tokenBalance(holder) >= amount) {
        return holder;
      }
    } catch {
      // Some candidate addresses can fail balance checks on flaky RPC responses.
    }
  }

  throw new Error(
    `Could not find a Base USDC holder with at least ${amount} units`
  );
}

const holder = findHolder();

run(["cast", "rpc", "--rpc-url", rpcUrl, "anvil_impersonateAccount", holder]);
run([
  "cast",
  "rpc",
  "--rpc-url",
  rpcUrl,
  "anvil_setBalance",
  holder,
  "0x3635c9adc5dea00000",
]);
run([
  "cast",
  "send",
  "--rpc-url",
  rpcUrl,
  "--unlocked",
  "--from",
  holder,
  USDC,
  "transfer(address,uint256)",
  recipient,
  amount.toString(),
]);
run([
  "cast",
  "rpc",
  "--rpc-url",
  rpcUrl,
  "anvil_stopImpersonatingAccount",
  holder,
]);

console.log(
  `Funded ${recipient} with ${amount / 1_000_000n} USDC on the local Base fork`
);
