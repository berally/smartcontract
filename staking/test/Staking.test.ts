import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Staking } from "../types";

function randomBigIntInRange(min: bigint, max: bigint): bigint {
  const range = max - min + BigInt(1);
  const randomNumber = BigInt(Math.floor(Math.random() * Number(range)));
  return min + randomNumber;
}

function randomAmount(): bigint {
  return randomBigIntInRange(
    BigInt(10) ** BigInt(18), // 1 token
    BigInt(999) * (BigInt(10) ** BigInt(18)) // 999 tokens
  );
}

describe("Staking", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployStakingFixture() {
    const withdrawLockingTime = 7 * 24 * 60 * 60;
    // const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

    const [owner, staker1, staker2] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");

    const brly = await MockERC20.deploy("Berally Token", "BRLY");
    const usdc = await MockERC20.deploy("USDC Token", "USDC");

    const Staking = await ethers.getContractFactory("Staking");
    const staking = await upgrades.deployProxy(
      Staking,
      [
        await brly.getAddress(),
        await usdc.getAddress(),
        withdrawLockingTime,
      ],
      { initializer: 'initialize' }
    ) as unknown as Staking;

    return { staking, usdc, brly, owner, staker1, staker2, withdrawLockingTime };
  }

  async function deployStakingFixtureWith1Staker() {
    const {staking, brly, usdc, owner, staker1, withdrawLockingTime } = await deployStakingFixture()

    const staker1Amount = ethers.parseEther("100"); // 100 tokens
    await brly.mint(staker1.address, staker1Amount)
    await brly.connect(staker1).approve(await staking.getAddress(), staker1Amount);
    await staking.connect(staker1).stake(staker1Amount);

    return { staking, brly, usdc, owner, staker1, staker1Amount, withdrawLockingTime};
  }

  async function deployWith1StakerAndRewards() {
    const {staking, brly, usdc, owner, staker1, staker1Amount } = await deployStakingFixtureWith1Staker()

    const rewards = ethers.parseEther("10"); // 10 USDC rewards
    await usdc.mint(owner.address, rewards)
    await usdc.connect(owner).approve(await staking.getAddress(), rewards);
    await staking.connect(owner).distributeRewards(rewards);

    return { staking, brly, usdc, owner, staker1, staker1Amount, rewards };
  }

  describe("Deployment", function () {
    it("Should set the right config", async function () {
      const { staking, brly, usdc, owner, withdrawLockingTime } = await loadFixture(deployStakingFixture);

      expect(await staking.getWithdrawLockingTime()).to.equal(withdrawLockingTime);
      expect(await staking.brlyToken()).to.equal(await brly.getAddress());
      expect(await staking.usdToken()).to.equal(await usdc.getAddress());
      expect(await staking.owner()).to.equal(owner.address);
    });

    it("Should allow anyone to stake", async function () {
      const { staking, brly, staker1, staker1Amount } = await loadFixture(deployStakingFixtureWith1Staker);

      const vaultBrlyBalance = await brly.balanceOf(await staking.getAddress());
      expect(vaultBrlyBalance).to.equal(staker1Amount);

      const stakedAmount = await staking.getBrlyStaked(staker1.address);
      expect(stakedAmount).to.equal(staker1Amount);

      const rewardsClaimable = await staking.getRewardsClaimable(staker1.address)
      expect(rewardsClaimable).to.equal(0);
    });

    it("Should prevent staking zero amount", async function () {
      const { staking, staker1 } = await loadFixture(deployStakingFixture);
      await expect(staking.connect(staker1).stake(0))
        .to.be.revertedWith("Attempting to stake zero tokens");
    });

    it("Should emit Staked event", async function () {
      const { staking, brly, staker1 } = await loadFixture(deployStakingFixture);
      const amount = ethers.parseEther("100");
      await brly.mint(staker1.address, amount);
      await brly.connect(staker1).approve(await staking.getAddress(), amount);
      
      await expect(staking.connect(staker1).stake(amount))
        .to.emit(staking, "Staked")
        .withArgs(staker1.address, amount);
    });
  });

  describe("Withdrawals", function () {
    it("Should allow staker to withdraw", async function () {
      const { staking, brly, staker1, staker1Amount } = await loadFixture(deployStakingFixtureWith1Staker);
      const withdrawAmount = staker1Amount / 2n;
      
      const stakedBefore = await staking.getBrlyStaked(staker1.address);
      await staking.connect(staker1).withdraw(withdrawAmount);
      const stakedAfter = await staking.getBrlyStaked(staker1.address);

      expect(stakedAfter).to.equal(stakedBefore - withdrawAmount);

      const withdrawnState = await staking.getWithdrawnBrlyStates(staker1.address);
      expect(withdrawnState[0].brlyPendingUnlock).to.equal(withdrawAmount);
    });

    it("Should prevent withdrawing more than staked", async function () {
      const { staking, staker1, staker1Amount } = await loadFixture(deployStakingFixtureWith1Staker);
      await expect(staking.connect(staker1).withdraw(staker1Amount + 1n))
        .to.be.revertedWith("Attempting to withdraw more BRLY than staked.");
    });

    it("Should prevent withdrawing zero amount", async function () {
      const { staking, staker1 } = await loadFixture(deployStakingFixtureWith1Staker);
      await expect(staking.connect(staker1).withdraw(0))
        .to.be.revertedWith("Attempting to withdraw 0 staked tokens");
    });

    it("Should emit Withdrawn event", async function () {
      const { staking, staker1, staker1Amount } = await loadFixture(deployStakingFixtureWith1Staker);
      const withdrawAmount = staker1Amount / 2n;
      
      await expect(staking.connect(staker1).withdraw(withdrawAmount))
        .to.emit(staking, "Withdrawn")
        .withArgs(staker1.address, withdrawAmount);
    });
  });

  describe("Claiming BRLY", function () {
    it("Should allow staker to claim BRLY after locking period", async function () {
      const { staking, brly, staker1, staker1Amount, withdrawLockingTime } = await loadFixture(deployStakingFixtureWith1Staker);

      const withdrawAmount = staker1Amount / 2n;
      await staking.connect(staker1).withdraw(withdrawAmount);
      await time.increase(withdrawLockingTime + 1);

      const brlyBefore = await brly.balanceOf(staker1.address);
      await staking.connect(staker1).claimBrly();
      const brlyAfter = await brly.balanceOf(staker1.address);

      expect(brlyAfter).to.equal(brlyBefore + withdrawAmount);
    });

    it("Should prevent claiming BRLY before locking period", async function () {
      const { staking, staker1, staker1Amount } = await loadFixture(deployStakingFixtureWith1Staker);

      await staking.connect(staker1).withdraw(staker1Amount / 2n);
      await expect(staking.connect(staker1).claimBrly())
        .to.be.revertedWith("No BRLY to claim");
    });
  });

  describe("Rewards", function () {
    it("Should allow staker to claim rewards", async function () {
      const { staking, usdc, staker1, rewards } = await loadFixture(deployWith1StakerAndRewards);

      const rewardsBefore = await usdc.balanceOf(staker1.address);
      await staking.connect(staker1).claimRewards();
      const rewardsAfter = await usdc.balanceOf(staker1.address);

      expect(rewardsAfter).to.equal(rewardsBefore + rewards);
    });

    it("Should prevent claiming rewards when none available", async function () {
      const { staking, staker1 } = await loadFixture(deployStakingFixtureWith1Staker);
      await expect(staking.connect(staker1).claimRewards())
        .to.be.revertedWith("No rewards to claim");
    });

    it("Should prevent non-owner from distributing rewards", async function () {
      const { staking, staker1 } = await loadFixture(deployStakingFixture);
      await expect(staking.connect(staker1).distributeRewards(100))
        .to.be.revertedWith("Unauthorized to distribute rewards");
    });

    it("Should emit RewardsDistributed event", async function () {
      const { staking, usdc, owner } = await loadFixture(deployStakingFixture);
      const rewards = ethers.parseEther("10");
      await usdc.mint(owner.address, rewards);
      await usdc.connect(owner).approve(await staking.getAddress(), rewards);

      await expect(staking.connect(owner).distributeRewards(rewards))
        .to.emit(staking, "RewardsDistributed")
        .withArgs(rewards);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update withdraw locking time", async function () {
      const { staking, owner } = await loadFixture(deployStakingFixture);
      const newLockTime = 14 * 24 * 60 * 60; // 14 days

      await staking.connect(owner).updateConfig(newLockTime);
      expect(await staking.getWithdrawLockingTime()).to.equal(newLockTime);
    });

    it("Should prevent non-owner from updating config", async function () {
      const { staking, staker1 } = await loadFixture(deployStakingFixture);
      const newLockTime = 14 * 24 * 60 * 60;

      await expect(staking.connect(staker1).updateConfig(newLockTime))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount")
        .withArgs(staker1.address);
    });
  });
});
