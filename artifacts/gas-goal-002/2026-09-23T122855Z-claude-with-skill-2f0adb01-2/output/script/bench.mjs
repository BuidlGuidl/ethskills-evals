// Measures real per-transfer gas for a relayer on Base.
//
// Execution gas is measured by sending real transactions against an anvil fork
// of Base (live USDC, live state). L1 data fee is measured by asking Base's own
// GasPriceOracle predeploy to price each serialised transaction.
//
//   anvil --fork-url https://mainnet.base.org --port 8545 --silent &
//   node script/bench.mjs
//
// Writes script/bench-results.json.

import { readFileSync, writeFileSync } from "node:fs";
import {
  createWalletClient, createPublicClient, http, encodeFunctionData,
  parseAbi, serializeTransaction, keccak256, toHex, getAddress,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const FORK = process.env.FORK_RPC_URL ?? "http://127.0.0.1:8545";
const LIVE = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const GAS_ORACLE = "0x420000000000000000000000000000000000000F";
// A large live USDC holder on Base, impersonated as our stand-in relayer.
const WHALE = "0xcDAC0d6c6C59727a65F871236188350531885C43";
const AMOUNT = 1_000_000n; // 1 USDC

const erc20 = parseAbi([
  "function transfer(address,uint256) returns (bool)",
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);
const oracleAbi = parseAbi([
  "function getL1Fee(bytes) view returns (uint256)",
  "function l1BaseFee() view returns (uint256)",
  "function blobBaseFee() view returns (uint256)",
]);
const artifact = JSON.parse(readFileSync(new URL("./BatchTransfer.artifact.json", import.meta.url)));

const httpOpts = { timeout: 300_000, retryCount: 2 };
const fork = createPublicClient({ transport: http(FORK, httpOpts) });
const live = createPublicClient({ chain: base, transport: http(LIVE, httpOpts) });
const wallet = createWalletClient({ chain: base, transport: http(FORK, httpOpts) });

const rpc = (method, params = []) => fork.request({ method, params });

// Pseudorandom addresses, so calldata has a realistic mix of non-zero bytes
// (16 gas) and zero bytes (4 gas). Sequential addresses would be almost all
// zeroes and would understate calldata cost badly.
let recipientSalt = 0;
const freshRecipients = (n) =>
  Array.from({ length: n }, () =>
    getAddress("0x" + keccak256(toHex(++recipientSalt, { size: 32 })).slice(26)),
  );

async function sendFrom(from, to, data) {
  const hash = await wallet.sendTransaction({ account: from, to, data, chain: null });
  const r = await fork.waitForTransactionReceipt({ hash, timeout: 300_000 });
  if (r.status !== "success") throw new Error(`tx reverted: ${hash}`);
  return { gasUsed: r.gasUsed, data };
}

/// What the L1 data fee would be for this calldata, priced by Base's own
/// GasPriceOracle predeploy. We read it through the fork (same state, no public
/// rate limit) and wrap the calldata in a realistic signed EIP-1559 envelope
/// first, because the oracle prices the whole serialised transaction.
const dummy = privateKeyToAccount("0x" + "11".repeat(32));
async function l1Fee(to, data) {
  const tx = {
    chainId: 8453, type: "eip1559", nonce: 1_000_000, to, value: 0n, data,
    gas: 30_000_000n, maxFeePerGas: 10_000_000n, maxPriorityFeePerGas: 1_000_000n,
  };
  const signature = await dummy.sign({ hash: "0x" + "22".repeat(32) });
  const raw = serializeTransaction(tx, {
    r: `0x${signature.slice(2, 66)}`, s: `0x${signature.slice(66, 130)}`, v: 27n,
  });
  return fork.readContract({ address: GAS_ORACLE, abi: oracleAbi, functionName: "getL1Fee", args: [raw] });
}

async function main() {
  const chainId = await fork.getChainId();
  if (chainId !== 8453) throw new Error(`fork is chain ${chainId}, expected Base (8453)`);

  await rpc("anvil_impersonateAccount", [WHALE]);
  await rpc("anvil_setBalance", [WHALE, "0xde0b6b3a7640000"]);
  const bal = await fork.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [WHALE] });
  console.log(`relayer (impersonated) USDC balance: ${Number(bal) / 1e6}`);

  const results = { measuredAt: new Date().toISOString(), block: Number(await fork.getBlockNumber()) };

  // ---- baseline: one ERC-20 transfer per transaction -----------------------
  {
    const samples = [];
    for (const to of freshRecipients(15)) {
      const data = encodeFunctionData({ abi: erc20, functionName: "transfer", args: [to, AMOUNT] });
      const { gasUsed } = await sendFrom(WHALE, USDC, data);
      samples.push({ gasUsed, l1: await l1Fee(USDC, data) });
    }
    const med = (a) => a.slice().sort((x, y) => (x < y ? -1 : 1))[Math.floor(a.length / 2)];
    results.baseline = {
      l2GasPerTransfer: Number(med(samples.map((s) => s.gasUsed))),
      l1FeeWeiPerTransfer: Number(med(samples.map((s) => s.l1))),
    };
    console.log("baseline (1 transfer / tx):", results.baseline);
  }

  // ---- batched -------------------------------------------------------------
  const batcher = await deployBatcher();
  console.log("BatchTransfer deployed at", batcher);
  await sendFrom(WHALE, USDC, encodeFunctionData({
    abi: erc20, functionName: "approve", args: [batcher, (1n << 256n) - 1n],
  }));

  results.batched = [];
  for (const n of [1, 10, 25, 50, 100, 200]) {
    const row = { n };
    for (const [key, fn] of [["disperse", disperseData], ["dispersePacked", packedData]]) {
      const data = fn(freshRecipients(n));
      const { gasUsed } = await sendFrom(WHALE, batcher, data);
      row[key] = {
        totalL2Gas: Number(gasUsed),
        l2GasPerTransfer: Number(gasUsed) / n,
        calldataBytes: (data.length - 2) / 2,
        l1FeeWeiPerTransfer: Number(await l1Fee(batcher, data)) / n,
      };
    }
    results.batched.push(row);
    console.log(`n=${n}`, JSON.stringify(row));
  }

  // ---- warm recipients (already hold the token) ---------------------------
  {
    const rs = freshRecipients(100);
    await sendFrom(WHALE, batcher, disperseData(rs)); // seed
    const data = disperseData(rs);
    const { gasUsed } = await sendFrom(WHALE, batcher, data);
    results.warmRecipients100 = {
      l2GasPerTransfer: Number(gasUsed) / 100,
      l1FeeWeiPerTransfer: Number(await l1Fee(batcher, data)) / 100,
    };
    console.log("warm recipients, n=100:", results.warmRecipients100);
  }

  // ---- live network conditions --------------------------------------------
  const l2BaseFee = await live.getBlock().then((b) => b.baseFeePerGas);
  const l1BaseFee = await fork.readContract({ address: GAS_ORACLE, abi: oracleAbi, functionName: "l1BaseFee" });
  const blobBaseFee = await fork.readContract({ address: GAS_ORACLE, abi: oracleAbi, functionName: "blobBaseFee" });
  results.network = {
    l2BaseFeeWei: Number(l2BaseFee),
    l1BaseFeeWei: Number(l1BaseFee),
    blobBaseFeeWei: Number(blobBaseFee),
  };
  console.log("network:", results.network);

  writeFileSync(new URL("./bench-results.json", import.meta.url), JSON.stringify(results, null, 2));
  console.log("\nwrote script/bench-results.json");

  function disperseData(rs) {
    return encodeFunctionData({
      abi: artifact.abi, functionName: "disperse",
      args: [USDC, rs, rs.map(() => AMOUNT)],
    });
  }
  function packedData(rs) {
    return encodeFunctionData({
      abi: artifact.abi, functionName: "dispersePacked",
      args: [USDC, rs.map((r) => (BigInt(r) << 96n) | AMOUNT)],
    });
  }
  async function deployBatcher() {
    const hash = await wallet.deployContract({
      abi: artifact.abi, bytecode: artifact.bytecode, args: [WHALE], account: WHALE, chain: null,
    });
    return (await fork.waitForTransactionReceipt({ hash })).contractAddress;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
