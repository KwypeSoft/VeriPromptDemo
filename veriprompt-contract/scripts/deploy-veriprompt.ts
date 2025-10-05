import { network } from "hardhat";

const { ethers } = await network.connect();

async function main() {
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("No signer available. Check your network configuration and PRIVATE_KEY env variable.");
  }

  const [deployer] = signers;

  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("Deploying VeriPrompt contract with the account:", deployer.address);
  console.log("Account balance:", balance.toString());

  const initialOwner = process.env.INITIAL_OWNER_ADDRESS || deployer.address;
  if (!initialOwner) {
    throw new Error("INITIAL_OWNER_ADDRESS environment variable is missing.");
  }

  if (!ethers.isAddress(initialOwner)) {
    throw new Error(
      `INITIAL_OWNER_ADDRESS must be a checksummed 0x address. Received: ${initialOwner}`
    );
  }

  const VeriPrompt = await ethers.getContractFactory("VeriPrompt");
  const veriPrompt = await VeriPrompt.deploy(initialOwner);
  await veriPrompt.waitForDeployment();

  const contractAddress = await veriPrompt.getAddress();

  console.log("VeriPrompt contract deployed to:", contractAddress);
  console.log("Owner:", await veriPrompt.owner());
  console.log("Max Supply:", await veriPrompt.MAX_SUPPLY());
  console.log("Current Token ID:", await veriPrompt.getCurrentTokenId());

  if (process.env.VERIPROMPT_CONTRACT_ADDRESS !== contractAddress) {
    console.log("⚠️  Remember to update VERIPROMPT_CONTRACT_ADDRESS in your env files with:", contractAddress);
  }
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});