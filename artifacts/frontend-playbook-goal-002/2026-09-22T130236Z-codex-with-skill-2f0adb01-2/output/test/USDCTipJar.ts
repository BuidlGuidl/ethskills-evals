import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { ethers, network } from "hardhat";

const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function installMockUsdc() {
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockImplementation = await MockUSDC.deploy();
  await mockImplementation.waitForDeployment();

  const runtimeBytecode = await ethers.provider.getCode(await mockImplementation.getAddress());
  await network.provider.send("hardhat_setCode", [BASE_USDC_ADDRESS, runtimeBytecode]);

  return MockUSDC.attach(BASE_USDC_ADDRESS) as any;
}

describe("USDCTipJar", () => {
  it("accepts USDC tips and stores them for the feed", async () => {
    const [owner, tipper] = await ethers.getSigners();
    const mockUsdc = await installMockUsdc();
    const amount = ethers.parseUnits("25", 6);

    await mockUsdc.mint(tipper.address, amount);

    const TipJar = await ethers.getContractFactory("USDCTipJar");
    const tipJar = (await TipJar.deploy(BASE_USDC_ADDRESS, owner.address)) as any;
    await tipJar.waitForDeployment();

    await mockUsdc.connect(tipper).approve(await tipJar.getAddress(), amount);

    await expect(tipJar.connect(tipper).tip(amount, "For the Base builders"))
      .to.emit(tipJar, "TipReceived")
      .withArgs(0, tipper.address, owner.address, amount, "For the Base builders", anyValue);

    expect(await mockUsdc.balanceOf(owner.address)).to.equal(amount);
    expect(await tipJar.getTipCount()).to.equal(1);

    const tips = await tipJar.getTips(0, 10);
    expect(tips).to.have.length(1);
    expect(tips[0].from).to.equal(tipper.address);
    expect(tips[0].amount).to.equal(amount);
    expect(tips[0].message).to.equal("For the Base builders");
  });

  it("rejects empty amounts and long messages", async () => {
    const [owner] = await ethers.getSigners();
    await installMockUsdc();

    const TipJar = await ethers.getContractFactory("USDCTipJar");
    const tipJar = (await TipJar.deploy(BASE_USDC_ADDRESS, owner.address)) as any;
    await tipJar.waitForDeployment();

    await expect(tipJar.tip(0, "nope")).to.be.revertedWithCustomError(tipJar, "AmountMustBePositive");
    await expect(tipJar.tip(1, "x".repeat(281))).to.be.revertedWithCustomError(tipJar, "MessageTooLong");
  });
});
