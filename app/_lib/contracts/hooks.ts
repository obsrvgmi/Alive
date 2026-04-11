/**
 * React hooks for ALIVE contract interactions
 */

'use client';

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useBalance,
  useChainId,
} from 'wagmi';
import { parseEther, formatEther, type Address } from 'viem';
import { useState, useEffect, useMemo } from 'react';

import { getContractAddresses, BONDING_CURVE } from './config';
import {
  AliveTokenFactoryABI,
  AliveBondingCurveABI,
  AliveCharacterRegistryABI,
  AliveBattleArenaABI,
  AliveTokenABI,
} from './abis';

// ============ Factory Hooks ============

export type LaunchParams = {
  name: string;
  ticker: string;
  metadataURI: string;
  feeRecipients: Address[];
  feeSplits: bigint[];
  devBuyAmount: bigint;
};

export function useLaunch() {
  const chainId = useChainId();
  const { address } = useAccount();
  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const launch = async (params: LaunchParams) => {
    if (!addresses || !address) return;

    // Calculate total value: launch fee + dev buy
    // Minimum launch fee is 0.01 ETH even if devBuy is 0
    let launchFee = (params.devBuyAmount * BONDING_CURVE.LAUNCH_FEE_BPS) / 10000n;
    const minFee = parseEther('0.01');
    if (launchFee < minFee) launchFee = minFee;
    const totalValue = launchFee + params.devBuyAmount;

    writeContract({
      address: addresses.factory,
      abi: AliveTokenFactoryABI,
      functionName: 'launch',
      args: [{
        name: params.name,
        ticker: params.ticker,
        metadataURI: params.metadataURI,
        feeRecipients: params.feeRecipients,
        feeSplits: params.feeSplits,
        devBuyAmount: params.devBuyAmount,
      }],
      value: totalValue,
    });
  };

  return {
    launch,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// ============ Bonding Curve Hooks ============

export function useTokenPrice(tokenAddress: Address | undefined) {
  const chainId = useChainId();
  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const { data, isLoading, error, refetch } = useReadContract({
    address: addresses?.bondingCurve,
    abi: AliveBondingCurveABI,
    functionName: 'getPrice',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: {
      enabled: !!tokenAddress && !!addresses,
    },
  });

  return {
    price: data,
    priceFormatted: data ? formatEther(data) : '0',
    isLoading,
    error,
    refetch,
  };
}

export function useTokenReserve(tokenAddress: Address | undefined) {
  const chainId = useChainId();
  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const { data, isLoading, refetch } = useReadContract({
    address: addresses?.bondingCurve,
    abi: AliveBondingCurveABI,
    functionName: 'getReserve',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: {
      enabled: !!tokenAddress && !!addresses,
    },
  });

  return {
    reserve: data,
    reserveFormatted: data ? formatEther(data) : '0',
    isLoading,
    refetch,
  };
}

export function useGetTokensOut(tokenAddress: Address | undefined, okbAmount: string) {
  const chainId = useChainId();
  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const okbWei = useMemo(() => {
    try {
      return parseEther(okbAmount || '0');
    } catch {
      return 0n;
    }
  }, [okbAmount]);

  const { data, isLoading } = useReadContract({
    address: addresses?.bondingCurve,
    abi: AliveBondingCurveABI,
    functionName: 'getTokensOut',
    args: tokenAddress ? [tokenAddress, okbWei] : undefined,
    query: {
      enabled: !!tokenAddress && !!addresses && okbWei > 0n,
    },
  });

  return {
    tokensOut: data,
    tokensOutFormatted: data ? formatEther(data) : '0',
    isLoading,
  };
}

export function useGetOkbOut(tokenAddress: Address | undefined, tokenAmount: string) {
  const chainId = useChainId();
  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const tokensWei = useMemo(() => {
    try {
      return parseEther(tokenAmount || '0');
    } catch {
      return 0n;
    }
  }, [tokenAmount]);

  const { data, isLoading } = useReadContract({
    address: addresses?.bondingCurve,
    abi: AliveBondingCurveABI,
    functionName: 'getOkbOut',
    args: tokenAddress ? [tokenAddress, tokensWei] : undefined,
    query: {
      enabled: !!tokenAddress && !!addresses && tokensWei > 0n,
    },
  });

  return {
    okbOut: data,
    okbOutFormatted: data ? formatEther(data) : '0',
    isLoading,
  };
}

export function useBuy(tokenAddress: Address | undefined) {
  const chainId = useChainId();
  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const buy = async (okbAmount: string, minTokensOut: bigint = 0n) => {
    if (!addresses || !tokenAddress) return;

    const value = parseEther(okbAmount);

    writeContract({
      address: addresses.bondingCurve,
      abi: AliveBondingCurveABI,
      functionName: 'buy',
      args: [tokenAddress, minTokensOut],
      value,
    });
  };

  return {
    buy,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

export function useSell(tokenAddress: Address | undefined) {
  const chainId = useChainId();
  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const sell = async (tokenAmount: string, minOkbOut: bigint = 0n) => {
    if (!addresses || !tokenAddress) return;

    const amount = parseEther(tokenAmount);

    writeContract({
      address: addresses.bondingCurve,
      abi: AliveBondingCurveABI,
      functionName: 'sell',
      args: [tokenAddress, amount, minOkbOut],
    });
  };

  return {
    sell,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

// ============ Registry Hooks ============

export function useCharacter(tokenAddress: Address | undefined) {
  const chainId = useChainId();
  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const { data, isLoading, error, refetch } = useReadContract({
    address: addresses?.registry,
    abi: AliveCharacterRegistryABI,
    functionName: 'getCharacter',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: {
      enabled: !!tokenAddress && !!addresses,
    },
  });

  return {
    character: data,
    isLoading,
    error,
    refetch,
  };
}

export function useVitality(tokenAddress: Address | undefined) {
  const chainId = useChainId();
  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const { data, isLoading, refetch } = useReadContract({
    address: addresses?.registry,
    abi: AliveCharacterRegistryABI,
    functionName: 'getCurrentVitality',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: {
      enabled: !!tokenAddress && !!addresses,
      refetchInterval: 10000, // Refresh every 10 seconds
    },
  });

  // Convert to percentage (0-100)
  const vitalityPct = data ? Number(data) / 100 : 0;

  return {
    vitality: data,
    vitalityPct,
    isLoading,
    refetch,
  };
}

// ============ Battle Hooks ============

export function useBattle(battleId: bigint | undefined) {
  const chainId = useChainId();
  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const { data, isLoading, refetch } = useReadContract({
    address: addresses?.battleArena,
    abi: AliveBattleArenaABI,
    functionName: 'getBattle',
    args: battleId !== undefined ? [battleId] : undefined,
    query: {
      enabled: battleId !== undefined && !!addresses,
      refetchInterval: 5000, // Refresh every 5 seconds during battle
    },
  });

  return {
    battle: data,
    isLoading,
    refetch,
  };
}

export function useStakeBattle() {
  const chainId = useChainId();
  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const stake = async (battleId: bigint, character: Address, amount: string) => {
    if (!addresses) return;

    const value = parseEther(amount);

    writeContract({
      address: addresses.battleArena,
      abi: AliveBattleArenaABI,
      functionName: 'stake',
      args: [battleId, character],
      value,
    });
  };

  return {
    stake,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

export function useClaimWinnings() {
  const chainId = useChainId();
  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claim = async (battleId: bigint) => {
    if (!addresses) return;

    writeContract({
      address: addresses.battleArena,
      abi: AliveBattleArenaABI,
      functionName: 'claimWinnings',
      args: [battleId],
    });
  };

  return {
    claim,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

// ============ Token Hooks ============

export function useTokenBalance(tokenAddress: Address | undefined) {
  const { address } = useAccount();

  const { data, isLoading, refetch } = useReadContract({
    address: tokenAddress,
    abi: AliveTokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!tokenAddress && !!address,
    },
  });

  return {
    balance: data,
    balanceFormatted: data ? formatEther(data) : '0',
    isLoading,
    refetch,
  };
}

export function useApproveToken(tokenAddress: Address | undefined) {
  const chainId = useChainId();
  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = async (amount: bigint = BigInt(2) ** BigInt(256) - BigInt(1)) => {
    if (!addresses || !tokenAddress) return;

    writeContract({
      address: tokenAddress,
      abi: AliveTokenABI,
      functionName: 'approve',
      args: [addresses.bondingCurve, amount],
    });
  };

  return {
    approve,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

export function useAllowance(tokenAddress: Address | undefined) {
  const { address } = useAccount();
  const chainId = useChainId();
  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  const { data, isLoading, refetch } = useReadContract({
    address: tokenAddress,
    abi: AliveTokenABI,
    functionName: 'allowance',
    args: address && addresses ? [address, addresses.bondingCurve] : undefined,
    query: {
      enabled: !!tokenAddress && !!address && !!addresses,
    },
  });

  return {
    allowance: data,
    isLoading,
    refetch,
  };
}
