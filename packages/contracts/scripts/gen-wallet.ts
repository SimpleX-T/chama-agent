import { Wallet } from "ethers";

const labels = ["DEPLOYER", "MEMBER1", "MEMBER2", "MEMBER3"];

console.log("# --- Generated wallets — paste into chama-agent/.env ---");
console.log("# Fund each address with CELO-S from https://faucet.celo.org/celo-sepolia");
console.log();
for (const label of labels) {
  const w = Wallet.createRandom();
  console.log(`${label}_PRIVATE_KEY=${w.privateKey}`);
  console.log(`${label}_ADDRESS=${w.address}`);
  console.log();
}
