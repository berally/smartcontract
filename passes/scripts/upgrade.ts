import { ethers, upgrades, run, network } from "hardhat";

async function main() {
  const Passes = await ethers.getContractFactory("Passes");

  const proxyAddress = '0x71432464F46106570b269F57048012CcEbB088C4';
  const passes = await upgrades.upgradeProxy(proxyAddress, Passes)

  console.log(
    `Smart Contract deployed to ${await passes.getAddress()}`
  );

  if(network.name !== "localhost") {
    console.log("Sleeping for 61 seconds...");
    await new Promise((resolve) => setTimeout(resolve, 61000));
    await run("verify:verify", {
      address: await passes.getAddress(),
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
