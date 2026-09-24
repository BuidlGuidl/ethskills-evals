import fs from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";

const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const STARTING_USDC = ethers.parseUnits("10000", 6);

async function main() {
  const [deployer, secondAccount] = await ethers.getSigners();

  if (network.name !== "localhost" && network.name !== "hardhat") {
    throw new Error("This script is only intended for the local Hardhat network.");
  }

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockImplementation = await MockUSDC.deploy();
  await mockImplementation.waitForDeployment();
  const mockRuntimeBytecode = await ethers.provider.getCode(await mockImplementation.getAddress());

  await network.provider.send("hardhat_setCode", [BASE_USDC_ADDRESS, mockRuntimeBytecode]);
  const mockUsdc = MockUSDC.attach(BASE_USDC_ADDRESS) as any;
  await (await mockUsdc.mint(deployer.address, STARTING_USDC)).wait();
  await (await mockUsdc.mint(secondAccount.address, STARTING_USDC)).wait();

  const USDCTipJar = await ethers.getContractFactory("USDCTipJar");
  const tipJar = await USDCTipJar.deploy(BASE_USDC_ADDRESS, deployer.address);
  await tipJar.waitForDeployment();

  const deployment = {
    chainId: 31337,
    usdc: BASE_USDC_ADDRESS,
    tipJar: await tipJar.getAddress(),
    recipient: deployer.address,
    seededAccounts: [deployer.address, secondAccount.address]
  };

  const outputDir = path.join(process.cwd(), "src", "deployments");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "localhost.json"), `${JSON.stringify(deployment, null, 2)}\n`);

  console.log("Local USDC installed at:", deployment.usdc);
  console.log("Tip jar deployed at:", deployment.tipJar);
  console.log("Recipient:", deployment.recipient);
  console.log("Seeded accounts:", deployment.seededAccounts.join(", "));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
