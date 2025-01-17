import { ethers, upgrades, run, network } from "hardhat";

async function main() {
  const Staking = await ethers.getContractFactory("Staking");
  const proxyStaking = '0xf2a18c06e36f27c73f0216D4065881eCbD094F49';
  await upgrades.forceImport(proxyStaking, Staking)
  const staking = await upgrades.upgradeProxy(proxyStaking, Staking, { redeployImplementation: 'always' })

  console.log(
    `Staking deployed to ${await staking.getAddress()}`
  );

  if(network.name !== "localhost") {
    console.log("Sleeping for 61 seconds...");
    await new Promise((resolve) => setTimeout(resolve, 61000));
    await run("verify:verify", {
      address: await staking.getAddress(),
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
