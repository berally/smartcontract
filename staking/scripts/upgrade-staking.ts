import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading contract with the account:", deployer.address);

  // Address of the proxy contract to upgrade
  const PROXY_ADDRESS = "YOUR_PROXY_ADDRESS";
  
  // Deploy WBERA token since it's needed for V3
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  console.log("Deploying WBERA token...");
  const wbera = await MockERC20.deploy("Wrapped BERA", "WBERA");
  await wbera.waitForDeployment();
  console.log("WBERA token deployed to:", await wbera.getAddress());

  // Get the current implementation address
  const oldImplementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("Current implementation address:", oldImplementationAddress);

  // Upgrade to StakingV3
  console.log("Upgrading to StakingV3...");
  const StakingV3 = await ethers.getContractFactory("StakingV3");
  const stakingV3 = await upgrades.upgradeProxy(PROXY_ADDRESS, StakingV3);
  await stakingV3.waitForDeployment();

  // Get the new implementation address
  const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(await stakingV3.getAddress());
  console.log("New implementation address:", newImplementationAddress);

  // Note: StakingV3 doesn't have a direct function to migrate from USDC to WBERA
  // You'll need to handle the migration of rewards and balances manually
  console.log("\nIMPORTANT: Manual steps required after upgrade:");
  console.log("1. Transfer any remaining USDC rewards from the contract");
  console.log("2. Update reward distributor settings if needed");
  console.log("3. Verify all staker balances and rewards are correct");

  // Verify upgrade
  console.log("\nUpgrade Summary:");
  console.log("===============");
  console.log("Proxy Address:", await stakingV3.getAddress());
  console.log("Old Implementation:", oldImplementationAddress);
  console.log("New Implementation:", newImplementationAddress);
  console.log("WBERA Token:", await wbera.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 