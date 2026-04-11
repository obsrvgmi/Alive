// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/// @title AliveToken
/// @notice ERC20 token for ALIVE characters with controlled minting
contract AliveToken is ERC20 {
    address public immutable factory;
    address public immutable bondingCurve;

    error OnlyFactory();
    error OnlyBondingCurve();

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    modifier onlyBondingCurve() {
        if (msg.sender != bondingCurve) revert OnlyBondingCurve();
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        address factory_,
        address bondingCurve_
    ) ERC20(name_, symbol_) {
        factory = factory_;
        bondingCurve = bondingCurve_;
    }

    /// @notice Mint tokens - only callable by bonding curve
    function mint(address to, uint256 amount) external onlyBondingCurve {
        _mint(to, amount);
    }

    /// @notice Burn tokens - callable by anyone for their own tokens
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
