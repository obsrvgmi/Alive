// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAliveCharacterRegistry} from "./interfaces/IAlive.sol";

/// @title AliveCharacterRegistry
/// @notice On-chain registry for character state and metadata
contract AliveCharacterRegistry is IAliveCharacterRegistry {
    // ============ Storage ============

    address public factory;
    address public bondingCurve;
    address public owner;

    mapping(address => Character) public characters;
    mapping(address => bool) public registered;
    address[] public allCharacters;

    // Vitality constants (basis points, 10000 = 100%)
    uint256 public constant MAX_VITALITY = 10000;
    uint256 public constant VITALITY_DECAY_RATE = 10; // 0.1% per hour
    uint256 public constant HEAL_COEFFICIENT = 100; // Vitality points per OKB bought
    uint256 public constant DRAIN_COEFFICIENT = 150; // Vitality points per OKB sold

    // ============ Events ============

    event CharacterRegistered(address indexed token, string name, string ticker, address creator);
    event VitalityUpdated(address indexed token, uint256 oldVitality, uint256 newVitality);
    event CharacterGraduated(address indexed token);

    // ============ Errors ============

    error OnlyFactory();
    error OnlyBondingCurve();
    error OnlyOwner();
    error AlreadyRegistered();
    error NotRegistered();
    error ZeroAddress();

    // ============ Modifiers ============

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    modifier onlyBondingCurve() {
        if (msg.sender != bondingCurve) revert OnlyBondingCurve();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ============ Constructor ============

    constructor(address _owner) {
        if (_owner == address(0)) revert ZeroAddress();
        owner = _owner;
    }

    // ============ Admin ============

    function setFactory(address _factory) external onlyOwner {
        if (_factory == address(0)) revert ZeroAddress();
        factory = _factory;
    }

    function setBondingCurve(address _bondingCurve) external onlyOwner {
        if (_bondingCurve == address(0)) revert ZeroAddress();
        bondingCurve = _bondingCurve;
    }

    // ============ Registration ============

    function registerCharacter(
        address token,
        string calldata name_,
        string calldata ticker,
        string calldata metadataURI,
        address creator
    ) external onlyFactory {
        if (registered[token]) revert AlreadyRegistered();
        if (token == address(0) || creator == address(0)) revert ZeroAddress();

        characters[token] = Character({
            token: token,
            name: name_,
            ticker: ticker,
            metadataURI: metadataURI,
            creator: creator,
            vitality: MAX_VITALITY, // Start at 100%
            lastTradeTime: block.timestamp,
            graduated: false
        });

        registered[token] = true;
        allCharacters.push(token);

        emit CharacterRegistered(token, name_, ticker, creator);
    }

    // ============ Vitality Management ============

    /// @notice Update vitality based on trade activity
    /// @dev Called by bonding curve on buy/sell
    function updateVitality(address token, uint256 newVitality) external onlyBondingCurve {
        if (!registered[token]) revert NotRegistered();

        uint256 oldVitality = characters[token].vitality;
        characters[token].vitality = newVitality > MAX_VITALITY ? MAX_VITALITY : newVitality;
        characters[token].lastTradeTime = block.timestamp;

        emit VitalityUpdated(token, oldVitality, characters[token].vitality);
    }

    /// @notice Get current vitality with time decay applied
    function getCurrentVitality(address token) public view returns (uint256) {
        if (!registered[token]) return 0;

        Character memory c = characters[token];
        uint256 hoursPassed = (block.timestamp - c.lastTradeTime) / 1 hours;
        uint256 decay = hoursPassed * VITALITY_DECAY_RATE;

        if (decay >= c.vitality) return 0;
        return c.vitality - decay;
    }

    /// @notice Calculate vitality change for a buy
    function calculateBuyHeal(uint256 okbAmount) public pure returns (uint256) {
        // log2(okbAmount) * coefficient, simplified to linear for gas
        // In practice: 1 OKB = 100 vitality points
        return (okbAmount * HEAL_COEFFICIENT) / 1 ether;
    }

    /// @notice Calculate vitality change for a sell
    function calculateSellDrain(uint256 okbAmount) public pure returns (uint256) {
        // Selling drains more than buying heals
        return (okbAmount * DRAIN_COEFFICIENT) / 1 ether;
    }

    // ============ Graduation ============

    function markGraduated(address token) external onlyBondingCurve {
        if (!registered[token]) revert NotRegistered();
        characters[token].graduated = true;
        emit CharacterGraduated(token);
    }

    // ============ Views ============

    function getCharacter(address token) external view returns (Character memory) {
        return characters[token];
    }

    function isRegistered(address token) external view returns (bool) {
        return registered[token];
    }

    function getAllCharacters() external view returns (address[] memory) {
        return allCharacters;
    }

    function getCharacterCount() external view returns (uint256) {
        return allCharacters.length;
    }
}
