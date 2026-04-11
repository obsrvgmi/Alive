// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AliveTokenFactory.sol";
import "../src/AliveBondingCurve.sol";
import "../src/AliveCharacterRegistry.sol";
import "../src/AliveFeeSplitter.sol";
import "../src/AliveBattleArena.sol";
import "../src/AliveToken.sol";

contract AliveBattleArenaTest is Test {
    AliveTokenFactory public factory;
    AliveBondingCurve public curve;
    AliveCharacterRegistry public registry;
    AliveFeeSplitter public splitter;
    AliveBattleArena public arena;

    address public owner = address(1);
    address public treasury = address(2);
    address public resolver = address(3);
    address public user1 = address(4);
    address public user2 = address(5);

    address public tokenA;
    address public tokenB;

    function setUp() public {
        vm.startPrank(owner);

        registry = new AliveCharacterRegistry(owner);
        splitter = new AliveFeeSplitter(address(0));
        arena = new AliveBattleArena(address(registry), resolver);

        factory = new AliveTokenFactory(
            address(registry),
            address(0),
            treasury
        );

        curve = new AliveBondingCurve(
            address(factory),
            address(registry),
            address(splitter)
        );

        factory.setBondingCurve(address(curve));
        registry.setFactory(address(factory));
        registry.setBondingCurve(address(curve));
        splitter.setFactory(address(factory));

        vm.stopPrank();

        // Fund users
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);

        // Launch two tokens for battle testing
        vm.startPrank(user1);
        AliveTokenFactory.LaunchParams memory paramsA = AliveTokenFactory.LaunchParams({
            name: "Fighter A",
            ticker: "FGTRA",
            metadataURI: "ipfs://A",
            feeRecipients: new address[](0),
            feeSplits: new uint256[](0),
            devBuyAmount: 0
        });
        tokenA = factory.launch{value: 0.01 ether}(paramsA);

        AliveTokenFactory.LaunchParams memory paramsB = AliveTokenFactory.LaunchParams({
            name: "Fighter B",
            ticker: "FGTRB",
            metadataURI: "ipfs://B",
            feeRecipients: new address[](0),
            feeSplits: new uint256[](0),
            devBuyAmount: 0
        });
        tokenB = factory.launch{value: 0.01 ether}(paramsB);
        vm.stopPrank();
    }

    function test_CreateBattle() public {
        uint256 battleId = arena.createBattle(tokenA, tokenB);

        assertEq(battleId, 1);

        IAliveBattleArena.Battle memory battle = arena.getBattle(battleId);
        assertEq(battle.characterA, tokenA);
        assertEq(battle.characterB, tokenB);
        assertEq(battle.poolA, 0);
        assertEq(battle.poolB, 0);
        assertEq(uint256(battle.status), uint256(IAliveBattleArena.BattleStatus.Open));
    }

    function test_Stake() public {
        uint256 battleId = arena.createBattle(tokenA, tokenB);

        vm.prank(user1);
        arena.stake{value: 1 ether}(battleId, tokenA);

        vm.prank(user2);
        arena.stake{value: 2 ether}(battleId, tokenB);

        IAliveBattleArena.Battle memory battle = arena.getBattle(battleId);
        assertEq(battle.poolA, 1 ether);
        assertEq(battle.poolB, 2 ether);
        assertEq(uint256(battle.status), uint256(IAliveBattleArena.BattleStatus.Live));

        assertEq(arena.getStake(battleId, user1, tokenA), 1 ether);
        assertEq(arena.getStake(battleId, user2, tokenB), 2 ether);
    }

    function test_ResolveRounds() public {
        uint256 battleId = arena.createBattle(tokenA, tokenB);

        vm.prank(user1);
        arena.stake{value: 1 ether}(battleId, tokenA);

        vm.prank(user2);
        arena.stake{value: 2 ether}(battleId, tokenB);

        // Resolve 5 rounds as resolver
        vm.startPrank(resolver);

        arena.resolveRound(battleId, tokenA); // Round 1: A wins
        arena.resolveRound(battleId, tokenA); // Round 2: A wins
        arena.resolveRound(battleId, tokenB); // Round 3: B wins
        arena.resolveRound(battleId, tokenA); // Round 4: A wins
        arena.resolveRound(battleId, tokenA); // Round 5: A wins - Battle ends

        vm.stopPrank();

        IAliveBattleArena.Battle memory battle = arena.getBattle(battleId);
        assertEq(battle.roundsCompleted, 5);
        assertEq(uint256(battle.status), uint256(IAliveBattleArena.BattleStatus.Resolved));
        assertEq(battle.winner, tokenA);
    }

    function test_ClaimWinnings() public {
        uint256 battleId = arena.createBattle(tokenA, tokenB);

        // User1 stakes on A, User2 stakes on B
        vm.prank(user1);
        arena.stake{value: 1 ether}(battleId, tokenA);

        vm.prank(user2);
        arena.stake{value: 2 ether}(battleId, tokenB);

        // Resolve battle - A wins
        vm.startPrank(resolver);
        for (uint256 i = 0; i < 5; i++) {
            arena.resolveRound(battleId, tokenA);
        }
        vm.stopPrank();

        // User1 claims winnings
        uint256 balanceBefore = user1.balance;

        vm.prank(user1);
        uint256 claimed = arena.claimWinnings(battleId);

        uint256 balanceAfter = user1.balance;

        // Total pool = 3 OKB, platform takes 5% = 0.15 OKB
        // Prize pool = 2.85 OKB
        // User1 staked 100% of winning pool, gets 100% of prize
        assertTrue(claimed > 2.8 ether);
        assertEq(balanceAfter - balanceBefore, claimed);
    }

    function test_VitalityPenalty() public {
        uint256 battleId = arena.createBattle(tokenA, tokenB);

        vm.prank(user1);
        arena.stake{value: 1 ether}(battleId, tokenA);

        vm.prank(user2);
        arena.stake{value: 1 ether}(battleId, tokenB);

        // Resolve battle - A wins, B loses
        vm.startPrank(resolver);
        for (uint256 i = 0; i < 5; i++) {
            arena.resolveRound(battleId, tokenA);
        }
        vm.stopPrank();

        // B should have vitality penalty
        assertTrue(arena.hasVitalityPenalty(tokenB));
        assertFalse(arena.hasVitalityPenalty(tokenA));

        // Effective vitality should be capped
        uint256 effectiveVit = arena.getEffectiveVitality(tokenB);
        assertTrue(effectiveVit <= 8000); // Max 80% due to 20% penalty
    }

    function test_Revert_SameCharacter() public {
        vm.expectRevert(AliveBattleArena.SameCharacter.selector);
        arena.createBattle(tokenA, tokenA);
    }

    function test_Revert_InvalidCharacter() public {
        vm.expectRevert(AliveBattleArena.InvalidCharacter.selector);
        arena.createBattle(tokenA, address(999));
    }

    function test_Revert_StakeTooLow() public {
        uint256 battleId = arena.createBattle(tokenA, tokenB);

        vm.prank(user1);
        vm.expectRevert(AliveBattleArena.InsufficientStake.selector);
        arena.stake{value: 0.001 ether}(battleId, tokenA); // Below 0.01 min
    }

    function test_Revert_ClaimBeforeResolved() public {
        uint256 battleId = arena.createBattle(tokenA, tokenB);

        vm.prank(user1);
        arena.stake{value: 1 ether}(battleId, tokenA);

        vm.prank(user1);
        vm.expectRevert(AliveBattleArena.BattleNotResolved.selector);
        arena.claimWinnings(battleId);
    }

    function test_Revert_DoubleClaim() public {
        uint256 battleId = arena.createBattle(tokenA, tokenB);

        vm.prank(user1);
        arena.stake{value: 1 ether}(battleId, tokenA);

        vm.startPrank(resolver);
        for (uint256 i = 0; i < 5; i++) {
            arena.resolveRound(battleId, tokenA);
        }
        vm.stopPrank();

        vm.startPrank(user1);
        arena.claimWinnings(battleId);

        vm.expectRevert(AliveBattleArena.AlreadyClaimed.selector);
        arena.claimWinnings(battleId);
        vm.stopPrank();
    }

    function test_Revert_OnlyResolver() public {
        uint256 battleId = arena.createBattle(tokenA, tokenB);

        vm.prank(user1);
        arena.stake{value: 1 ether}(battleId, tokenA);

        vm.prank(user1);
        vm.expectRevert(AliveBattleArena.OnlyResolver.selector);
        arena.resolveRound(battleId, tokenA);
    }
}
