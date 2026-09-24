import { expect } from "chai";
import { ethers, network } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const usdc = (amount: number) => ethers.parseUnits(amount.toString(), 6);
const day = 24 * 60 * 60;

describe("ToolshedEscrow", function () {
  async function deployFixture() {
    const [admin, owner, borrower, stranger] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const token = await MockUSDC.deploy();
    const ToolshedEscrow = await ethers.getContractFactory("ToolshedEscrow");
    const escrow = await ToolshedEscrow.deploy(await token.getAddress(), admin.address);

    await escrow.setMembers([owner.address, borrower.address], true);
    await token.mint(borrower.address, usdc(500));
    await token.connect(borrower).approve(await escrow.getAddress(), usdc(500));

    const now = await time.latest();
    return {
      admin,
      owner,
      borrower,
      stranger,
      token,
      escrow,
      startsAt: now + day,
      dueAt: now + 4 * day,
      toolId: ethers.id("ladder-01")
    };
  }

  it("escrows a borrower deposit and lets the owner accept", async function () {
    const { owner, borrower, token, escrow, startsAt, dueAt, toolId } = await deployFixture();

    await expect(
      escrow.connect(borrower).requestLoan(toolId, owner.address, usdc(100), usdc(8), startsAt, dueAt)
    ).to.emit(escrow, "LoanRequested");

    expect(await token.balanceOf(await escrow.getAddress())).to.equal(usdc(100));

    await expect(escrow.connect(owner).acceptLoan(1)).to.emit(escrow, "LoanAccepted");
    expect((await escrow.loans(1)).status).to.equal(2);
  });

  it("refunds the full deposit for an on-time return", async function () {
    const { owner, borrower, token, escrow, startsAt, dueAt, toolId } = await deployFixture();

    await escrow.connect(borrower).requestLoan(toolId, owner.address, usdc(100), usdc(8), startsAt, dueAt);
    await escrow.connect(owner).acceptLoan(1);
    await time.setNextBlockTimestamp(dueAt);

    await expect(escrow.connect(owner).confirmReturn(1)).to.emit(escrow, "LoanReturned").withArgs(1, 0, 0, usdc(100));

    expect(await token.balanceOf(borrower.address)).to.equal(usdc(500));
    const stats = await escrow.borrowerStats(borrower.address);
    expect(stats.completedLoans).to.equal(1);
    expect(stats.lateReturns).to.equal(0);
  });

  it("pays late fees to the owner and refunds the remainder", async function () {
    const { owner, borrower, token, escrow, startsAt, dueAt, toolId } = await deployFixture();

    await escrow.connect(borrower).requestLoan(toolId, owner.address, usdc(100), usdc(8), startsAt, dueAt);
    await escrow.connect(owner).acceptLoan(1);
    await time.setNextBlockTimestamp(dueAt + day + 1);

    await expect(escrow.connect(owner).confirmReturn(1))
      .to.emit(escrow, "LoanReturned")
      .withArgs(1, 2, usdc(16), usdc(84));

    expect(await token.balanceOf(owner.address)).to.equal(usdc(16));
    expect(await token.balanceOf(borrower.address)).to.equal(usdc(484));
    const stats = await escrow.borrowerStats(borrower.address);
    expect(stats.completedLoans).to.equal(1);
    expect(stats.lateReturns).to.equal(1);
    expect(stats.totalLateFeesPaid).to.equal(usdc(16));
  });

  it("lets either party cancel a pending request and refunds the borrower", async function () {
    const { owner, borrower, token, escrow, startsAt, dueAt, toolId } = await deployFixture();

    await escrow.connect(borrower).requestLoan(toolId, owner.address, usdc(100), usdc(8), startsAt, dueAt);
    await expect(escrow.connect(owner).cancelRequest(1)).to.emit(escrow, "LoanCancelled");

    expect(await token.balanceOf(borrower.address)).to.equal(usdc(500));
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(0);
  });

  it("blocks non-members and non-owners from privileged actions", async function () {
    const { owner, borrower, stranger, escrow, startsAt, dueAt, toolId } = await deployFixture();

    await expect(
      escrow.connect(stranger).requestLoan(toolId, owner.address, usdc(100), usdc(8), startsAt, dueAt)
    ).to.be.revertedWithCustomError(escrow, "NotMember");

    await escrow.connect(borrower).requestLoan(toolId, owner.address, usdc(100), usdc(8), startsAt, dueAt);

    await expect(escrow.connect(borrower).acceptLoan(1)).to.be.revertedWithCustomError(escrow, "Unauthorized");
    await expect(escrow.connect(stranger).cancelRequest(1)).to.be.revertedWithCustomError(escrow, "Unauthorized");
  });

  it("allows the owner to claim the deposit after the default grace period", async function () {
    const { owner, borrower, token, escrow, startsAt, dueAt, toolId } = await deployFixture();

    await escrow.connect(borrower).requestLoan(toolId, owner.address, usdc(100), usdc(8), startsAt, dueAt);
    await escrow.connect(owner).acceptLoan(1);
    await network.provider.send("evm_setNextBlockTimestamp", [dueAt + 31 * day]);

    await expect(escrow.connect(owner).claimDefault(1)).to.emit(escrow, "LoanDefaulted").withArgs(1, usdc(100));

    expect(await token.balanceOf(owner.address)).to.equal(usdc(100));
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(0);
    const stats = await escrow.borrowerStats(borrower.address);
    expect(stats.completedLoans).to.equal(1);
    expect(stats.lateReturns).to.equal(1);
  });
});
