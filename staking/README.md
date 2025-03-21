# Berally Staking Contracts

Smart contracts for staking BRLY tokens and earning rewards in USDC/WBERA.

## Contracts

- `Staking.sol`: Initial version with USDC rewards
- `StakingV3.sol`: Upgraded version with WBERA rewards
- Mock tokens for testing and testnet deployment

## Features

- Stake BRLY tokens
- Earn rewards in USDC (v1) or WBERA (v3)
- Upgradeable using UUPS proxy pattern
- Configurable withdraw locking time
- Reward distribution mechanism
- Emergency withdrawal functionality

## Development

### Prerequisites

- Node.js >= 16
- Yarn

### Installation

```bash
yarn install
```

### Compile Contracts

```bash
yarn compile
```

### Run Tests

```bash
# Run all tests
yarn test

# Run coverage
yarn test:coverage
```

### Local Development

```bash
# Start local node
yarn start

# Deploy to local network
yarn hardhat run scripts/deploy-staking.ts --network localhost
```

## Deployment

### Testnet

1. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your private key and API keys
```

2. Deploy mock tokens:
```bash
yarn deploy:MockTokens:testnet
```

3. Deploy staking contract:
```bash
yarn deploy:Staking:berachainTestnet
```

4. Verify contracts:
```bash
yarn verify
```

### Mainnet

1. Update mainnet token addresses in deployment scripts

2. Deploy staking contract:
```bash
yarn deploy:StakingV3:berachainMainnet
```

### Check Deployment Status

```bash
yarn check:status
```

## Upgrading

1. Deploy new implementation:
```bash
yarn upgrade:Staking:berachainTestnet
```

2. Verify new implementation:
```bash
yarn verify <IMPLEMENTATION_ADDRESS>
```

## Contract Addresses

### Testnet
- BRLY: [Explorer Link]
- USDC/WBERA: [Explorer Link]
- Staking Proxy: [Explorer Link]

### Mainnet
- BRLY: [Explorer Link]
- WBERA: [Explorer Link]
- Staking Proxy: [Explorer Link]

## Security

- All contracts are upgradeable
- Emergency functions for critical situations
- Comprehensive test coverage
- Access control using OpenZeppelin

## License

MIT