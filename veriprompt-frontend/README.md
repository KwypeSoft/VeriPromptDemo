# VeriPrompt Frontend

Lit + Vite frontend for generating AI artwork, storing assets on IPFS/Pinata, and minting NFTs with the VeriPrompt smart contract.

---

## ✨ Features

- Wallet connection via MetaMask using `ethers@6`
- Prompt submission to a Google Cloud Function backend
- Automatic handling of Pinata and Google Cloud Storage URLs
- Tailwind CSS v4 styling applied globally (shadow DOM disabled)
- Structured status messaging with color-coded log levels
- NFT minting that records the metadata hash on-chain
- Minted NFT preview with metadata and explorer shortcuts

---

## 🧱 Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | [Lit 3](https://lit.dev/) |
| Build Tool | [Vite 7](https://vitejs.dev/) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) |
| Web3 | [ethers 6](https://docs.ethers.org/) |
| Node Runtime | Node 18+ (tested on 20.x) |

---

## ⚙️ Prerequisites

- **Node.js** 18 or newer (LTS recommended)
- **npm** (ships with Node)
- **MetaMask** extension installed in your browser
- Access to the VeriPrompt smart contract address
- Google Cloud Function endpoint capable of returning generation + IPFS metadata

> The frontend expects the backend to return Pinata gateway URLs when available; it falls back to Google Cloud Storage URLs otherwise.

---

## 🔐 Environment Configuration

Environment variables are read via Vite’s standard precedence:

1. `.env`
2. `.env.local`
3. `.env.<mode>`
4. `.env.<mode>.local`

### Required Keys

| Key | Description |
| --- | --- |
| `VITE_CONTRACT_ADDRESS` | Deployed VeriPrompt contract address (Sepolia by default) |
| `VITE_BACKEND_URL` | Google Cloud Function endpoint that generates art + metadata |
| `VITE_BLOCK_EXPLORER_TOKEN_URL` | Optional: base URL to view tokens (defaults to Sepolia Etherscan) |

### Quick Setup

```powershell
cp .env.example .env
cp env/.env.development.example .env.local  # customize values for local dev
```

Update `.env.local` with your actual contract address, backend URL, and any explorer overrides. Restart the dev server after changes.

---

## 🚀 Development Workflow

```powershell
npm install
npm run dev
```

- The dev server binds to `0.0.0.0`, allowing access from Windows Sandbox or other devices on the LAN. Use `http://<host-ip>:5173/` externally.
- Hot Module Replacement (HMR) is enabled by default.

### Other Scripts

| Command | Description |
| --- | --- |
| `npm run build` | Type-checks with `tsc` and produces a production build via Vite |
| `npm run preview` | Serves the production build locally |

---

## 🧠 User Flow

1. **Connect Wallet** – Requests MetaMask connection and switches to Sepolia (`wallet_switchEthereumChain`).
2. **Generate Image** – Posts the prompt to the backend. Response fields update UI state:
   - `ipfsImageGatewayUrl`, `ipfsMetadataGatewayUrl`
   - `ipfsImageCid`, `ipfsMetadataCid`
   - `metadataHash` (hex; prefixed with `0x` for on-chain use)
3. **Mint NFT** – Calls `safeMint(address, metadataUrl, metadataHash)`; waits for receipt and extracts `tokenId` from Transfer logs.
4. **Preview** – Displays minted image (IPFS or fallback) plus metadata/explorer links.

Status messages expose four log levels—`info`, `success`, `warning`, `error`—which map to Tailwind text colors for instant visual feedback.

---

## 📦 Backend Contract

The frontend expects the Google Cloud Function to return JSON similar to:

```json
{
  "metadataHash": "00fde7…",
  "ipfsImageCid": "Qmd4w…",
  "ipfsImageGatewayUrl": "https://gateway.pinata.cloud/ipfs/Qmd4w…",
  "ipfsMetadataCid": "Qmb33…",
  "ipfsMetadataGatewayUrl": "https://gateway.pinata.cloud/ipfs/Qmb33…",
  "imageUrl": "https://storage.googleapis.com/...",            // optional fallback
  "metadataUrl": "https://storage.googleapis.com/...",        // optional fallback
  "original_prompt": "A cyberpunk cat…",
  "attributes": [ { "trait_type": "Cat", "value": "99%" } ]
}
```

The frontend uses Pinata gateway URLs when provided; otherwise it reverts to the Google Cloud Storage URLs.

---

## 🧾 Metadata & IPFS

- `metadataHash` is forwarded to the contract during minting so the hash is recorded on-chain.
- `loadMintedImage()` fetches metadata (if accessible) and extracts the resulting IPFS image for preview.
- `resolveResourceUrl()` converts `ipfs://` URIs into standard gateways (`https://ipfs.io/ipfs/...`).

> If metadata retrieval fails (e.g., due to CORS timing), the UI logs a warning and falls back to the locally generated image.

---

## 🧰 Troubleshooting

| Issue | Resolution |
| --- | --- |
| MetaMask opens on Polygon | The app never switched chains—ensure `wallet_switchEthereumChain` is executed before signing. |
| `.env.local` not used | Ensure `.env.development` doesn’t redefine values; by default it ships with only comments. |
| Metadata preview unavailable | Check gateway accessibility/CORS; the UI will continue using the generated image. |

---

## 📄 License

Released under the [MIT License](LICENSE). You may use, modify, and distribute this project freely, including in commercial applications, provided the original copyright notice and this permission notice are included.
