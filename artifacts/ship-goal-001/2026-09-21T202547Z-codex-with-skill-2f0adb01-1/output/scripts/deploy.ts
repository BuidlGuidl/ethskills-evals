import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const configuredUsdc = process.env.USDC_ADDRESS;

  let usdcAddress = configuredUsdc;
  if (!usdcAddress) {
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mock = await MockUSDC.deploy();
    await mock.waitForDeployment();
    usdcAddress = await mock.getAddress();
    console.log(`MockUSDC deployed to ${usdcAddress}`);
  }

  const ToolshedEscrow = await ethers.getContractFactory("ToolshedEscrow");
  const escrow = await ToolshedEscrow.deploy(usdcAddress, deployer.address);
  await escrow.waitForDeployment();

  console.log(`ToolshedEscrow deployed to ${await escrow.getAddress()}`);
  console.log(`Owner/member admin: ${deployer.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
