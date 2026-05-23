import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Chama", () => {
  const CYCLE = 5 * 60; // 5 minutes — ACTIVE-phase length
  const OPEN_TIMEOUT = 30 * 24 * 60 * 60; // 30 days — force-advance fallback
  const CONTRIB = ethers.parseUnits("20", 18); // 20 cUSD

  async function deploy(openTimeout = OPEN_TIMEOUT, rounds = 1) {
    const [agent, alice, bob, carol, stranger] = await ethers.getSigners();
    const cUSD = await ethers.deployContract("MockCUSD");
    const chama = await ethers.deployContract("Chama", [
      await cUSD.getAddress(),
      agent.address,
      [alice.address, bob.address, carol.address],
      CONTRIB,
      CYCLE,
      openTimeout,
      rounds,
    ]);
    const chamaAddr = await chama.getAddress();
    for (const u of [alice, bob, carol]) {
      await cUSD.mint(u.address, CONTRIB * 20n);
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

  it("executePayout during OPEN phase reverts with OpenTimeoutNotElapsed", async () => {
    const { chama, stranger } = await deploy();
    await expect(chama.connect(stranger).executePayout()).to.be.revertedWithCustomError(
      chama,
      "OpenTimeoutNotElapsed",
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
    // Cycle 1 starts in OPEN — the deadline that's exposed is the force-advance one
    expect(await chama.isCycleActive()).to.equal(false);

    await chama.contributeFor(alice.address);
    await chama.contributeFor(bob.address);
    expect(await chama.isCycleActive()).to.equal(false); // still OPEN

    await chama.contributeFor(carol.address); // flips ACTIVE — cycleDeadline now = activeAt + cycleLength
    const tip = (await ethers.provider.getBlock("latest"))!.timestamp;
    const deadline = Number(await chama.cycleDeadline());
    expect(await chama.isCycleActive()).to.equal(true);
    expect(deadline - tip).to.be.closeTo(CYCLE, 5);
  });

  it("force-advances after openTimeout, emits Defaulted, partial pot to the slot's payee", async () => {
    const { chama, cUSD, alice, bob, carol, stranger } = await deploy();
    // Only Alice contributes
    await chama.contributeFor(alice.address);
    // Force-advance reverts before openTimeout elapses
    await expect(chama.connect(stranger).executePayout()).to.be.revertedWithCustomError(
      chama,
      "OpenTimeoutNotElapsed",
    );

    await time.increase(OPEN_TIMEOUT);

    const before = await cUSD.balanceOf(alice.address);
    const tx = chama.connect(stranger).executePayout();
    await expect(tx).to.emit(chama, "PayoutExecuted").withArgs(alice.address, 0, CONTRIB);
    await expect(tx).to.emit(chama, "Defaulted").withArgs(bob.address, 0);
    await expect(tx).to.emit(chama, "Defaulted").withArgs(carol.address, 0);
    // Alice (slot 0 payee) gets the partial pot — her own returned contribution
    expect((await cUSD.balanceOf(alice.address)) - before).to.equal(CONTRIB);
  });

  it("when openTimeout=0, force-advance is disabled — chama waits indefinitely", async () => {
    const { chama, alice, stranger } = await deploy(0);
    await chama.contributeFor(alice.address);
    await time.increase(365 * 24 * 60 * 60); // a year
    await expect(chama.connect(stranger).executePayout()).to.be.revertedWithCustomError(
      chama,
      "OpenTimeoutDisabled",
    );
  });

  it("runs multiple rounds — payee rotation wraps modulo memberCount", async () => {
    const { chama, alice, bob, carol } = await deploy(OPEN_TIMEOUT, 2); // 2 rounds × 3 members = 6 cycles

    expect(await chama.totalCycles()).to.equal(6);
    const expectedPayees = [alice, bob, carol, alice, bob, carol];

    for (let cycle = 0; cycle < 6; cycle++) {
      expect(await chama.currentRound()).to.equal(Math.floor(cycle / 3));
      await chama.contributeFor(alice.address);
      await chama.contributeFor(bob.address);
      await chama.contributeFor(carol.address);
      await time.increase(CYCLE);
      await expect(chama.executePayout())
        .to.emit(chama, "PayoutExecuted")
        .withArgs(expectedPayees[cycle].address, cycle, CONTRIB * 3n);
    }

    expect(await chama.currentCycle()).to.equal(6);
    await expect(chama.executePayout()).to.be.revertedWithCustomError(chama, "ChamaAlreadyCompleted");
  });

  it("rejects invalid construction", async () => {
    const [agent, alice] = await ethers.getSigners();
    const cUSD = await ethers.deployContract("MockCUSD");
    const Chama = await ethers.getContractFactory("Chama");
    await expect(
      Chama.deploy(
        await cUSD.getAddress(),
        agent.address,
        [alice.address],
        CONTRIB,
        CYCLE,
        OPEN_TIMEOUT,
        1,
      ),
    ).to.be.revertedWithCustomError(Chama, "InvalidConfig");
    await expect(
      Chama.deploy(
        await cUSD.getAddress(),
        agent.address,
        [alice.address, alice.address],
        CONTRIB,
        CYCLE,
        OPEN_TIMEOUT,
        1,
      ),
    ).to.be.revertedWithCustomError(Chama, "DuplicateMember");
    // rounds = 0 is invalid
    const [, , bob] = await ethers.getSigners();
    await expect(
      Chama.deploy(
        await cUSD.getAddress(),
        agent.address,
        [alice.address, bob.address],
        CONTRIB,
        CYCLE,
        OPEN_TIMEOUT,
        0,
      ),
    ).to.be.revertedWithCustomError(Chama, "InvalidConfig");
  });
});
