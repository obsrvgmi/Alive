// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAliveBattleArena, IAliveCharacterRegistry} from "./interfaces/IAlive.sol";

/// @title AliveBattleArena
/// @notice Weekly battles between characters with staking
contract AliveBattleArena is IAliveBattleArena {
    // ============ Constants ============

    uint256 public constant ROUNDS_PER_BATTLE = 5;
    uint256 public constant PLATFORM_FEE_BPS = 500; // 5% rake
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant LOSER_VITALITY_PENALTY_BPS = 2000; // 20% vitality cap reduction
    uint256 public constant PENALTY_DURATION = 24 hours;
    uint256 public constant MIN_STAKE = 0.01 ether;

    // ============ Storage ============

    address public owner;
    address public registry;
    address public battleResolver; // AI oracle that resolves rounds

    uint256 public battleCount;
    mapping(uint256 => Battle) public battles;
    mapping(uint256 => mapping(address => mapping(address => uint256))) public stakes; // battleId => staker => character => amount
    mapping(uint256 => mapping(address => bool)) public claimed; // battleId => staker => claimed
    mapping(address => uint256) public vitalityPenaltyUntil; // character => penalty end time

    // ============ Errors ============

    error OnlyOwner();
    error OnlyResolver();
    error InvalidCharacter();
    error BattleNotOpen();
    error BattleNotLive();
    error BattleNotResolved();
    error AlreadyClaimed();
    error InsufficientStake();
    error InvalidRoundWinner();
    error TransferFailed();
    error ZeroAddress();
    error SameCharacter();
    error BattleAlreadyResolved();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyResolver() {
        if (msg.sender != battleResolver) revert OnlyResolver();
        _;
    }

    // ============ Constructor ============

    constructor(address _registry, address _battleResolver) {
        owner = msg.sender;
        registry = _registry;
        battleResolver = _battleResolver;
    }

    // ============ Admin ============

    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        registry = _registry;
    }

    function setBattleResolver(address _resolver) external onlyOwner {
        if (_resolver == address(0)) revert ZeroAddress();
        battleResolver = _resolver;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    // ============ Battle Creation ============

    /// @notice Create a new battle between two characters
    function createBattle(address characterA, address characterB) external returns (uint256) {
        if (characterA == characterB) revert SameCharacter();
        if (!IAliveCharacterRegistry(registry).isRegistered(characterA)) revert InvalidCharacter();
        if (!IAliveCharacterRegistry(registry).isRegistered(characterB)) revert InvalidCharacter();

        uint256 battleId = ++battleCount;

        battles[battleId] = Battle({
            characterA: characterA,
            characterB: characterB,
            poolA: 0,
            poolB: 0,
            startTime: block.timestamp,
            roundsCompleted: 0,
            winner: address(0),
            status: BattleStatus.Open
        });

        emit BattleCreated(battleId, characterA, characterB);
        return battleId;
    }

    // ============ Staking ============

    /// @notice Stake OKB on a character in a battle
    function stake(uint256 battleId, address character) external payable {
        Battle storage battle = battles[battleId];

        if (battle.status != BattleStatus.Open && battle.status != BattleStatus.Live) {
            revert BattleNotOpen();
        }
        if (character != battle.characterA && character != battle.characterB) {
            revert InvalidCharacter();
        }
        if (msg.value < MIN_STAKE) revert InsufficientStake();

        // Update pools
        if (character == battle.characterA) {
            battle.poolA += msg.value;
        } else {
            battle.poolB += msg.value;
        }

        // Record stake
        stakes[battleId][msg.sender][character] += msg.value;

        // Start battle if first stake
        if (battle.status == BattleStatus.Open) {
            battle.status = BattleStatus.Live;
        }

        emit StakePlaced(battleId, msg.sender, character, msg.value);
    }

    // ============ Resolution ============

    /// @notice Resolve a round (called by AI resolver)
    function resolveRound(uint256 battleId, address roundWinner) external onlyResolver {
        Battle storage battle = battles[battleId];

        if (battle.status != BattleStatus.Live) revert BattleNotLive();
        if (roundWinner != battle.characterA && roundWinner != battle.characterB) {
            revert InvalidRoundWinner();
        }
        if (battle.roundsCompleted >= ROUNDS_PER_BATTLE) revert BattleAlreadyResolved();

        battle.roundsCompleted++;

        emit RoundResolved(battleId, battle.roundsCompleted, roundWinner);

        // Check if battle is complete (5 rounds)
        if (battle.roundsCompleted >= ROUNDS_PER_BATTLE) {
            _finalizeBattle(battleId, roundWinner);
        }
    }

    function _finalizeBattle(uint256 battleId, address winner) internal {
        Battle storage battle = battles[battleId];

        battle.winner = winner;
        battle.status = BattleStatus.Resolved;

        // Apply vitality penalty to loser
        address loser = winner == battle.characterA ? battle.characterB : battle.characterA;
        vitalityPenaltyUntil[loser] = block.timestamp + PENALTY_DURATION;

        uint256 totalPool = battle.poolA + battle.poolB;
        emit BattleResolved(battleId, winner, totalPool);
    }

    // ============ Claims ============

    /// @notice Claim winnings from a resolved battle
    function claimWinnings(uint256 battleId) external returns (uint256) {
        Battle storage battle = battles[battleId];

        if (battle.status != BattleStatus.Resolved) revert BattleNotResolved();
        if (claimed[battleId][msg.sender]) revert AlreadyClaimed();

        // Get user's stake on winning character
        uint256 userStake = stakes[battleId][msg.sender][battle.winner];
        if (userStake == 0) return 0;

        // Calculate winnings
        uint256 totalPool = battle.poolA + battle.poolB;
        uint256 winningPool = battle.winner == battle.characterA ? battle.poolA : battle.poolB;

        // Platform takes 5% of total
        uint256 platformFee = (totalPool * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 prizePool = totalPool - platformFee;

        // User gets proportional share of prize pool
        uint256 winnings = (prizePool * userStake) / winningPool;

        // Mark as claimed
        claimed[battleId][msg.sender] = true;

        // Transfer winnings
        (bool sent, ) = msg.sender.call{value: winnings}("");
        if (!sent) revert TransferFailed();

        return winnings;
    }

    // ============ Views ============

    function getBattle(uint256 battleId) external view returns (Battle memory) {
        return battles[battleId];
    }

    function getStake(uint256 battleId, address staker, address character) external view returns (uint256) {
        return stakes[battleId][staker][character];
    }

    function getTotalStake(uint256 battleId, address staker) external view returns (uint256) {
        Battle storage battle = battles[battleId];
        return stakes[battleId][staker][battle.characterA] + stakes[battleId][staker][battle.characterB];
    }

    function hasVitalityPenalty(address character) external view returns (bool) {
        return block.timestamp < vitalityPenaltyUntil[character];
    }

    function getEffectiveVitality(address character) external view returns (uint256) {
        uint256 baseVitality = IAliveCharacterRegistry(registry).getCurrentVitality(character);

        if (block.timestamp < vitalityPenaltyUntil[character]) {
            // Apply 20% penalty cap
            uint256 penaltyCap = 10000 - LOSER_VITALITY_PENALTY_BPS; // 8000 = 80%
            if (baseVitality > penaltyCap) {
                return penaltyCap;
            }
        }

        return baseVitality;
    }

    // ============ Receive ============

    receive() external payable {}
}
