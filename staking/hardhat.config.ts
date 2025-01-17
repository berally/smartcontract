import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-abi-exporter";
import "@openzeppelin/hardhat-upgrades";
import dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  networks: {
    localhost: {
      chainId: 31337,
      url: "http://127.0.0.1:8545",
      timeout: 600000,
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
      berachainTestnet : process.env.BERACHAIN_API_KEY || "",
    },
    customChains: [
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
        version: "0.8.24",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 20,
          },
        },
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
      "Staking",
      "Rewards",
    ],
    spacing: 2,
  },
  mocha: {
    timeout: 100000000
  },
};

export default config;
