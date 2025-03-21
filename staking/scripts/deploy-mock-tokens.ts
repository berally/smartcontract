import { ethers, network, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying mock tokens with the account:", deployer.address);

  // Deploy MockERC20 tokens
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  
  // Deploy BRLY token
  console.log("\nDeploying BRLY token...");
  const brly = await MockERC20.deploy("Berally Token", "BRLY");
  await brly.waitForDeployment();
  console.log("BRLY token deployed to:", await brly.getAddress());

  // Mint initial supply for BRLY
  const brlyInitialSupply = ethers.parseEther("1000000"); // 1 million BRLY
  await brly.mint(deployer.address, brlyInitialSupply);
  console.log(`Minted ${ethers.formatEther(brlyInitialSupply)} BRLY to ${deployer.address}`);

  // Deploy USDC token
  console.log("\nDeploying USDC token...");
  const usdc = await MockERC20.deploy("USDC Token", "USDC");
  await usdc.waitForDeployment();
  console.log("USDC token deployed to:", await usdc.getAddress());

  // Mint initial supply for USDC
  const usdcInitialSupply = ethers.parseEther("1000000"); // 1 million USDC
  await usdc.mint(deployer.address, usdcInitialSupply);
  console.log(`Minted ${ethers.formatEther(usdcInitialSupply)} USDC to ${deployer.address}`);

  // Deploy WBERA token
  console.log("\nDeploying WBERA token...");
  const wbera = await MockERC20.deploy("Wrapped BERA", "WBERA");
  await wbera.waitForDeployment();
  console.log("WBERA token deployed to:", await wbera.getAddress());

  // Mint initial supply for WBERA
  const wberaInitialSupply = ethers.parseEther("1000000"); // 1 million WBERA
  await wbera.mint(deployer.address, wberaInitialSupply);
  console.log(`Minted ${ethers.formatEther(wberaInitialSupply)} WBERA to ${deployer.address}`);

  // Save deployment addresses
  console.log("\nToken Addresses:");
  console.log("===============");
  console.log("BRLY:", await brly.getAddress());
  console.log("USDC:", await usdc.getAddress());
  console.log("WBERA:", await wbera.getAddress());

  // Print token balances
  console.log("\nToken Balances:");
  console.log("==============");
  console.log("BRLY:", ethers.formatEther(await brly.balanceOf(deployer.address)));
  console.log("USDC:", ethers.formatEther(await usdc.balanceOf(deployer.address)));
  console.log("WBERA:", ethers.formatEther(await wbera.balanceOf(deployer.address)));

  // Verify contracts on Etherscan (if not on localhost)
  if (network.name !== "localhost" && network.name !== "hardhat") {
    console.log("\nVerifying contracts on Etherscan...");
    
    await verify(await brly.getAddress(), ["Berally Token", "BRLY"]);
    await verify(await usdc.getAddress(), ["USDC Token", "USDC"]);
    await verify(await wbera.getAddress(), ["Wrapped BERA", "WBERA"]);
  }
}

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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 