const hre = require("hardhat");

async function main() {
  const escrowAddress = process.env.TOOLSHED_ESCROW_ADDRESS;
  const loanId = process.env.SMOKE_LOAN_ID;
  const returnedAt = Number(process.env.SMOKE_RETURNED_AT || Math.floor(Date.now() / 1000));

  if (!hre.ethers.isAddress(escrowAddress || "")) {
    throw new Error("TOOLSHED_ESCROW_ADDRESS must be set");
  }
  if (!loanId) {
    throw new Error("SMOKE_LOAN_ID must be set");
  }

  const escrow = await hre.ethers.getContractAt("ToolshedEscrow", escrowAddress);
  const tx = await escrow.associationSettle(loanId, returnedAt);
  const receipt = await tx.wait();

  console.log(`Settled loan ${loanId}`);
  console.log(`Settlement tx: ${receipt.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
