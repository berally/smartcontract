// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface ICustomBerachainRewardsVault {
    function getReward(address account) external returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function earned(address account) external view returns (uint256);
    function undistributedRewards() external view returns (uint256);

}