// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Mock Erc20 token - for testing purposes ONLY.
contract MockERC20 is ERC20 {
  uint8 internal _decimals;

  constructor(
    string memory name,
    string memory symbol,
    uint8 __decimals
  ) ERC20(name, symbol) {
    _decimals = __decimals;
  }

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function burn(address from, uint256 amount) external {
    _burn(from, amount);
  }

  function decimals() public view override returns (uint8) {
    return _decimals;
  }
}