import { network } from "hardhat";

async function main() {
  console.log("Deploying LogIntegrity contract...");

  const { ethers } = await network.connect("celoSepolia");

  const contract = await ethers.deployContract("LogIntegrity");
  await contract.waitForDeployment();

  console.log("Contract deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});