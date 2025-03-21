// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Rewards is OwnableUpgradeable, UUPSUpgradeable, EIP712Upgradeable {
    using SafeERC20 for IERC20;

    uint256 public constant DENOMINATOR = 100e18;
    uint256 public constant MAX_RELEASE_TIME = 365 days;
    
    address public rewardToken;
    address private beWallet;
    address public rewardDistributor;
    
    mapping(uint16 year => mapping(uint8 month => uint256 releaseAt)) public releaseTimelines;
    mapping(uint16 year => mapping(uint8 month => uint256 amount)) public cycles;
    mapping(uint16 year => mapping(uint8 month => mapping(address user => uint256 amount))) public claimed;
    mapping(bytes32 => bool) private usedSignatures;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    event Created(
        uint16 year,
        uint8 month,
        uint256 releaseAt
    );

    event Updated(
        uint16 year,
        uint8 month,
        uint256 releaseAt
    );

    event Claimed(
        uint16 year,
        uint8 month,
        address user,
        uint256 percent,
        uint256 amount
    );

    event RewardsDistributed (
        uint16 year,
        uint8 month,
        uint256 amount
    );

    function initialize(
        address _rewardToken
    ) external initializer {
        require(_rewardToken != address(0), "Invalid token address");
        
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __EIP712_init("Berally Rewards", "1");
        
        rewardDistributor = msg.sender;
        rewardToken = _rewardToken;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function createCycle(uint16 year, uint8 month, uint256 releaseAt) external onlyOwner {
        require(2025 <= year, "Invalid year");
        require(1 <= month && month <= 12, "Invalid month");
        require(releaseAt > block.timestamp, "Release time not in future");
        require(releaseAt <= block.timestamp + MAX_RELEASE_TIME, "Release time too far");
        require(releaseTimelines[year][month] == 0, "Already created");

        releaseTimelines[year][month] = releaseAt;

        emit Created(year, month, releaseAt);
    }

    function updateCycle(uint16 year, uint8 month, uint256 releaseAt) external onlyOwner {
        require(2025 <= year, "Invalid year");
        require(1 <= month && month <= 12, "Invalid month");
        require(releaseAt > block.timestamp, "Release time not in future");
        require(releaseAt <= block.timestamp + MAX_RELEASE_TIME, "Release time too far");
        require(releaseTimelines[year][month] > block.timestamp, "Already released");

        releaseTimelines[year][month] = releaseAt;

        emit Updated(year, month, releaseAt);
    }

    function distributeRewards(uint16 year, uint8 month, uint256 amount) external {
        require(msg.sender == rewardDistributor, "Unauthorized to distribute rewards");
        require(amount > 0, "Invalid rewards value");
        require(releaseTimelines[year][month] > 0, "Cycle not found");
        require(cycles[year][month] == 0, "Already distributed");

        IERC20(rewardToken).safeTransferFrom(msg.sender, address(this), amount);
        cycles[year][month] = amount;

        emit RewardsDistributed(year, month, amount);
    }

    function claim(uint16 year, uint8 month, uint256 percent, bytes calldata signature) external {
        require(releaseTimelines[year][month] <= block.timestamp, "Can not claim now");
        require(cycles[year][month] > 0, "No rewards");
        require(claimed[year][month][msg.sender] == 0, "Already claimed");
        require(percent > 0 && percent <= DENOMINATOR, "Invalid percent");

        bytes32 signatureHash = keccak256(abi.encodePacked(signature));
        require(!usedSignatures[signatureHash], "Signature already used");

        if(
            ECDSA.recover(
                MessageHashUtils.toEthSignedMessageHash(
                    getDigest(year, month, msg.sender, percent)
                ),
                signature
            ) != beWallet
        ) revert("Invalid signature");

        usedSignatures[signatureHash] = true;

        uint256 cycleAmount = cycles[year][month];
        uint256 amount = (cycleAmount * percent) / DENOMINATOR;
        require(amount <= cycleAmount, "Overflow in reward calculation");

        claimed[year][month][msg.sender] = amount;
        IERC20(rewardToken).safeTransfer(msg.sender, amount);

        emit Claimed(year, month, msg.sender, percent, amount);
    }

    function withdraw(
        address receiver,
        address token,
        uint256 amount
    ) external onlyOwner {
        require(receiver != address(0), "Invalid receiver address");
        if (token == address(0)) {
            payable(receiver).transfer(amount);
        } else {
            IERC20(token).safeTransfer(receiver, amount);
        }
    }

    function getDigest(
        uint16 year,
        uint8 month,
        address user,
        uint256 percent
    ) public view returns (bytes32) {
        return
            _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256("claim"),
                    year,
                    month,
                    user,
                    percent
                )
            )
        );
    }

    function setBEWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "Invalid wallet address");
        beWallet = wallet;
    }

    function setRewardDistributor(address _rewardDistributor) external onlyOwner {
        require(_rewardDistributor != address(0), "Invalid distributor address");
        rewardDistributor = _rewardDistributor;
    }
}