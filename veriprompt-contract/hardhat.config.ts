import type { HardhatUserConfig } from "hardhat/config";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: [".env.local", ".env"] });

console.log("Using SEPOLIA_RPC_URL:", process.env.SEPOLIA_RPC_URL);
console.log("Using PRIVATE_KEY:", process.env.PRIVATE_KEY);

import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

// Helper function to get private key or empty array
function getPrivateKey(): string[] {
  const privateKey = process.env.PRIVATE_KEY;
  if (privateKey && privateKey !== "0xYourMetaMaskPrivateKey" && privateKey.startsWith("0x")) {
    return [privateKey];
  }
  return [];
}

// Helper function to get RPC URL with fallback
function getRpcUrl(envVar: string, fallback: string): string {
  const url = process.env[envVar];
  if (url && !url.includes("YOUR_")) {
    return url;
  }
  return fallback;
}

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: 31337,
    },
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: getRpcUrl("SEPOLIA_RPC_URL", "https://eth-sepolia.g.alchemy.com/v2/EGeoP6H3-TdUQQVUL2TlPTblSiFrBShq"),
      accounts: getPrivateKey(),
    },
    mainnet: {
      type: "http",
      chainType: "l1", 
      url: getRpcUrl("MAINNET_RPC_URL", "https://mainnet.infura.io/v3/YOUR_INFURA_KEY"),
      accounts: getPrivateKey(),
    },
    polygon: {
      type: "http",
      chainType: "l1",
      url: getRpcUrl("POLYGON_RPC_URL", "https://polygon-mainnet.infura.io/v3/YOUR_INFURA_KEY"), 
      accounts: getPrivateKey(),
    },
  },
};

export default config;
