# Vite + Web3 Environment Configuration Guide

## 📋 Environment Files Overview

This project includes multiple environment files for different deployment stages:

```
📁 Environment Files
├── .env                 # Default/base configuration
└── .env.local          # Local overrides (create if needed)
```

## 🔧 Vite Environment Variables

### **VITE_ Prefix Requirement**
⚠️ **Important**: Variables accessible in the frontend must have the `VITE_` prefix.

```bash
# ✅ Accessible in frontend
VITE_CONTRACT_ADDRESS=0x123...

# ❌ NOT accessible in frontend
CONTRACT_ADDRESS=0x123...
```

### **Key Vite Variables**

#### **Blockchain Configuration**
```bash
VITE_CHAIN_ID=31337                    # Network chain ID
VITE_CHAIN_NAME="Hardhat Local"        # Human-readable network name
VITE_RPC_URL=http://127.0.0.1:8545    # RPC endpoint
VITE_CONTRACT_ADDRESS=0x123...         # Deployed contract address
VITE_BLOCK_EXPLORER_URL=http://...     # Block explorer URL
```

#### **Development Settings**
```bash
VITE_DEV_MODE=true                     # Enable development features
VITE_DEBUG_LOGS=true                   # Show debug console logs
VITE_HOT_RELOAD=true                   # Enable hot module reload
VITE_MOCK_DATA=true                    # Use mock data when needed
```

## 🚀 Usage Examples

### **Frontend (React/Vue/Vanilla)**

```javascript
// Access environment variables in your frontend
const chainId = import.meta.env.VITE_CHAIN_ID;
const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
const rpcUrl = import.meta.env.VITE_RPC_URL;

// Example: Initialize ethers provider
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(
  import.meta.env.VITE_RPC_URL
);

const contract = new ethers.Contract(
  import.meta.env.VITE_CONTRACT_ADDRESS,
  VeriPromptABI,
  provider
);
```

### **Vite Configuration (vite.config.js)**

```javascript
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    // Define global constants
    define: {
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION),
      __CONTRACT_ADDRESS__: JSON.stringify(env.VITE_CONTRACT_ADDRESS),
    },
    
    // Development server configuration
    server: {
      port: parseInt(env.VITE_PORT) || 3000,
      host: env.VITE_HOST || 'localhost',
      open: env.VITE_OPEN_BROWSER === 'true',
    },
    
    // Build configuration
    build: {
      sourcemap: env.VITE_DEV_MODE === 'true',
    },
  };
});
```

## 🌍 Environment-Specific Configuration

### **Development Environment**
```bash
# Start development server
npm run dev

# Uses: .env.development + .env.local (if exists)
NODE_ENV=development
VITE_CHAIN_ID=31337              # Local Hardhat network
VITE_RPC_URL=http://127.0.0.1:8545
VITE_DEV_MODE=true
VITE_DEBUG_LOGS=true
```

### **Production Environment**
```bash
# Build for production
npm run build

# Uses: .env.production + .env.local (if exists)
NODE_ENV=production
VITE_CHAIN_ID=1                  # Ethereum Mainnet
VITE_RPC_URL=https://mainnet.infura.io/v3/...
VITE_DEV_MODE=false
VITE_DEBUG_LOGS=false
```

## 🔒 Security Best Practices

### **1. Environment File Security**
```bash
# ✅ Safe for frontend (public)
VITE_CONTRACT_ADDRESS=0x123...
VITE_CHAIN_ID=1

# ❌ NEVER expose in frontend
PRIVATE_KEY=0x123...              # Keep in backend only
INFURA_API_SECRET=secret          # Backend only
```

### **2. .gitignore Configuration**
```gitignore
# Environment files
.env.local
.env.*.local

# Keep committed (no secrets):
# .env
# .env.development  
# .env.production
```

### **3. Separate API Keys**
```bash
# Development (.env.development)
VITE_INFURA_PROJECT_ID=test_key_123

# Production (.env.production)  
VITE_INFURA_PROJECT_ID=prod_key_456
```

## 📱 Complete Integration Example

### **Frontend Setup**
```javascript
// src/config/web3.js
export const web3Config = {
  chainId: parseInt(import.meta.env.VITE_CHAIN_ID),
  chainName: import.meta.env.VITE_CHAIN_NAME,
  rpcUrl: import.meta.env.VITE_RPC_URL,
  contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS,
  blockExplorer: import.meta.env.VITE_BLOCK_EXPLORER_URL,
  
  // Development flags
  isDev: import.meta.env.VITE_DEV_MODE === 'true',
  debug: import.meta.env.VITE_DEBUG_LOGS === 'true',
};

// src/services/contract.js
import { ethers } from 'ethers';
import VeriPromptABI from '../abi/VeriPrompt.minimal.abi.json';
import { web3Config } from '../config/web3.js';

export class VeriPromptService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(web3Config.rpcUrl);
    this.contract = new ethers.Contract(
      web3Config.contractAddress,
      VeriPromptABI,
      this.provider
    );
  }

  async getTotalSupply() {
    return await this.contract.totalSupply();
  }

  async safeMint(to, uri, signer) {
    const contractWithSigner = this.contract.connect(signer);
    return await contractWithSigner.safeMint(to, uri);
  }
}
```

## 🎯 Environment Variables Checklist

### **Required for Frontend**
- [ ] `VITE_CHAIN_ID` - Network chain ID
- [ ] `VITE_RPC_URL` - RPC endpoint  
- [ ] `VITE_CONTRACT_ADDRESS` - Contract address
- [ ] `VITE_APP_NAME` - Application name

### **Backend Only (No VITE_ prefix)**
- [ ] `PRIVATE_KEY` - Deployment private key
- [ ] `SEPOLIA_RPC_URL` - Testnet RPC
- [ ] `ETHERSCAN_API_KEY` - For verification

## 🚦 Quick Start Commands

```bash
# 1. Copy environment template
cp .env .env.local

# 2. Update with your values
nano .env.local

# 3. Start development
npm run dev

# 4. Deploy contract (updates .env with address)
npx hardhat run scripts/deploy-veriprompt.ts --network sepolia

# 5. Extract ABI for frontend
npx tsx scripts/extract-abi.ts
```