import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { ethers } from "hardhat";

const SELF_HUB_SEPOLIA = "0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74";
const SELF_HUB_MAINNET = "0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF";

/**
 * Verification config — must mirror the frontend's `disclosures` exactly.
 * Frontend currently sets `{ ofac: true }`; matching here.
 *
 * Struct (from SelfUtils.UnformattedVerificationConfigV2):
 *   olderThan          uint256   age floor; 0 = no age requirement
 *   forbiddenCountries string[]  ISO 3166-1 alpha-3 codes to reject
 *   ofacEnabled        bool      OFAC sanctions screening
 */
const CONFIG = {
  olderThan: 0n,
  forbiddenCountries: [] as string[],
  ofacEnabled: true,
};

const SCOPE_SEED = "chamaagent"; // ≤ 31 ASCII chars

async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId, name } = await ethers.provider.getNetwork();
  const isMainnet = name === "celo";
  const hub = isMainnet ? SELF_HUB_MAINNET : SELF_HUB_SEPOLIA;

  console.log(`Network:        ${name} (${chainId})`);
  console.log(`Deployer:       ${deployer.address}`);
  console.log(`Self Hub:       ${hub}`);
  console.log(`Scope seed:     "${SCOPE_SEED}"`);
  console.log(`Config:         olderThan=${CONFIG.olderThan}, forbiddenCountries=[${CONFIG.forbiddenCountries.join(",")}], ofacEnabled=${CONFIG.ofacEnabled}`);

  console.log("\nDeploying ChamaVerifier…");
  const verifier = await ethers.deployContract("ChamaVerifier", [
    hub,
    SCOPE_SEED,
    CONFIG,
  ]);
  await verifier.waitForDeployment();
  const addr = await verifier.getAddress();
  console.log(`ChamaVerifier:  ${addr}`);

  // Read back the computed scope so the frontend can use it
  const scopeUint = (await verifier.scope()) as bigint;
  const configId = (await verifier.verificationConfigId()) as string;
  console.log(`Computed scope: ${scopeUint.toString()}`);
  console.log(`Config id:      ${configId}`);

  // Update deployment.json (bootstrap if missing — same pattern as deploy-factory)
  const file = path.resolve(__dirname, "..", "deployments", `${chainId}.json`);
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
    };
  } else {
    throw new Error(`No deployment.json for chain ${chainId}; run deploy:sepolia first.`);
  }
  deployment.contracts.ChamaVerifier = addr;
  deployment.self = {
    hub,
    scopeSeed: SCOPE_SEED,
    scope: scopeUint.toString(),
    configId,
    config: {
      olderThan: CONFIG.olderThan.toString(),
      forbiddenCountries: CONFIG.forbiddenCountries,
      ofacEnabled: CONFIG.ofacEnabled,
    },
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));
  console.log(`Saved ->        ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
