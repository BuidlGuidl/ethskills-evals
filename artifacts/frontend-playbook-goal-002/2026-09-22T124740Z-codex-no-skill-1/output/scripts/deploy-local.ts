import fs from "node:fs";
import path from "node:path";
import { artifacts, ethers, network } from "hardhat";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
  const [deployer] = await ethers.getSigners();

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUsdc = await MockUSDC.deploy();
  await mockUsdc.waitForDeployment();

  const USDCTipJar = await ethers.getContractFactory("USDCTipJar");
  const tipJar = await USDCTipJar.deploy(
    await mockUsdc.getAddress(),
    deployer.address,
    deployer.address,
  );
  await tipJar.waitForDeployment();

  await mockUsdc.mint(deployer.address, ethers.parseUnits("10000", 6));

  const tipJarArtifact = await artifacts.readArtifact("USDCTipJar");
  const mockUsdcArtifact = await artifacts.readArtifact("MockUSDC");

  const deployment = {
    chainId: network.config.chainId ?? 31337,
    chainName: "Hardhat Local",
    baseUsdc: BASE_USDC,
    tipJar: await tipJar.getAddress(),
    usdc: await mockUsdc.getAddress(),
    owner: deployer.address,
    beneficiary: deployer.address,
    deployedAt: new Date().toISOString(),
    tipJarAbi: tipJarArtifact.abi,
    mockUsdcAbi: mockUsdcArtifact.abi,
  };

  const outDir = path.resolve("frontend/src/deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "local.json"),
    `${JSON.stringify(deployment, null, 2)}\n`,
  );

  console.log("Local tip jar deployed");
  console.log(`  Mock USDC: ${deployment.usdc}`);
  console.log(`  Tip jar:   ${deployment.tipJar}`);
  console.log("  Wrote frontend/src/deployments/local.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
