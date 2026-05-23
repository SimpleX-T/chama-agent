import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { ethers } from "hardhat";

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const deploymentPath = path.resolve(__dirname, "..", "deployments", `${chainId}.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

  const [deployer] = await ethers.getSigners();
  const cUSD = await ethers.getContractAt("MockCUSD", deployment.contracts.cUSD);
  const chama = await ethers.getContractAt("Chama", deployment.contracts.Chama);
  const chamaAddr = await chama.getAddress();

  const memberKeys = [
    process.env.MEMBER1_PRIVATE_KEY!,
    process.env.MEMBER2_PRIVATE_KEY!,
    process.env.MEMBER3_PRIVATE_KEY!,
  ];
  if (memberKeys.some((k) => !k)) throw new Error("MEMBER{1,2,3}_PRIVATE_KEY missing in .env");
  const members = memberKeys.map((k) => new ethers.Wallet(k, ethers.provider));

  console.log(`\n=== ChamaAgent demo — chain ${chainId} ===`);
  console.log(`Chama:    ${chamaAddr}`);
  console.log(`MockCUSD: ${await cUSD.getAddress()}`);
  console.log(`Members:  ${members.map((m) => m.address).join(", ")}\n`);

  const contribution = await chama.contribution();
  const memberCount = Number(await chama.memberCount());
  const startCycle = Number(await chama.currentCycle());
  if (startCycle >= memberCount) {
    console.log("Chama already completed — redeploy to run a fresh rotation.");
    return;
  }
  const cyclesRemaining = memberCount - startCycle;
  const need = contribution * BigInt(cyclesRemaining);

  console.log("--- Setup: top-up balances and approvals ---");
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const bal = await cUSD.balanceOf(m.address);
    if (bal < need) {
      const mintAmt = need - bal;
      const tx = await cUSD.connect(deployer).mint(m.address, mintAmt);
      const r = await tx.wait();
      console.log(`  mint(MEMBER${i + 1}, ${ethers.formatUnits(mintAmt)} mcUSD) — ${r!.hash}`);
    }
    const allowance = await cUSD.allowance(m.address, chamaAddr);
    if (allowance < need) {
      const tx = await cUSD.connect(m).approve(chamaAddr, ethers.MaxUint256);
      const r = await tx.wait();
      console.log(`  MEMBER${i + 1}.approve(chama, MAX) — ${r!.hash}`);
    }
  }

  console.log("\n--- Running rotation ---");
  const onChainMembers = await chama.members();
  for (let cycle = startCycle; cycle < memberCount; cycle++) {
    const expectedPayee = onChainMembers[cycle];
    const memberIdx = members.findIndex((m) => m.address.toLowerCase() === expectedPayee.toLowerCase());
    console.log(`\nCycle ${cycle} — payee MEMBER${memberIdx + 1} (${expectedPayee})`);

    for (let i = 0; i < members.length; i++) {
      const tx = await chama.contributeFor(members[i].address);
      const r = await tx.wait();
      console.log(`  contributeFor(MEMBER${i + 1}) — ${r!.hash}`);
    }

    const tx = await chama.connect(deployer).executePayout();
    const r = await tx.wait();
    const log = r!.logs.find((l) => {
      try {
        return chama.interface.parseLog(l)?.name === "PayoutExecuted";
      } catch {
        return false;
      }
    });
    const parsed = log ? chama.interface.parseLog(log) : null;
    const paidAmount = parsed?.args[2] as bigint | undefined;
    console.log(`  executePayout()              — ${r!.hash}`);
    if (paidAmount !== undefined) {
      console.log(`  payout: ${ethers.formatUnits(paidAmount)} mcUSD -> MEMBER${memberIdx + 1}`);
    }
  }

  console.log("\n=== Chama completed — all 3 members paid in order ===");
  console.log(`Explorer: https://celo-sepolia.blockscout.com/address/${chamaAddr}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
