import { ethers, network, upgrades, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function verify(contractAddress: string, args: any[]) {
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
    console.log(`Verified contract at ${contractAddress}`);
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("Contract is already verified!");
    } else {
      console.error(error);
    }
  }
}

async function saveDeployment(networkName: string, addresses: any) {
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  const filePath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(addresses, null, 2));
  console.log(`Deployment addresses saved to ${filePath}`);
}

async function main() {
  // Kiểm tra môi trường deploy
  if (network.name === "hardhat") {
    console.warn(
      "You are trying to deploy a contract to the Hardhat Network, which" +
      "gets automatically created and destroyed every time. Use the Hardhat" +
      " option '--network localhost' to deploy to a local network"
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));
  console.log("Network:", network.name);

  // Deploy MockERC20 tokens first (chỉ cho môi trường test)
  let brlyAddress: string;
  let wberaAddress: string;

  if (network.name === "localhost" || network.name === "testnet") {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    console.log("\nDeploying BRLY token...");
    const brly = await MockERC20.deploy("Berally Token", "BRLY");
    await brly.waitForDeployment();
    brlyAddress = await brly.getAddress();
    console.log("BRLY token deployed to:", brlyAddress);

    console.log("\nDeploying WBERA token...");
    const wbera = await MockERC20.deploy("Wrapped BERA", "WBERA");
    await wbera.waitForDeployment();
    wberaAddress = await wbera.getAddress();
    console.log("WBERA token deployed to:", wberaAddress);

    // Verify mock tokens
    if (network.name === "testnet") {
      console.log("\nVerifying mock tokens...");
      await verify(brlyAddress, ["Berally Token", "BRLY"]);
      await verify(wberaAddress, ["Wrapped BERA", "WBERA"]);
    }
  } else {
    // Mainnet addresses
    brlyAddress = "MAINNET_BRLY_ADDRESS"; // TODO: Replace with actual mainnet address
    wberaAddress = "MAINNET_WBERA_ADDRESS"; // TODO: Replace with actual mainnet address
  }

  // Deploy StakingV3 contract
  console.log("\nDeploying StakingV3 contract...");
  const withdrawLockingTime = 7 * 24 * 60 * 60; // 7 days in seconds

  const StakingV3 = await ethers.getContractFactory("StakingV3");
  const stakingV3 = await upgrades.deployProxy(StakingV3, [
    brlyAddress,
    wberaAddress,
    withdrawLockingTime
  ], {
    initializer: 'initialize',
    kind: 'uups'
  });
  await stakingV3.waitForDeployment();

  const stakingV3Address = await stakingV3.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(stakingV3Address);

  console.log("StakingV3 proxy deployed to:", stakingV3Address);
  console.log("Implementation contract deployed to:", implementationAddress);

  // Verify StakingV3 contracts if on testnet or mainnet
  if (network.name !== "localhost" && network.name !== "hardhat") {
    console.log("\nVerifying StakingV3 contracts...");
    // Verify implementation contract
    await verify(implementationAddress, []);
  }

  // Save deployment addresses
  const deploymentData = {
    network: network.name,
    deployer: deployer.address,
    contracts: {
      brly: brlyAddress,
      wbera: wberaAddress,
      stakingV3Proxy: stakingV3Address,
      stakingV3Implementation: implementationAddress
    },
    timestamp: new Date().toISOString()
  };

  await saveDeployment(network.name, deploymentData);

  console.log("\nDeployment Summary:");
  console.log("===================");
  console.log("Network:", network.name);
  console.log("BRLY Token:", brlyAddress);
  console.log("WBERA Token:", wberaAddress);
  console.log("StakingV3 Proxy:", stakingV3Address);
  console.log("StakingV3 Implementation:", implementationAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 