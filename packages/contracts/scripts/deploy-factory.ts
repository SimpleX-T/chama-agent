import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId, name } = await ethers.provider.getNetwork();
  const isMainnet = name === "celo";

  const file = path.resolve(__dirname, "..", "deployments", `${chainId}.json`);

  // Bootstrap a deployment file if this is mainnet and we're deploying the
  // factory without a seed Chama (no MockCUSD on mainnet — real cUSD).
  let deployment: any;
  if (fs.existsSync(file)) {
    deployment = JSON.parse(fs.readFileSync(file, "utf-8"));
  } else if (isMainnet) {
    const cusdMainnet = process.env.CUSD_MAINNET ?? "0x765DE816845861e75A25fCA122bb6898B8B1282a";
    deployment = {
      network: name,
      chainId: chainId.toString(),
      deployer: deployer.address,
      agent: deployer.address,
      contracts: { cUSD: cusdMainnet },
      deployedAt: new Date().toISOString(),
      note: "Bootstrapped by deploy-factory.ts; no MockCUSD on mainnet — using real cUSD.",
    };
  } else {
    throw new Error(`No deployment.json for chain ${chainId}; run deploy:sepolia (or deploy-factory:mainnet) first.`);
  }

  const token = deployment.contracts.cUSD as string;
  if (!token) throw new Error("cUSD address missing in deployment.json — deploy MockCUSD first");

  console.log(`Network:   ${name} (${chainId})`);
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Token:     ${token}`);
  console.log(`Agent:     ${deployer.address} (default for factory)`);

  console.log("Deploying ChamaFactory…");
  const factory = await ethers.deployContract("ChamaFactory", [token, deployer.address]);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log(`Factory:   ${factoryAddr}`);

  deployment.contracts.ChamaFactory = factoryAddr;
  deployment.factoryDeployedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));
  console.log(`Saved ->   ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
