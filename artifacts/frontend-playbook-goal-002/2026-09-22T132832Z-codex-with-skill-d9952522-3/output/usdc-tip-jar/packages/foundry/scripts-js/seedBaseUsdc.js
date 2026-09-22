import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TRANSFER_TOPIC = ethers.utils.id("Transfer(address,address,uint256)");
const USDC_ABI = [
  "event Transfer(address indexed from,address indexed to,uint256 value)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to,uint256 amount) returns (bool)",
];

const [, , recipientArg, amountArg, holderArg] = process.argv;
const recipient = recipientArg || "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const amount = ethers.utils.parseUnits(amountArg || "1000", 6);

if (!ethers.utils.isAddress(recipient)) {
  throw new Error(`Invalid recipient address: ${recipient}`);
}

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
const scanBlocks = Number(process.env.SCAN_BLOCKS || "10000");
const batchSize = Number(process.env.LOG_BATCH || "25");

async function findHolder() {
  if (holderArg) {
    if (!ethers.utils.isAddress(holderArg)) {
      throw new Error(`Invalid holder address: ${holderArg}`);
    }
    return holderArg;
  }

  const latestBlock = await provider.getBlockNumber();
  const seen = new Set();

  for (
    let toBlock = latestBlock;
    toBlock > Math.max(latestBlock - scanBlocks, 0);
    toBlock -= batchSize
  ) {
    const fromBlock = Math.max(toBlock - batchSize + 1, 0);
    let logs = [];

    try {
      logs = await provider.getLogs({
        address: USDC_ADDRESS,
        fromBlock,
        toBlock,
        topics: [TRANSFER_TOPIC],
      });
    } catch (error) {
      console.warn(
        `Skipping blocks ${fromBlock}-${toBlock}: ${
          error.reason || error.message
        }`
      );
      continue;
    }

    for (let index = logs.length - 1; index >= 0; index--) {
      const parsed = usdc.interface.parseLog(logs[index]);
      const from = parsed.args.from;

      if (
        from === ethers.constants.AddressZero ||
        seen.has(from.toLowerCase())
      ) {
        continue;
      }

      seen.add(from.toLowerCase());
      const balance = await usdc.balanceOf(from);
      if (balance.gte(amount)) {
        return from;
      }
    }
  }

  throw new Error(
    "Could not find a recent USDC holder with enough balance. Pass one as the third argument."
  );
}

async function main() {
  const holder = await findHolder();
  const before = await usdc.balanceOf(recipient);

  await provider.send("anvil_impersonateAccount", [holder]);
  await provider.send("anvil_setBalance", [holder, "0x8ac7230489e80000"]);

  const signer = provider.getSigner(holder);
  const tx = await usdc.connect(signer).transfer(recipient, amount);
  await tx.wait();
  await provider.send("anvil_stopImpersonatingAccount", [holder]);

  const after = await usdc.balanceOf(recipient);
  console.log(
    `Seeded ${ethers.utils.formatUnits(amount, 6)} USDC to ${recipient}`
  );
  console.log(`Holder: ${holder}`);
  console.log(
    `Recipient balance: ${ethers.utils.formatUnits(
      before,
      6
    )} -> ${ethers.utils.formatUnits(after, 6)} USDC`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
