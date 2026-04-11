// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAliveFeeSplitter} from "./interfaces/IAlive.sol";

/// @title AliveFeeSplitter
/// @notice Distributes creator fees to multiple recipients
contract AliveFeeSplitter is IAliveFeeSplitter {
    // ============ Constants ============

    uint256 public constant BPS_DENOMINATOR = 10000;

    // ============ Storage ============

    address public owner;
    address public factory;

    struct FeeSplit {
        address[] recipients;
        uint256[] splits; // In basis points, must sum to 10000
    }

    mapping(address => FeeSplit) internal tokenFeeSplits;
    mapping(address => mapping(address => uint256)) public pendingWithdrawals;

    // ============ Events ============

    event FeesDistributed(address indexed token, uint256 amount);
    event SplitsUpdated(address indexed token, address[] recipients, uint256[] splits);
    event Withdrawn(address indexed recipient, uint256 amount);

    // ============ Errors ============

    error OnlyOwner();
    error OnlyFactory();
    error InvalidSplits();
    error TransferFailed();
    error NothingToWithdraw();
    error ZeroAddress();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    // ============ Constructor ============

    constructor(address _factory) {
        owner = msg.sender;
        factory = _factory;
    }

    // ============ Admin ============

    function setFactory(address _factory) external onlyOwner {
        if (_factory == address(0)) revert ZeroAddress();
        factory = _factory;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    // ============ Fee Split Configuration ============

    /// @notice Set fee splits for a token (called by factory on launch)
    function setFeeSplits(
        address token,
        address[] calldata recipients,
        uint256[] calldata splits
    ) external onlyFactory {
        if (recipients.length != splits.length) revert InvalidSplits();
        if (recipients.length == 0) revert InvalidSplits();

        // Validate splits sum to 100%
        uint256 total = 0;
        for (uint256 i = 0; i < splits.length; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            total += splits[i];
        }
        if (total != BPS_DENOMINATOR) revert InvalidSplits();

        tokenFeeSplits[token] = FeeSplit({
            recipients: recipients,
            splits: splits
        });

        emit SplitsUpdated(token, recipients, splits);
    }

    // ============ Fee Distribution ============

    /// @notice Distribute fees for a token
    function distributeFees(address token) external payable {
        if (msg.value == 0) return;

        FeeSplit storage split = tokenFeeSplits[token];

        // If no splits configured, send to contract owner
        if (split.recipients.length == 0) {
            pendingWithdrawals[token][owner] += msg.value;
        } else {
            // Distribute according to splits
            for (uint256 i = 0; i < split.recipients.length; i++) {
                uint256 share = (msg.value * split.splits[i]) / BPS_DENOMINATOR;
                pendingWithdrawals[token][split.recipients[i]] += share;
            }
        }

        emit FeesDistributed(token, msg.value);
    }

    /// @notice Withdraw pending fees
    function withdraw(address token) external {
        uint256 amount = pendingWithdrawals[token][msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pendingWithdrawals[token][msg.sender] = 0;

        (bool sent, ) = msg.sender.call{value: amount}("");
        if (!sent) revert TransferFailed();

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Withdraw all pending fees across all tokens
    function withdrawAll(address[] calldata tokens) external {
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = pendingWithdrawals[tokens[i]][msg.sender];
            if (amount > 0) {
                pendingWithdrawals[tokens[i]][msg.sender] = 0;
                totalAmount += amount;
            }
        }

        if (totalAmount == 0) revert NothingToWithdraw();

        (bool sent, ) = msg.sender.call{value: totalAmount}("");
        if (!sent) revert TransferFailed();

        emit Withdrawn(msg.sender, totalAmount);
    }

    // ============ Views ============

    function getFeeSplits(address token) external view returns (address[] memory, uint256[] memory) {
        FeeSplit storage split = tokenFeeSplits[token];
        return (split.recipients, split.splits);
    }

    function getPendingAmount(address token, address recipient) external view returns (uint256) {
        return pendingWithdrawals[token][recipient];
    }

    // ============ Receive ============

    receive() external payable {}
}
