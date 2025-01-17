# Berally
## Repository
We have a main contract:
`Passes`: Contract for managers create passes, users buy and sell the passes.

## Sequence of Events
A `Passes` 'contract allows managers to create passes. It allows users to perform buying and selling of passes.

### 1. Init the first pass
* The entry point `buyPasses` in `Passes` contract allow managers to create the first pass before other users can buy. With the factor parameter, managers can adjust the price for their passes.

### 2. Buy passes
* The entry point `buyPasses` in `Passes` contract also allow users to buy passes with prices that change based on the balance of passes. Additionally, a referenced user is attached to receive the funds from the transaction. Staking Tokens will be minted corresponding to the prices and staked into Berachain Rewards.

### 3. Sell passes
* The entry point `sellPasses` in `Passes` contract allow users to sell their passes. Additionally, a referenced user is attached to receive the funds from the transaction. Staking Tokens equivalent to the sold passes will be burned.

## Build
```bash
yarn compile
```

## Configuration
See example in `config/*.config.ts`

## Deploy
* Before deploy contract, you need ensure add enviroment variable in `.env` (see `.env.example`)
* Deploy Passes on Berachain
```bash
yarn deploy:Passes:berachain
```

