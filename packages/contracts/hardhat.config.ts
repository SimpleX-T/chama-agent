import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';

const DEPLOYER = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = DEPLOYER ? [DEPLOYER] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    celoSepolia: {
      url: process.env.CELO_SEPOLIA_RPC ?? 'https://forno.celo-sepolia.celo-testnet.org',
      chainId: Number(process.env.CELO_SEPOLIA_CHAIN_ID ?? 11142220),
      accounts,
    },
    celo: {
      url: process.env.CELO_RPC ?? 'https://forno.celo.org',
      chainId: 42220,
      accounts,
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
