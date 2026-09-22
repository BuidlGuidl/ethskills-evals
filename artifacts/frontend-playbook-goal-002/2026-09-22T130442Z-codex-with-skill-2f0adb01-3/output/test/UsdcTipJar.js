const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("UsdcTipJar", function () {
  async function deployFixture() {
    const [owner, tipper, recipient] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const TipJar = await ethers.getContractFactory("UsdcTipJar");
    const tipJar = await TipJar.deploy(await usdc.getAddress(), owner.address);

    await usdc.mint(tipper.address, ethers.parseUnits("25", 6));

    return { owner, tipper, recipient, usdc, tipJar };
  }

  it("accepts approved USDC tips and records them", async function () {
    const { tipper, usdc, tipJar } = await deployFixture();
    const amount = ethers.parseUnits("4.25", 6);

    await usdc.connect(tipper).approve(await tipJar.getAddress(), amount);

    await expect(tipJar.connect(tipper).tip(amount, "Thanks for building on Base."))
      .to.emit(tipJar, "TipReceived")
      .withArgs(tipper.address, amount, "Thanks for building on Base.", anyValue, 0);

    expect(await tipJar.tipCount()).to.equal(1);
    expect(await usdc.balanceOf(await tipJar.getAddress())).to.equal(amount);

    const tip = await tipJar.getTip(0);
    expect(tip.sender).to.equal(tipper.address);
    expect(tip.amount).to.equal(amount);
    expect(tip.message).to.equal("Thanks for building on Base.");
  });

  it("allows only the owner to withdraw", async function () {
    const { owner, tipper, recipient, usdc, tipJar } = await deployFixture();
    const amount = ethers.parseUnits("8", 6);

    await usdc.connect(tipper).approve(await tipJar.getAddress(), amount);
    await tipJar.connect(tipper).tip(amount, "Ship it.");

    await expect(tipJar.connect(tipper).withdraw(recipient.address, amount)).to.be.revertedWithCustomError(
      tipJar,
      "NotOwner",
    );

    await tipJar.connect(owner).withdraw(recipient.address, amount);
    expect(await usdc.balanceOf(recipient.address)).to.equal(amount);
  });

  it("rejects empty tips and overlong messages", async function () {
    const { tipper, usdc, tipJar } = await deployFixture();
    const amount = ethers.parseUnits("1", 6);

    await usdc.connect(tipper).approve(await tipJar.getAddress(), amount);
    await expect(tipJar.connect(tipper).tip(0, "Nope")).to.be.revertedWithCustomError(tipJar, "EmptyTip");
    await expect(tipJar.connect(tipper).tip(amount, "x".repeat(281))).to.be.revertedWithCustomError(
      tipJar,
      "MessageTooLong",
    );
  });
});
