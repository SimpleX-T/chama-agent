import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId, name } = await ethers.provider.getNetwork();

  console.log(`Network:  ${name} (${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance:  ${ethers.formatEther(bal)} native`);
  if (bal === 0n) throw new Error("Deployer has 0 balance — fund via the faucet first");

  const members = [
    process.env.MEMBER1_ADDRESS,
    process.env.MEMBER2_ADDRESS,
    process.env.MEMBER3_ADDRESS,
  ];
  if (members.some((m) => !m || !/^0x[0-9a-fA-F]{40}$/.test(m))) {
    throw new Error("MEMBER{1,2,3}_ADDRESS missing or invalid in .env");
  }

  const isMainnet = name === "celo";
  let cUSDAddr: string;
  if (isMainnet) {
    cUSDAddr = process.env.CUSD_MAINNET!;
    if (!cUSDAddr) throw new Error("CUSD_MAINNET missing in .env");
    console.log(`cUSD:     ${cUSDAddr} (real)`);
  } else {
    console.log("Deploying MockCUSD…");
    const cUSD = await ethers.deployContract("MockCUSD");
    await cUSD.waitForDeployment();
    cUSDAddr = await cUSD.getAddress();
    console.log(`MockCUSD: ${cUSDAddr}`);
  }

  // Demo-friendly params: 1 cUSD per cycle, 5-min ACTIVE phase, 30-day open
  const CONTRIBUTION = ethers.parseUnits("1", 18);
  const CYCLE_LENGTH_SEC = 5 * 60;
  const OPEN_TIMEOUT_SEC = 30 * 24 * 60 * 60;

  console.log("Deploying Chama…");
  const chama = await ethers.deployContract("Chama", [
    cUSDAddr,
    deployer.address, // agent = deployer for v0
    members,
    CONTRIBUTION,
    CYCLE_LENGTH_SEC,
    OPEN_TIMEOUT_SEC,
  ]);
  await chama.waitForDeployment();
  const chamaAddr = await chama.getAddress();
  console.log(`Chama:    ${chamaAddr}`);

  const deployment = {
    network: name,
    chainId: chainId.toString(),
    deployer: deployer.address,
    agent: deployer.address,
    members,
    contracts: { MockCUSD: isMainnet ? null : cUSDAddr, cUSD: cUSDAddr, Chama: chamaAddr },
    contributionWei: CONTRIBUTION.toString(),
    cycleLengthSec: CYCLE_LENGTH_SEC,
    deployedAt: new Date().toISOString(),
    txHashes: {
      Chama: chama.deploymentTransaction()?.hash,
    },
  };

  const outDir = path.resolve(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${chainId}.json`);
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));
  console.log(`Saved:    ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
