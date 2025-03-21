# Berally Rewards Smart Contract

A smart contract system for managing and distributing rewards in the Berally ecosystem. This contract allows for creating reward cycles, distributing rewards, and claiming rewards with signature verification.

## Features

- **Cycle Management**: Create and update reward cycles with specific release timelines
- **Reward Distribution**: Distribute ERC20 tokens as rewards for each cycle
- **Secure Claiming**: Claim rewards using signature verification
- **Upgradeable**: Contract is upgradeable using OpenZeppelin's upgrade pattern
- **Role-based Access**: Owner and reward distributor roles for secure management

## Technical Stack

- Solidity ^0.8.0
- Hardhat
- OpenZeppelin Contracts
- TypeScript
- Ethers.js
- Chai (Testing)

## Contract Architecture

### Main Components

1. **Cycle Management**
   - Create cycles with year/month periods
   - Set release timelines for each cycle
   - Update cycle parameters before release

2. **Reward Distribution**
   - Distribute ERC20 tokens for each cycle
   - Track distributed amounts
   - Restricted to authorized distributor

3. **Claiming System**
   - EIP712-compliant signature verification
   - One-time claiming per user per cycle
   - Percentage-based reward calculation

### Key Functions

```solidity
function createCycle(uint16 year, uint8 month, uint256 releaseAt)
function updateCycle(uint16 year, uint8 month, uint256 releaseAt)
function distributeRewards(uint16 year, uint8 month, uint256 amount)
function claim(uint16 year, uint8 month, uint256 percent, bytes calldata signature)
```

## Setup and Installation

1. Install dependencies:
```bash
yarn install
```

2. Compile contracts:
```bash
yarn compile
```

3. Run tests:
```bash
npx hardhat test
```

## Configuration

The contract can be configured through the `config/rewards.ts` file:

```typescript
export type Config = {
    rewardAddress: string
}

// Network-specific configurations
export const getConfig = (networkName: string): Config => {
    switch (networkName) {
        case "berachainTestnet":
            return {
                rewardAddress: "",
            };
        case "berachainMainnet":
            return {
                rewardAddress: "0x5C43a5fEf2b056934478373A53d1cb08030fd382",
            };
    }
}
```

## Deployment

Deploy to testnet:
```bash
yarn deploy:Rewards:berachainTestnet
```

Deploy to mainnet:
```bash
yarn deploy:Rewards:berachainMainnet
```

## Testing

The contract includes comprehensive tests covering:
- Cycle creation and management
- Reward distribution
- Claiming mechanism
- Access control
- Error cases

Run tests:
```bash
npx hardhat test
```

## Security Considerations

1. **Access Control**
   - Owner-only functions for critical operations
   - Separate reward distributor role
   - Signature verification for claims

2. **Validation**
   - Year validation (>= 2025)
   - Month validation (1-12)
   - Release time validation
   - One-time claiming per user

3. **Upgradability**
   - Uses OpenZeppelin's upgradeable contract pattern
   - Secure initialization process

## License

This project is licensed under the GPL-2.0-or-later License.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request 