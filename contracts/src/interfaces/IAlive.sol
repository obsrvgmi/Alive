// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ALIVE Protocol Interfaces
/// @notice Shared interfaces for the ALIVE memecoin launchpad

interface IAliveToken {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function burn(uint256 amount) external;
    function mint(address to, uint256 amount) external;
}

interface IAliveCharacterRegistry {
    struct Character {
        address token;
        string name;
        string ticker;
        string metadataURI;
        address creator;
        uint256 vitality;
        uint256 lastTradeTime;
        bool graduated;
    }

    function registerCharacter(
        address token,
        string calldata name,
        string calldata ticker,
        string calldata metadataURI,
        address creator
    ) external;

    function updateVitality(address token, uint256 vitality) external;
    function getCharacter(address token) external view returns (Character memory);
    function isRegistered(address token) external view returns (bool);
    function getCurrentVitality(address token) external view returns (uint256);
    function calculateBuyHeal(uint256 okbAmount) external pure returns (uint256);
    function calculateSellDrain(uint256 okbAmount) external pure returns (uint256);
    function markGraduated(address token) external;
}

interface IAliveBondingCurve {
    event Buy(
        address indexed buyer,
        address indexed token,
        uint256 okbAmount,
        uint256 tokenAmount,
        uint256 newVitality
    );

    event Sell(
        address indexed seller,
        address indexed token,
        uint256 tokenAmount,
        uint256 okbAmount,
        uint256 newVitality
    );

    event Graduated(address indexed token, address indexed lpPair, uint256 liquidity);

    function buy(address token, uint256 minTokensOut) external payable returns (uint256);
    function sell(address token, uint256 tokenAmount, uint256 minOkbOut) external returns (uint256);
    function getPrice(address token) external view returns (uint256);
    function getTokensForOkb(address token, uint256 okbAmount) external view returns (uint256);
    function getOkbForTokens(address token, uint256 tokenAmount) external view returns (uint256);
}

interface IAliveFeeSplitter {
    function distributeFees(address token) external payable;
    function setFeeSplits(
        address token,
        address[] calldata recipients,
        uint256[] calldata splits
    ) external;
}

interface IAliveBattleArena {
    enum BattleStatus { Open, Live, Resolved, Cancelled }

    struct Battle {
        address characterA;
        address characterB;
        uint256 poolA;
        uint256 poolB;
        uint256 startTime;
        uint256 roundsCompleted;
        address winner;
        BattleStatus status;
    }

    event BattleCreated(uint256 indexed battleId, address indexed charA, address indexed charB);
    event StakePlaced(uint256 indexed battleId, address indexed staker, address indexed character, uint256 amount);
    event RoundResolved(uint256 indexed battleId, uint256 round, address roundWinner);
    event BattleResolved(uint256 indexed battleId, address indexed winner, uint256 prizePool);

    function createBattle(address characterA, address characterB) external returns (uint256);
    function stake(uint256 battleId, address character) external payable;
    function resolveRound(uint256 battleId, address roundWinner) external;
    function claimWinnings(uint256 battleId) external returns (uint256);
}
