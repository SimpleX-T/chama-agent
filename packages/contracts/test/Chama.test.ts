import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Chama", () => {
  const CYCLE = 5 * 60; // 5 minutes
  const CONTRIB = ethers.parseUnits("20", 18); // 20 cUSD

  async function deploy() {
    const [agent, alice, bob, carol, stranger] = await ethers.getSigners();
    const cUSD = await ethers.deployContract("MockCUSD");
    const chama = await ethers.deployContract("Chama", [
      await cUSD.getAddress(),
      agent.address,
      [alice.address, bob.address, carol.address],
      CONTRIB,
      CYCLE,
    ]);
    const chamaAddr = await chama.getAddress();
    for (const u of [alice, bob, carol]) {
      await cUSD.mint(u.address, CONTRIB * 10n);
      await cUSD.connect(u).approve(chamaAddr, ethers.MaxUint256);
    }
    return { chama, cUSD, agent, alice, bob, carol, stranger };
  }

  it("runs a full 3-cycle rotation: contribute, wait, payout for each cycle in order", async () => {
    const { chama, cUSD, alice, bob, carol } = await deploy();
    const payouts: Array<[any, number]> = [
      [alice, 0],
      [bob, 1],
      [carol, 2],
    ];

    for (const [payee, cycle] of payouts) {
      // OPEN phase — contributions land but no clock starts
      expect(await chama.isCycleActive()).to.equal(false);
      await chama.contributeFor(alice.address);
      await chama.contributeFor(bob.address);
      expect(await chama.isCycleActive()).to.equal(false);

      // Last contribution flips cycle to ACTIVE
      await expect(chama.contributeFor(carol.address))
        .to.emit(chama, "CycleActivated")
        .withArgs(cycle, (t: bigint) => t > 0n);
      expect(await chama.isCycleActive()).to.equal(true);

      // Payout blocked until cycleLength elapses
      await expect(chama.executePayout()).to.be.revertedWithCustomError(chama, "ActivePhaseNotElapsed");

      // `before` measured AFTER contributions but BEFORE payout — so the only
      // movement we should see is the +pot the payee receives.
      const before = await cUSD.balanceOf(payee.address);
      await time.increase(CYCLE);

      await expect(chama.executePayout())
        .to.emit(chama, "PayoutExecuted")
        .withArgs(payee.address, cycle, CONTRIB * 3n);

      expect((await cUSD.balanceOf(payee.address)) - before).to.equal(CONTRIB * 3n);
      // After payout, new cycle is back in OPEN phase
      expect(await chama.currentCycleActiveAt()).to.equal(0);
    }

    expect(await chama.currentCycle()).to.equal(3);
    await expect(chama.executePayout()).to.be.revertedWithCustomError(chama, "ChamaAlreadyCompleted");
  });

  it("executePayout reverts during OPEN phase (no contributions yet)", async () => {
    const { chama, stranger } = await deploy();
    await expect(chama.connect(stranger).executePayout()).to.be.revertedWithCustomError(
      chama,
      "CycleNotActive",
    );
  });

  it("executePayout reverts before the active phase elapses", async () => {
    const { chama, alice, bob, carol, stranger } = await deploy();
    await chama.contributeFor(alice.address);
    await chama.contributeFor(bob.address);
    await chama.contributeFor(carol.address); // flips to ACTIVE
    expect(await chama.isCycleActive()).to.equal(true);
    // No time advance — still mid-active
    await expect(chama.connect(stranger).executePayout()).to.be.revertedWithCustomError(
      chama,
      "ActivePhaseNotElapsed",
    );
  });

  it("contributeFor is permissionless but rejects non-members and duplicates", async () => {
    const { chama, alice, stranger } = await deploy();

    await chama.connect(stranger).contributeFor(alice.address); // any wallet can trigger
    await expect(chama.contributeFor(stranger.address)).to.be.revertedWithCustomError(
      chama,
      "NotMember",
    );
    await expect(chama.contributeFor(alice.address)).to.be.revertedWithCustomError(
      chama,
      "AlreadyContributed",
    );
  });

  it("executePayout is permissionless once active phase has elapsed", async () => {
    const { chama, alice, bob, carol, stranger } = await deploy();
    await chama.contributeFor(alice.address);
    await chama.contributeFor(bob.address);
    await chama.contributeFor(carol.address);
    await time.increase(CYCLE);
    await expect(chama.connect(stranger).executePayout())
      .to.emit(chama, "PayoutExecuted")
      .withArgs(alice.address, 0, CONTRIB * 3n);
  });

  it("each cycle's clock only starts on its own last contribution", async () => {
    const { chama, alice, bob, carol } = await deploy();
    // Race through cycle 0
    await chama.contributeFor(alice.address);
    await chama.contributeFor(bob.address);
    await chama.contributeFor(carol.address);
    await time.increase(CYCLE);
    await chama.executePayout();
    expect(await chama.currentCycle()).to.equal(1);
    expect(await chama.currentCycleActiveAt()).to.equal(0);
    // Cycle 1 should be OPEN again, deadline should be 0
    expect(await chama.cycleDeadline()).to.equal(0);

    await chama.contributeFor(alice.address);
    await chama.contributeFor(bob.address);
    expect(await chama.cycleDeadline()).to.equal(0); // still OPEN

    await chama.contributeFor(carol.address); // flips ACTIVE
    const tip = (await ethers.provider.getBlock("latest"))!.timestamp;
    const deadline = Number(await chama.cycleDeadline());
    expect(deadline - tip).to.be.closeTo(CYCLE, 5);
  });

  it("rejects invalid construction", async () => {
    const [agent, alice] = await ethers.getSigners();
    const cUSD = await ethers.deployContract("MockCUSD");
    const Chama = await ethers.getContractFactory("Chama");
    await expect(
      Chama.deploy(await cUSD.getAddress(), agent.address, [alice.address], CONTRIB, CYCLE),
    ).to.be.revertedWithCustomError(Chama, "InvalidConfig");
    await expect(
      Chama.deploy(await cUSD.getAddress(), agent.address, [alice.address, alice.address], CONTRIB, CYCLE),
    ).to.be.revertedWithCustomError(Chama, "DuplicateMember");
  });
});
