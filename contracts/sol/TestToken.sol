// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TestToken
/// @notice Minimal mintable ERC20 with configurable decimals.
///         Deployed on Sepolia as the borrower's collateral token and on Creditcoin as Mock USD1.
contract TestToken is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Testnet-only faucet-style mint.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
