const hre = require("hardhat");

async function main() {
  const [borrower] = await hre.ethers.getSigners();
  const escrowAddress = process.env.TOOLSHED_ESCROW_ADDRESS;
  const usdcAddress = process.env.USDC_ADDRESS;
  const toolOwner = process.env.SMOKE_TOOL_OWNER;
  const deposit = hre.ethers.parseUnits(process.env.SMOKE_DEPOSIT_USDC || "1", 6);
  const dailyLateFee = hre.ethers.parseUnits(process.env.SMOKE_DAILY_LATE_FEE_USDC || "0.10", 6);
  const dueAt = Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60;

  if (!hre.ethers.isAddress(escrowAddress || "")) {
    throw new Error("TOOLSHED_ESCROW_ADDRESS must be set");
  }
  if (!hre.ethers.isAddress(usdcAddress || "")) {
    throw new Error("USDC_ADDRESS must be set");
  }
  if (!hre.ethers.isAddress(toolOwner || "")) {
    throw new Error("SMOKE_TOOL_OWNER must be set");
  }
  if (toolOwner.toLowerCase() === borrower.address.toLowerCase()) {
    throw new Error("SMOKE_TOOL_OWNER must differ from the deployer/borrower");
  }

  const token = await hre.ethers.getContractAt("IERC20", usdcAddress);
  const escrow = await hre.ethers.getContractAt("ToolshedEscrow", escrowAddress);

  console.log(`Approving ${hre.ethers.formatUnits(deposit, 6)} USDC from ${borrower.address}`);
  const approval = await token.approve(escrowAddress, deposit);
  await approval.wait();
  console.log(`Approval tx: ${approval.hash}`);

  const toolId = hre.ethers.id(`smoke-${Date.now()}`);
  const tx = await escrow.openLoan(toolId, toolOwner, dueAt, deposit, dailyLateFee);
  const receipt = await tx.wait();
  const event = receipt.logs
    .map((log) => {
      try {
        return escrow.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed?.name === "LoanOpened");

  console.log(`Open loan tx: ${receipt.hash}`);
  console.log(`Loan id: ${event ? event.args.loanId.toString() : "unknown"}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
