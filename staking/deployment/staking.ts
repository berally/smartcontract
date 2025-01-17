import { ethers, upgrades, network, run } from "hardhat";
import { getConfig } from "../config/staking";

async function main() {
  const config = getConfig(network.name);
  console.log('Config: ', config);

  const Staking = await ethers.getContractFactory("Staking");
  const staking = await upgrades.deployProxy(
    Staking, [
      config.brlyAddress,
      config.rewardsAddress,
      config.withdrawLockingTime,
    ]
  )

  const stakingAddress = await staking.getAddress();

  console.log(
    `Staking deployed to ${stakingAddress}`
  );

  if(network.name !== "localhost") {
    // sleep for 60 seconds to avoid the error: 'contract does not exist'
    console.log("Sleeping for 60 seconds...");
    await new Promise((resolve) => setTimeout(resolve, 60000));
    await run("verify:verify", {
      address: stakingAddress
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
