# Berally
## Repository
We have two contracts:
- `Staking`: Contract allows users to stake BRLY tokens. Based on the duration and the amount of tokens staked, they will receive rewards in the form of HONEY.
- `Rewards`: The contract allows users to receive rewards based on their XP. After each month, users can claim reward token.

## Staking's sequence of events
A `Staking` contract allows users to stake BRLY tokens, which are locked in the contract. Users can then request to withdraw BRLY tokens, but the withdrawal will only be permitted after a specified period by calling the claimBrly function. Rewards are distributed over time, and users can claim their rewards by calling the claimRewards function.

### 1. Stake BRLY token
The entry point `stake` in the `Staking` contract allows users to stake BRLY tokens, and this action can be performed multiple times.

### 2. Request to withdraw BRLY tokens.
The entry point `withdraw` in the `Staking` contract allows users to submit a request to withdraw BRLY tokens. However, these tokens cannot be withdrawn immediately and must wait until the release time.

### 3. Claim BRLY token
The entry point `claimBrly` in the `Staking` contract allows users to withdraw BRLY tokens that were previously requested, after the release time has been reached.

### 4. Distribute rewards
The entry point `distributeRewards` in the Staking contract allocates a certain amount of HONEY as rewards for staking. The entire reward pool is distributed among all users currently staking.

### 5. Claim rewards
The entry point claimRewards in the Staking contract allows users to withdraw their allocated HONEY rewards, which have been distributed based on the staking duration and amount

## Rewards's sequence of events
A `Rewards` contract allows the distribution of a certain amount of BRLY as monthly rewards. Each month, the protocol's administrator will initiate a cycle with a specified reward amount. Upon reaching the release time, users can claim their corresponding reward based on their XP.

### Create a cycle
The entry point createCycle allows the protocol's administrator to initiate a new cycle, transfer a specified amount of reward tokens into the contract, and set the release time.

### Claim rewards
The entry point claim allows users to withdraw their corresponding reward based on the XP they accumulated during the cycle, once the release time has been reached.