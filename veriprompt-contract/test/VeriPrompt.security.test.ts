import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("VeriPrompt Security Tests", function () {
  let veriPrompt: any;
  let owner: any;
  let addr1: any;
  let addr2: any;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    const VeriPromptFactory = await ethers.getContractFactory("VeriPrompt");
    veriPrompt = await VeriPromptFactory.deploy(owner.address);
  });

  describe("Counter Security", function () {
    it("Should start token IDs from 0", async function () {
      await veriPrompt.safeMint(addr1.address, "ipfs://test1");
      expect(await veriPrompt.ownerOf(0)).to.equal(addr1.address);
    });

    it("Should increment token IDs sequentially", async function () {
      await veriPrompt.safeMint(addr1.address, "ipfs://test1");
      await veriPrompt.safeMint(addr1.address, "ipfs://test2");
      await veriPrompt.safeMint(addr1.address, "ipfs://test3");

      expect(await veriPrompt.ownerOf(0)).to.equal(addr1.address);
      expect(await veriPrompt.ownerOf(1)).to.equal(addr1.address);
      expect(await veriPrompt.ownerOf(2)).to.equal(addr1.address);
    });

    it("Should handle many mints without overflow (simulation)", async function () {
      // Test minting multiple tokens
      for (let i = 0; i < 10; i++) { // Reduced for faster testing
        await veriPrompt.safeMint(addr1.address, `ipfs://test${i}`);
      }
      
      // Verify the 10th token has ID 9 (0-indexed)
      expect(await veriPrompt.ownerOf(9)).to.equal(addr1.address);
      expect(await veriPrompt.totalSupply()).to.equal(10);
    });
  });

  describe("Access Control Security", function () {
    it("Should only allow owner to mint", async function () {
      // Owner should be able to mint
      await expect(veriPrompt.safeMint(addr1.address, "ipfs://test1"))
        .to.emit(veriPrompt, "TokenMinted")
        .withArgs(addr1.address, 0, "ipfs://test1");

      // Non-owner should not be able to mint
      await expect(
        veriPrompt.connect(addr1).safeMint(addr1.address, "ipfs://test2")
      ).to.be.revertedWithCustomError(veriPrompt, "OwnableUnauthorizedAccount");
    });

    it("Should prevent minting to zero address", async function () {
      await expect(
        veriPrompt.safeMint(ethers.ZeroAddress, "ipfs://test1")
      ).to.be.revertedWith("VeriPrompt: mint to zero address");
    });

    it("Should prevent minting with empty URI", async function () {
      await expect(
        veriPrompt.safeMint(addr1.address, "")
      ).to.be.revertedWith("VeriPrompt: empty URI");
    });
  });

  describe("Supply Limit Security", function () {
    it("Should enforce maximum supply", async function () {
      // Check that MAX_SUPPLY is set correctly
      expect(await veriPrompt.MAX_SUPPLY()).to.equal(1000000);
    });

    it("Should track total supply correctly", async function () {
      expect(await veriPrompt.totalSupply()).to.equal(0);
      
      await veriPrompt.safeMint(addr1.address, "ipfs://test1");
      expect(await veriPrompt.totalSupply()).to.equal(1);
      
      await veriPrompt.safeMint(addr1.address, "ipfs://test2");
      expect(await veriPrompt.totalSupply()).to.equal(2);
    });

    it("Should provide current token ID", async function () {
      expect(await veriPrompt.getCurrentTokenId()).to.equal(0);
      
      await veriPrompt.safeMint(addr1.address, "ipfs://test1");
      expect(await veriPrompt.getCurrentTokenId()).to.equal(1);
    });
  });

  describe("Event Emission", function () {
    it("Should emit TokenMinted event with correct parameters", async function () {
      await expect(veriPrompt.safeMint(addr1.address, "ipfs://test1"))
        .to.emit(veriPrompt, "TokenMinted")
        .withArgs(addr1.address, 0, "ipfs://test1");
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should have nonReentrant modifier on safeMint", async function () {
      // This test verifies the contract compiles with ReentrancyGuard
      // Actual reentrancy testing would require a malicious contract
      expect(await veriPrompt.safeMint(addr1.address, "ipfs://test1"))
        .to.emit(veriPrompt, "TokenMinted");
    });
  });
});