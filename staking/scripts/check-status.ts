import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Checking status with account:", deployer.address);

  // Load deployment data
  const deploymentsDir = path.join(__dirname, "../deployments");
  const files = fs.readdirSync(deploymentsDir);
  
  for (const file of files) {
    console.log(`\nChecking deployment from ${file}:`);
    console.log("=====================================");
    
    const deploymentPath = path.join(deploymentsDir, file);
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

    // Check tokens
    const brly = await ethers.getContractAt("MockERC20", deployment.contracts.brly);
    const totalSupplyBRLY = await brly.totalSupply();
    console.log(`BRLY Total Supply: ${ethers.formatEther(totalSupplyBRLY)}`);

    const rewardToken = file.includes("v1") 
      ? await ethers.getContractAt("MockERC20", deployment.contracts.usdc)
      : await ethers.getContractAt("MockERC20", deployment.contracts.wbera);
    const totalSupplyReward = await rewardToken.totalSupply();
    console.log(`Reward Token Total Supply: ${ethers.formatEther(totalSupplyReward)}`);

    // Check Staking Contract
    const stakingAddress = deployment.contracts.stakingProxy;
    const StakingContract = file.includes("v1") ? "Staking" : "StakingV3";
    const staking = await ethers.getContractAt(StakingContract, stakingAddress);

    // Get basic info
    const totalStaked = await staking.totalStaked();
    const totalRewards = await staking.totalRewards();
    console.log(`\nStaking Contract Status:`);
    console.log(`Total Staked: ${ethers.formatEther(totalStaked)} BRLY`);
    console.log(`Total Rewards: ${ethers.formatEther(totalRewards)} ${file.includes("v1") ? "USDC" : "WBERA"}`);

    // Check implementation
    const implementation = await staking.getImplementation();
    console.log(`Implementation: ${implementation}`);
    if (implementation !== deployment.contracts.stakingImplementation) {
      console.warn("Warning: Implementation address mismatch!");
    }

    // Check configurations
    const withdrawLockingTime = await staking.withdrawLockingTime();
    console.log(`\nConfigurations:`);
    console.log(`Withdraw Locking Time: ${withdrawLockingTime} seconds`);
    if (file.includes("v1")) {
      const rewardDistributionTime = await staking.rewardDistributionTime();
      console.log(`Reward Distribution Time: ${rewardDistributionTime} seconds`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 