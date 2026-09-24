const hre = require("hardhat");

const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const usdcAddress = process.env.USDC_ADDRESS || BASE_SEPOLIA_USDC;
  const associationOwner = process.env.ASSOCIATION_MULTISIG || deployer.address;

  if (!hre.ethers.isAddress(usdcAddress)) {
    throw new Error("USDC_ADDRESS must be a valid address");
  }
  if (!hre.ethers.isAddress(associationOwner)) {
    throw new Error("ASSOCIATION_MULTISIG must be a valid address");
  }

  console.log(`Deploying ToolshedEscrow from ${deployer.address}`);
  console.log(`USDC: ${usdcAddress}`);
  console.log(`Association owner: ${associationOwner}`);

  const ToolshedEscrow = await hre.ethers.getContractFactory("ToolshedEscrow");
  const escrow = await ToolshedEscrow.deploy(usdcAddress, associationOwner);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log(`ToolshedEscrow deployed to ${address}`);

  if (hre.network.name !== "hardhat" && process.env.BASESCAN_API_KEY) {
    console.log("Waiting before verification...");
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    await hre.run("verify:verify", {
      address,
      constructorArguments: [usdcAddress, associationOwner]
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
