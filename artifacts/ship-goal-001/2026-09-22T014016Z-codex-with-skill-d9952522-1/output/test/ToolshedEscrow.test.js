const { expect } = require("chai");
const { ethers } = require("hardhat");

const usdc = (amount) => ethers.parseUnits(amount, 6);
const day = 24 * 60 * 60;

async function latestTimestamp() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
}

describe("ToolshedEscrow", function () {
  async function deployFixture() {
    const [association, borrower, owner, stranger] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const token = await MockUSDC.deploy();
    const ToolshedEscrow = await ethers.getContractFactory("ToolshedEscrow");
    const escrow = await ToolshedEscrow.deploy(await token.getAddress(), association.address);

    await token.mint(borrower.address, usdc("100"));
    await token.connect(borrower).approve(await escrow.getAddress(), usdc("100"));

    return { association, borrower, owner, stranger, token, escrow };
  }

  it("opens a loan and locks the borrower's USDC deposit", async function () {
    const { borrower, owner, token, escrow } = await deployFixture();
    const dueAt = (await latestTimestamp()) + 3 * day;
    const toolId = ethers.id("tool-1");

    await expect(
      escrow.connect(borrower).openLoan(toolId, owner.address, dueAt, usdc("25"), usdc("3"))
    )
      .to.emit(escrow, "LoanOpened")
      .withArgs(1, toolId, borrower.address, owner.address, dueAt, usdc("25"), usdc("3"));

    expect(await token.balanceOf(await escrow.getAddress())).to.equal(usdc("25"));
  });

  it("returns the full deposit when the owner settles on time", async function () {
    const { borrower, owner, token, escrow } = await deployFixture();
    const dueAt = (await latestTimestamp()) + 3 * day;

    await escrow.connect(borrower).openLoan(ethers.id("tool-1"), owner.address, dueAt, usdc("25"), usdc("3"));
    await ethers.provider.send("evm_setNextBlockTimestamp", [dueAt - 60]);

    await expect(escrow.connect(owner).settleReturn(1))
      .to.emit(escrow, "ReturnSettled")
      .withArgs(1, borrower.address, owner.address, dueAt - 60, 0, 0, usdc("25"));

    expect(await token.balanceOf(borrower.address)).to.equal(usdc("100"));
    expect(await token.balanceOf(owner.address)).to.equal(0);
  });

  it("pays daily late fees to the owner and refunds the remainder", async function () {
    const { borrower, owner, token, escrow } = await deployFixture();
    const dueAt = (await latestTimestamp()) + day;

    await escrow.connect(borrower).openLoan(ethers.id("tool-2"), owner.address, dueAt, usdc("25"), usdc("4"));
    await ethers.provider.send("evm_setNextBlockTimestamp", [dueAt + day + 1]);

    await escrow.connect(owner).settleReturn(1);

    expect(await token.balanceOf(owner.address)).to.equal(usdc("8"));
    expect(await token.balanceOf(borrower.address)).to.equal(usdc("92"));
  });

  it("caps late fees at the deposit", async function () {
    const { borrower, owner, token, escrow } = await deployFixture();
    const dueAt = (await latestTimestamp()) + day;

    await escrow.connect(borrower).openLoan(ethers.id("tool-3"), owner.address, dueAt, usdc("10"), usdc("4"));
    await ethers.provider.send("evm_setNextBlockTimestamp", [dueAt + 10 * day]);

    await escrow.connect(owner).settleReturn(1);

    expect(await token.balanceOf(owner.address)).to.equal(usdc("10"));
    expect(await token.balanceOf(borrower.address)).to.equal(usdc("90"));
  });

  it("lets the association settle a return dispute with a returned-at timestamp", async function () {
    const { association, borrower, owner, token, escrow } = await deployFixture();
    const dueAt = (await latestTimestamp()) + day;

    await escrow.connect(borrower).openLoan(ethers.id("tool-4"), owner.address, dueAt, usdc("20"), usdc("5"));
    await ethers.provider.send("evm_setNextBlockTimestamp", [dueAt + 5 * day]);

    await escrow.connect(association).associationSettle(1, dueAt + day);

    expect(await token.balanceOf(owner.address)).to.equal(usdc("5"));
    expect(await token.balanceOf(borrower.address)).to.equal(usdc("95"));
  });

  it("restricts owner settlement to the tool owner", async function () {
    const { borrower, owner, stranger, escrow } = await deployFixture();
    const dueAt = (await latestTimestamp()) + day;

    await escrow.connect(borrower).openLoan(ethers.id("tool-5"), owner.address, dueAt, usdc("20"), usdc("5"));

    await expect(escrow.connect(stranger).settleReturn(1)).to.be.revertedWithCustomError(escrow, "NotToolOwner");
  });
});
