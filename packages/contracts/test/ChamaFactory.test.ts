import { expect } from "chai";
import { ethers } from "hardhat";

describe("ChamaFactory", () => {
  const ONE_WEEK = 7 * 24 * 60 * 60;
  const CONTRIB = ethers.parseUnits("20", 18);

  async function deploy() {
    const [agent, creator, alice, bob, carol] = await ethers.getSigners();
    const cUSD = await ethers.deployContract("MockCUSD");
    const factory = await ethers.deployContract("ChamaFactory", [await cUSD.getAddress(), agent.address]);
    return { factory, cUSD, agent, creator, alice, bob, carol };
  }

  it("deploys a new Chama via createChama and emits ChamaCreated", async () => {
    const { factory, creator, alice, bob, carol } = await deploy();
    const members = [alice.address, bob.address, carol.address];

    const tx = await factory.connect(creator).createChama(members, CONTRIB, ONE_WEEK);
    const receipt = await tx.wait();

    const ev = receipt!.logs
      .map((l) => {
        try {
          return factory.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((p) => p && p.name === "ChamaCreated");

    expect(ev, "ChamaCreated event").to.exist;
    expect(ev!.args.creator).to.equal(creator.address);
    expect(ev!.args.index).to.equal(0);

    const chamaAddr = ev!.args.chama as string;
    const chama = await ethers.getContractAt("Chama", chamaAddr);
    expect(await chama.memberCount()).to.equal(3n);
    expect(await chama.contribution()).to.equal(CONTRIB);
    expect(await chama.cycleLength()).to.equal(BigInt(ONE_WEEK));

    expect(await factory.chamasCount()).to.equal(1);
    expect(await factory.chamaAt(0)).to.equal(chamaAddr);
  });

  it("returns latest chamas in reverse-chronological order", async () => {
    const { factory, creator, alice, bob, carol } = await deploy();
    const members = [alice.address, bob.address, carol.address];

    const txs = [];
    for (let i = 0; i < 4; i++) {
      const t = await factory.connect(creator).createChama(members, CONTRIB, ONE_WEEK);
      txs.push(await t.wait());
    }
    expect(await factory.chamasCount()).to.equal(4);

    const latest = await factory.latestChamas(3);
    expect(latest.length).to.equal(3);
    expect(latest[0]).to.equal(await factory.chamaAt(3));
    expect(latest[1]).to.equal(await factory.chamaAt(2));
    expect(latest[2]).to.equal(await factory.chamaAt(1));
  });

  it("rejects zero-address constructor params", async () => {
    const [agent] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ChamaFactory");
    await expect(Factory.deploy(ethers.ZeroAddress, agent.address)).to.be.revertedWithCustomError(
      Factory,
      "InvalidConfig",
    );
    const cUSD = await ethers.deployContract("MockCUSD");
    await expect(Factory.deploy(await cUSD.getAddress(), ethers.ZeroAddress)).to.be.revertedWithCustomError(
      Factory,
      "InvalidConfig",
    );
  });

  it("tracks chamas per creator", async () => {
    const { factory, creator, alice, bob, carol } = await deploy();
    const members = [alice.address, bob.address, carol.address];

    await factory.connect(alice).createChama(members, CONTRIB, ONE_WEEK);
    await factory.connect(creator).createChama(members, CONTRIB, ONE_WEEK);
    await factory.connect(creator).createChama(members, CONTRIB, ONE_WEEK);

    expect((await factory.chamasOf(alice.address)).length).to.equal(1);
    expect((await factory.chamasOf(creator.address)).length).to.equal(2);
  });
});
