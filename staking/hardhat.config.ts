import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-abi-exporter";
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
    },
    berachainMainnet : {
      url: 'https://rpc.berachain.com/',
      chainId: 80094,
      accounts: process.env.OWNER_PRIVATE_KEY
          ?[
            process.env.OWNER_PRIVATE_KEY,
          ]:[],
    },
    hardhat: {
      allowUnlimitedContractSize: true
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
      {
        network: "berachainMainnet",
        chainId: 80094,
        urls: {
          apiURL: 'https://api.routescan.io/v2/network/mainnet/evm/80094/etherscan',
          // apiURL: 'https://api.berascan.com/api',
          browserURL: "https://berascan.com/"
        }
      },
    ]
  },
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
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
