// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

interface IStakingV3 {
    struct GlobalRewardsDetails {
        uint64 distributionTime;
        uint256 wberaRewardsAmount;
        uint256 brlyRewardsAmount;
    }

    struct State {
        uint256 brlyStaked;
        int256 sumSize;
        int256 sumSizeXTime;
    }

    struct ReleaseTimeline {
        uint64 releaseTime;
        uint256 amount;
    }

    struct Checkpoint {
        uint64 time;
        uint256 brlyStaked;
        int256 sumSize;
        int256 sumSizeXTime;
        uint256 wberaRewards;
        uint256 brlyRewards;
    }

    struct LastActivityTimes {
        uint64 lastStakeTime;
        uint64 lastWithdrawTime;
    }

    struct WithdrawnBrlyStates {
        uint256 brlyClaimable;
        uint256 brlyPendingUnlock;
    }

    struct Section {
        uint64 startTime;
        int256 brlySize;
        address staker;
        uint32 version;
    }

    struct QueueIndex {
        uint64 count;
        uint64 upTo;
    }

    struct Rewards {
        uint256 wbera;
        uint256 brly;
    }

    function stake(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function claimBrly() external;
    function claimRewards() external;
    function getWithdrawnBrlyStates(
        address staker
    ) external view returns (
        WithdrawnBrlyStates memory,
        ReleaseTimeline[] memory
    );
    function getRewardsDetails(
        address staker
    ) external view returns (Rewards[] memory);
    function getGlobalRewardsDetails()
    external
    view
    returns (GlobalRewardsDetails[] memory);
    function getRewardsClaimable(address staker) external view returns (Rewards memory);
    function getBrlyStaked(address staker) external view returns (uint256);
    function getTotalBrlyStaked() external view returns (uint256);
    function getPoint(address staker) external view returns (uint256);
    function getTotalPoint() external view returns (uint256);
    function getLastActivityTimes(
        address staker
    ) external view returns (LastActivityTimes memory);
    function getWithdrawLockingTime() external view returns (uint64);

    event Staked(address staker, uint256 amount);
    event Withdrawn(address staker, uint256 amount);
    event Claimed(address staker, uint256 wbera, uint256 brly);
    event RewardsDistributed(uint256 wberaAmount, uint256 brlyAmount);
}