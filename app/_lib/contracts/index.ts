/**
 * ALIVE Contract Integration
 *
 * This module provides React hooks for interacting with ALIVE smart contracts
 * on X Layer blockchain.
 */

// Configuration
export {
  CONTRACT_ADDRESSES,
  getContractAddresses,
  BONDING_CURVE,
  BATTLE_ARENA,
  VITALITY,
} from './config';

// ABIs
export {
  AliveTokenFactoryABI,
  AliveBondingCurveABI,
  AliveCharacterRegistryABI,
  AliveBattleArenaABI,
  AliveTokenABI,
} from './abis';

// Hooks
export {
  // Factory
  useLaunch,
  type LaunchParams,

  // Bonding Curve
  useTokenPrice,
  useTokenReserve,
  useGetTokensOut,
  useGetOkbOut,
  useBuy,
  useSell,

  // Registry
  useCharacter,
  useVitality,

  // Battle Arena
  useBattle,
  useStakeBattle,
  useClaimWinnings,

  // Token
  useTokenBalance,
  useApproveToken,
  useAllowance,
} from './hooks';
