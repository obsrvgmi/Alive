// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AliveTokenFactory.sol";
import "../src/AliveBondingCurve.sol";
import "../src/AliveCharacterRegistry.sol";
import "../src/AliveFeeSplitter.sol";
import "../src/AliveToken.sol";

contract AliveBondingCurveTest is Test {
    AliveTokenFactory public factory;
    AliveBondingCurve public curve;
    AliveCharacterRegistry public registry;
    AliveFeeSplitter public splitter;

    address public owner = address(1);
    address public treasury = address(2);
    address public user1 = address(3);
    address public user2 = address(4);

    address public token;

    function setUp() public {
        vm.startPrank(owner);

        registry = new AliveCharacterRegistry(owner);
        splitter = new AliveFeeSplitter(address(0));

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

        // Launch a token for testing
        vm.startPrank(user1);
        AliveTokenFactory.LaunchParams memory params = AliveTokenFactory.LaunchParams({
            name: "Test Token",
            ticker: "TEST",
            metadataURI: "ipfs://Qm...",
            feeRecipients: new address[](0),
            feeSplits: new uint256[](0),
            devBuyAmount: 0
        });
        token = factory.launch{value: 0.01 ether}(params);
        vm.stopPrank();
    }

    function test_Buy_Basic() public {
        vm.startPrank(user1);

        uint256 balanceBefore = AliveToken(token).balanceOf(user1);
        uint256 expectedTokens = curve.getTokensForOkb(token, 1 ether);

        curve.buy{value: 1 ether}(token, 0);

        uint256 balanceAfter = AliveToken(token).balanceOf(user1);

        // User should have received tokens (accounting for 1% fee)
        assertTrue(balanceAfter > balanceBefore);

        vm.stopPrank();
    }

    function test_Buy_IncreasesVitality() public {
        // First decay vitality by time
        vm.warp(block.timestamp + 24 hours);

        uint256 vitalityBefore = registry.getCurrentVitality(token);
        assertTrue(vitalityBefore < 10000); // Should have decayed

        vm.prank(user1);
        curve.buy{value: 5 ether}(token, 0);

        uint256 vitalityAfter = registry.getCurrentVitality(token);
        assertTrue(vitalityAfter > vitalityBefore); // Should have healed
    }

    function test_Buy_MultipleBuyers() public {
        vm.prank(user1);
        curve.buy{value: 1 ether}(token, 0);

        vm.prank(user2);
        curve.buy{value: 2 ether}(token, 0);

        assertTrue(AliveToken(token).balanceOf(user1) > 0);
        assertTrue(AliveToken(token).balanceOf(user2) > 0);

        // Price should have increased
        uint256 reserve = curve.tokenReserve(token);
        assertTrue(reserve > 2.9 ether); // 3 ether minus fees
    }

    function test_Sell_Basic() public {
        // First buy some tokens
        vm.startPrank(user1);
        curve.buy{value: 5 ether}(token, 0);

        uint256 tokenBalance = AliveToken(token).balanceOf(user1);
        uint256 okbBefore = user1.balance;

        // Approve and sell half
        uint256 sellAmount = tokenBalance / 2;
        AliveToken(token).approve(address(curve), sellAmount);

        curve.sell(token, sellAmount, 0);

        uint256 okbAfter = user1.balance;
        assertTrue(okbAfter > okbBefore); // Should have received OKB

        vm.stopPrank();
    }

    function test_Sell_DecreasesVitality() public {
        // Buy first
        vm.startPrank(user1);
        curve.buy{value: 5 ether}(token, 0);

        uint256 vitalityBefore = registry.getCurrentVitality(token);

        // Sell
        uint256 sellAmount = AliveToken(token).balanceOf(user1) / 2;
        AliveToken(token).approve(address(curve), sellAmount);
        curve.sell(token, sellAmount, 0);

        uint256 vitalityAfter = registry.getCurrentVitality(token);
        assertTrue(vitalityAfter < vitalityBefore); // Should have drained

        vm.stopPrank();
    }

    function test_Price_ChangesWithSupply() public {
        uint256 price1 = curve.getPrice(token);

        vm.prank(user1);
        curve.buy{value: 10 ether}(token, 0);

        uint256 price2 = curve.getPrice(token);

        // Price should change as supply increases (bonding curve)
        assertTrue(price2 != price1);
    }

    function test_Revert_BuyZero() public {
        vm.prank(user1);
        vm.expectRevert(AliveBondingCurve.ZeroAmount.selector);
        curve.buy{value: 0}(token, 0);
    }

    function test_Revert_SellZero() public {
        vm.prank(user1);
        vm.expectRevert(AliveBondingCurve.ZeroAmount.selector);
        curve.sell(token, 0, 0);
    }

    function test_Revert_InvalidToken() public {
        vm.prank(user1);
        vm.expectRevert(AliveBondingCurve.InvalidToken.selector);
        curve.buy{value: 1 ether}(address(999), 0);
    }

    function test_Revert_InsufficientBalance() public {
        vm.prank(user2);
        vm.expectRevert(AliveBondingCurve.InsufficientBalance.selector);
        curve.sell(token, 1 ether, 0); // User2 has no tokens
    }

    function test_VitalityDecay() public {
        uint256 initialVitality = registry.getCurrentVitality(token);
        assertEq(initialVitality, 10000); // 100%

        // Warp 10 hours - should decay 1% (10 * 0.1%)
        vm.warp(block.timestamp + 10 hours);

        uint256 decayedVitality = registry.getCurrentVitality(token);
        assertEq(decayedVitality, 9900); // 99%

        // Warp another 100 hours - should decay 10% more
        vm.warp(block.timestamp + 100 hours);

        uint256 furtherDecayed = registry.getCurrentVitality(token);
        assertEq(furtherDecayed, 8900); // 89%
    }

    function test_Graduation() public {
        // Buy enough to trigger graduation (100 OKB threshold)
        vm.deal(user1, 200 ether);

        vm.startPrank(user1);

        // Check if token graduates after exceeding threshold
        uint256 reserveBefore = curve.tokenReserve(token);

        // Buy to exceed graduation threshold
        curve.buy{value: 105 ether}(token, 0);

        // Check reserve increased significantly
        uint256 reserveAfter = curve.tokenReserve(token);
        assertTrue(reserveAfter > reserveBefore);

        // Check if graduated
        IAliveCharacterRegistry.Character memory c = registry.getCharacter(token);
        assertTrue(c.graduated);

        vm.stopPrank();
    }
}
