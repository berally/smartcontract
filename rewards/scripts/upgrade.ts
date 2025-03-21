import { ethers, upgrades, run, network } from "hardhat";

async function main() {
  const Rewards = await ethers.getContractFactory("Rewards");
  const proxyRewards = '0x80d914514342A45011B84CFa9528546Adb73c63a';
  await upgrades.forceImport(proxyRewards, Rewards)
  const reward = await upgrades.upgradeProxy(proxyRewards, Rewards, {redeployImplementation: 'always'})
  console.log(
    `Rewards deployed to ${await reward.getAddress()}`
  );

  if(network.name !== "localhost") {
    console.log("Sleeping for 61 seconds...");
    await new Promise((resolve) => setTimeout(resolve, 61000));
    await run("verify:verify", {
      address: await reward.getAddress(),
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 