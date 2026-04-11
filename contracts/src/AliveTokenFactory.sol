// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AliveToken} from "./AliveToken.sol";
import {IAliveCharacterRegistry} from "./interfaces/IAlive.sol";
import {AliveBondingCurve} from "./AliveBondingCurve.sol";

/// @title AliveTokenFactory
/// @notice Factory for deploying ALIVE character tokens
contract AliveTokenFactory {
    // ============ Constants ============

    uint256 public constant LAUNCH_FEE_BPS = 100; // 1% launch fee
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_DEV_BUY = 5 ether; // Max 5 OKB dev buy

    // ============ Storage ============

    address public owner;
    address public registry;
    address public bondingCurve;
    address public feeTreasury;

    uint256 public totalLaunches;
    mapping(address => address[]) public creatorTokens;

    // ============ Events ============

    event TokenLaunched(
        address indexed token,
        string name,
        string ticker,
        address indexed creator,
        uint256 devBuy,
        uint256 timestamp
    );

    // ============ Errors ============

    error OnlyOwner();
    error InsufficientFee();
    error DevBuyTooHigh();
    error ZeroAddress();
    error TransferFailed();
    error InvalidTicker();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ============ Constructor ============

    constructor(address _registry, address _bondingCurve, address _feeTreasury) {
        owner = msg.sender;
        registry = _registry;
        bondingCurve = _bondingCurve;
        feeTreasury = _feeTreasury;
    }

    // ============ Admin ============

    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        registry = _registry;
    }

    function setBondingCurve(address _bondingCurve) external onlyOwner {
        if (_bondingCurve == address(0)) revert ZeroAddress();
        bondingCurve = _bondingCurve;
    }

    function setFeeTreasury(address _feeTreasury) external onlyOwner {
        if (_feeTreasury == address(0)) revert ZeroAddress();
        feeTreasury = _feeTreasury;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    // ============ Launch ============

    struct LaunchParams {
        string name;
        string ticker;
        string metadataURI;
        address[] feeRecipients;
        uint256[] feeSplits;
        uint256 devBuyAmount;
    }

    /// @notice Launch a new character token
    /// @param params Launch parameters
    /// @return token The deployed token address
    function launch(LaunchParams calldata params) external payable returns (address token) {
        // Validate ticker (1-6 uppercase chars)
        if (bytes(params.ticker).length == 0 || bytes(params.ticker).length > 6) {
            revert InvalidTicker();
        }

        // Validate dev buy
        if (params.devBuyAmount > MAX_DEV_BUY) revert DevBuyTooHigh();

        // Calculate required payment
        uint256 launchFee = (params.devBuyAmount * LAUNCH_FEE_BPS) / BPS_DENOMINATOR;
        if (launchFee < 0.01 ether) launchFee = 0.01 ether; // Minimum 0.01 OKB
        uint256 totalRequired = launchFee + params.devBuyAmount;
        if (msg.value < totalRequired) revert InsufficientFee();

        // Deploy token
        token = address(new AliveToken(
            params.name,
            params.ticker,
            address(this),
            bondingCurve
        ));

        // Register character
        IAliveCharacterRegistry(registry).registerCharacter(
            token,
            params.name,
            params.ticker,
            params.metadataURI,
            msg.sender
        );

        // Initialize on bonding curve with dev buy - tokens go to creator
        AliveBondingCurve(payable(bondingCurve)).initializeToken{value: params.devBuyAmount}(
            token,
            params.devBuyAmount,
            msg.sender
        );

        // Send launch fee to treasury
        if (launchFee > 0) {
            (bool sent, ) = feeTreasury.call{value: launchFee}("");
            if (!sent) revert TransferFailed();
        }

        // Refund excess
        uint256 excess = msg.value - totalRequired;
        if (excess > 0) {
            (bool refunded, ) = msg.sender.call{value: excess}("");
            if (!refunded) revert TransferFailed();
        }

        // Track launch
        totalLaunches++;
        creatorTokens[msg.sender].push(token);

        emit TokenLaunched(
            token,
            params.name,
            params.ticker,
            msg.sender,
            params.devBuyAmount,
            block.timestamp
        );

        return token;
    }

    // ============ Views ============

    function getCreatorTokens(address creator) external view returns (address[] memory) {
        return creatorTokens[creator];
    }

    function getCreatorTokenCount(address creator) external view returns (uint256) {
        return creatorTokens[creator].length;
    }

    // ============ Receive ============

    receive() external payable {}
}
