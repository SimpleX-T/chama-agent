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
  const chama = await ethers.getContractAt("Chama", deployment.contracts.Chama);
  const cUSD = await ethers.getContractAt("MockCUSD", deployment.contracts.cUSD);

  console.log("On-chain Chama state:");
  console.log("  members:        ", await chama.members());
  console.log("  memberCount:    ", await chama.memberCount());
  console.log("  currentCycle:   ", await chama.currentCycle());
  console.log("  currentPayee:   ", await chama.currentPayee());
  console.log("  contribution:   ", (await chama.contribution()).toString());
  console.log("  cycleLength:    ", (await chama.cycleLength()).toString());
  console.log("  contract bal:   ", (await cUSD.balanceOf(deployment.contracts.Chama)).toString());

  console.log("\nMember balances:");
  for (const m of deployment.members) {
    console.log(`  ${m}: ${(await cUSD.balanceOf(m)).toString()}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
