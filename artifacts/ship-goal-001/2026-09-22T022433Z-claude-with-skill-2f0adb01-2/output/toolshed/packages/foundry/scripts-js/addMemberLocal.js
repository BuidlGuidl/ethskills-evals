/**
 * Adds an address to the local shed's member roll and hands it test USDC and ETH — the quickest way
 * to click around as a fresh neighbor (for example the burner wallet the app spins up on localhost).
 *
 *   yarn member 0xYourAddress
 *
 * Local Anvil only. On a real deployment the steward does this from the /steward screen.
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Contract, Wallet, providers, utils } from "ethers";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const LOCAL_CHAIN_ID = 31337;
const HERE = dirname(fileURLToPath(import.meta.url));

// Anvil account #9 — the default deployer, and therefore the steward. Public test key.
const STEWARD_KEY = process.env.STEWARD_PRIVATE_KEY || "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6";

const main = async () => {
  const member = process.argv[2];
  if (!member || !utils.isAddress(member)) {
    throw new Error("Usage: yarn member <address>");
  }

  const provider = new providers.JsonRpcProvider(RPC_URL);
  const { chainId } = await provider.getNetwork().catch(() => {
    throw new Error(`No chain at ${RPC_URL}. Run \`yarn chain\` first.`);
  });
  if (chainId !== LOCAL_CHAIN_ID) throw new Error(`Refusing to touch chain ${chainId}; local Anvil only.`);

  const deployments = JSON.parse(readFileSync(join(HERE, "..", "deployments", "31337.json"), "utf8"));
  const addresses = Object.fromEntries(
    Object.entries(deployments)
      .filter(([key]) => key.startsWith("0x"))
      .map(([address, name]) => [name, address]),
  );
  const abiOf = name =>
    JSON.parse(readFileSync(join(HERE, "..", "out", `${name}.sol`, `${name}.json`), "utf8")).abi;

  const steward = new Wallet(STEWARD_KEY, provider);
  const shed = new Contract(addresses.Toolshed, abiOf("Toolshed"), steward);
  const usdc = new Contract(addresses.MockUSDC, abiOf("MockUSDC"), steward);

  await (await shed.addMembers([member])).wait();
  await (await usdc.faucet(member, utils.parseUnits("2000", 6))).wait();

  // Plain transfer rather than anvil_setBalance: works on any local node, including the
  // Hardhat-style ones some setups leave running on 8545.
  if ((await provider.getBalance(member)).lt(utils.parseEther("1"))) {
    await (await steward.sendTransaction({ to: member, value: utils.parseEther("5") })).wait();
  }

  console.log(`${member} is on the roll, holding $2,000 test USDC and gas money.`);
};

main().catch(error => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
