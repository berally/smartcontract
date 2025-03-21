import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";
import { Passes } from "../types";
import { randomInt } from "crypto";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const ONE_BERA = BigInt(1e18)
const Aggressive = 500n
const Neutral = 100n
const Friendly = 30n

describe("Passes Test", function () {
  async function deployFixture() {
    const [owner, admin, manager, user1, user2, user3] = await ethers.getSigners();

    const MockBerachainRewardsVaultFactory = await ethers.getContractFactory("MockBerachainRewardsVaultFactory");
    const mockVaultFactory = await MockBerachainRewardsVaultFactory.deploy();

    const Passes = await ethers.getContractFactory("MockPasses");
    const passes = await upgrades.deployProxy(
      Passes, [await mockVaultFactory.getAddress()]
    ) as unknown as Passes;

    return {
      owner, admin, manager, user1, user2, user3,
      passes
    };
  }

  describe("Config", function () {
    it("Init", async function () {
      const { passes, owner } = await loadFixture(deployFixture);

      expect(await passes.owner()).to.equal(owner.address);
      expect(await passes.treasury()).to.equal(await owner.getAddress());
      expect(await passes.protocolFeePercentage()).to.equal(BigInt(5e16));
      expect(await passes.managerFeePercentage()).to.equal(BigInt(5e16));
      expect(await passes.referralFeePercent()).to.equal(BigInt(1e16));
      expect(await passes.defaultFactors(500)).to.equal(true);
      expect(await passes.defaultFactors(100)).to.equal(true);
      expect(await passes.defaultFactors(30)).to.equal(true);
      expect(await passes.defaultFactors(1000)).to.equal(false);
    })

    it("Update treasury address", async function () {
      const { passes, owner, admin } = await loadFixture(deployFixture);

      await passes.connect(owner).setTreasury(admin.address)

      expect(await passes.treasury()).to.equal(admin.address)
    })

    it("Update default factor", async function () {
      const { passes, owner } = await loadFixture(deployFixture);

      expect(await passes.defaultFactors(Friendly)).to.equal(true)

      await passes.connect(owner).setDefaultFactor(Friendly, false)

      expect(await passes.defaultFactors(Friendly)).to.equal(false)

      await passes.connect(owner).setDefaultFactor(Friendly, true)

      expect(await passes.defaultFactors(Friendly)).to.equal(true)
    })

    it("Protocol Fee Percentage", async function () {
      const { passes, owner } = await loadFixture(deployFixture);

      const protocolFeePercentage = await passes.protocolFeePercentage()
      const newProtocolFeePercentage = protocolFeePercentage + BigInt(randomInt(1, 10000))

      await passes.connect(owner).setProtocolFeePercentage(newProtocolFeePercentage)

      expect(await passes.protocolFeePercentage()).to.equal(newProtocolFeePercentage)
    })

    it("Subject Fee Percentage", async function () {
      const { passes, owner } = await loadFixture(deployFixture);

      const managerFeePercentage = await passes.managerFeePercentage()
      const newManagerFeePercentage = managerFeePercentage + BigInt(randomInt(1, 10000))

      await passes.connect(owner).setManagerFeePercentage(newManagerFeePercentage)

      expect(await passes.managerFeePercentage()).to.equal(newManagerFeePercentage)
    })
  })

  describe("Buy & Sell", function () {
    let passes: Passes
    let owner: HardhatEthersSigner, manager: HardhatEthersSigner
    let user1: HardhatEthersSigner, user2: HardhatEthersSigner, user3: HardhatEthersSigner
    let totalSupply = 0n
    const factor = 500n

    this.beforeAll(async function () {
      ({ passes, owner, manager, user1, user2, user3 } = await loadFixture(deployFixture))
    })

    it("Config fees", async function () {
      const protocolFeePercentage = BigInt(Math.floor(Math.random() * 1e17))
      const managerFeePercentage = BigInt(Math.floor(Math.random() * 1e17))

      await passes.setProtocolFeePercentage(protocolFeePercentage)
      await passes.setManagerFeePercentage(managerFeePercentage)

      expect(await passes.protocolFeePercentage()).to.equal(protocolFeePercentage)
      expect(await passes.managerFeePercentage()).to.equal(managerFeePercentage)
    })

    it("Manager buys the first pass", async function () {
      const price = await passes.getBuyPriceAfterFee(manager.address, 1);
      expect(price).to.equal(0);

      const _tx = await passes.connect(manager).buyPasses(
        manager.address, 
        1, 
        factor,
        ethers.ZeroAddress
      );
      totalSupply++;

      expect(await passes.passesSupply(manager.address)).to.equal(totalSupply);
      expect(await passes.passesBalance(manager.address, manager.address)).to.equal(1);

      expect(totalSupply).to.equal(1);
      const buyPrice = await passes.getBuyPrice(manager.address, 1);
      expect(buyPrice).to.equal(ONE_BERA/factor);

      const buyPrice2 = await passes.getBuyPrice(manager.address, 2);
      expect(buyPrice2).to.equal(BigInt(4n*ONE_BERA/factor) + buyPrice);

      const sellPrice = await passes.getSellPrice(manager.address, 1);
      expect(sellPrice).to.equal(0);

      const supply = await passes.passesSupply(manager.address);
    });

    it("User1 buys the second pass", async function () {
      let supply = await passes.passesSupply(manager.address);
      expect(supply).to.equal(1);

      let price = await passes.getBuyPriceAfterFee(manager.address, 1);
      await passes.connect(user1).buyPasses(
        manager.address, 
        1, 
        factor,
        ethers.ZeroAddress,
        { value: price }
      );
      totalSupply++;

      supply = await passes.passesSupply(manager.address);
      expect(supply).to.equal(2);

      let buyPrice = await passes.getBuyPrice(manager.address, 1);
      let sellPrice = await passes.getSellPrice(manager.address, 1);
      expect(buyPrice).greaterThan(sellPrice);

      price = await passes.getBuyPriceAfterFee(manager.address, 1);
      await passes.connect(user1).buyPasses(
        manager.address, 
        1, 
        factor,
        ethers.ZeroAddress,
        { value: price }
      );
      totalSupply++;

      supply = await passes.passesSupply(manager.address);
      expect(supply).to.equal(3);

      buyPrice = await passes.getBuyPrice(manager.address, 1);
      sellPrice = await passes.getSellPrice(manager.address, 1);
      expect(buyPrice).greaterThan(sellPrice);
    });

    it("Manager buys N passes", async function () {
      const balanceBefore = await passes.passesBalance(manager.address, manager.address);

      const amount = BigInt(randomInt(1, 5));
      const price = await passes.getBuyPriceAfterFee(manager.address, amount);
      expect(price).to.gt(BigInt(0));

      const treasuryBefore = await ethers.provider.getBalance(owner.address);

      await passes.connect(manager).buyPasses(
        manager.address, 
        amount, 
        factor,
        ethers.ZeroAddress,
        { value: price * amount }
      );
      totalSupply += amount;

      expect(await passes.passesSupply(manager.address)).to.equal(totalSupply);
      expect(await passes.passesBalance(manager.address, manager.address)).to.equal(balanceBefore + amount);

      const treasuryAfter = await ethers.provider.getBalance(owner.address);

      expect(treasuryAfter).gt(treasuryBefore);
    });

    it("User2 buys a pass", async function () {
      const price = await passes.getBuyPriceAfterFee(manager.address, 1);

      const treasuryBefore = await ethers.provider.getBalance(owner.address);
      const managerBefore = await ethers.provider.getBalance(manager.address);
      const user1Before = await ethers.provider.getBalance(user2.address);

      const tx = await passes.connect(user2).buyPasses(
        manager.address, 
        1, 
        factor,
        ethers.ZeroAddress,
        { value: price * 2n }
      );
      totalSupply++;

      expect(await passes.passesSupply(manager.address)).to.equal(totalSupply);
      expect(await passes.passesBalance(manager.address, user2.address)).to.equal(1);

      const treasuryAfter = await ethers.provider.getBalance(owner.address);
      const managerAfter = await ethers.provider.getBalance(manager.address);
      const user1After = await ethers.provider.getBalance(user2.address);

      expect(user1Before - user1After).to.greaterThan(price);
      expect(user1Before - user1After).to.lessThan(price * 2n);
      expect(treasuryAfter).gt(treasuryBefore);
      expect(managerAfter).greaterThan(managerBefore);
    });

    it("User3 buys N passes", async function () {
      const balanceBefore = await passes.passesBalance(manager.address, user3.address);
      const treasuryBefore = await ethers.provider.getBalance(owner.address);
      const managerBefore = await ethers.provider.getBalance(manager.address);

      const amount = BigInt(randomInt(1, 5));
      const price = await passes.getBuyPriceAfterFee(manager.address, amount);

      await passes.connect(user3).buyPasses(
        manager.address, 
        amount, 
        factor,
        ethers.ZeroAddress,
        { value: price * amount }
      );
      totalSupply += amount;
      const balanceAfter = await passes.passesBalance(manager.address, user3.address);

      expect(await passes.passesSupply(manager.address)).to.equal(totalSupply);
      expect(balanceAfter - balanceBefore).to.equal(amount);

      const treasuryAfter = await ethers.provider.getBalance(owner.address);
      const managerAfter = await ethers.provider.getBalance(manager.address);

      expect(treasuryAfter).gt(treasuryBefore);
      expect(managerAfter).greaterThan(managerBefore);
    });

    it("User2 sells a pass", async function () {
      const balanceBefore = await passes.passesBalance(manager.address, user2.address);
      const treasuryBefore = await ethers.provider.getBalance(owner.address);
      const managerBefore = await ethers.provider.getBalance(manager.address);

      const minPrice = await passes.getSellPrice(manager.address, 1);
      await passes.connect(user2).sellPasses(
        manager.address, 
        1, 
        minPrice,
        ethers.ZeroAddress
      );
      totalSupply--;
      const balanceAfter = await passes.passesBalance(manager.address, user2.address);

      expect(await passes.passesSupply(manager.address)).to.equal(totalSupply);
      expect(balanceBefore - balanceAfter).to.equal(1);

      const treasuryAfter = await ethers.provider.getBalance(owner.address);
      const managerAfter = await ethers.provider.getBalance(manager.address);

      expect(treasuryAfter).gt(treasuryBefore);
      expect(managerAfter).greaterThan(managerBefore);
    });

    it("User3 sells all passes", async function () {
      const balanceBefore = await passes.passesBalance(manager.address, user3.address);
      expect(balanceBefore).to.gt(0);

      const treasuryBefore = await ethers.provider.getBalance(owner.address);
      const managerBefore = await ethers.provider.getBalance(manager.address);

      const minPrice = await passes.getSellPrice(manager.address, balanceBefore);
      await passes.connect(user3).sellPasses(
        manager.address, 
        balanceBefore, 
        minPrice,
        ethers.ZeroAddress
      );

      totalSupply -= balanceBefore;
      const balanceAfter = await passes.passesBalance(manager.address, user3.address);

      expect(await passes.passesSupply(manager.address)).to.equal(totalSupply);
      expect(balanceAfter).to.equal(0);

      const treasuryAfter = await ethers.provider.getBalance(owner.address);
      const managerAfter = await ethers.provider.getBalance(manager.address);

      expect(treasuryAfter).gt(treasuryBefore);
      expect(managerAfter).greaterThan(managerBefore);
    });

    it("User3 is unable sell more", async function () {
      const balanceBefore = await passes.passesBalance(manager.address, user3.address);
      expect(balanceBefore).to.eq(0);

      const amount = BigInt(randomInt(1, 100));

      await expect(passes.connect(user3).sellPasses(
        manager.address, 
        amount, 
        0,
        ethers.ZeroAddress
      )).to.be.reverted;
    });

    it("The manager is unable to sell all the passes", async function () {
      const balance = await passes.passesBalance(manager.address, manager.address);
      const minPrice = await passes.getSellPrice(manager.address, balance);
      await expect(passes.connect(manager).sellPasses(
        manager.address, 
        balance, 
        minPrice,
        ethers.ZeroAddress
      )).to.be.reverted;
    });

    it("Manager sells a pass", async function () {
      const balanceBefore = await passes.passesBalance(manager.address, manager.address);
      const minPrice = await passes.getSellPrice(manager.address, 1);
      const _tx = await passes.connect(manager).sellPasses(
        manager.address, 
        1, 
        minPrice,
        ethers.ZeroAddress
      );
      totalSupply--;

      expect(await passes.passesSupply(manager.address)).to.equal(totalSupply);
      expect(await passes.passesBalance(manager.address, manager.address)).to.equal(balanceBefore - BigInt(1));
    });

    it("Manager sells N passes", async function () {
      const balanceBefore = await passes.passesBalance(manager.address, manager.address);

      const amount = balanceBefore - BigInt(1);
      const minPrice = await passes.getSellPrice(manager.address, amount);
      await passes.connect(manager).sellPasses(
        manager.address, 
        amount, 
        minPrice,
        ethers.ZeroAddress
      );
      totalSupply -= amount;

      const balanceAfter = await passes.passesBalance(manager.address, manager.address);

      expect(balanceAfter).to.equal(1);
    });

    it("Manager is unable to sell the first pass", async function () {
      const balance = await passes.passesBalance(manager.address, manager.address);
      expect(balance).to.equal(BigInt(1));
      const minPrice = await passes.getSellPrice(manager.address, 1);
      await expect(passes.connect(manager).sellPasses(
        manager.address, 
        1, 
        minPrice,
        ethers.ZeroAddress
      )).to.be.reverted;
    });
  })
});
