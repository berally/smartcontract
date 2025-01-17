import { ethers } from "hardhat";
import { Passes } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const POL_VAULT_ADDRESS = ''
const PASSES_ADDRESS = ''

var fs = require('fs');
var jsonFile = "./test/BerachainRewardsVault.json";
var parsed= JSON.parse(fs.readFileSync(jsonFile));
var polVault= new ethers.Contract(POL_VAULT_ADDRESS, parsed, ethers.provider);

describe("Passes Test: OnChain", function () {
  let owner: HardhatEthersSigner
  let passes: Passes

  this.beforeAll(async function () {
    [owner] = await ethers.getSigners();

    const Passes = await ethers.getContractFactory("Passes");
    passes = Passes.attach(PASSES_ADDRESS) as unknown as Passes;
  })

  describe("Actions", function () {
    it("Updating", async function () {
      const address = await polVault.getAddress()
      console.log(address)

      const y = await polVault.getDelegateStake(owner.address, PASSES_ADDRESS)
      console.log(y)

      /* const rewards = await polVault.connect(owner).getReward('0x842F0D4dc594A19F715dceeC954D859f08633353')
      console.log(rewards) */
    })
  })
});
