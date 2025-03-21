// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IBerachainRewardsVault {
    function delegateStake(address user, uint256 amount) external;
    function delegateWithdraw(address user, uint256 amount) external;
}

contract MockBerachainRewardsVault is IBerachainRewardsVault {
    function delegateStake(address user, uint256 amount) external override {}
    function delegateWithdraw(address user, uint256 amount) external override {}
}

contract MockBerachainRewardsVaultFactory {
    function createRewardsVault(address stakingToken) external returns (address) {
        return address(new MockBerachainRewardsVault());
    }
} 