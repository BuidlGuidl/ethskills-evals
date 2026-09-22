const assert = require("node:assert/strict");
const hre = require("hardhat");

describe("TipJar", function () {
  async function deployFixture() {
    const [owner, tipper, recipient] = await hre.ethers.getSigners();

    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const TipJar = await hre.ethers.getContractFactory("TipJar");
    const tipJar = await TipJar.deploy(await usdc.getAddress(), owner.address);
    await tipJar.waitForDeployment();

    await usdc.mint(tipper.address, hre.ethers.parseUnits("100", 6));

    return { owner, tipper, recipient, usdc, tipJar };
  }

  it("accepts USDC tips and emits the message", async function () {
    const { tipper, usdc, tipJar } = await deployFixture();
    const amount = hre.ethers.parseUnits("12.5", 6);

    await usdc.connect(tipper).approve(await tipJar.getAddress(), amount);
    const receipt = await (await tipJar.connect(tipper).tip(amount, "ship it")).wait();

    const event = receipt.logs
      .map((log) => {
        try {
          return tipJar.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "Tip");

    assert.equal(await tipJar.balance(), amount);
    assert.equal(await tipJar.totalTips(), amount);
    assert.equal(event.args.tipper, tipper.address);
    assert.equal(event.args.amount, amount);
    assert.equal(event.args.message, "ship it");
  });

  it("lets only the owner withdraw", async function () {
    const { owner, tipper, recipient, usdc, tipJar } = await deployFixture();
    const amount = hre.ethers.parseUnits("20", 6);

    await usdc.connect(tipper).approve(await tipJar.getAddress(), amount);
    await tipJar.connect(tipper).tip(amount, "for the jar");

    await assert.rejects(
      tipJar.connect(tipper).withdraw(recipient.address, amount),
      /OnlyOwner/
    );

    await tipJar.connect(owner).withdraw(recipient.address, amount);
    assert.equal(await usdc.balanceOf(recipient.address), amount);
  });
});
