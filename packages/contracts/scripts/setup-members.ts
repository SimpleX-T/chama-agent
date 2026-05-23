/**
 * Testnet setup helper: mints MockCUSD to each member and has each member
 * approve the Chama contract for unlimited spend. Idempotent — running it
 * twice does nothing once balances + allowances are in place.
 *
 * In production, members approve from their own wallet (e.g., a MiniPay mini-app
 * UI). This script exists solely so that the agent cron service has no need
 * to touch member private keys.
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { ethers } from "hardhat";

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const deployment = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "deployments", `${chainId}.json`), "utf-8"),
  );
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

  const contribution = await chama.contribution();
  const memberCount = Number(await chama.memberCount());
  const need = contribution * BigInt(memberCount); // enough for a full rotation

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const bal = await cUSD.balanceOf(m.address);
    if (bal < need) {
      const mintAmt = need - bal;
      const tx = await cUSD.connect(deployer).mint(m.address, mintAmt);
      const r = await tx.wait();
      console.log(`mint(MEMBER${i + 1}, ${ethers.formatUnits(mintAmt)} mcUSD) — ${r!.hash}`);
    } else {
      console.log(`MEMBER${i + 1} already funded (${ethers.formatUnits(bal)} mcUSD) — skip`);
    }

    const allowance = await cUSD.allowance(m.address, chamaAddr);
    if (allowance < need) {
      const tx = await cUSD.connect(m).approve(chamaAddr, ethers.MaxUint256);
      const r = await tx.wait();
      console.log(`MEMBER${i + 1}.approve(chama, MAX) — ${r!.hash}`);
    } else {
      console.log(`MEMBER${i + 1} already approved — skip`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
