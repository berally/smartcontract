# Berally Passes Smart Contract

This is a smart contract for managing passes on the Berally platform, deployed on Berachain.

## Project Structure

```
├── contracts/
│   ├── Passes.sol              # Main contract for pass management
│   ├── mocks/
│   │   ├── MockPasses.sol      # Mock contract for testing
│   │   └── MockBerachainRewardsVaultFactory.sol
├── test/
│   └── mock.test.ts            # Test cases
└── scripts/                     # Deployment scripts
```

## Core Components

### 1. Passes Contract
The main contract (`Passes.sol`) implements the following features:
- Pass creation and management
- Fee distribution system (protocol, manager, referral)
- Integration with Berachain staking system
- Price calculation based on bonding curve

### 2. PassesStakingToken
An ERC20 token that:
- Represents staked value in the system
- Can only be minted/burned by the Passes contract
- Used for delegating stake to Berachain Rewards

### 3. Mock Contracts
For testing purposes:
- `MockPasses`: Test version of the main contract
- `MockBerachainRewardsVaultFactory`: Simulates the Berachain rewards system

## Features

### 1. Pass Management
- **First Pass Creation**: Only managers can create the first pass
- **Dynamic Pricing**: Uses a bonding curve formula
- **Configurable Factors**: Supports different price curves (500, 100, 30)

### 2. Fee System
- **Protocol Fee**: Platform fee (default: 5%)
- **Manager Fee**: Pass creator fee (default: 5%)
- **Referral Fee**: Commission for referrers (default: 1%)

### 3. Staking Integration
- Automatic staking of purchase value
- FIFO-based unstaking on sales
- Integration with Berachain Rewards system

## Setup and Development

### Requirements
- Node.js
- Yarn
- Hardhat

### Installation
```bash
yarn install
```

### Testing
```bash
# Run all tests
yarn test

# Run specific test file
yarn test test/mock.test.ts
```

### Configuration
1. Copy `.env.example` to `.env`
2. Configure the following variables:
   - Network RPC URLs
   - Private keys
   - API keys (if needed)

## Technical Details

### Smart Contract Parameters
- Protocol Fee: 5% (0.05 ether)
- Manager Fee: 5% (0.05 ether)
- Referral Fee: 1% (0.01 ether)
- Default Factors: [500, 100, 30]

### Price Calculation
Uses a bonding curve formula:
```solidity
function getPrice(uint256 supply, uint256 amount, uint256 factor) public pure returns (uint256)
```


### Mainnet
- Vault: [Explorer Link]
- Passes: [Explorer Link]
- 
### Security Features
- OpenZeppelin's Upgradeable Contracts
- Access Control
- Safe Math operations
- Reentrancy protection

## Testing
The test suite covers:
- Contract initialization
- Fee configuration
- Pass buying/selling scenarios
- Edge cases and restrictions
- Integration with staking system

## Contributing
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License
UNLICENSED

