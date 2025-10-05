import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ethers } from 'ethers';

import contractABI from './VeriPrompt.json';

// Extend Window interface to include ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const BLOCK_EXPLORER_TOKEN_URL = import.meta.env.VITE_BLOCK_EXPLORER_TOKEN_URL || 'https://sepolia.etherscan.io/token';

@customElement('my-app')
export class MyApp extends LitElement {
  @property({ type: String }) walletAddress = '';
  @property({ type: String }) prompt = 'A cyberpunk cat wearing sunglasses in Paris';
  @property({ type: String }) imageUrl = '';
  @property({ type: String }) metadataUrl = '';
  @property({ type: String }) metadataHash = '';
  @property({ type: String }) ipfsImageCid = '';
  @property({ type: String }) ipfsImageGatewayUrl = '';
  @property({ type: String }) ipfsMetadataCid = '';
  @property({ type: String }) ipfsMetadataGatewayUrl = '';
  @property({ type: String }) explorerUrl = '';
  @property({ type: String }) mintedTokenId = '';
  @property({ type: String }) mintedImageUrl = '';
  @property({ type: String }) status = 'Ready.';
  @property({ type: Boolean }) isLoading = false;
  @property({ type: Boolean }) isGenerating = false;
  @property({ type: Boolean }) isMinting = false;
  @property({ type: String }) statusLevel: 'info' | 'success' | 'warning' | 'error' = 'info';

  // Disable Shadow DOM to use global Tailwind styles
  createRenderRoot() {
    return this;
  }

  async connectWallet() {
    if (!window.ethereum) {
      this.statusLevel = 'error';
      this.status = 'Please install MetaMask.';
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      this.walletAddress = await signer.getAddress();
      this.statusLevel = 'success';
      this.status = 'Wallet connected.';
      console.log('Connected wallet (connectWallet):', this.walletAddress);
    } catch (error) {
      this.statusLevel = 'error';
      this.status = 'Failed to connect wallet.';
    }
  }

