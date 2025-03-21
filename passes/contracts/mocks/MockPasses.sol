// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IBerachainRewardsVaultFactory {
    function createRewardsVault(
        address stakingToken
    ) external returns (address);
}

interface IBerachainRewardsVault {
    function delegateStake(address user, uint256 amount) external;
    function delegateWithdraw(address user, uint256 amount) external;
}

contract PassesStakingToken is ERC20 {
    address public immutable passes;

    constructor(address _passes) ERC20("Passes Staking Token", "BRLY-ST") {
        passes = _passes;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == passes, "Only Passes can mint");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == passes, "Only Passes can burn");
        _burn(from, amount);
    }
}

contract MockPasses is OwnableUpgradeable {
    event ProtocolFeePercentageChanged(uint256 feePercentage);
    event ManagerFeePercentageChanged(uint256 feePercentage);
    event ReferralFeePercentageChanged(uint256 feePercentage);
    event Trade(
        address trader,
        address manager,
        bool isBuy,
        uint256 passAmount,
        uint256 beraAmount,
        uint256 protocolBeraAmount,
        uint256 managerBeraAmount,
        address referral,
        uint256 referralBeraAmount,
        uint256 supply,
        uint256 factor
    );

    uint256 public protocolFeePercentage;
    uint256 public managerFeePercentage;
    uint256 public referralFeePercent;
    address public treasury;
    mapping(uint256 => bool) public defaultFactors;
    mapping(address => mapping(address => uint256)) public passesBalance;
    mapping(address => uint256) public passesSupply;
    mapping(address => uint256) public factors;

    struct Lot {
        uint256 shares;
        uint256 stakedAmount;
    }
    mapping(address => mapping(address => Lot[])) public shareLots;
    IBerachainRewardsVault public polVault;
    PassesStakingToken public stakingToken;

    function initialize(address _vaultFactory) public initializer {
        __Ownable_init();
        treasury = owner();

        protocolFeePercentage = 5e16;
        managerFeePercentage = 5e16;
        referralFeePercent = 1e16;

        defaultFactors[500] = true;
        defaultFactors[100] = true;
        defaultFactors[30] = true;

        stakingToken = new PassesStakingToken(address(this));
        polVault = IBerachainRewardsVault(
            IBerachainRewardsVaultFactory(_vaultFactory).createRewardsVault(
                address(stakingToken)
            )
        );
    }

    function setTreasury(address _treasury) public onlyOwner {
        treasury = _treasury;
    }

    function setDefaultFactor(uint256 factor, bool status) public onlyOwner {
        defaultFactors[factor] = status;
    }

    function setProtocolFeePercentage(uint256 _feePercentage) public onlyOwner {
        require(referralFeePercent < _feePercentage, "Invalid Fee");
        protocolFeePercentage = _feePercentage;
        emit ProtocolFeePercentageChanged(protocolFeePercentage);
    }

    function setManagerFeePercentage(uint256 _feePercentage) public onlyOwner {
        managerFeePercentage = _feePercentage;
        emit ManagerFeePercentageChanged(managerFeePercentage);
    }

    function setReferralFeePercentage(uint256 _feePercentage) public onlyOwner {
        require(_feePercentage < protocolFeePercentage, "Invalid Fee");
        referralFeePercent = _feePercentage;
        emit ReferralFeePercentageChanged(referralFeePercent);
    }

    function getPrice(uint256 supply, uint256 amount, uint256 factor) public pure returns (uint256) {
        uint256 sum1 = supply == 0 ? 0 : (supply - 1 )* (supply) * (2 * (supply - 1) + 1) / 6;
        uint256 sum2 = supply == 0 && amount == 1 ? 0 : (supply - 1 + amount) * (supply + amount) * (2 * (supply - 1 + amount) + 1) / 6;
        uint256 summation = sum2 - sum1;
        return summation * 1 ether / factor;
    }

    function getBuyPrice(address manager, uint256 amount) public view returns (uint256) {
        uint256 factor = factors[manager];
        if (factor == 0) return 0;
        return getPrice(passesSupply[manager], amount, factor);
    }

    function getSellPrice(address manager, uint256 amount) public view returns (uint256) {
        uint256 factor = factors[manager];
        if (factor == 0) return 0;
        return getPrice(passesSupply[manager] - amount, amount, factor);
    }

    function getBuyPriceAfterFee(address manager, uint256 amount) public view returns (uint256) {
        uint256 price = getBuyPrice(manager, amount);
        uint256 protocolFee = price * protocolFeePercentage / 1 ether;
        uint256 managerFee = price * managerFeePercentage / 1 ether;
        return price + protocolFee + managerFee;
    }

    function getSellPriceAfterFee(address manager, uint256 amount) public view returns (uint256) {
        uint256 price = getSellPrice(manager, amount);
        uint256 protocolFee = price * protocolFeePercentage / 1 ether;
        uint256 managerFee = price * managerFeePercentage / 1 ether;
        return price - protocolFee - managerFee;
    }

    function balanceOf(address holder, address manager) public view returns (uint256) {
        return passesBalance[manager][holder];
    }

    function buyPasses(address manager, uint256 amount, uint256 factor, address referral) public payable {
        uint256 supply = passesSupply[manager];
        require(supply > 0 || manager == msg.sender, "Manager must buy the first pass");

        if(supply == 0 && manager == msg.sender) {
            require(defaultFactors[factor], "Invalid factor value");
            factors[manager] = factor;
        }
        else {
            require(factors[manager] == factor, "Invalid factor value");
        }

        uint256 price = getPrice(supply, amount, factor);
        uint256 protocolFee = price * protocolFeePercentage / 1 ether;
        uint256 managerFee = price * managerFeePercentage / 1 ether;
        require(msg.value >= price + protocolFee + managerFee , "Insufficient payment");
        uint256 refundedAmount = msg.value - (price + protocolFee + managerFee);

        uint256 referralFee = 0;
        if(referral != address(0)) {
            referralFee = price * referralFeePercent / 1 ether;
            protocolFee -= referralFee;
        }

        passesBalance[manager][msg.sender] += amount;
        passesSupply[manager] = supply + amount;
        emit Trade(msg.sender, manager, true, amount, price, protocolFee, managerFee, referral, referralFee, supply + amount, factor);

        (bool success1, ) = treasury.call{value: protocolFee}("");
        (bool success2, ) = manager.call{value: managerFee}("");

        bool success3 = true;
        if(referralFee > 0) {
            (success3, ) = referral.call{value: referralFee}("");
        }

        bool success4 = true;
        if(refundedAmount > 0) {
            (success4, ) = msg.sender.call{value: refundedAmount}("");
        }
        require(success1 && success2 && success3 && success4, "Unable to send funds");

        if(price > 0) {
            shareLots[msg.sender][manager].push(
                Lot({shares: amount, stakedAmount: price})
            );
            stakingToken.mint(address(this), price);
            stakingToken.approve(address(polVault), price);
            polVault.delegateStake(msg.sender, price);
        }
    }

    function sellPasses(address manager, uint256 amount, uint256 minPrice, address referral) public payable {
        uint256 supply = passesSupply[manager];
        require(supply > amount, "Cannot sell the last pass");
        require(msg.sender != manager || passesBalance[manager][msg.sender] > amount, "Cannot sell the first pass");
        require(passesBalance[manager][msg.sender] >= amount, "Insufficient passes");

        uint factor = factors[manager];
        uint256 price = getPrice(supply - amount, amount, factor);
        require(price >= minPrice, "Lower than minimum price");

        uint256 sharesToSell = amount;
        uint256 totalStakeToWithdraw = 0;
        while (sharesToSell > 0) { // Use FIFO to determine which lots to sell from
            Lot storage lot = shareLots[msg.sender][manager][0];

            if (lot.shares <= sharesToSell) { // Sell entire lot
                totalStakeToWithdraw += lot.stakedAmount;
                sharesToSell -= lot.shares;
                removeLot(msg.sender, manager);
            } else { // Sell part of the lot
                uint256 partialStake = (lot.stakedAmount * sharesToSell) /
                                lot.shares;
                totalStakeToWithdraw += partialStake;
                lot.shares -= sharesToSell;
                lot.stakedAmount -= partialStake;
                sharesToSell = 0;
            }
        }
        // Withdraw staked amount
        polVault.delegateWithdraw(msg.sender, totalStakeToWithdraw);
        stakingToken.burn(address(this), totalStakeToWithdraw);

        uint256 protocolFee = price * protocolFeePercentage / 1 ether;
        uint256 managerFee = price * managerFeePercentage / 1 ether;
        uint256 referralFee = 0;
        if(referral != address(0)) {
            referralFee = price * referralFeePercent / 1 ether;
            protocolFee -= referralFee;
        }

        passesBalance[manager][msg.sender] = passesBalance[manager][msg.sender] - amount;
        passesSupply[manager] = supply - amount;
        emit Trade(msg.sender, manager, false, amount, price, protocolFee, managerFee, referral, referralFee, supply - amount, factor);
        (bool success1, ) = msg.sender.call{value: price - protocolFee - managerFee - referralFee}("");
        (bool success2, ) = treasury.call{value: protocolFee}("");
        (bool success3, ) = manager.call{value: managerFee}("");

        bool success4 = true;
        if(referralFee > 0) {
            (success4, ) = referral.call{value: referralFee}("");
        }

        require(success1 && success2 && success3 && success4, "Unable to send funds");
    }

    function removeLot(address user, address subject) internal {
        for (uint i = 0; i < shareLots[user][subject].length - 1; i++) {
            shareLots[user][subject][i] = shareLots[user][subject][i + 1];
        }
        shareLots[user][subject].pop();
    }
}