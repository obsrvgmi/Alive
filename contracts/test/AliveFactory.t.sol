// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AliveTokenFactory.sol";
import "../src/AliveBondingCurve.sol";
import "../src/AliveCharacterRegistry.sol";
import "../src/AliveFeeSplitter.sol";
import "../src/AliveToken.sol";

contract AliveFactoryTest is Test {
    AliveTokenFactory public factory;
    AliveBondingCurve public curve;
    AliveCharacterRegistry public registry;
    AliveFeeSplitter public splitter;

    address public owner = address(1);
    address public treasury = address(2);
    address public user = address(3);
    address public collaborator = address(4);

    function setUp() public {
        vm.startPrank(owner);

        // Deploy registry first
        registry = new AliveCharacterRegistry(owner);

        // Deploy splitter (factory address will be set later)
        splitter = new AliveFeeSplitter(address(0));

        // Deploy factory (curve address will be set later)
        factory = new AliveTokenFactory(
            address(registry),
            address(0), // curve not deployed yet
            treasury
        );

        // Deploy curve
        curve = new AliveBondingCurve(
            address(factory),
            address(registry),
            address(splitter)
        );

        // Set up cross-references
        factory.setBondingCurve(address(curve));
        registry.setFactory(address(factory));
        registry.setBondingCurve(address(curve));
        splitter.setFactory(address(factory));

        vm.stopPrank();

        // Fund user
        vm.deal(user, 100 ether);
    }

    function test_Launch_Basic() public {
        vm.startPrank(user);

        AliveTokenFactory.LaunchParams memory params = AliveTokenFactory.LaunchParams({
            name: "Test Character",
            ticker: "TEST",
            metadataURI: "ipfs://Qm...",
            feeRecipients: new address[](0),
            feeSplits: new uint256[](0),
            devBuyAmount: 0
        });

        address token = factory.launch{value: 0.01 ether}(params);

        // Verify token deployed
        assertTrue(token != address(0));
        assertEq(AliveToken(token).name(), "Test Character");
        assertEq(AliveToken(token).symbol(), "TEST");

        // Verify registered
        assertTrue(registry.isRegistered(token));

        // Verify character state
        IAliveCharacterRegistry.Character memory c = registry.getCharacter(token);
        assertEq(c.name, "Test Character");
        assertEq(c.ticker, "TEST");
        assertEq(c.creator, user);
        assertEq(c.vitality, 10000); // 100%

        vm.stopPrank();
    }

    function test_Launch_WithDevBuy() public {
        vm.startPrank(user);

        AliveTokenFactory.LaunchParams memory params = AliveTokenFactory.LaunchParams({
            name: "Dev Buy Test",
            ticker: "DEVBUY",
            metadataURI: "ipfs://Qm...",
            feeRecipients: new address[](0),
            feeSplits: new uint256[](0),
            devBuyAmount: 1 ether
        });

        // Dev buy of 1 OKB + 1% fee (0.01 min) = 1.01 OKB
        address token = factory.launch{value: 1.01 ether}(params);

        // Verify user got tokens
        uint256 userBalance = AliveToken(token).balanceOf(user);
        assertTrue(userBalance > 0);

        // Verify curve has reserve (after 1% trading fee on dev buy)
        uint256 reserve = curve.tokenReserve(token);
        assertTrue(reserve > 0.9 ether); // Should be ~0.99 OKB after 1% fee

        vm.stopPrank();
    }

    function test_Launch_MaxDevBuy() public {
        vm.startPrank(user);

        AliveTokenFactory.LaunchParams memory params = AliveTokenFactory.LaunchParams({
            name: "Max Dev",
            ticker: "MAXDEV",
            metadataURI: "ipfs://Qm...",
            feeRecipients: new address[](0),
            feeSplits: new uint256[](0),
            devBuyAmount: 5 ether // Max
        });

        address token = factory.launch{value: 5.05 ether}(params);
        assertTrue(token != address(0));

        vm.stopPrank();
    }

    function test_Launch_Revert_DevBuyTooHigh() public {
        vm.startPrank(user);

        AliveTokenFactory.LaunchParams memory params = AliveTokenFactory.LaunchParams({
            name: "Too Much",
            ticker: "TOOMCH",
            metadataURI: "ipfs://Qm...",
            feeRecipients: new address[](0),
            feeSplits: new uint256[](0),
            devBuyAmount: 6 ether // Over max
        });

        vm.expectRevert(AliveTokenFactory.DevBuyTooHigh.selector);
        factory.launch{value: 10 ether}(params);

        vm.stopPrank();
    }

    function test_Launch_Revert_InsufficientFee() public {
        vm.startPrank(user);

        AliveTokenFactory.LaunchParams memory params = AliveTokenFactory.LaunchParams({
            name: "No Money",
            ticker: "BROKE",
            metadataURI: "ipfs://Qm...",
            feeRecipients: new address[](0),
            feeSplits: new uint256[](0),
            devBuyAmount: 1 ether
        });

        vm.expectRevert(AliveTokenFactory.InsufficientFee.selector);
        factory.launch{value: 0.5 ether}(params); // Not enough

        vm.stopPrank();
    }

    function test_Launch_InvalidTicker() public {
        vm.startPrank(user);

        AliveTokenFactory.LaunchParams memory params = AliveTokenFactory.LaunchParams({
            name: "Bad Ticker",
            ticker: "TOOLONG7", // 7 chars
            metadataURI: "ipfs://Qm...",
            feeRecipients: new address[](0),
            feeSplits: new uint256[](0),
            devBuyAmount: 0
        });

        vm.expectRevert(AliveTokenFactory.InvalidTicker.selector);
        factory.launch{value: 0.01 ether}(params);

        vm.stopPrank();
    }

    function test_TrackLaunches() public {
        vm.startPrank(user);

        assertEq(factory.totalLaunches(), 0);
        assertEq(factory.getCreatorTokenCount(user), 0);

        // Launch 3 tokens
        for (uint256 i = 0; i < 3; i++) {
            AliveTokenFactory.LaunchParams memory params = AliveTokenFactory.LaunchParams({
                name: string.concat("Token ", vm.toString(i)),
                ticker: string.concat("TK", vm.toString(i)),
                metadataURI: "ipfs://Qm...",
                feeRecipients: new address[](0),
                feeSplits: new uint256[](0),
                devBuyAmount: 0
            });
            factory.launch{value: 0.01 ether}(params);
        }

        assertEq(factory.totalLaunches(), 3);
        assertEq(factory.getCreatorTokenCount(user), 3);

        address[] memory userTokens = factory.getCreatorTokens(user);
        assertEq(userTokens.length, 3);

        vm.stopPrank();
    }
}
