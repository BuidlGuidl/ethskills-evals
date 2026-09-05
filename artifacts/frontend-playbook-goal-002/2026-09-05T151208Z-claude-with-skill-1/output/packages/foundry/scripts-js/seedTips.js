/**
 * Drop a few tips into the jar so the feed has something in it on first load.
 *
 * Uses anvil's unlocked dev accounts as tippers, funded with real USDC pulled from an
 * existing Base holder on the fork.
 *
 * Usage:
 *   yarn seed
 */
import {
  RPC_URL,
  assertLocalFork,
  cast,
  deployedAddress,
  formatUsdc,
  fundUsdc,
} from "./forkHelpers.js";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const SEED_TIPS = [
  {
    account: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    amount: "25",
    message: "Loving the Base build logs — keep them coming.",
  },
  {
    account: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    amount: "5",
    message: "Coffee on me ☕",
  },
  {
    account: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    amount: "12.5",
    message: "This saved me an afternoon. Thank you!",
  },
];

try {
  assertLocalFork();
  const tipJar = deployedAddress("TipJar");
  console.log(`🫙 Seeding tips into TipJar at ${tipJar}\n`);

  for (const { account, amount, message } of SEED_TIPS) {
    const units = BigInt(Math.round(Number(amount) * 1e6));

    fundUsdc(account, amount);
    cast([
      "send",
      USDC,
      "approve(address,uint256)",
      tipJar,
      units.toString(),
      "--from",
      account,
      "--unlocked",
      "--rpc-url",
      RPC_URL,
    ]);
    cast([
      "send",
      tipJar,
      "tip(uint256,string)",
      units.toString(),
      message,
      "--from",
      account,
      "--unlocked",
      "--rpc-url",
      RPC_URL,
    ]);

    console.log(
      `  ✅ ${account} tipped ${formatUsdc(units)} USDC — "${message}"`
    );
  }

  const total = cast([
    "call",
    tipJar,
    "totalTipped()(uint256)",
    "--rpc-url",
    RPC_URL,
  ]).split(/\s+/)[0];
  const count = cast([
    "call",
    tipJar,
    "tipCount()(uint256)",
    "--rpc-url",
    RPC_URL,
  ]).split(/\s+/)[0];
  console.log(
    `\n🎉 Jar now holds ${formatUsdc(BigInt(total))} USDC across ${count} tips.`
  );
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
