import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Chama", () => {
  const ONE_WEEK = 7 * 24 * 60 * 60;
  const CONTRIB = ethers.parseUnits("20", 18); // 20 cUSD

  async function deploy() {
    const [agent, alice, bob, carol, stranger] = await ethers.getSigners();
    const cUSD = await ethers.deployContract("MockCUSD");
    const chama = await ethers.deployContract("Chama", [
      await cUSD.getAddress(),
      agent.address,
      [alice.address, bob.address, carol.address],
      CONTRIB,
      ONE_WEEK,
    ]);
    const chamaAddr = await chama.getAddress();
    for (const u of [alice, bob, carol]) {
      await cUSD.mint(u.address, CONTRIB * 10n);
      await cUSD.connect(u).approve(chamaAddr, ethers.MaxUint256);
    }
    return { chama, cUSD, agent, alice, bob, carol, stranger };
  }

  it("runs a full 3-cycle rotation with auto-payout firing on the last contribution", async () => {
    const { chama, cUSD, alice, bob, carol } = await deploy();

    const payouts: Array<[any, any]> = [
      [alice, 0],
      [bob, 1],
      [carol, 2],
    ];

    for (const [payee, cycle] of payouts) {
      const before = await cUSD.balanceOf(payee.address);
      // The LAST contributeFor of the cycle auto-advances — no separate executePayout needed
      await chama.contributeFor(alice.address);
      await chama.contributeFor(bob.address);
      const tx = await chama.contributeFor(carol.address);
      await expect(tx).to.emit(chama, "PayoutExecuted").withArgs(payee.address, cycle, CONTRIB * 3n);
      // Payee contributed once (-CONTRIB) and received the full pot (+3*CONTRIB),
      // so the net change against the pre-cycle balance is +2 * CONTRIB.
      expect((await cUSD.balanceOf(payee.address)) - before).to.equal(CONTRIB * 2n);
    }

    expect(await chama.currentCycle()).to.equal(3);
    await expect(chama.executePayout()).to.be.revertedWithCustomError(chama, "ChamaAlreadyCompleted");
  });

  it("advances on deadline with a partial pot and emits Defaulted for missing members", async () => {
    const { chama, cUSD, agent, alice, bob, carol } = await deploy();

    await chama.contributeFor(alice.address); // bob and carol skip

    await expect(chama.connect(agent).executePayout()).to.be.revertedWithCustomError(
      chama,
      "CycleNotReady",
    );

    await time.increase(ONE_WEEK + 1);

    const before = await cUSD.balanceOf(alice.address);
    const tx = await chama.connect(agent).executePayout();
    await expect(tx).to.emit(chama, "Defaulted").withArgs(bob.address, 0);
    await expect(tx).to.emit(chama, "Defaulted").withArgs(carol.address, 0);
    expect(await cUSD.balanceOf(alice.address)).to.equal(before + CONTRIB);
  });

  it("contributeFor is permissionless but rejects non-members and duplicates", async () => {
    const { chama, alice, stranger } = await deploy();

    await chama.connect(stranger).contributeFor(alice.address); // anyone can trigger
    await expect(chama.contributeFor(stranger.address)).to.be.revertedWithCustomError(
      chama,
      "NotMember",
    );
    await expect(chama.contributeFor(alice.address)).to.be.revertedWithCustomError(
      chama,
      "AlreadyContributed",
    );
  });

  it("executePayout is permissionless on the deadline-elapsed path (partial pot)", async () => {
    const { chama, alice, bob, carol, stranger } = await deploy();
    await chama.contributeFor(alice.address); // only alice paid in
    await time.increase(ONE_WEEK + 1);
    // a wallet that's neither the agent nor a member can advance the cycle
    await expect(chama.connect(stranger).executePayout())
      .to.emit(chama, "PayoutExecuted")
      .withArgs(alice.address, 0, CONTRIB)
      .and.to.emit(chama, "Defaulted").withArgs(bob.address, 0)
      .and.to.emit(chama, "Defaulted").withArgs(carol.address, 0);
  });

  it("executePayout still reverts before the cycle is ready, regardless of caller", async () => {
    const { chama, alice, stranger } = await deploy();
    await chama.contributeFor(alice.address); // only one member paid in
    // not all contributed AND deadline not elapsed → CycleNotReady
    await expect(chama.connect(stranger).executePayout()).to.be.revertedWithCustomError(
      chama,
      "CycleNotReady",
    );
  });

  it("each cycle gets its own full clock — fast cycles don't shrink later ones", async () => {
    const { chama, alice, bob, carol } = await deploy();
    // complete cycle 0 immediately (auto-payout fires on the third contribution)
    await chama.contributeFor(alice.address);
    await chama.contributeFor(bob.address);
    await chama.contributeFor(carol.address);
    expect(await chama.currentCycle()).to.equal(1);

    const tip = (await ethers.provider.getBlock("latest"))!.timestamp;
    const deadline = Number(await chama.cycleDeadline());
    // Cycle 1's deadline should sit ~ONE_WEEK in the future from *now*, not
    // 2 * ONE_WEEK from the original chama-creation time.
    expect(deadline - tip).to.be.closeTo(ONE_WEEK, 5);
  });

  it("rejects invalid construction", async () => {
    const [agent, alice] = await ethers.getSigners();
    const cUSD = await ethers.deployContract("MockCUSD");
    const Chama = await ethers.getContractFactory("Chama");
    await expect(
      Chama.deploy(await cUSD.getAddress(), agent.address, [alice.address], CONTRIB, ONE_WEEK),
    ).to.be.revertedWithCustomError(Chama, "InvalidConfig");
    await expect(
      Chama.deploy(await cUSD.getAddress(), agent.address, [alice.address, alice.address], CONTRIB, ONE_WEEK),
    ).to.be.revertedWithCustomError(Chama, "DuplicateMember");
  });
});
