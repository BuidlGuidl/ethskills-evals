const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
  const [deployer, demoTipper] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  let usdcAddress = BASE_USDC;
  let mockUsdcAddress = null;

  if (chainId === 31337) {
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    mockUsdcAddress = await mockUsdc.getAddress();
    usdcAddress = mockUsdcAddress;

    const seedAmount = hre.ethers.parseUnits("2500", 6);
    await (await mockUsdc.mint(deployer.address, seedAmount)).wait();
    await (await mockUsdc.mint(demoTipper.address, seedAmount)).wait();
  }

  const TipJar = await hre.ethers.getContractFactory("TipJar");
  const tipJar = await TipJar.deploy(usdcAddress, deployer.address);
  await tipJar.waitForDeployment();

  const deployment = {
    network: hre.network.name,
    chainId,
    baseUsdc: BASE_USDC,
    usdc: usdcAddress,
    mockUsdc: mockUsdcAddress,
    tipJar: await tipJar.getAddress(),
    owner: deployer.address,
    deployedAt: new Date().toISOString()
  };

  const outputDir = path.join(__dirname, "..", "src", "deployments");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "localhost.json"),
    `${JSON.stringify(deployment, null, 2)}\n`
  );

  console.log("TipJar deployed");
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
