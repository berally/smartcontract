import { ethers, upgrades, run, network } from "hardhat";
import { getConfig } from "../config/rewards";

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "berachainTestnet" : network.name;
  const config = getConfig(networkName);

  console.log("Deploying Rewards contract...");
  
  const Rewards = await ethers.getContractFactory("Rewards");
  
  // Deploy qua Proxy
  const rewards = await upgrades.deployProxy(
    Rewards,
    [config.rewardAddress],
    {
      initializer: 'initialize',
      kind: 'uups'
    }
  );

  await rewards.waitForDeployment();
  
  console.log("Rewards Proxy deployed to:", await rewards.getAddress());
  console.log("Rewards initialized with token:", config.rewardAddress);

  // Verify contract nếu không phải localhost
  if(network.name !== "localhost") {
    console.log("Sleeping for 61 seconds before verification...");
    await new Promise((resolve) => setTimeout(resolve, 61000));

    // Lấy implementation address
    const implAddress = await upgrades.erc1967.getImplementationAddress(
      await rewards.getAddress()
    );

    console.log("Verifying implementation contract:", implAddress);
    
    try {
      await run("verify:verify", {
        address: implAddress,
        constructorArguments: [],
      });
    } catch (error) {
      console.log("Verification failed:", error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 