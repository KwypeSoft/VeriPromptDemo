# VeriPrompt

Full-stack reference for generating AI artwork, storing it on IPFS, and minting NFTs secured on Ethereum.

**IMPORTANT**: right now, only the contract owner is allowed to **mint** NFTs. This demo isn’t meant to be a full production app, but you could make it one by relaxing the minting permission in the Solidity contract so anyone can mint.

## System Snapshot
- **Frontend** — Lit + Vite UI in [`src/veriprompt-app.ts`](src/veriprompt-app.ts ) renders the wallet workflow, image preview, and minting controls.
- **Backend** — Google Cloud Function `generateAndStore` orchestrates Vertex AI Imagen, Vision annotations, Google Cloud Storage, and Pinata IPFS pinning.
- **Smart Contract** — Solidity ERC-721 contract `VeriPrompt` (Ownable + ReentrancyGuard) mints tokens referencing hashed metadata.

## Request Lifecycle
1. Wallet connects through MetaMask via [`MyApp.connectWallet`](src/veriprompt-app.ts ).
2. Prompt submission hits the Cloud Function; it generates the image, extracts attributes, pins assets, and returns metadata hashes.
3. Mint request calls [`safeMint`](src/veriprompt-app.ts ) with the metadata URI and SHA-256 hash to anchor the NFT on-chain.

## Environment Keys
| File | Purpose |
| --- | --- |
| [`.env`](.env ) | Global contract, backend, and explorer URLs consumed by Vite. |
| [`env/.env.development.example`](env/.env.development.example ) | Local development defaults for quick start. |

