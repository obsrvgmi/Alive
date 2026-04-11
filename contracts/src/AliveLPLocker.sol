// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AliveLPLocker
/// @notice Locks LP tokens forever on graduation
contract AliveLPLocker {
    // ============ Storage ============

    address public owner;
    address public bondingCurve;

    struct LockedLP {
        address lpToken;
        uint256 amount;
        uint256 lockedAt;
        address graduatedToken;
    }

    mapping(address => LockedLP) public lockedLPs; // graduatedToken => LockedLP
    address[] public allLockedTokens;

    // ============ Events ============

    event LPLocked(
        address indexed graduatedToken,
        address indexed lpToken,
        uint256 amount,
        uint256 timestamp
    );

    // ============ Errors ============

    error OnlyOwner();
    error OnlyBondingCurve();
    error ZeroAddress();
    error AlreadyLocked();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyBondingCurve() {
        if (msg.sender != bondingCurve) revert OnlyBondingCurve();
        _;
    }

    // ============ Constructor ============

    constructor(address _bondingCurve) {
        owner = msg.sender;
        bondingCurve = _bondingCurve;
    }

    // ============ Admin ============

    function setBondingCurve(address _bondingCurve) external onlyOwner {
        if (_bondingCurve == address(0)) revert ZeroAddress();
        bondingCurve = _bondingCurve;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    // ============ Locking ============

    /// @notice Lock LP tokens forever (called by bonding curve on graduation)
    function lockLP(
        address graduatedToken,
        address lpToken,
        uint256 amount
    ) external onlyBondingCurve {
        if (lockedLPs[graduatedToken].amount > 0) revert AlreadyLocked();
        if (lpToken == address(0)) revert ZeroAddress();

        lockedLPs[graduatedToken] = LockedLP({
            lpToken: lpToken,
            amount: amount,
            lockedAt: block.timestamp,
            graduatedToken: graduatedToken
        });

        allLockedTokens.push(graduatedToken);

        emit LPLocked(graduatedToken, lpToken, amount, block.timestamp);
    }

    // ============ Views ============

    function getLockedLP(address graduatedToken) external view returns (LockedLP memory) {
        return lockedLPs[graduatedToken];
    }

    function isLocked(address graduatedToken) external view returns (bool) {
        return lockedLPs[graduatedToken].amount > 0;
    }

    function getTotalLockedCount() external view returns (uint256) {
        return allLockedTokens.length;
    }

    function getAllLockedTokens() external view returns (address[] memory) {
        return allLockedTokens;
    }
}
