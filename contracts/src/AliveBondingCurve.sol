// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAliveBondingCurve, IAliveCharacterRegistry} from "./interfaces/IAlive.sol";
import {AliveToken} from "./AliveToken.sol";

/// @title AliveBondingCurve
/// @notice Bonding curve for buying/selling ALIVE tokens with vitality effects
contract AliveBondingCurve is IAliveBondingCurve {
    // ============ Constants ============

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether; // 1B tokens
    uint256 public constant GRADUATION_THRESHOLD = 100 ether; // 100 OKB for graduation
    uint256 public constant K = 30 ether; // Curve parameter
    uint256 public constant TRADING_FEE_BPS = 100; // 1% fee
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ============ Storage ============

    address public immutable factory;
    address public immutable registry;
    address public feeSplitter;
    address public owner;

    mapping(address => uint256) public tokenSupply; // Circulating supply per token
    mapping(address => uint256) public tokenReserve; // OKB reserve per token

    // ============ Errors ============

    error OnlyFactory();
    error OnlyOwner();
    error InvalidToken();
    error InsufficientPayment();
    error InsufficientOutput();
    error InsufficientBalance();
    error AlreadyGraduated();
    error TransferFailed();
    error ZeroAmount();

    // ============ Modifiers ============

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ============ Constructor ============

    constructor(address _factory, address _registry, address _feeSplitter) {
        factory = _factory;
        registry = _registry;
        feeSplitter = _feeSplitter;
        owner = msg.sender;
    }

    // ============ Admin ============

    function setFeeSplitter(address _feeSplitter) external onlyOwner {
        feeSplitter = _feeSplitter;
    }

    // ============ Factory Functions ============

    /// @notice Initialize a new token on the bonding curve
    function initializeToken(address token, uint256 initialBuy, address creator) external payable onlyFactory {
        if (msg.value < initialBuy) revert InsufficientPayment();

        // Initial state
        tokenSupply[token] = 0;
        tokenReserve[token] = 0;

        // Process initial dev buy if any - tokens go to creator, not factory
        if (initialBuy > 0) {
            _buy(token, creator, initialBuy);
        }
    }

    // ============ Trading ============

    /// @notice Buy tokens with OKB
    function buy(address token, uint256 minTokensOut) external payable returns (uint256) {
        if (msg.value == 0) revert ZeroAmount();
        if (!IAliveCharacterRegistry(registry).isRegistered(token)) revert InvalidToken();

        IAliveCharacterRegistry.Character memory c = IAliveCharacterRegistry(registry).getCharacter(token);
        if (c.graduated) revert AlreadyGraduated();

        return _buy(token, msg.sender, msg.value);
    }

    function _buy(address token, address buyer, uint256 okbAmount) internal returns (uint256) {
        // Calculate fee
        uint256 fee = (okbAmount * TRADING_FEE_BPS) / BPS_DENOMINATOR;
        uint256 amountAfterFee = okbAmount - fee;

        // Calculate tokens to mint
        uint256 tokensOut = _getTokensForOkb(token, amountAfterFee);
        if (tokensOut == 0) revert ZeroAmount();

        // Update state
        tokenSupply[token] += tokensOut;
        tokenReserve[token] += amountAfterFee;

        // Mint tokens to buyer
        AliveToken(token).mint(buyer, tokensOut);

        // Send fee to splitter
        if (fee > 0 && feeSplitter != address(0)) {
            (bool sent, ) = feeSplitter.call{value: fee}("");
            if (!sent) revert TransferFailed();
        }

        // Update vitality (buying heals)
        uint256 currentVitality = IAliveCharacterRegistry(registry).getCurrentVitality(token);
        uint256 heal = IAliveCharacterRegistry(registry).calculateBuyHeal(okbAmount);
        uint256 newVitality = currentVitality + heal;
        if (newVitality > 10000) newVitality = 10000;
        IAliveCharacterRegistry(registry).updateVitality(token, newVitality);

        // Check graduation
        if (tokenReserve[token] >= GRADUATION_THRESHOLD) {
            _graduate(token);
        }

        emit Buy(buyer, token, okbAmount, tokensOut, newVitality);
        return tokensOut;
    }

    /// @notice Sell tokens for OKB
    function sell(address token, uint256 tokenAmount, uint256 minOkbOut) external returns (uint256) {
        if (tokenAmount == 0) revert ZeroAmount();
        if (!IAliveCharacterRegistry(registry).isRegistered(token)) revert InvalidToken();

        IAliveCharacterRegistry.Character memory c = IAliveCharacterRegistry(registry).getCharacter(token);
        if (c.graduated) revert AlreadyGraduated();

        // Check balance
        if (AliveToken(token).balanceOf(msg.sender) < tokenAmount) revert InsufficientBalance();

        // Calculate OKB to return
        uint256 okbOut = _getOkbForTokens(token, tokenAmount);
        if (okbOut < minOkbOut) revert InsufficientOutput();

        // Calculate fee
        uint256 fee = (okbOut * TRADING_FEE_BPS) / BPS_DENOMINATOR;
        uint256 amountAfterFee = okbOut - fee;

        // Update state
        tokenSupply[token] -= tokenAmount;
        tokenReserve[token] -= okbOut;

        // Burn tokens
        AliveToken(token).transferFrom(msg.sender, address(this), tokenAmount);
        // Note: In production, implement burn in the token

        // Send OKB to seller
        (bool sent, ) = msg.sender.call{value: amountAfterFee}("");
        if (!sent) revert TransferFailed();

        // Send fee to splitter
        if (fee > 0 && feeSplitter != address(0)) {
            (bool feeSent, ) = feeSplitter.call{value: fee}("");
            if (!feeSent) revert TransferFailed();
        }

        // Update vitality (selling drains)
        uint256 currentVitality = IAliveCharacterRegistry(registry).getCurrentVitality(token);
        uint256 drain = IAliveCharacterRegistry(registry).calculateSellDrain(okbOut);
        uint256 newVitality = drain >= currentVitality ? 0 : currentVitality - drain;
        IAliveCharacterRegistry(registry).updateVitality(token, newVitality);

        emit Sell(msg.sender, token, tokenAmount, amountAfterFee, newVitality);
        return amountAfterFee;
    }

    // ============ Graduation ============

    function _graduate(address token) internal {
        // Mark as graduated
        IAliveCharacterRegistry(registry).markGraduated(token);

        // In production: create LP pair and lock liquidity
        // For now, emit event
        emit Graduated(token, address(0), tokenReserve[token]);
    }

    // ============ Price Calculations ============

    /// @notice Bonding curve: y = TOTAL_SUPPLY * (1 - 1 / (1 + reserve/K))
    function _getTokensForOkb(address token, uint256 okbAmount) internal view returns (uint256) {
        uint256 currentReserve = tokenReserve[token];
        uint256 newReserve = currentReserve + okbAmount;

        uint256 currentSupply = _supplyAtReserve(currentReserve);
        uint256 newSupply = _supplyAtReserve(newReserve);

        return newSupply - currentSupply;
    }

    function _getOkbForTokens(address token, uint256 tokenAmount) internal view returns (uint256) {
        uint256 currentSupply = tokenSupply[token];
        uint256 newSupply = currentSupply - tokenAmount;

        uint256 currentReserve = _reserveAtSupply(currentSupply);
        uint256 newReserve = _reserveAtSupply(newSupply);

        return currentReserve - newReserve;
    }

    function _supplyAtReserve(uint256 reserve) internal pure returns (uint256) {
        if (reserve == 0) return 0;
        // y = TOTAL_SUPPLY * (1 - 1 / (1 + reserve/K))
        // y = TOTAL_SUPPLY * reserve / (reserve + K)
        return (TOTAL_SUPPLY * reserve) / (reserve + K);
    }

    function _reserveAtSupply(uint256 supply) internal pure returns (uint256) {
        if (supply == 0) return 0;
        if (supply >= TOTAL_SUPPLY) return type(uint256).max;
        // Inverse: reserve = K * supply / (TOTAL_SUPPLY - supply)
        return (K * supply) / (TOTAL_SUPPLY - supply);
    }

    // ============ Views ============

    function getPrice(address token) external view returns (uint256) {
        // Price = derivative of curve = K * TOTAL_SUPPLY / (reserve + K)^2
        uint256 reserve = tokenReserve[token];
        uint256 denominator = reserve + K;
        return (K * TOTAL_SUPPLY) / (denominator * denominator);
    }

    function getTokensForOkb(address token, uint256 okbAmount) external view returns (uint256) {
        return _getTokensForOkb(token, okbAmount);
    }

    function getOkbForTokens(address token, uint256 tokenAmount) external view returns (uint256) {
        return _getOkbForTokens(token, tokenAmount);
    }

    function getMarketCap(address token) external view returns (uint256) {
        return tokenReserve[token];
    }

    // ============ Receive ============

    receive() external payable {}
}
