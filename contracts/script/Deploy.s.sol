// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AliveTokenFactory.sol";
import "../src/AliveBondingCurve.sol";
import "../src/AliveCharacterRegistry.sol";
import "../src/AliveFeeSplitter.sol";
import "../src/AliveBattleArena.sol";
import "../src/AliveLPLocker.sol";

contract DeployAlive is Script {
    function run() external {
        // Load deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Configuration
        address treasury = vm.envOr("TREASURY", deployer);
        address battleResolver = vm.envOr("BATTLE_RESOLVER", deployer);

        console.log("Deploying ALIVE Protocol...");
        console.log("Deployer:", deployer);
        console.log("Treasury:", treasury);
        console.log("Battle Resolver:", battleResolver);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy CharacterRegistry
        AliveCharacterRegistry registry = new AliveCharacterRegistry(deployer);
        console.log("CharacterRegistry deployed:", address(registry));

        // 2. Deploy FeeSplitter (factory address will be set later)
        AliveFeeSplitter splitter = new AliveFeeSplitter(address(0));
        console.log("FeeSplitter deployed:", address(splitter));

        // 3. Deploy LP Locker (bonding curve address will be set later)
        AliveLPLocker lpLocker = new AliveLPLocker(address(0));
        console.log("LPLocker deployed:", address(lpLocker));

        // 4. Deploy Factory (bonding curve address will be set later)
        AliveTokenFactory factory = new AliveTokenFactory(
            address(registry),
            address(0), // bonding curve not deployed yet
            treasury
        );
        console.log("TokenFactory deployed:", address(factory));

        // 5. Deploy BondingCurve
        AliveBondingCurve curve = new AliveBondingCurve(
            address(factory),
            address(registry),
            address(splitter)
        );
        console.log("BondingCurve deployed:", address(curve));

        // 6. Deploy BattleArena
        AliveBattleArena arena = new AliveBattleArena(
            address(registry),
            battleResolver
        );
        console.log("BattleArena deployed:", address(arena));

        // 7. Configure cross-references
        factory.setBondingCurve(address(curve));
        registry.setFactory(address(factory));
        registry.setBondingCurve(address(curve));
        splitter.setFactory(address(factory));
        lpLocker.setBondingCurve(address(curve));

        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log("Registry:", address(registry));
        console.log("Factory:", address(factory));
        console.log("BondingCurve:", address(curve));
        console.log("FeeSplitter:", address(splitter));
        console.log("LPLocker:", address(lpLocker));
        console.log("BattleArena:", address(arena));
        console.log("===========================\n");

        vm.stopBroadcast();
    }
}
