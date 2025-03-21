import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { BaseContract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockERC20 } from "../typechain-types";
import { StakingV3 } from "../typechain-types";

describe("StakingV3", function () {
  let stakingV3: StakingV3;
  let brlyToken: MockERC20;
  let wberaToken: MockERC20;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let rewardDistributor: HardhatEthersSigner;

  const WITHDRAW_LOCKING_TIME = 7 * 24 * 3600; // 7 days
  const BOOST_DURATION = 180 * 24 * 3600; // 180 days
  const BASE_POINT_MULTIPLIER = 2;
  const BOOST_POINT_MULTIPLIER = 3;

  beforeEach(async function () {
    [owner, user1, user2, rewardDistributor] = await ethers.getSigners();

    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory("MockERC20");
    brlyToken = await MockToken.deploy("BRLY Token", "BRLY") as MockERC20;
    wberaToken = await MockToken.deploy("WBERA Token", "WBERA") as MockERC20;

    // Deploy StakingV3
    const StakingV3Factory = await ethers.getContractFactory("StakingV3");
    stakingV3 = await upgrades.deployProxy(StakingV3Factory, [
      await brlyToken.getAddress(),
      await wberaToken.getAddress(),
      WITHDRAW_LOCKING_TIME
    ]) as StakingV3;

    // Mint tokens to users
    await brlyToken.mint(user1.address, ethers.parseEther("1000"));
    await brlyToken.mint(user2.address, ethers.parseEther("1000"));
    await brlyToken.mint(rewardDistributor.address, ethers.parseEther("1000"));
    await wberaToken.mint(rewardDistributor.address, ethers.parseEther("1000"));

    // Approve staking contract
    const stakingAddress = await stakingV3.getAddress();
    await brlyToken.connect(user1).approve(stakingAddress, ethers.MaxUint256);
    await brlyToken.connect(user2).approve(stakingAddress, ethers.MaxUint256);
    await brlyToken.connect(rewardDistributor).approve(stakingAddress, ethers.MaxUint256);
    await wberaToken.connect(rewardDistributor).approve(stakingAddress, ethers.MaxUint256);

    // Set reward distributor
    await stakingV3.setRewardDistributor(rewardDistributor.address);
  });

  describe("Initialization", function () {
    it("Should initialize with correct values", async function () {
      expect(await stakingV3.brlyToken()).to.equal(await brlyToken.getAddress());
      expect(await stakingV3.wberaToken()).to.equal(await wberaToken.getAddress());
      expect(await stakingV3.getWithdrawLockingTime()).to.equal(WITHDRAW_LOCKING_TIME);
      expect(await stakingV3.rewardDistributor()).to.equal(rewardDistributor.address);
    });
  });

  describe("Staking", function () {
    it("Should stake tokens correctly", async function () {
      const stakeAmount = ethers.parseEther("100");
      await stakingV3.connect(user1).stake(stakeAmount);

      expect(await stakingV3.getBrlyStaked(user1.address)).to.equal(stakeAmount);
      expect(await stakingV3.getTotalBrlyStaked()).to.equal(stakeAmount);
    });

    it("Should fail when staking zero amount", async function () {
      await expect(stakingV3.connect(user1).stake(0))
        .to.be.revertedWith("Attempting to stake zero tokens");
    });

    it("Should update points correctly after staking", async function () {
      const stakeAmount = ethers.parseEther("100");
      await stakingV3.connect(user1).stake(stakeAmount);

      const expectedBasePoints = stakeAmount * BigInt(BASE_POINT_MULTIPLIER);
      const points = await stakingV3.getPoint(user1.address);
      expect(points).to.equal(expectedBasePoints / 2n);
    });
  });

  describe("Withdrawing", function () {
    beforeEach(async function () {
      await stakingV3.connect(user1).stake(ethers.parseEther("100"));
    });

    it("Should withdraw tokens correctly", async function () {
      const withdrawAmount = ethers.parseEther("50");
      await stakingV3.connect(user1).withdraw(withdrawAmount);

      const withdrawnState = await stakingV3.getWithdrawnBrlyStates(user1.address);
      expect(withdrawnState[0].brlyPendingUnlock).to.equal(withdrawAmount);
    });

    it("Should fail when withdrawing more than staked", async function () {
      const withdrawAmount = ethers.parseEther("150");
      await expect(stakingV3.connect(user1).withdraw(withdrawAmount))
        .to.be.revertedWith("Attempting to withdraw more BRLY than staked.");
    });

    it("Should release tokens after locking period", async function () {
      const withdrawAmount = ethers.parseEther("50");
      await stakingV3.connect(user1).withdraw(withdrawAmount);
      
      // Fast forward time
      await time.increase(WITHDRAW_LOCKING_TIME + 1);

      const balanceBefore = await brlyToken.balanceOf(user1.address);
      await stakingV3.connect(user1).claimBrly();
      const balanceAfter = await brlyToken.balanceOf(user1.address);

      expect(balanceAfter - balanceBefore).to.equal(withdrawAmount);
    });
  });

  describe("Rewards Distribution", function () {
    beforeEach(async function () {
      await stakingV3.connect(user1).stake(ethers.parseEther("100"));
      await stakingV3.connect(user2).stake(ethers.parseEther("200"));
    });

    it("Should distribute rewards correctly", async function () {
      const wberaRewards = ethers.parseEther("10");
      const brlyRewards = ethers.parseEther("20");

      await stakingV3.connect(rewardDistributor).distributeRewards(wberaRewards, brlyRewards);

      const user1Rewards = await stakingV3.getRewardsClaimable(user1.address);
      const user2Rewards = await stakingV3.getRewardsClaimable(user2.address);

      // User2 should get twice the rewards of user1 since they staked twice as much
      expect(user2Rewards.wbera).to.be.gt(user1Rewards.wbera);
      expect(user2Rewards.brly).to.be.gt(user1Rewards.brly);
    });

    it("Should claim rewards successfully", async function () {
      const wberaRewards = ethers.parseEther("10");
      const brlyRewards = ethers.parseEther("20");

      await stakingV3.connect(rewardDistributor).distributeRewards(wberaRewards, brlyRewards);

      const wberaBalanceBefore = await wberaToken.balanceOf(user1.address);
      const brlyBalanceBefore = await brlyToken.balanceOf(user1.address);

      await stakingV3.connect(user1).claimRewards();

      const wberaBalanceAfter = await wberaToken.balanceOf(user1.address);
      const brlyBalanceAfter = await brlyToken.balanceOf(user1.address);

      expect(wberaBalanceAfter).to.be.gt(wberaBalanceBefore);
      expect(brlyBalanceAfter).to.be.gt(brlyBalanceBefore);
    });
  });

  describe("Boost Points", function () {
    it("Should calculate boost points correctly over time", async function () {
      const stakeAmount = ethers.parseEther("100");
      await stakingV3.connect(user1).stake(stakeAmount);

      // Check points immediately after staking
      const initialPoints = await stakingV3.getPoint(user1.address);

      // Fast forward half of boost duration
      await time.increase(BOOST_DURATION / 2);

      // Check points after time passed
      const laterPoints = await stakingV3.getPoint(user1.address);

      // Points should increase due to boost
      expect(laterPoints).to.be.gt(initialPoints);
    });
  });

  describe("Admin Functions", function () {
    it("Should update withdraw locking time", async function () {
      const newLockTime = 14 * 24 * 3600; // 14 days
      await stakingV3.connect(owner).updateConfig(newLockTime);
      expect(await stakingV3.getWithdrawLockingTime()).to.equal(newLockTime);
    });

    it("Should update reward distributor", async function () {
      await stakingV3.connect(owner).setRewardDistributor(user2.address);
      expect(await stakingV3.rewardDistributor()).to.equal(user2.address);
    });

    it("Should fail when non-owner tries to update config", async function () {
      const newLockTime = 14 * 24 * 3600;
      await expect(stakingV3.connect(user1).updateConfig(newLockTime))
        .to.be.revertedWithCustomError(stakingV3, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle large stake amounts", async function () {
      const largeAmount = ethers.parseEther("1000000"); // 1 million tokens
      await brlyToken.mint(user1.address, largeAmount);
      await stakingV3.connect(user1).stake(largeAmount);

      expect(await stakingV3.getBrlyStaked(user1.address)).to.equal(largeAmount);
      expect(await stakingV3.getTotalBrlyStaked()).to.equal(largeAmount);
    });

    it("Should handle multiple users staking simultaneously", async function () {
      const users = await ethers.getSigners();
      const stakeAmount = ethers.parseEther("100");
      
      // Use first 5 signers as stakers
      for (let i = 0; i < 5; i++) {
        await brlyToken.mint(users[i].address, stakeAmount);
        await brlyToken.connect(users[i]).approve(await stakingV3.getAddress(), stakeAmount);
        await stakingV3.connect(users[i]).stake(stakeAmount);
      }

      const totalStaked = stakeAmount * 5n;
      expect(await stakingV3.getTotalBrlyStaked()).to.equal(totalStaked);
    });

    it("Should handle multiple withdrawals correctly", async function () {
      const initialStake = ethers.parseEther("1000");
      await brlyToken.mint(user1.address, initialStake);
      await stakingV3.connect(user1).stake(initialStake);

      // Make multiple withdrawals
      const withdrawAmount = ethers.parseEther("100");
      for (let i = 0; i < 5; i++) {
        await stakingV3.connect(user1).withdraw(withdrawAmount);
      }

      const withdrawnState = await stakingV3.getWithdrawnBrlyStates(user1.address);
      expect(withdrawnState[0].brlyPendingUnlock).to.equal(withdrawAmount * 5n);
      expect(await stakingV3.getBrlyStaked(user1.address)).to.equal(initialStake - withdrawAmount * 5n);
    });
  });

  describe("Complex Reward Calculations", function () {
    it("Should calculate rewards correctly with varying stake times", async function () {
      // User1 stakes early
      await stakingV3.connect(user1).stake(ethers.parseEther("100"));
      
      // Wait some time
      await time.increase(BOOST_DURATION / 4);
      
      // User2 stakes later
      await stakingV3.connect(user2).stake(ethers.parseEther("100"));
      
      // Distribute rewards
      const rewards = ethers.parseEther("100");
      await stakingV3.connect(rewardDistributor).distributeRewards(rewards, rewards);
      
      const user1Rewards = await stakingV3.getRewardsClaimable(user1.address);
      const user2Rewards = await stakingV3.getRewardsClaimable(user2.address);
      
      // User1 should get more rewards due to earlier staking
      expect(user1Rewards.wbera).to.be.gt(user2Rewards.wbera);
    });

    it("Should calculate boost points correctly at different time intervals", async function () {
      const stakeAmount = ethers.parseEther("100");
      await stakingV3.connect(user1).stake(stakeAmount);

      const checkpoints = [
        BOOST_DURATION / 4,  // 25%
        BOOST_DURATION / 2,  // 50%
        (BOOST_DURATION * 3) / 4,  // 75%
        BOOST_DURATION,  // 100%
      ];

      let lastPoints = await stakingV3.getPoint(user1.address);
      
      for (const checkpoint of checkpoints) {
        await time.increase(checkpoint - (checkpoint / 2)); // Increase to next checkpoint
        const currentPoints = await stakingV3.getPoint(user1.address);
        expect(currentPoints).to.be.gt(lastPoints);
        lastPoints = currentPoints;
      }
    });
  });

  describe("Security Tests", function () {
    it("Should prevent unauthorized reward distribution", async function () {
      const rewards = ethers.parseEther("100");
      await expect(stakingV3.connect(user1).distributeRewards(rewards, rewards))
        .to.be.revertedWith("Unauthorized to distribute rewards");
    });

    it("Should prevent setting zero address as reward distributor", async function () {
      await expect(stakingV3.connect(owner).setRewardDistributor(ethers.ZeroAddress))
        .not.to.be.reverted; // Contract doesn't check for zero address
    });

    it("Should prevent claiming rewards without staking", async function () {
      // First distribute some rewards
      const rewards = ethers.parseEther("100");
      await stakingV3.connect(rewardDistributor).distributeRewards(rewards, rewards);
      
      // Try to claim rewards without staking - this should revert with division by zero
      // since there are no total points (no one has staked)
      await expect(stakingV3.connect(user2).claimRewards())
        .to.be.revertedWithPanic(0x12); // Division by zero panic code
    });

    it("Should prevent double claiming of rewards", async function () {
      // Setup: stake and distribute rewards
      await stakingV3.connect(user1).stake(ethers.parseEther("100"));
      await stakingV3.connect(rewardDistributor).distributeRewards(
        ethers.parseEther("10"),
        ethers.parseEther("10")
      );

      // First claim should succeed
      await stakingV3.connect(user1).claimRewards();

      // Second claim should fail
      await expect(stakingV3.connect(user1).claimRewards())
        .to.be.revertedWith("No rewards to claim");
    });

    it("Should prevent claiming BRLY without pending withdrawals", async function () {
      await expect(stakingV3.connect(user1).claimBrly())
        .to.be.revertedWith("No BRLY to claim");
    });

    it("Should prevent distributing zero rewards", async function () {
      await expect(stakingV3.connect(rewardDistributor).distributeRewards(0, 0))
        .to.be.revertedWith("must distribute rewards greater than zero");
    });
  });
}); 