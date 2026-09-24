/**
 * Fills a freshly deployed local shed with neighbors, tools and a few loans, so the app has
 * something to show on the first run: an available tool, a tool that is out and overdue, a pending
 * request, and one member with a clean track record to rank against.
 *
 * Local Anvil only — it moves the chain's clock with `evm_increaseTime` and signs with Anvil's
 * well-known development keys, which are public and hold no real value.
 *
 *   yarn chain        # terminal 1
 *   yarn deploy       # terminal 2
 *   yarn seed         # terminal 2
 *
 * Listings use `data:` metadata URIs, so seeding needs no pinning service and no network access.
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Contract, Wallet, providers, utils } from "ethers";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const LOCAL_CHAIN_ID = 31337;
const HERE = dirname(fileURLToPath(import.meta.url));

// Anvil's default accounts. Public knowledge, worthless outside a local chain — import one into
// your wallet to click around the app as that neighbor.
const ACCOUNTS = {
  ana: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // lends the drill + ladder
  ben: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // borrows, runs late
  chi: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // borrows, returns on time
  dee: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // lends the steamer + cutter
};

const TOOLS = [
  {
    owner: "ana",
    name: "Cordless hammer drill",
    description: "18V, two batteries and a charger in a hard case.",
    condition: "Chuck sticks a little. The second battery holds about half a charge.",
    deposit: "60",
    dailyLateFee: "2",
    maxDurationDays: 7,
  },
  {
    owner: "ana",
    name: "3m aluminium ladder",
    description: "Folds flat, fits in a hatchback.",
    condition: "Left foot pad lost its rubber. Fine on grass, slides on tile.",
    deposit: "40",
    dailyLateFee: "1",
    maxDurationDays: 14,
  },
  {
    owner: "dee",
    name: "Wallpaper steamer",
    description: "Strips a normal room in about an hour.",
    condition: "Tank seal replaced last spring. Works perfectly.",
    deposit: "25",
    dailyLateFee: "1.50",
    maxDurationDays: 3,
  },
  {
    owner: "dee",
    name: "Manual tile cutter",
    description: "Score-and-snap, up to 60cm.",
    condition: "Blade is getting blunt — go slow on porcelain.",
    deposit: "35",
    dailyLateFee: "2",
    maxDurationDays: 5,
  },
];

const usdc = amount => utils.parseUnits(amount, 6);

const metadataUri = tool =>
  `data:application/json,${encodeURIComponent(
    JSON.stringify({ name: tool.name, description: tool.description, condition: tool.condition }),
  )}`;

const loadDeployment = () => {
  const path = join(HERE, "..", "deployments", `${LOCAL_CHAIN_ID}.json`);
  let file;
  try {
    file = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`No local deployment found at ${path}. Run \`yarn deploy\` first.`);
  }
  const addresses = {};
  for (const [address, name] of Object.entries(file)) {
    if (address.startsWith("0x")) addresses[name] = address;
  }
  if (!addresses.Toolshed || !addresses.MockUSDC) {
    throw new Error("Local deployment is missing Toolshed or MockUSDC. Run `yarn deploy` again.");
  }
  return addresses;
};

const loadAbi = name => {
  const artifact = JSON.parse(readFileSync(join(HERE, "..", "out", `${name}.sol`, `${name}.json`), "utf8"));
  return artifact.abi;
};

const main = async () => {
  const provider = new providers.JsonRpcProvider(RPC_URL);
  const network = await provider.getNetwork().catch(() => {
    throw new Error(`No chain at ${RPC_URL}. Run \`yarn chain\` first.`);
  });
  if (network.chainId !== LOCAL_CHAIN_ID) {
    throw new Error(`Refusing to seed chain ${network.chainId}; this script is for local Anvil only.`);
  }

  const { Toolshed: shedAddress, MockUSDC: usdcAddress } = loadDeployment();
  const shedAbi = loadAbi("Toolshed");
  const usdcAbi = loadAbi("MockUSDC");

  const wallets = Object.fromEntries(
    Object.entries(ACCOUNTS).map(([name, key]) => [name, new Wallet(key, provider)]),
  );
  const shedAs = who => new Contract(shedAddress, shedAbi, wallets[who]);
  const usdcAs = who => new Contract(usdcAddress, usdcAbi, wallets[who]);

  // The deployer holds STEWARD_ROLE (see DeployToolshed): Anvil account #9 by default.
  const stewardKey = process.env.STEWARD_PRIVATE_KEY || "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6";
  const steward = new Wallet(stewardKey, provider);
  const shedAsSteward = new Contract(shedAddress, shedAbi, steward);

  const roll = Object.values(wallets).map(wallet => wallet.address);
  console.log("Adding 4 neighbors to the roll…");
  await (await shedAsSteward.addMembers(roll)).wait();

  console.log("Handing out test USDC…");
  for (const wallet of Object.values(wallets)) {
    await (await usdcAs("ana").faucet(wallet.address, usdc("2000"))).wait();
  }

  const toolIds = {};
  for (const tool of TOOLS) {
    const receipt = await (
      await shedAs(tool.owner).listTool(
        metadataUri(tool),
        usdc(tool.deposit),
        usdc(tool.dailyLateFee),
        tool.maxDurationDays,
      )
    ).wait();
    const listed = receipt.events.find(event => event.event === "ToolListed");
    toolIds[tool.name] = listed.args.toolId;
    console.log(`Listed "${tool.name}" as #${listed.args.toolId} (deposit $${tool.deposit})`);
  }

  const borrow = async (who, toolId, days) => {
    const deposit = (await shedAs(who).getTool(toolId)).deposit;
    await (await usdcAs(who).approve(shedAddress, deposit)).wait();
    const receipt = await (await shedAs(who).requestLoan(toolId, days)).wait();
    return receipt.events.find(event => event.event === "LoanRequested").args.loanId;
  };

  const skipDays = async days => {
    await provider.send("evm_increaseTime", [days * 24 * 60 * 60]);
    await provider.send("evm_mine", []);
  };

  const drill = toolIds["Cordless hammer drill"];
  const ladder = toolIds["3m aluminium ladder"];

  console.log("Chi borrows the drill for 3 days and brings it back on time…");
  const cleanLoan = await borrow("chi", drill, 3);
  await (await shedAs("ana").approveLoan(cleanLoan)).wait();
  await skipDays(2);
  await (await shedAs("ana").confirmReturn(cleanLoan)).wait();

  console.log("Ben borrows the ladder for 2 days, then the clock jumps past the due date…");
  const lateLoan = await borrow("ben", ladder, 2);
  await (await shedAs("ana").approveLoan(lateLoan)).wait();
  await skipDays(6);

  console.log("Ben asks for the drill as well, so Ana has a request waiting…");
  await borrow("ben", drill, 5);

  console.log("\nSeeded. Open http://localhost:3000 and import one of these Anvil keys:");
  for (const [name, wallet] of Object.entries(wallets)) {
    console.log(`  ${name.padEnd(4)} ${wallet.address}`);
  }
  console.log(`  steward ${steward.address} (member roll + disputes)`);
};

main().catch(error => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
