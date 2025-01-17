import { ethers, upgrades, run, network } from "hardhat";
async function main() {
  const Passes = await ethers.getContractFactory("Passes");
  const passes = await upgrades.deployProxy(Passes);

  console.log(
    `Passes deployed to ${await passes.getAddress()}`
  );

  if(network.name !== "localhost") {
      console.log("Sleeping for 61 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 61000));

    const address = await passes.getAddress()
    await run("verify:verify", {
      address,
    });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
