import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Rewards } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Rewards", function () {
  let rewards: Rewards;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let rewardToken: string;
  let beWallet: SignerWithAddress;

  beforeEach(async function () {
    [owner, user, beWallet] = await ethers.getSigners();
    
    // Deploy mock ERC20 token for testing
    const MockToken = await ethers.getContractFactory("MockERC20");
    const mockToken = await MockToken.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();
    rewardToken = await mockToken.getAddress();

    // Deploy Rewards contract
    const Rewards = await ethers.getContractFactory("Rewards");
    rewards = await upgrades.deployProxy(Rewards, [rewardToken], {
      initializer: 'initialize',
      kind: 'uups'
    }) as any as Rewards;
    await rewards.waitForDeployment();
    
    // Set BE wallet
    await rewards.setBEWallet(await beWallet.getAddress());
  });

  describe("Initialization", function () {
    it("Should initialize with correct values", async function () {
      expect(await rewards.rewardToken()).to.equal(rewardToken);
      expect(await rewards.rewardDistributor()).to.equal(owner.address);
      expect(await rewards.owner()).to.equal(owner.address);
    });

    it("Should not initialize twice", async function () {
      await expect(
        rewards.initialize(rewardToken)
      ).to.be.revertedWithCustomError(rewards, "InvalidInitialization");
    });

    it("Should not initialize with zero address", async function () {
      const Rewards = await ethers.getContractFactory("Rewards");
      await expect(
        upgrades.deployProxy(Rewards, [ethers.ZeroAddress], {
          initializer: 'initialize',
          kind: 'uups'
        })
      ).to.be.revertedWith("Invalid token address");
    });
  });

  describe("Cycle Management", function () {
    it("Should create a new cycle", async function () {
      const year = 2025;
      const month = 1;
      const releaseTime = await time.latest() + 3600; // 1 hour from now

      await rewards.createCycle(year, month, releaseTime);
      
      const storedReleaseTime = await rewards.releaseTimelines(year, month);
      expect(storedReleaseTime).to.equal(releaseTime);
    });

    it("Should fail to create cycle with invalid year", async function () {
      const year = 2024;
      const month = 1;
      const releaseTime = await time.latest() + 3600;

      await expect(
        rewards.createCycle(year, month, releaseTime)
      ).to.be.revertedWith("Invalid year");
    });

    it("Should fail to create cycle with release time too far in future", async function () {
      const year = 2025;
      const month = 1;
      const releaseTime = await time.latest() + 366 * 24 * 3600; // More than 365 days

      await expect(
        rewards.createCycle(year, month, releaseTime)
      ).to.be.revertedWith("Release time too far");
    });
  });

  describe("Rewards Distribution", function () {
    const year = 2025;
    const month = 1;
    const amount = ethers.parseEther("1000");

    beforeEach(async function () {
      const releaseTime = await time.latest() + 3600;
      await rewards.createCycle(year, month, releaseTime);
    });

    it("Should distribute rewards", async function () {
      // Mock token approval and distribution
      const mockToken = await ethers.getContractAt("MockERC20", rewardToken);
      await mockToken.mint(owner.address, amount);
      await mockToken.approve(await rewards.getAddress(), amount);
      
      await rewards.distributeRewards(year, month, amount);
      
      const cycleAmount = await rewards.cycles(year, month);
      expect(cycleAmount).to.equal(amount);
    });

    it("Should fail to distribute rewards if not distributor", async function () {
      const mockToken = await ethers.getContractAt("MockERC20", rewardToken);
      await mockToken.mint(user.address, amount);
      await mockToken.connect(user).approve(await rewards.getAddress(), amount);
      
      await expect(
        rewards.connect(user).distributeRewards(year, month, amount)
      ).to.be.revertedWith("Unauthorized to distribute rewards");
    });
  });

  describe("Claiming", function () {
    const year = 2025;
    const month = 1;
    const amount = ethers.parseEther("1000");
    const percent = ethers.parseEther("50"); // 50%

    beforeEach(async function () {
      const releaseTime = await time.latest() + 3600;
      await rewards.createCycle(year, month, releaseTime);
      
      // Distribute rewards
      const mockToken = await ethers.getContractAt("MockERC20", rewardToken);
      await mockToken.mint(owner.address, amount);
      await mockToken.approve(await rewards.getAddress(), amount);
      await rewards.distributeRewards(year, month, amount);
    });

    it("Should claim rewards with valid signature", async function () {
      // Move time forward past release time
      await time.increase(3600);

      const message = await rewards.getDigest(year, month, user.address, percent);
      const signature = await beWallet.signMessage(ethers.getBytes(message));

      await rewards.connect(user).claim(year, month, percent, signature);
      
      const claimedAmount = await rewards.claimed(year, month, user.address);
      expect(claimedAmount).to.equal(amount * BigInt(percent) / BigInt(await rewards.DENOMINATOR()));
    });

    it("Should not allow claiming before release time", async function () {
      const message = await rewards.getDigest(year, month, user.address, percent);
      const signature = await beWallet.signMessage(ethers.getBytes(message));

      await expect(
        rewards.connect(user).claim(year, month, percent, signature)
      ).to.be.revertedWith("Can not claim now");
    });

    it("Should not allow claiming with invalid signature", async function () {
      await time.increase(3600);

      const message = await rewards.getDigest(year, month, user.address, percent);
      const signature = await owner.signMessage(ethers.getBytes(message)); // Wrong signer

      await expect(
        rewards.connect(user).claim(year, month, percent, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should not allow claiming twice", async function () {
      await time.increase(3600);

      const message = await rewards.getDigest(year, month, user.address, percent);
      const signature = await beWallet.signMessage(ethers.getBytes(message));

      await rewards.connect(user).claim(year, month, percent, signature);
      
      await expect(
        rewards.connect(user).claim(year, month, percent, signature)
      ).to.be.revertedWith("Already claimed");
    });
  });

  describe("Admin Functions", function () {
    it("Should set BE wallet", async function () {
      const newWallet = user.address;
      await rewards.setBEWallet(newWallet);
      
      // Verify BE wallet was set by checking signature validation
      const year = 2025;
      const month = 1;
      const percent = ethers.parseEther("50");
      
      const message = await rewards.getDigest(year, month, owner.address, percent);
      const signature = await user.signMessage(ethers.getBytes(message));
      
      // Create and distribute rewards
      const releaseTime = await time.latest() + 3600;
      await rewards.createCycle(year, month, releaseTime);
      await time.increase(3600);
      
      const mockToken = await ethers.getContractAt("MockERC20", rewardToken);
      await mockToken.mint(owner.address, ethers.parseEther("1000"));
      await mockToken.approve(await rewards.getAddress(), ethers.parseEther("1000"));
      await rewards.distributeRewards(year, month, ethers.parseEther("1000"));
      
      // Should not revert with invalid signature
      await rewards.claim(year, month, percent, signature);
    });

    it("Should not set zero address as BE wallet", async function () {
      await expect(
        rewards.setBEWallet(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid wallet address");
    });

    it("Should set reward distributor", async function () {
      await rewards.setRewardDistributor(user.address);
      expect(await rewards.rewardDistributor()).to.equal(user.address);
    });

    it("Should not set zero address as reward distributor", async function () {
      await expect(
        rewards.setRewardDistributor(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid distributor address");
    });
  });
}); 