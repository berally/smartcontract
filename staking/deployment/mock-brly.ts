import { ethers, upgrades, network, run } from "hardhat";
import { getConfig } from "../config/staking";

async function main() {
  const Brly = await ethers.getContractFactory("MockERC20");
  const brly = await Brly.deploy("BRLY Token", "BRLY", 18);

  const brlyAddress = await brly.getAddress();

  console.log(
    `Brly deployed to ${brlyAddress}`
  );

  if(network.name !== "localhost") {
    // sleep for 60 seconds to avoid the error: 'contract does not exist'
    console.log("Sleeping for 60 seconds...");
    await new Promise((resolve) => setTimeout(resolve, 60000));
    await run("verify:verify", {
      address: brlyAddress,
      constructorArguments: ["BRLY Token", "BRLY", 18]
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
