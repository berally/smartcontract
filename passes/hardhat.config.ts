import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";
import "@typechain/hardhat";
import '@nomicfoundation/hardhat-ethers'
import '@nomicfoundation/hardhat-chai-matchers'
import "hardhat-abi-exporter";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      outputSelection: {
        "*": {
          "*": ["storageLayout"]
        }
      }
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    berachain: {
      url: process.env.BERACHAIN_RPC || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      berachain: process.env.BERACHAIN_API_KEY || "",
    },
    customChains: [
      {
        network: "berachain",
        chainId: 80084,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/testnet/evm/80084/etherscan",
          browserURL: "https://bartio.beratrail.io/"
        }
      }
    ]
  },
  typechain: {
    outDir: "./types",
    target: "ethers-v6",
  },
  abiExporter: {
    path: "./abi",
    clear: true,
    flat: true,
    only: [
      "Passes",
      "ICustomBerachainRewardsVault"
    ],
    spacing: 2,
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
  mocha: {
    timeout: 100000
  },
};

export default config;
