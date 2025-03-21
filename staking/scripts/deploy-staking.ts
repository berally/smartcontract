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
  
  const filePath = path.join(deploymentsDir, `${networkName}-v1.json`);
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
  let usdcAddress: string;

  if (network.name === "localhost" || network.name === "testnet") {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    console.log("\nDeploying BRLY token...");
    const brly = await MockERC20.deploy("Berally Token", "BRLY");
    await brly.waitForDeployment();
    brlyAddress = await brly.getAddress();
    console.log("BRLY token deployed to:", brlyAddress);

    console.log("\nDeploying USDC token...");
    const usdc = await MockERC20.deploy("USD Coin", "USDC");
    await usdc.waitForDeployment();
    usdcAddress = await usdc.getAddress();
    console.log("USDC token deployed to:", usdcAddress);

    // Verify mock tokens
    if (network.name === "testnet") {
      console.log("\nVerifying mock tokens...");
      await verify(brlyAddress, ["Berally Token", "BRLY"]);
      await verify(usdcAddress, ["USD Coin", "USDC"]);
    }

    // Mint initial supply for testing
    if (network.name === "localhost") {
      console.log("\nMinting initial supply for testing...");
      const mintAmount = ethers.parseEther("1000000"); // 1 million tokens
      await brly.mint(deployer.address, mintAmount);
      await usdc.mint(deployer.address, mintAmount);
      console.log("Minted 1,000,000 BRLY and USDC to:", deployer.address);
    }
  } else {
    // Mainnet addresses
    brlyAddress = "MAINNET_BRLY_ADDRESS"; // TODO: Replace with actual mainnet address
    usdcAddress = "MAINNET_USDC_ADDRESS"; // TODO: Replace with actual mainnet address
  }

  // Deploy Staking contract
  console.log("\nDeploying Staking contract...");
  const withdrawLockingTime = 7 * 24 * 60 * 60; // 7 days in seconds
  const rewardDistributionTime = 30 * 24 * 60 * 60; // 30 days in seconds

  const Staking = await ethers.getContractFactory("Staking");
  const staking = await upgrades.deployProxy(Staking, [
    brlyAddress,
    usdcAddress,
    withdrawLockingTime,
    rewardDistributionTime
  ], {
    initializer: 'initialize',
    kind: 'uups'
  });
  await staking.waitForDeployment();

  const stakingAddress = await staking.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(stakingAddress);

  console.log("Staking proxy deployed to:", stakingAddress);
  console.log("Implementation contract deployed to:", implementationAddress);

  // Verify Staking contracts if on testnet or mainnet
  if (network.name !== "localhost" && network.name !== "hardhat") {
    console.log("\nVerifying Staking contracts...");
    // Verify implementation contract
    await verify(implementationAddress, []);
  }

  // Save deployment addresses
  const deploymentData = {
    network: network.name,
    deployer: deployer.address,
    contracts: {
      brly: brlyAddress,
      usdc: usdcAddress,
      stakingProxy: stakingAddress,
      stakingImplementation: implementationAddress
    },
    config: {
      withdrawLockingTime,
      rewardDistributionTime
    },
    timestamp: new Date().toISOString()
  };

  await saveDeployment(network.name, deploymentData);

  console.log("\nDeployment Summary:");
  console.log("===================");
  console.log("Network:", network.name);
  console.log("BRLY Token:", brlyAddress);
  console.log("USDC Token:", usdcAddress);
  console.log("Staking Proxy:", stakingAddress);
  console.log("Staking Implementation:", implementationAddress);
  console.log("\nConfiguration:");
  console.log("Withdraw Locking Time:", withdrawLockingTime, "seconds");
  console.log("Reward Distribution Time:", rewardDistributionTime, "seconds");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 