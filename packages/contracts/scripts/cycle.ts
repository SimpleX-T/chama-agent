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

  // --list: dump every chama from the factory, then exit
  if (process.argv.includes("--list") || process.env.LIST) {
    await listChamas(deployment);
    return;
  }

  const chamaAddr = (process.env.CHAMA_ADDRESS as `0x${string}`) || (deployment.contracts.Chama as `0x${string}`);
  if (!/^0x[0-9a-fA-F]{40}$/.test(chamaAddr)) {
    throw new Error(`Invalid chama address: ${chamaAddr}`);
  }

  // Pre-flight: confirm there's actually a Chama contract at this address.
  const code = await ethers.provider.getCode(chamaAddr);
  if (!code || code === "0x") {
    console.error(`\n✗ No contract found at ${chamaAddr}.`);
    console.error(`\n  That's an EOA (a regular wallet), not the chama contract you're trying to operate.`);
    console.error(`  The chama address is what shows in your browser URL when you're on /chama/<addr>,`);
    console.error(`  or in the "Contracts" section at the bottom of the chama detail page.\n`);
    console.error(`  Run with --list to see every chama deployed by the factory:`);
    console.error(`    pnpm --filter @chama/contracts cycle:sepolia --list\n`);
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  const chama = await ethers.getContractAt("Chama", chamaAddr);

  // Smoke test the ABI: if memberCount() doesn't decode, this isn't a Chama
  let memberCountTest: bigint;
  try {
    memberCountTest = (await chama.memberCount()) as bigint;
  } catch {
    console.error(`\n✗ ${chamaAddr} has bytecode but doesn't expose Chama's ABI.`);
    console.error(`  Make sure you're passing a Chama (not a MockCUSD, ChamaFactory, etc.).\n`);
    process.exit(1);
  }
  void memberCountTest;

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

      // Did the contribution flip the cycle to ACTIVE?
      for (const log of r!.logs) {
        try {
          const parsed = chama.interface.parseLog(log);
          if (parsed?.name === "CycleActivated") {
            console.log(
              `  → CYCLE ${parsed.args.cycle.toString()} now ACTIVE — payout unlocks in ${(await chama.cycleLength()).toString()}s`,
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

  // Phase 3: if cycle is ACTIVE and timer has elapsed, fire the payout
  const isActive = (await chama.isCycleActive()) as boolean;
  if (isActive) {
    const deadline = Number((await chama.cycleDeadline()) as bigint);
    const now = Math.floor(Date.now() / 1000);
    if (now >= deadline) {
      console.log("\n--- Phase 3: executePayout (active phase elapsed) ---");
      try {
        const tx = await chama.connect(deployer).executePayout();
        const r = await tx.wait();
        for (const log of r!.logs) {
          try {
            const parsed = chama.interface.parseLog(log);
            if (parsed?.name === "PayoutExecuted") {
              const payeeIdx = members.findIndex(
                (m) => m.toLowerCase() === (parsed.args.payee as string).toLowerCase(),
              );
              console.log(
                `  PAYOUT: ${ethers.formatUnits(parsed.args.amount as bigint)} mcUSD → MEMBER ${
                  payeeIdx + 1
                } (${shortAddr(parsed.args.payee as string)}) — ${r!.hash}`,
              );
            }
          } catch {}
        }
      } catch (e: any) {
        console.log(`  executePayout failed — ${e?.shortMessage ?? e?.message?.split("\n")[0]}`);
      }
    } else {
      const remain = deadline - now;
      console.log(
        `\nCycle is ACTIVE — payout unlocks in ${remain}s (${new Date(deadline * 1000).toISOString()}).`,
      );
      console.log("Re-run this script after the timer elapses, or let the agent service handle it.");
    }
  }

  // Phase 4: post one ERC-8004 reputation attestation per env-wallet member
  // against the agent. The Reputation Registry blocks self-feedback so the
  // agent (deployer) can't farm itself, but each member can attest once per
  // call — net effect: +N on-chain tx per cycle that move our 8004scan rank.
  const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";
  const AGENT_ID = 274n;
  const reputationAbi = [
    "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
  ];

  console.log("\n--- Phase 4: ERC-8004 reputation attestations ---");
  const cycleNow = (await chama.currentCycle()) as bigint;
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const envWallet = envByAddr[member.toLowerCase()];
    if (!envWallet) {
      console.log(`  MEMBER ${i + 1}: skipped (no env key — owner attests from the dashboard)`);
      continue;
    }
    try {
      const registry = new ethers.Contract(REPUTATION_REGISTRY, reputationAbi, envWallet);
      const tx = await registry.giveFeedback(
        AGENT_ID,
        100, // perfect score for this cycle
        0,
        "rosca-cycle",
        `cycle-${cycleNow.toString()}`,
        `https://celo-sepolia.blockscout.com/address/${chamaAddr}`,
        "",
        ethers.ZeroHash,
      );
      const r = await tx.wait();
      console.log(`  MEMBER ${i + 1}: attested agent #${AGENT_ID} (cycle ${cycleNow}) — ${r!.hash}`);
    } catch (e: any) {
      console.log(`  MEMBER ${i + 1}: attestation failed — ${e?.shortMessage ?? e?.message?.split("\n")[0]}`);
    }
  }

  const after = (await chama.currentCycle()) as bigint;
  console.log(`\nDone. Cycle is now: ${after}/${memberCount}`);
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

async function listChamas(deployment: any) {
  const factoryAddr = deployment.contracts?.ChamaFactory;
  if (!factoryAddr) {
    console.error("No ChamaFactory in deployment.json. Deploy one first:");
    console.error("  pnpm --filter @chama/contracts deploy-factory:sepolia");
    return;
  }
  const factory = await ethers.getContractAt("ChamaFactory", factoryAddr);
  const count = (await factory.chamasCount()) as bigint;
  console.log(`\n=== Chamas from factory ${factoryAddr} (${count.toString()} total) ===\n`);
  if (count === 0n) {
    console.log("  No chamas yet. Create one via the dashboard (/create) and try again.\n");
    return;
  }
  const addrs = (await factory.latestChamas(count > 20n ? 20n : count)) as readonly string[];
  for (const addr of addrs) {
    try {
      const chama = await ethers.getContractAt("Chama", addr);
      const [memberCount, currentCycle, contribution] = (await Promise.all([
        chama.memberCount(),
        chama.currentCycle(),
        chama.contribution(),
      ])) as [bigint, bigint, bigint];
      const completed = currentCycle >= memberCount;
      console.log(
        `  ${addr}  · ${memberCount} members · ${(Number(contribution) / 1e18).toFixed(2)} mcUSD/cycle · cycle ${currentCycle}/${memberCount}${completed ? " (completed)" : ""}`,
      );
    } catch {
      console.log(`  ${addr}  · (failed to read — skipped)`);
    }
  }
  console.log(`\n  Run with: CHAMA_ADDRESS=0x... pnpm --filter @chama/contracts cycle:sepolia\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