  async generateImage() {
    if (!this.prompt || this.isGenerating) return;

    if (!this.walletAddress) {
      this.statusLevel = 'error';
      this.status = 'Please connect your wallet.';
      return;
    }

    this.statusLevel = 'info';
    this.isGenerating = true;
    this.status = '🧠 Generating image...';
    this.imageUrl = '';
    this.metadataUrl = '';
    this.metadataHash = '';
    this.ipfsImageCid = '';
    this.ipfsImageGatewayUrl = '';
    this.ipfsMetadataCid = '';
    this.ipfsMetadataGatewayUrl = '';
    this.explorerUrl = '';
    this.mintedTokenId = '';
    this.mintedImageUrl = '';

    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: this.prompt }),
      });
      if (!response.ok) throw new Error('Failed to generate.');

      const data = await response.json();

      const imageGateway = data.ipfsImageGatewayUrl ?? '';
      const metadataGateway = data.ipfsMetadataGatewayUrl ?? '';
      const imageFallback = data.imageUrl ?? data.image ?? '';
      const metadataFallback = data.metadataUrl ?? data.metadata ?? '';

      this.ipfsImageCid = data.ipfsImageCid ?? '';
      this.ipfsImageGatewayUrl = imageGateway;
      this.ipfsMetadataCid = data.ipfsMetadataCid ?? '';
      this.ipfsMetadataGatewayUrl = metadataGateway;

      this.imageUrl = imageGateway || imageFallback;
      this.metadataUrl = metadataGateway || metadataFallback;

      const hash = data.metadataHash ?? '';
      this.metadataHash = hash.startsWith('0x') ? hash : (hash ? `0x${hash}` : '');

      this.statusLevel = 'success';
      this.status = '✅ Image and metadata ready!';
    } catch (error) {
      console.error('Image generation failed:', error);
      this.statusLevel = 'error';
      this.status = '❌ Error generating image.';
    } finally {
      this.isGenerating = false;
    }
  }

  async mintNFT() {
    if (!this.metadataUrl || !this.metadataHash || !window.ethereum || this.isMinting) return;
    this.isMinting = true;
    this.statusLevel = 'info';
    this.status = '✍️ Approve transaction in MetaMask...';
    this.explorerUrl = '';
    this.mintedTokenId = '';
    this.mintedImageUrl = '';

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('wallet_switchEthereumChain', [{ chainId: '0xaa36a7' }]);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);
      let receipt: any;

      try {
        const tx = await contract.safeMint(this.walletAddress, this.metadataUrl, this.metadataHash);
        console.log('Connected wallet (mintNFT):', this.walletAddress);

        this.status = '⛓️ Transaction sent...';
        receipt = await tx.wait();
      } catch (err) {
        console.log('Minting error:', err);
        this.statusLevel = 'error';
        alert('Only the contract owner can mint.');
        return;
      }

      const transferTopic = ethers.id('Transfer(address,address,uint256)');
      const transferLog = receipt.logs.find((log: any) => log.topics[0] === transferTopic);
      if (transferLog) {
        const parsedLog = contract.interface.parseLog({
          topics: transferLog.topics,
          data: transferLog.data
        });
        const tokenId = parsedLog?.args?.tokenId?.toString();
        if (tokenId) {
          this.mintedTokenId = tokenId;
          this.explorerUrl = `${BLOCK_EXPLORER_TOKEN_URL}/${CONTRACT_ADDRESS}?a=${tokenId}`;
          this.statusLevel = 'success';
          this.status = '🎉 NFT Minted!';
          await this.loadMintedImage();
        } else {
          this.statusLevel = 'warning';
          this.status = '✅ Minted, but token ID not found.';
        }
      } else {
        this.statusLevel = 'warning';
        this.status = '✅ Minted, but token ID not found.';
      }
    } catch (error) {
      console.error(error);
      this.statusLevel = 'error';
      this.status = '❌ Minting failed.';
    } finally {
      this.isMinting = false;
    }
  }

    private async loadMintedImage() {
    if (!this.metadataUrl) return;

    const metadataUrl = this.resolveResourceUrl(this.metadataUrl);
    if (!metadataUrl) return;

    try {
      const response = await fetch(metadataUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Metadata fetch failed: ${response.status} ${response.statusText}`);
      }

      const metadata = await response.json();
      const imageUrl = this.resolveResourceUrl(metadata?.image ?? metadata?.image_url);

      if (imageUrl) {
        this.mintedImageUrl = imageUrl;
      }
    } catch (error) {
      console.error('Unable to load metadata for minted token', error);
      if (!this.mintedImageUrl && this.imageUrl) {
        this.mintedImageUrl = this.resolveResourceUrl(this.imageUrl);
      }
      this.status = `${this.status} (metadata preview unavailable)`;
    }
  }

  private resolveResourceUrl(url?: string) {
    if (!url) return '';
    if (url.startsWith('ipfs://')) {
      return `https://ipfs.io/ipfs/${url.replace('ipfs://', '')}`;
    }
    return url;
  }

  private getStatusClass() {
    switch (this.statusLevel) {
      case 'success':
        return 'text-green-400';
      case 'warning':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      case 'info':
      default:
        return 'text-gray-300';
    }
  }

  render() {
    const mintedImageSrc = this.resolveResourceUrl(this.mintedImageUrl || this.imageUrl);
    const metadataHref = this.ipfsMetadataGatewayUrl || this.resolveResourceUrl(this.metadataUrl);
    return html`
      <div class="min-h-screen flex items-center justify-center p-4">
        <div class="max-w-2xl w-full p-6 bg-gray-800 text-white rounded-lg shadow-2xl">
          <h1 class="text-4xl font-bold mb-2 text-center">VeriPrompt</h1>
        <p class="text-center text-gray-400 mb-6">AI-Powered NFT Minter</p>

        ${this.walletAddress
          ? html`<p class="text-center mb-4 text-green-400">Connected: ${this.walletAddress.substring(0, 6)}...${this.walletAddress.substring(this.walletAddress.length - 4)}</p>`
          : html`<button @click=${this.connectWallet} class="w-full bg-blue-600 hover:bg-blue-700 font-bold py-2 px-4 rounded mb-4 transition-colors">Connect Wallet</button>`
        }

        <textarea
          .value=${this.prompt}
          @input=${(e: any) => this.prompt = e.target.value}
          class="w-full p-3 rounded bg-gray-700 border border-gray-600 mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
          rows="3"
        ></textarea>

        <button
          @click=${this.generateImage}
          .disabled=${this.isGenerating}
          class="w-full bg-green-600 hover:bg-green-700 font-bold py-3 px-4 rounded transition-colors"
        >
           ${this.isGenerating ? 'Generating…' : '1. Generate Image'}
        </button>

        <div class="my-6 p-4 border-2 border-dashed border-gray-600 min-h-[256px] flex items-center justify-center bg-gray-900/50 rounded-md">
          ${this.imageUrl ? html`<img src="${mintedImageSrc || this.imageUrl}" alt="Generated Art" class="max-w-full h-auto rounded-md" />` : html`<p class="text-gray-500">AI-generated image will appear here</p>`}
        </div>

      <button
          @click=${this.mintNFT}
          .disabled=${this.isMinting || this.isGenerating || !this.imageUrl || !this.metadataHash}
          class="w-full bg-purple-600 hover:bg-purple-700 font-bold py-3 px-4 rounded transition-colors"
        >
          ${this.isMinting ? 'Minting…' : '2. Mint NFT'}
        </button>

        <p class="mt-6 text-center text-sm ${this.getStatusClass()}">Status: ${this.status}</p>
        ${this.mintedTokenId ? html`
          <div class="mt-6 p-4 rounded-md border border-gray-700 bg-gray-900/60">
            <h2 class="text-2xl font-semibold text-center mb-3">Minted NFT</h2>
            ${this.mintedImageUrl ? html`
              <img src="${this.mintedImageUrl}" alt="Minted NFT preview" class="mx-auto max-h-72 rounded-md shadow-md" />
            ` : ''}
            <p class="text-center text-sm text-gray-400 mt-3">Token ID: ${this.mintedTokenId}</p>
            <div class="mt-4 flex flex-col sm:flex-row gap-3">
              ${metadataHref ? html`
                <a
                  href="${metadataHref}"
                  target="_blank"
                  class="flex-1 text-center bg-gray-700 hover:bg-gray-600 font-semibold py-2 px-4 rounded transition-colors"
                >
                  View Metadata
                </a>
              ` : ''}
              ${this.explorerUrl ? html`
                <a
                  href="${this.explorerUrl}"
                  target="_blank"
                  class="flex-1 text-center bg-sky-500 hover:bg-sky-600 font-semibold py-2 px-4 rounded transition-colors"
                >
                  View on Explorer
                </a>
              ` : ''}
            </div>
          </div>
        ` : ''}
        </div>
      </div>
    `;
  }
}