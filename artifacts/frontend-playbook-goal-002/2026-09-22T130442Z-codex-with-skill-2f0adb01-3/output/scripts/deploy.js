const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const isLocal = network.chainId === 31337n;

  let usdcAddress = process.env.USDC_ADDRESS || BASE_USDC;
  let mockUsdcAddress = null;

  if (isLocal && !process.env.USDC_ADDRESS) {
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    mockUsdcAddress = usdcAddress;

    const seedAmount = hre.ethers.parseUnits("1000", 6);
    const mintTx = await mockUsdc.mint(deployer.address, seedAmount);
    await mintTx.wait();
  }

  const TipJar = await hre.ethers.getContractFactory("UsdcTipJar");
  const tipJar = await TipJar.deploy(usdcAddress, deployer.address);
  await tipJar.waitForDeployment();

  const tipJarAddress = await tipJar.getAddress();
  const tipJarArtifact = await hre.artifacts.readArtifact("UsdcTipJar");
  const usdcArtifact = await hre.artifacts.readArtifact(isLocal ? "MockUSDC" : "MockUSDC");

  const deployed = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    owner: deployer.address,
    baseUsdc: BASE_USDC,
    usdc: usdcAddress,
    mockUsdc: mockUsdcAddress,
    tipJar: tipJarAddress,
    tipJarAbi: tipJarArtifact.abi,
    usdcAbi: usdcArtifact.abi,
  };

  const outPath = path.join(__dirname, "..", "frontend", "src", "deployed.json");
  fs.writeFileSync(outPath, `${JSON.stringify(deployed, null, 2)}\n`);

  console.log(`Network: ${hre.network.name} (${network.chainId})`);
  console.log(`Deployer / owner: ${deployer.address}`);
  console.log(`USDC: ${usdcAddress}${mockUsdcAddress ? " (local mock)" : ""}`);
  console.log(`Tip jar: ${tipJarAddress}`);
  console.log(`Frontend config written to ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
