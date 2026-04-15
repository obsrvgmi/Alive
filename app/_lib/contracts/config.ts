/**
 * Contract configuration for ALIVE on X Layer
 */

import { type Address } from 'viem';

// Contract addresses (set after deployment)
export const CONTRACT_ADDRESSES = {
  // Mainnet (chainId: 196)
  196: {
    factory: process.env.NEXT_PUBLIC_FACTORY_ADDRESS as Address,
    bondingCurve: process.env.NEXT_PUBLIC_BONDING_CURVE_ADDRESS as Address,
    registry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as Address,
    battleArena: process.env.NEXT_PUBLIC_BATTLE_ARENA_ADDRESS as Address,
    feeSplitter: process.env.NEXT_PUBLIC_FEE_SPLITTER_ADDRESS as Address,
  },
  // Testnet (chainId: 195) - Not deployed yet
  195: {
    factory: '0x0000000000000000000000000000000000000000' as Address,
    bondingCurve: '0x0000000000000000000000000000000000000000' as Address,
    registry: '0x0000000000000000000000000000000000000000' as Address,
    battleArena: '0x0000000000000000000000000000000000000000' as Address,
    feeSplitter: '0x0000000000000000000000000000000000000000' as Address,
    lpLocker: '0x0000000000000000000000000000000000000000' as Address,
  },
  // X Layer Sepolia (chainId: 1952) - DEPLOYED
  1952: {
    factory: '0x677e2CD672DdF0F0Cd8F744663FF6787bc0Cc7F7' as Address,
    bondingCurve: '0xE0A417c8f3ade5007e5166D79B893307Ec2B0DCC' as Address,
    registry: '0x1c3964595EBFba18ED528626f1B144a9dC711D3c' as Address,
    battleArena: '0x17d1983E22c66527fc1F94E74A26Af1016F41211' as Address,
    feeSplitter: '0x92Ee488f8CFc33bc8cfD98648267BB3598d8b90e' as Address,
    lpLocker: '0x6B3FBd72a07772d4467B4DA8148dc261fEB185df' as Address,
  },
  // Local Anvil (chainId: 31337)
  31337: {
    factory: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9') as Address,
    bondingCurve: (process.env.NEXT_PUBLIC_BONDING_CURVE_ADDRESS || '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9') as Address,
    registry: (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3') as Address,
    battleArena: (process.env.NEXT_PUBLIC_BATTLE_ARENA_ADDRESS || '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707') as Address,
    feeSplitter: (process.env.NEXT_PUBLIC_FEE_SPLITTER_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512') as Address,
  },
} as const;

// Default to testnet if mainnet addresses not set
export function getContractAddresses(chainId: number) {
  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];
  if (!addresses) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return addresses;
}

// Contract constants matching Solidity
export const BONDING_CURVE = {
  TOTAL_SUPPLY: 1_000_000_000n * 10n ** 18n, // 1 billion tokens
  K: 30n * 10n ** 18n, // 30 OKB - steepness parameter
  GRADUATION_THRESHOLD: 100n * 10n ** 18n, // 100 OKB market cap
  LAUNCH_FEE_BPS: 100n, // 1%
  TRADING_FEE_BPS: 100n, // 1%
} as const;

export const BATTLE_ARENA = {
  ROUNDS_PER_BATTLE: 5,
  PLATFORM_FEE_BPS: 500, // 5%
  MIN_STAKE: 0.1, // 0.1 OKB
  VITALITY_PENALTY_DURATION: 24 * 60 * 60, // 24 hours in seconds
  VITALITY_PENALTY_PCT: 20, // 20% vitality cap reduction
} as const;

export const VITALITY = {
  MAX: 10000, // 100%
  CRITICAL: 500, // 5%
  LOW: 1500, // 15%
  STRESSED: 4000, // 40%
  NORMAL: 7000, // 70%
  THRIVING: 9000, // 90%
  HEAL_COEFFICIENT: 10, // log2(okb) * 10
  DRAIN_COEFFICIENT: 15, // log2(okb) * 15
} as const;
