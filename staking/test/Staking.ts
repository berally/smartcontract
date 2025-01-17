import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre, { upgrades } from "hardhat";
import { Staking } from "../types";

function randomBigIntInRange(min: bigint, max: bigint): bigint {
  const range = max - min + BigInt(1);
  const randomNumber = BigInt(Math.floor(Math.random() * Number(range)));
  return min + randomNumber;
}

function randomAmount(): bigint {
  return randomBigIntInRange(BigInt(1^18), BigInt(999 * 10^18));
}

describe("Staking", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployStakingFixture() {
    const withdrawLockingTime = 7 * 24 * 60 * 60;
    // const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

    const [owner, staker1, staker2] = await hre.ethers.getSigners();

    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");

    const brly = await MockERC20.deploy("Berally Token", "BRLY", 18);
    const usdc = await MockERC20.deploy("USDC Token", "USDC", 18);

    const Staking = await hre.ethers.getContractFactory("Staking");
    const staking = await upgrades.deployProxy(
      Staking,
      [
        await brly.getAddress(),
        await usdc.getAddress(),
        withdrawLockingTime,
      ]
    ) as unknown as Staking

    return { staking, usdc, brly, owner, staker1, staker2, withdrawLockingTime };
  }

  async function deployStakingFixtureWith1Staker() {
    const {staking, brly, usdc, owner, staker1, withdrawLockingTime } = await deployStakingFixture()

    const staker1Amount = 10000000000000n;
    await brly.mint(staker1.address, staker1Amount)
    await brly.connect(staker1).approve(await staking.getAddress(), staker1Amount);
    await staking.connect(staker1).stake(staker1Amount);

    return { staking, brly, usdc, owner, staker1, staker1Amount, withdrawLockingTime};
  }

  async function deployWith1StakerAndRewards() {
    const {staking, brly, usdc, owner, staker1, staker1Amount } = await deployStakingFixtureWith1Staker()

    const rewards = randomAmount();
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
    })

    it("Should allow staker to withdraw", async function () {
      const { staking, brly, staker1, staker1Amount } = await loadFixture(deployStakingFixtureWith1Staker);
      await staking.connect(staker1).withdraw(staker1Amount/2n)
    })

    it("Should allow staker to claim BRLY", async function () {
      const { staking, brly, staker1, staker1Amount, withdrawLockingTime } = await loadFixture(deployStakingFixtureWith1Staker);

      const withdrawAmount = staker1Amount/2n
      await staking.connect(staker1).withdraw(withdrawAmount)

      await time.increase(withdrawLockingTime - 1)

      const brlyBefore = await brly.balanceOf(staker1.address);
      await staking.connect(staker1).claimBrly()
      const brlyAfter = await brly.balanceOf(staker1.address);

      expect(brlyAfter).to.equal(brlyBefore + withdrawAmount);
    })

    it("Should allow staker to claim rewards", async function () {
      const { staking, brly, usdc, staker1, staker1Amount, rewards } = await loadFixture(deployWith1StakerAndRewards);

      const rewardsBefore = await usdc.balanceOf(staker1.address);
      await staking.connect(staker1).claimRewards()
      const rewardsAfter = await usdc.balanceOf(staker1.address);
      expect(rewardsAfter).to.greaterThan(rewardsBefore);
      expect(rewardsAfter).to.equal(rewardsBefore + rewards);
    })
  });

  /* describe("Withdrawals", function () {
    describe("Validations", function () {
      it("Should revert with the right error if called too soon", async function () {
        const { lock } = await loadFixture(deployOneYearLockFixture);

        await expect(lock.withdraw()).to.be.revertedWith(
          "You can't withdraw yet"
        );
      });

      it("Should revert with the right error if called from another account", async function () {
        const { lock, unlockTime, otherAccount } = await loadFixture(
          deployOneYearLockFixture
        );

        // We can increase the time in Hardhat Network
        await time.increaseTo(unlockTime);

        // We use lock.connect() to send a transaction from another account
        await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
          "You aren't the owner"
        );
      });

      it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
        const { lock, unlockTime } = await loadFixture(
          deployOneYearLockFixture
        );

        // Transactions are sent using the first signer by default
        await time.increaseTo(unlockTime);

        await expect(lock.withdraw()).not.to.be.reverted;
      });
    });

    describe("Events", function () {
      it("Should emit an event on withdrawals", async function () {
        const { lock, unlockTime, lockedAmount } = await loadFixture(
          deployOneYearLockFixture
        );

        await time.increaseTo(unlockTime);

        await expect(lock.withdraw())
          .to.emit(lock, "Withdrawal")
          .withArgs(lockedAmount, anyValue); // We accept any value as `when` arg
      });
    });

    describe("Transfers", function () {
      it("Should transfer the funds to the owner", async function () {
        const { lock, unlockTime, lockedAmount, owner } = await loadFixture(
          deployOneYearLockFixture
        );

        await time.increaseTo(unlockTime);

        await expect(lock.withdraw()).to.changeEtherBalances(
          [owner, lock],
          [lockedAmount, -lockedAmount]
        );
      });
    });
  }); */
});
