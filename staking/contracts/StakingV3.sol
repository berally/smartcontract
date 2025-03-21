// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import "./interfaces/IStakingV3.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract StakingV3 is IStakingV3, OwnableUpgradeable {
    uint256 constant BASE_POINT_MULTIPLIER = 2;
    uint256 constant BOOST_POINT_MULTIPLIER = 3;
    uint32 constant BOOST_DURATION = 3600 * 24 * 180; // 180 days

    address public brlyToken;
    address public wberaToken;
    uint64 withdrawLockingTime;
    State overallState;
    QueueIndex sectionIndex;
    uint64 numCheckpoints;
    address public rewardDistributor;

    mapping(uint64 => Section) toApplySections;
    // whenever `staker` withdraws BRLY, its version gets increased by 1.
    // so that all previous sections will be outdated and canceled.
    mapping(address => uint32) versions;
    mapping(address => State) states;
    mapping(address => QueueIndex) releaseTimelineIndexes;
    mapping(address => mapping(uint64 => ReleaseTimeline)) releaseTimelines;
    mapping(address => mapping(uint64 => Rewards)) rewardsBreakdowns;
    mapping(address => uint64) toClaimCheckpoint;
    mapping(address => uint64) checkpointIndexes;
    mapping(uint64 => Checkpoint) checkpoints;
    mapping(address => LastActivityTimes) lastActivityTimes;

    function initialize(
        address _brlyToken,
        address _wberaToken,
        uint32 _withdrawLockingTime
    ) external initializer {
        __Ownable_init(msg.sender);
        brlyToken = _brlyToken;
        wberaToken = _wberaToken;
        withdrawLockingTime = _withdrawLockingTime;
        rewardDistributor = owner();
    }

    function _updateStates(Section memory section) internal {
        address staker = section.staker;
        // the section is already outdated.
        if (versions[staker] != section.version) {
            return;
        }
        _processAllCheckpoints(staker);
        states[staker].sumSize += section.brlySize;
        states[staker].sumSizeXTime +=
            section.brlySize *
            int64(section.startTime);
        overallState.sumSize += section.brlySize;
        overallState.sumSizeXTime += section.brlySize * int64(section.startTime);
    }

    function _applySection(
        QueueIndex memory _sectionIndex
    ) internal returns (bool) {
        if (_sectionIndex.upTo >= _sectionIndex.count) {
            return false;
        }
        Section memory section = toApplySections[_sectionIndex.upTo];
        if (section.startTime > uint64(block.timestamp)) {
            return false;
        }
        delete toApplySections[_sectionIndex.upTo++];
        _updateStates(section);
        return true;
    }

    function _applySections(
        QueueIndex memory _sectionIndex,
        uint32 maxSections
    ) internal {
        for (uint32 i = 0; i < maxSections; i++) {
            if (!_applySection(_sectionIndex)) {
                break;
            }
        }
    }

    function _processAllSections() internal {
        QueueIndex memory _sectionIndex = sectionIndex;
        _applySections(_sectionIndex, type(uint32).max);
        sectionIndex = _sectionIndex;
    }

    function _processAllCheckpoints(address staker) internal {
        Rewards[] memory rewardsBreakdown = getRewardsDetails(staker);
        for (uint64 i = checkpointIndexes[staker]; i < numCheckpoints; i++) {
            rewardsBreakdowns[staker][i] = rewardsBreakdown[i];
        }
        checkpointIndexes[staker] = numCheckpoints;
    }

    // in case there are too many sections to be applied that they can't be applied
    // within a single tx, we can manually apply them by using this through multiple txs.
    function processSections(uint32 count) external {
        QueueIndex memory _sectionIndex = sectionIndex;
        _applySections(_sectionIndex, count);
        sectionIndex = _sectionIndex;
    }

    function stake(uint256 amount) external {
        require(amount > 0, "Attempting to stake zero tokens");

        _processAllSections();
        _processAllCheckpoints(msg.sender);
        SafeERC20.safeTransferFrom(
            IERC20(brlyToken),
            msg.sender,
            address(this),
            amount
        );
        states[msg.sender].brlyStaked += amount;
        overallState.brlyStaked += amount;

        emit Staked(msg.sender, amount);

        uint64 currentTime = uint64(block.timestamp);
        uint32 userVersion = versions[msg.sender];
        _updateStates(
            Section({
                startTime: currentTime,
                brlySize: int256(amount),
                staker: msg.sender,
                version: userVersion
            })
        );
        toApplySections[sectionIndex.count++] = Section({
            startTime: currentTime + BOOST_DURATION,
            brlySize: -int256(amount),
            staker: msg.sender,
            version: userVersion
        });
        lastActivityTimes[msg.sender].lastStakeTime = currentTime;
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "Attempting to withdraw 0 staked tokens");
        address sender = msg.sender;

        _processAllSections();
        _processAllCheckpoints(sender);
        require(
            amount <= states[sender].brlyStaked,
            "Attempting to withdraw more BRLY than staked."
        );
        states[sender].brlyStaked -= amount;
        overallState.brlyStaked -= amount;

        emit Withdrawn(sender, amount);

        // remove outdated states
        uint64 currentTime = uint64(block.timestamp);
        overallState.sumSize -= states[sender].sumSize;
        overallState.sumSizeXTime -= states[sender].sumSizeXTime;
        states[sender].sumSize = 0;
        states[sender].sumSizeXTime = 0;
        versions[sender] += 1;

        // set new states
        uint32 userVersion = versions[sender];
        uint256 newAmount = states[sender].brlyStaked;
        _updateStates(
            Section({
                startTime: currentTime,
                brlySize: int256(newAmount),
                staker: sender,
                version: userVersion
            })
        );

        toApplySections[sectionIndex.count++] = Section({
            startTime: currentTime + BOOST_DURATION,
            brlySize: -int256(newAmount),
            staker: sender,
            version: userVersion
        });

        releaseTimelines[sender][
        releaseTimelineIndexes[sender].count++
        ] = ReleaseTimeline({
            releaseTime: currentTime + withdrawLockingTime,
            amount: amount
        });
        lastActivityTimes[sender].lastWithdrawTime = currentTime;
    }

    function claimBrly() external {
        address sender = msg.sender;

        _processAllSections();
        _processAllCheckpoints(sender);
        QueueIndex memory index = releaseTimelineIndexes[sender];
        uint64 currentTime = uint64(block.timestamp);
        uint256 brlyClaimable = 0;
        while (index.upTo < index.count) {
            ReleaseTimeline memory timeline = releaseTimelines[sender][
                            index.upTo
                ];
            if (currentTime >= timeline.releaseTime) {
                brlyClaimable += timeline.amount;
                delete releaseTimelines[sender][index.upTo++];
            } else {
                break;
            }
        }
        releaseTimelineIndexes[sender] = index;
        require(brlyClaimable > 0, "No BRLY to claim");
        SafeERC20.safeTransfer(IERC20(brlyToken), sender, brlyClaimable);
    }

    function _claimRewards() internal returns (Rewards memory unclaimedRewards) {
        address sender = msg.sender;

        _processAllSections();
        _processAllCheckpoints(sender);
        for (uint64 i = toClaimCheckpoint[sender]; i < numCheckpoints; i++) {
            Rewards memory rewards = rewardsBreakdowns[sender][i];
            unclaimedRewards.wbera += rewards.wbera;
            unclaimedRewards.brly += rewards.brly;
        }
        toClaimCheckpoint[sender] = numCheckpoints;
        require(unclaimedRewards.wbera > 0 || unclaimedRewards.brly > 0, "No rewards to claim");
    }

    function claimRewards() external {
        Rewards memory unclaimedRewards = _claimRewards();

        if(unclaimedRewards.wbera > 0) {
            SafeERC20.safeTransfer(IERC20(wberaToken), msg.sender, unclaimedRewards.wbera);
        }

        if(unclaimedRewards.brly > 0) {
            SafeERC20.safeTransfer(IERC20(brlyToken), msg.sender, unclaimedRewards.brly);
        }

        emit Claimed(msg.sender, unclaimedRewards.wbera, unclaimedRewards.brly);
    }

    function distributeRewards(uint256 wberaRewards, uint256 brlyRewards) external {
        require(msg.sender == rewardDistributor, 'Unauthorized to distribute rewards');
        require(wberaRewards > 0 || brlyRewards > 0, "must distribute rewards greater than zero");

        _processAllSections();

        uint64 currentTime = uint64(block.timestamp);
        address sender = msg.sender;

        if(wberaRewards > 0) {
            SafeERC20.safeTransferFrom(
                IERC20(wberaToken),
                sender,
                address(this),
                wberaRewards
            );
        }

        if(brlyRewards > 0) {
            SafeERC20.safeTransferFrom(
                IERC20(brlyToken),
                sender,
                address(this),
                brlyRewards
            );
        }

        checkpoints[numCheckpoints++] = Checkpoint({
            time: currentTime,
            brlyStaked: overallState.brlyStaked,
            sumSize: overallState.sumSize,
            sumSizeXTime: overallState.sumSizeXTime,
            wberaRewards: wberaRewards,
            brlyRewards: brlyRewards
        });

        emit RewardsDistributed(wberaRewards, brlyRewards);
    }

    function getWithdrawnBrlyStates(
        address staker
    ) external view returns (
        WithdrawnBrlyStates memory withdrawnBrlyStates,
        ReleaseTimeline[] memory timelines
    ) {
        QueueIndex memory index = releaseTimelineIndexes[staker];
        uint64 currentTime = uint64(block.timestamp);

        timelines = new ReleaseTimeline[](index.count - index.upTo);
        uint64 id = 0;
        while (index.upTo < index.count) {
            ReleaseTimeline memory timeline = releaseTimelines[staker][
                            index.upTo
                ];
            timelines[id] = timeline;
            id++;
            if (currentTime >= timeline.releaseTime) {
                withdrawnBrlyStates.brlyClaimable += timeline.amount;
            } else {
                withdrawnBrlyStates.brlyPendingUnlock += timeline.amount;
            }
            index.upTo += 1;
        }
    }

    function getRewardsClaimable(
        address staker
    ) public view returns (Rewards memory rewardsClaimable) {
        Rewards[] memory rewardsBreakdown = getRewardsDetails(staker);
        for (uint64 i = toClaimCheckpoint[staker]; i < numCheckpoints; i++) {
            rewardsClaimable.wbera += rewardsBreakdown[i].wbera;
            rewardsClaimable.brly += rewardsBreakdown[i].brly;
        }
    }

    function getRewardsDetails(
        address staker
    ) public view returns (Rewards[] memory) {
        Rewards[] memory rewardsBreakdown = new Rewards[](numCheckpoints);
        for (uint64 i = 0; i < numCheckpoints; i++) {
            if (i < checkpointIndexes[staker]) {
                rewardsBreakdown[i] = rewardsBreakdowns[staker][i];
            } else {
                Checkpoint memory checkpoint = checkpoints[i];
                uint256 stakerPoint = _getPointAtTime(
                    states[staker],
                    checkpoint.time
                );
                uint256 totalPoint = _getPointAtTime(
                    State({
                        brlyStaked: checkpoint.brlyStaked,
                        sumSize: checkpoint.sumSize,
                        sumSizeXTime: checkpoint.sumSizeXTime
                    }),
                    checkpoint.time
                );
                rewardsBreakdown[i].wbera =
                    (stakerPoint * checkpoint.wberaRewards) /
                    totalPoint;
                rewardsBreakdown[i].brly =
                    (stakerPoint * checkpoint.brlyRewards) /
                    totalPoint;
            }
        }
        return rewardsBreakdown;
    }

    function getGlobalRewardsDetails()
    external
    view
    returns (GlobalRewardsDetails[] memory)
    {
        GlobalRewardsDetails[]
        memory globalRewardsDetails = new GlobalRewardsDetails[](
            numCheckpoints
        );
        for (uint64 i = 0; i < numCheckpoints; i++) {
            globalRewardsDetails[i].distributionTime = checkpoints[i].time;
            globalRewardsDetails[i].wberaRewardsAmount = checkpoints[i].wberaRewards;
            globalRewardsDetails[i].brlyRewardsAmount = checkpoints[i].brlyRewards;
        }
        return globalRewardsDetails;
    }

    function getBrlyStaked(address staker) external view returns (uint256) {
        return states[staker].brlyStaked;
    }

    function getTotalBrlyStaked() external view returns (uint256) {
        return overallState.brlyStaked;
    }

    function _getPointAtTime(
        State memory _state,
        uint64 currentTime
    ) internal pure returns (uint256) {
        uint256 basePoint = _state.brlyStaked * BASE_POINT_MULTIPLIER;
        uint256 boostPoint = (uint256(
            (int256(int64(currentTime)) * _state.sumSize - _state.sumSizeXTime)
        ) * BOOST_POINT_MULTIPLIER) / BOOST_DURATION;
        return basePoint + boostPoint;
    }

    function getPoint(address staker) external view returns (uint256) {
        uint64 currentTime = uint64(block.timestamp);
        return _getPointAtTime(states[staker], currentTime) / 2;
    }

    function getTotalPoint() external view returns (uint256) {
        uint64 currentTime = uint64(block.timestamp);
        return _getPointAtTime(overallState, currentTime) / 2;
    }

    function getLastActivityTimes(
        address staker
    ) external view returns (LastActivityTimes memory) {
        return lastActivityTimes[staker];
    }

    function getWithdrawLockingTime() external view returns (uint64) {
        return withdrawLockingTime;
    }

    function updateConfig(uint64 _withdrawLockingTime) external onlyOwner {
        withdrawLockingTime = _withdrawLockingTime;
    }

    function setRewardDistributor(address _rewardDistributor) external onlyOwner {
        rewardDistributor = _rewardDistributor;
    }
}