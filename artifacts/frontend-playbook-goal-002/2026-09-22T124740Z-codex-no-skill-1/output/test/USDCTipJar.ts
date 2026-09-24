import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("USDCTipJar", function () {
  async function deployFixture() {
    const [owner, tipper, beneficiary] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const USDCTipJar = await ethers.getContractFactory("USDCTipJar");
    const tipJar = await USDCTipJar.deploy(await usdc.getAddress(), owner.address, beneficiary.address);

    await usdc.mint(tipper.address, ethers.parseUnits("100", 6));

    return { owner, tipper, beneficiary, usdc, tipJar };
  }

  it("accepts an approved USDC tip and emits feed data", async function () {
    const { tipper, usdc, tipJar } = await deployFixture();
    const amount = ethers.parseUnits("12.34", 6);

    await usdc.connect(tipper).approve(await tipJar.getAddress(), amount);

    await expect(tipJar.connect(tipper).tip(amount, "Ada", "For the builders"))
      .to.emit(tipJar, "TipSent")
      .withArgs(1, tipper.address, amount, "Ada", "For the builders", anyValue);

    expect(await tipJar.tipCount()).to.equal(1);
    expect(await tipJar.totalTips()).to.equal(amount);
    expect(await usdc.balanceOf(await tipJar.getAddress())).to.equal(amount);
  });

  it("lets the owner withdraw to the beneficiary", async function () {
    const { owner, tipper, beneficiary, usdc, tipJar } = await deployFixture();
    const amount = ethers.parseUnits("4", 6);

    await usdc.connect(tipper).approve(await tipJar.getAddress(), amount);
    await tipJar.connect(tipper).tip(amount, "", "");

    await expect(tipJar.connect(owner).withdraw(0))
      .to.emit(tipJar, "Withdrawn")
      .withArgs(beneficiary.address, amount);

    expect(await usdc.balanceOf(beneficiary.address)).to.equal(amount);
    expect(await usdc.balanceOf(await tipJar.getAddress())).to.equal(0);
  });

  it("rejects empty tips and oversized metadata", async function () {
    const { tipper, usdc, tipJar } = await deployFixture();
    await usdc.connect(tipper).approve(await tipJar.getAddress(), ethers.parseUnits("1", 6));

    await expect(tipJar.connect(tipper).tip(0, "", "")).to.be.revertedWithCustomError(tipJar, "ZeroAmount");
    await expect(tipJar.connect(tipper).tip(1, "a".repeat(65), "")).to.be.revertedWithCustomError(
      tipJar,
      "NameTooLong",
    );
    await expect(tipJar.connect(tipper).tip(1, "", "a".repeat(281))).to.be.revertedWithCustomError(
      tipJar,
      "MessageTooLong",
    );
  });
});
