import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';

const SEPOLIA_KEY = process.env.DEPLOYER_PRIVATE_KEY;
// Mainnet wallet is a *separate* env var so the testnet key doesn't accidentally
// sign real-cUSD transactions. Falls back to DEPLOYER_PRIVATE_KEY only if set
// AND no MAINNET_DEPLOYER_PRIVATE_KEY is configured.
const MAINNET_KEY = process.env.MAINNET_DEPLOYER_PRIVATE_KEY;
const sepoliaAccounts = SEPOLIA_KEY ? [SEPOLIA_KEY] : [];
const mainnetAccounts = MAINNET_KEY ? [MAINNET_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    // 0.8.24 — our Chama / Factory / MockCUSD
    // 0.8.28 — @selfxyz/contracts (SelfVerificationRoot et al)
    compilers: [
      { version: '0.8.24', settings: { optimizer: { enabled: true, runs: 200 } } },
      { version: '0.8.28', settings: { optimizer: { enabled: true, runs: 200 } } },
    ],
  },
  networks: {
    celoSepolia: {
      url: process.env.CELO_SEPOLIA_RPC ?? 'https://forno.celo-sepolia.celo-testnet.org',
      chainId: Number(process.env.CELO_SEPOLIA_CHAIN_ID ?? 11142220),
      accounts: sepoliaAccounts,
    },
    celo: {
      // CELO_RPC may be a comma-separated list (for viem fallback); Hardhat
      // only takes one URL, so we use the first.
      url: (process.env.CELO_RPC?.split(',')[0] ?? 'https://forno.celo.org').trim(),
      chainId: 42220,
      accounts: mainnetAccounts,
    },
  },
  etherscan: {
    apiKey: {
      celoSepolia: process.env.CELOSCAN_API_KEY ?? '',
      celo: process.env.CELOSCAN_API_KEY ?? '',
    },
    customChains: [
      {
        network: 'celoSepolia',
        chainId: 11142220,
        urls: {
          apiURL: 'https://api-sepolia.celoscan.io/api',
          browserURL: 'https://celo-sepolia.blockscout.com',
        },
      },
      {
        network: 'celo',
        chainId: 42220,
        urls: {
          apiURL: 'https://api.celoscan.io/api',
          browserURL: 'https://celoscan.io',
        },
      },
    ],
  },
};

export default config;
