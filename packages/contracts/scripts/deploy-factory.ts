import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId, name } = await ethers.provider.getNetwork();

  const file = path.resolve(__dirname, "..", "deployments", `${chainId}.json`);
  const deployment = JSON.parse(fs.readFileSync(file, "utf-8"));

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
