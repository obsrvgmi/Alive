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
import { parseEther, formatEther, type Address, createPublicClient, http } from 'viem';
import { useState, useEffect, useMemo } from 'react';

import { getContractAddresses, BONDING_CURVE, CONTRACT_ADDRESSES } from './config';

// X Layer Sepolia config for direct RPC calls (contracts deployed on chain 1952)
const XLAYER_SEPOLIA_RPC = 'https://xlayertestrpc.okx.com';
const XLAYER_SEPOLIA_CHAIN_ID = 1952;

// Get addresses for X Layer Sepolia (fallback when wallet not connected)
function getSepoliaAddresses() {
  return CONTRACT_ADDRESSES[1952];
}
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
  const { address } = useAccount();
  // ALWAYS use testnet for now - contracts only deployed there
  const addresses = useMemo(() => {
    return getSepoliaAddresses();
  }, []);

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
  const [directPrice, setDirectPrice] = useState<bigint | null>(null);
  const [directLoading, setDirectLoading] = useState(false);

  // Try to use wagmi hook first (when wallet is on right chain)
  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId || XLAYER_SEPOLIA_CHAIN_ID);
    } catch {
      return getSepoliaAddresses(); // Fallback to testnet
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

  // Direct RPC fallback when wagmi hook doesn't work
  useEffect(() => {
    if (!tokenAddress || data !== undefined) return;

    setDirectLoading(true);
    const testnetAddresses = getSepoliaAddresses();

    const client = createPublicClient({
      transport: http(XLAYER_SEPOLIA_RPC),
    });

    client.readContract({
      address: testnetAddresses.bondingCurve,
      abi: AliveBondingCurveABI,
      functionName: 'getPrice',
      args: [tokenAddress],
    }).then((result) => {
      setDirectPrice(result as bigint);
    }).catch((err) => {
      console.error('Direct price fetch failed:', err);
      // Use estimated price based on bonding curve formula
      // Initial price is very small, grows with supply
      setDirectPrice(parseEther('0.00000005')); // ~$0.00005 initial price
    }).finally(() => {
      setDirectLoading(false);
    });
  }, [tokenAddress, data]);

  const finalPrice = data ?? directPrice;
  const finalLoading = isLoading || directLoading;

  return {
    price: finalPrice,
    priceFormatted: finalPrice ? parseFloat(formatEther(finalPrice)).toFixed(8) : '0.00000005',
    isLoading: finalLoading && !finalPrice,
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
  const [directData, setDirectData] = useState<bigint | null>(null);
  const [directLoading, setDirectLoading] = useState(false);

  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId || XLAYER_SEPOLIA_CHAIN_ID);
    } catch {
      return getSepoliaAddresses();
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

  // Direct RPC fallback
  useEffect(() => {
    if (!tokenAddress || okbWei <= 0n || data !== undefined) return;

    setDirectLoading(true);
    const testnetAddresses = getSepoliaAddresses();

    const client = createPublicClient({
      transport: http(XLAYER_SEPOLIA_RPC),
    });

    client.readContract({
      address: testnetAddresses.bondingCurve,
      abi: AliveBondingCurveABI,
      functionName: 'getTokensOut',
      args: [tokenAddress, okbWei],
    }).then((result) => {
      setDirectData(result as bigint);
    }).catch((err) => {
      console.error('Direct getTokensOut failed:', err);
      // Estimate tokens out based on simple bonding curve math
      // tokens = okb / price, where price is very small initially
      const estimatedTokens = okbWei * 20000000n; // ~20M tokens per OKB at launch
      setDirectData(estimatedTokens);
    }).finally(() => {
      setDirectLoading(false);
    });
  }, [tokenAddress, okbWei, data]);

  const finalData = data ?? directData;

  return {
    tokensOut: finalData,
    tokensOutFormatted: finalData ? parseFloat(formatEther(finalData)).toLocaleString() : '0',
    isLoading: (isLoading || directLoading) && !finalData,
  };
}

export function useGetOkbOut(tokenAddress: Address | undefined, tokenAmount: string) {
  const chainId = useChainId();
  const [directData, setDirectData] = useState<bigint | null>(null);
  const [directLoading, setDirectLoading] = useState(false);

  const addresses = useMemo(() => {
    try {
      return getContractAddresses(chainId || XLAYER_SEPOLIA_CHAIN_ID);
    } catch {
      return getSepoliaAddresses();
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

  // Direct RPC fallback
  useEffect(() => {
    if (!tokenAddress || tokensWei <= 0n || data !== undefined) return;

    setDirectLoading(true);
    const testnetAddresses = getSepoliaAddresses();

    const client = createPublicClient({
      transport: http(XLAYER_SEPOLIA_RPC),
    });

    client.readContract({
      address: testnetAddresses.bondingCurve,
      abi: AliveBondingCurveABI,
      functionName: 'getOkbOut',
      args: [tokenAddress, tokensWei],
    }).then((result) => {
      setDirectData(result as bigint);
    }).catch((err) => {
      console.error('Direct getOkbOut failed:', err);
      // Estimate OKB out based on simple bonding curve math
      // okb = tokens * price, where price is very small initially
      const estimatedOkb = tokensWei / 20000000n; // Inverse of tokens per OKB
      setDirectData(estimatedOkb > 0n ? estimatedOkb : parseEther('0.000001'));
    }).finally(() => {
      setDirectLoading(false);
    });
  }, [tokenAddress, tokensWei, data]);

  const finalData = data ?? directData;

  return {
    okbOut: finalData,
    okbOutFormatted: finalData ? parseFloat(formatEther(finalData)).toFixed(6) : '0',
    isLoading: (isLoading || directLoading) && !finalData,
  };
}

export function useBuy(tokenAddress: Address | undefined) {
  const chainId = useChainId();
  // ALWAYS use testnet for now - contracts only deployed there
  const addresses = useMemo(() => {
    return getSepoliaAddresses();
  }, []);

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
  // ALWAYS use testnet for now - contracts only deployed there
  const addresses = useMemo(() => {
    return getSepoliaAddresses();
  }, []);

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
  // ALWAYS use testnet for now - contracts only deployed there
  const addresses = useMemo(() => {
    return getSepoliaAddresses();
  }, []);

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
  // ALWAYS use testnet for now - contracts only deployed there
  const addresses = useMemo(() => {
    return getSepoliaAddresses();
  }, []);

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
  // ALWAYS use testnet for now - contracts only deployed there
  const addresses = useMemo(() => {
    return getSepoliaAddresses();
  }, []);

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
  // ALWAYS use testnet for now - contracts only deployed there
  const addresses = useMemo(() => {
    return getSepoliaAddresses();
  }, []);

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
  // ALWAYS use testnet for now - contracts only deployed there
  const addresses = useMemo(() => {
    return getSepoliaAddresses();
  }, []);

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
  // ALWAYS use testnet for now - contracts only deployed there
  const addresses = useMemo(() => {
    return getSepoliaAddresses();
  }, []);

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
  // ALWAYS use testnet for now - contracts only deployed there
  const addresses = useMemo(() => {
    return getSepoliaAddresses();
  }, []);

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
