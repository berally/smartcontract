import dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import '@typechain/hardhat'
import '@nomicfoundation/hardhat-ethers'
import '@nomicfoundation/hardhat-chai-matchers'
import "hardhat-abi-exporter";
import "@typechain/hardhat";

dotenv.config();

const config: HardhatUserConfig = {
  networks: {
    localhost: {
      chainId: 31337,
      url: "http://127.0.0.1:8545",
      timeout: 600000,
    },
    sepolia : {
      url: 'https://rpc2.sepolia.org',
      chainId: 11155111,
      accounts: process.env.OWNER_PRIVATE_KEY
        ?[
          process.env.OWNER_PRIVATE_KEY,
        ]:[],
    },
    berachainTestnet : {
      url: 'https://bartio.rpc.berachain.com/',
      chainId: 80084,
      accounts: process.env.OWNER_PRIVATE_KEY
        ?[
          process.env.OWNER_PRIVATE_KEY,
        ]:[],
    }
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      berachainTestnet : process.env.BERACHAIN_API_KEY || "",
    },
    customChains: [
      {
        network: "sepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://api-sepolia.etherscan.io/api",
          browserURL: "https://sepolia.etherscan.io/"
        }
      },
      {
        network: "berachainTestnet",
        chainId: 80084,
        urls: {
          apiURL: 'https://api.routescan.io/v2/network/testnet/evm/80084/etherscan',
          browserURL: "https://bartio.beratrail.io/"
        }
      },
    ]
  },
  solidity: {
    compilers: [
      {
        version: "0.8.18",
        settings: {
          outputSelection: {
            "*": {
              "*": ["storageLayout"],
            },
          },
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
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
  mocha: {
    timeout: 100000000
  },
};

export default config;
