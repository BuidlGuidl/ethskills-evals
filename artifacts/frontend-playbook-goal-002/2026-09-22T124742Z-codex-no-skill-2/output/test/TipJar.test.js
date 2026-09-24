const { expect } = require("chai");
const { ethers, artifacts, network } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ONE_HUNDRED_USDC = ethers.parseUnits("100", 6);

async function installMockUsdc(owner, users) {
  const artifact = await artifacts.readArtifact("MockUSDC");
  await network.provider.send("hardhat_setCode", [BASE_USDC, artifact.deployedBytecode]);

  const usdc = await ethers.getContractAt("MockUSDC", BASE_USDC);
  await usdc.initialize(owner.address);

  for (const user of users) {
    await usdc.mint(user.address, ONE_HUNDRED_USDC);
  }

  return usdc;
}

describe("TipJar", function () {
  beforeEach(async function () {
    await network.provider.send("hardhat_reset");
  });

  it("pulls Base USDC into the beneficiary and records the tip", async function () {
    const [owner, beneficiary, tipper] = await ethers.getSigners();
    const usdc = await installMockUsdc(owner, [tipper]);
    const TipJar = await ethers.getContractFactory("TipJar");
    const tipJar = await TipJar.deploy(beneficiary.address);
    await tipJar.waitForDeployment();

    const amount = ethers.parseUnits("12.34", 6);
    await usdc.connect(tipper).approve(tipJar.target, amount);

    await expect(tipJar.connect(tipper).tip(amount, "Keep going"))
      .to.emit(tipJar, "Tipped")
      .withArgs(0, tipper.address, amount, "Keep going", anyValue);

    expect(await usdc.balanceOf(beneficiary.address)).to.equal(amount);
    expect(await tipJar.totalTips()).to.equal(1);
    expect(await tipJar.totalAmount()).to.equal(amount);

    const tip = await tipJar.getTip(0);
    expect(tip.sender).to.equal(tipper.address);
    expect(tip.amount).to.equal(amount);
    expect(tip.message).to.equal("Keep going");
  });

  it("returns recent tips newest first", async function () {
    const [owner, beneficiary, tipper] = await ethers.getSigners();
    const usdc = await installMockUsdc(owner, [tipper]);
    const TipJar = await ethers.getContractFactory("TipJar");
    const tipJar = await TipJar.deploy(beneficiary.address);
    await tipJar.waitForDeployment();

    await usdc.connect(tipper).approve(tipJar.target, ethers.parseUnits("20", 6));
    await tipJar.connect(tipper).tip(ethers.parseUnits("1", 6), "First");
    await tipJar.connect(tipper).tip(ethers.parseUnits("2", 6), "Second");

    const recent = await tipJar.getRecentTips(2);
    expect(recent[0].message).to.equal("Second");
    expect(recent[1].message).to.equal("First");
  });

  it("rejects zero amounts and overly long messages", async function () {
    const [owner, beneficiary, tipper] = await ethers.getSigners();
    await installMockUsdc(owner, [tipper]);
    const TipJar = await ethers.getContractFactory("TipJar");
    const tipJar = await TipJar.deploy(beneficiary.address);
    await tipJar.waitForDeployment();

    await expect(tipJar.connect(tipper).tip(0, "Nope")).to.be.revertedWithCustomError(
      tipJar,
      "AmountMustBePositive"
    );
    await expect(tipJar.connect(tipper).tip(1, "x".repeat(281))).to.be.revertedWithCustomError(
      tipJar,
      "MessageTooLong"
    );
  });
});
