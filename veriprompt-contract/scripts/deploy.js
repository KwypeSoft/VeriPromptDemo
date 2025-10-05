async function main() {
  const [deployer] = await ethers.getSigners();
  const VeriPrompt = await ethers.getContractFactory("VeriPrompt");
  const veriprompt = await VeriPrompt.deploy(deployer.address);
  await veriprompt.waitForDeployment();
  console.log(`VeriPrompt deployed to: ${await veriprompt.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});