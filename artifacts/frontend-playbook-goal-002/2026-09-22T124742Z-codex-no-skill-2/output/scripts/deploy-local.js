const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const LOCAL_USDC_GRANT = hre.ethers.parseUnits("1000", 6);

async function ensureLocalUsdc(signers) {
  const provider = hre.ethers.provider;
  const existingCode = await provider.getCode(BASE_USDC);
  let installedMock = false;

  if (existingCode === "0x") {
    const artifact = await hre.artifacts.readArtifact("MockUSDC");
    await hre.network.provider.send("hardhat_setCode", [BASE_USDC, artifact.deployedBytecode]);
    installedMock = true;
  }

  const usdc = await hre.ethers.getContractAt("MockUSDC", BASE_USDC);

  try {
    if (!(await usdc.initialized())) {
      await (await usdc.initialize(signers[0].address)).wait();
    }

    const owner = await usdc.owner();
    if (owner.toLowerCase() === signers[0].address.toLowerCase()) {
      for (const signer of signers.slice(0, 5)) {
        const balance = await usdc.balanceOf(signer.address);
        if (balance < LOCAL_USDC_GRANT) {
          await (await usdc.mint(signer.address, LOCAL_USDC_GRANT - balance)).wait();
        }
      }
    }

    return { usdc, mocked: true, installedMock };
  } catch {
    return { usdc, mocked: false, installedMock };
  }
}

function writeFrontendContractConfig(tipJar, chainId) {
  const artifact = hre.artifacts.readArtifactSync("TipJar");
  const outDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(outDir, "tipJar.json"),
    JSON.stringify(
      {
        address: tipJar.target,
        abi: artifact.abi,
        usdc: BASE_USDC,
        chainId: Number(chainId)
      },
      null,
      2
    ) + "\n"
  );
}

async function main() {
  const [deployer, beneficiary, ...rest] = await hre.ethers.getSigners();
  const signers = [deployer, beneficiary, ...rest];
  const network = await hre.ethers.provider.getNetwork();
  const { mocked, installedMock } = await ensureLocalUsdc(signers);

  const TipJar = await hre.ethers.getContractFactory("TipJar");
  const tipJar = await TipJar.deploy(beneficiary.address);
  await tipJar.waitForDeployment();

  writeFrontendContractConfig(tipJar, network.chainId);

  console.log("TipJar deployed to:", tipJar.target);
  console.log("Beneficiary:", beneficiary.address);
  console.log(
    "USDC:",
    BASE_USDC,
    mocked ? (installedMock ? "(local mock installed)" : "(local mock ready)") : "(existing contract)"
  );
  console.log("Frontend config:", "frontend/src/contracts/tipJar.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
