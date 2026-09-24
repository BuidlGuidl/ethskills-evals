const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const GENERATED_PATH = path.join(__dirname, "..", "src", "generated", "deployment.ts");

async function main() {
  const { ethers, network } = hre;

  if (network.name !== "localhost" && network.name !== "hardhat") {
    throw new Error("This script is for local Hardhat networks only.");
  }

  const [deployer, alice, bob, carla] = await ethers.getSigners();

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();

  const mockRuntimeCode = await ethers.provider.getCode(await mockUSDC.getAddress());
  await ethers.provider.send("hardhat_setCode", [BASE_USDC, mockRuntimeCode]);

  const usdc = await ethers.getContractAt("MockUSDC", BASE_USDC);
  const starterBalance = ethers.parseUnits("1000", 6);

  for (const signer of [deployer, alice, bob, carla]) {
    const tx = await usdc.mint(signer.address, starterBalance);
    await tx.wait();
  }

  const TipJar = await ethers.getContractFactory("TipJar");
  const tipJar = await TipJar.deploy(deployer.address);
  const deploymentReceipt = await tipJar.deploymentTransaction().wait();
  await tipJar.waitForDeployment();

  const tipJarAddress = await tipJar.getAddress();
  const deploymentBlock = deploymentReceipt.blockNumber;
  const seedTips = [
    { signer: alice, amount: "12.50", message: "First round is on Base." },
    { signer: bob, amount: "5", message: "Tiny stablecoin high-five." },
    { signer: carla, amount: "20", message: "For the builder feed." }
  ];

  for (const seed of seedTips) {
    const amount = ethers.parseUnits(seed.amount, 6);
    await (await usdc.connect(seed.signer).approve(tipJarAddress, amount)).wait();
    await (await tipJar.connect(seed.signer).tip(amount, seed.message)).wait();
  }

  fs.mkdirSync(path.dirname(GENERATED_PATH), { recursive: true });
  fs.writeFileSync(
    GENERATED_PATH,
    `export const tipJarAddress = "${tipJarAddress}" as const;\n` +
      `export const baseUsdcAddress = "${BASE_USDC}" as const;\n` +
      `export const localRpcUrl = "http://127.0.0.1:8545" as const;\n` +
      `export const localChainId = 31337;\n` +
      `export const deploymentBlock = ${deploymentBlock}n;\n` +
      `export const isDeploymentConfigured = true;\n`
  );

  console.log(`Mock USDC installed at ${BASE_USDC}`);
  console.log(`TipJar deployed at ${tipJarAddress} in block ${deploymentBlock}`);
  console.log(`Minted 1,000 mock USDC to ${deployer.address}, ${alice.address}, ${bob.address}, ${carla.address}`);
  console.log(`Wrote ${path.relative(process.cwd(), GENERATED_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
