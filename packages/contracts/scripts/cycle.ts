/**
 * One-shot helper for a chama with env-wallet members.
 *
 * For every member of the chama whose private key lives in .env (MEMBER1/2/3),
 * this script:
 *
 *   1. Mints mcUSD to them (deployer signs) if their balance is below the
 *      contribution amount.
 *   2. Has them approve the chama contract (member signs) if their allowance
 *      is below the contribution amount.
 *   3. Calls contributeFor(member) (deployer signs — contributeFor is
 *      permissionless) if they haven't paid in this cycle yet.
 *
 * Members whose key isn't in .env (e.g. the creator's browser-connected
 * wallet) are skipped during steps 1+2 — they must mint/approve themselves
 * from the dashboard. Step 3 still runs for them if they're already
 * funded + approved, because contributeFor doesn't need their key.
 *
 * Usage:
 *   CHAMA_ADDRESS=0x... pnpm --filter @chama/contracts cycle:sepolia
 *   (falls back to deployment.json's seed Chama if CHAMA_ADDRESS isn't set)
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
  const chamaAddr = (process.env.CHAMA_ADDRESS as `0x${string}`) || (deployment.contracts.Chama as `0x${string}`);
  if (!/^0x[0-9a-fA-F]{40}$/.test(chamaAddr)) {
    throw new Error(`Invalid chama address: ${chamaAddr}`);
  }

  const [deployer] = await ethers.getSigners();
  const chama = await ethers.getContractAt("Chama", chamaAddr);
  const tokenAddr = (await chama.token()) as string;
  const cUSD = await ethers.getContractAt("MockCUSD", tokenAddr);
  const members = (await chama.members()) as string[];
  const contribution = (await chama.contribution()) as bigint;
  const currentCycle = (await chama.currentCycle()) as bigint;
  const memberCount = members.length;
  if (currentCycle >= BigInt(memberCount)) {
    console.log("Chama already completed — nothing to do.");
    return;
  }

  console.log(`\n=== Cycle helper — chama ${chamaAddr} ===`);
  console.log(`Token:       ${tokenAddr}`);
  console.log(`Members:     ${memberCount}`);
  console.log(`Contribution: ${ethers.formatUnits(contribution)} mcUSD/cycle`);
  console.log(`Cycle:       ${currentCycle} of ${memberCount}`);
  console.log(`Deployer:    ${deployer.address}\n`);

  // Build map of env-wallet members
  const envByAddr: Record<string, any> = {};
  for (const key of [
    process.env.MEMBER1_PRIVATE_KEY,
    process.env.MEMBER2_PRIVATE_KEY,
    process.env.MEMBER3_PRIVATE_KEY,
  ]) {
    if (!key) continue;
    const w = new ethers.Wallet(key, ethers.provider);
    envByAddr[w.address.toLowerCase()] = w;
  }

  // Phase 1: mint + approve for env-wallet members that need it
  console.log("--- Phase 1: fund + approve env-wallet members ---");
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const envWallet = envByAddr[member.toLowerCase()];
    if (!envWallet) {
      console.log(`  MEMBER ${i + 1} (${shortAddr(member)}): not an env wallet — owner must self-setup from the dashboard`);
      continue;
    }
    const balance = (await cUSD.balanceOf(member)) as bigint;
    if (balance < contribution) {
      const mintAmt = contribution * BigInt(memberCount) - balance; // enough for the whole rotation
      const tx = await cUSD.connect(deployer).mint(member, mintAmt);
      const r = await tx.wait();
      console.log(`  MEMBER ${i + 1}: mint(${ethers.formatUnits(mintAmt)} mcUSD) — ${r!.hash}`);
    } else {
      console.log(`  MEMBER ${i + 1}: already funded (${ethers.formatUnits(balance)} mcUSD)`);
    }
    const allowance = (await cUSD.allowance(member, chamaAddr)) as bigint;
    if (allowance < contribution) {
      const tx = await cUSD.connect(envWallet).approve(chamaAddr, ethers.MaxUint256);
      const r = await tx.wait();
      console.log(`  MEMBER ${i + 1}: approve(chama, MAX) — ${r!.hash}`);
    } else {
      console.log(`  MEMBER ${i + 1}: already approved`);
    }
  }

  // Phase 2: contributeFor every member that's ready
  console.log("\n--- Phase 2: contributeFor (permissionless) ---");
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const cycleNow = (await chama.currentCycle()) as bigint;
    if (cycleNow >= BigInt(memberCount)) {
      console.log("  Chama completed mid-loop — stopping.");
      break;
    }
    const hasContrib = (await chama.contributed(cycleNow, member)) as boolean;
    if (hasContrib) {
      console.log(`  MEMBER ${i + 1}: already paid in cycle ${cycleNow}`);
      continue;
    }
    const balance = (await cUSD.balanceOf(member)) as bigint;
    const allowance = (await cUSD.allowance(member, chamaAddr)) as bigint;
    if (balance < contribution || allowance < contribution) {
      console.log(
        `  MEMBER ${i + 1}: not ready (bal=${ethers.formatUnits(balance)} mcUSD, allow=${
          allowance > BigInt(10) ** BigInt(30) ? "MAX" : ethers.formatUnits(allowance)
        }) — skip`,
      );
      continue;
    }
    try {
      const tx = await chama.connect(deployer).contributeFor(member);
      const r = await tx.wait();
      console.log(`  MEMBER ${i + 1}: contributeFor — ${r!.hash}`);

      // Did the payout auto-fire in the same tx?
      for (const log of r!.logs) {
        try {
          const parsed = chama.interface.parseLog(log);
          if (parsed?.name === "PayoutExecuted") {
            const payeeIdx = members.findIndex(
              (m) => m.toLowerCase() === (parsed.args.payee as string).toLowerCase(),
            );
            console.log(
              `  → AUTO-PAYOUT: ${ethers.formatUnits(parsed.args.amount as bigint)} mcUSD landed in MEMBER ${
                payeeIdx + 1
              } (${shortAddr(parsed.args.payee as string)})`,
            );
          }
        } catch {
          // not our event
        }
      }
    } catch (e: any) {
      console.log(`  MEMBER ${i + 1}: contributeFor failed — ${e?.shortMessage ?? e?.message?.split("\n")[0]}`);
    }
  }

  const after = (await chama.currentCycle()) as bigint;
  console.log(`\nDone. Cycle is now: ${after}/${memberCount}`);
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
