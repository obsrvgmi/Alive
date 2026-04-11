/**
 * Real-time updates via WebSocket for ALIVE
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { type Address } from 'viem';

// Event types from backend
export type VitalityUpdate = {
  type: 'vitality';
  token: Address;
  oldVitality: number;
  newVitality: number;
  trigger: 'buy' | 'sell' | 'decay';
};

export type TradeEvent = {
  type: 'trade';
  token: Address;
  trader: Address;
  action: 'buy' | 'sell';
  okbAmount: string;
  tokenAmount: string;
  newPrice: string;
};

export type BattleUpdate = {
  type: 'battle';
  battleId: number;
  event: 'round_resolved' | 'battle_ended' | 'stake_placed';
  data: {
    winner?: Address;
    roundNumber?: number;
    totalPool?: string;
    staker?: Address;
    amount?: string;
  };
};

export type NewTweet = {
  type: 'tweet';
  token: Address;
  ticker: string;
  content: string;
  tweetId: string;
};

export type RealtimeEvent = VitalityUpdate | TradeEvent | BattleUpdate | NewTweet;

type EventHandler = (event: RealtimeEvent) => void;

/**
 * Hook for subscribing to real-time updates
 */
export function useRealtime(
  onEvent?: EventHandler,
  options?: {
    tokens?: Address[];
    battleIds?: number[];
  }
) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Set<EventHandler>>(new Set());

  // Add handler
  useEffect(() => {
    if (onEvent) {
      handlersRef.current.add(onEvent);
      return () => {
        handlersRef.current.delete(onEvent);
      };
    }
  }, [onEvent]);

  // Connect to WebSocket
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          console.log('[ALIVE] WebSocket connected');

          // Subscribe to specific tokens/battles if provided
          if (options?.tokens?.length) {
            ws.send(JSON.stringify({
              type: 'subscribe',
              tokens: options.tokens,
            }));
          }
          if (options?.battleIds?.length) {
            ws.send(JSON.stringify({
              type: 'subscribe',
              battles: options.battleIds,
            }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as RealtimeEvent;
            setLastEvent(data);

            // Notify all handlers
            handlersRef.current.forEach((handler) => handler(data));
          } catch (e) {
            console.error('[ALIVE] Failed to parse WebSocket message:', e);
          }
        };

        ws.onclose = () => {
          setConnected(false);
          console.log('[ALIVE] WebSocket disconnected, reconnecting...');
          setTimeout(connect, 3000);
        };

        ws.onerror = (error) => {
          console.error('[ALIVE] WebSocket error:', error);
        };
      } catch (error) {
        console.error('[ALIVE] WebSocket connection failed:', error);
        setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [options?.tokens?.join(','), options?.battleIds?.join(',')]);

  // Subscribe to additional tokens/battles
  const subscribe = useCallback((tokens?: Address[], battles?: number[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        tokens,
        battles,
      }));
    }
  }, []);

  // Unsubscribe from tokens/battles
  const unsubscribe = useCallback((tokens?: Address[], battles?: number[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        tokens,
        battles,
      }));
    }
  }, []);

  return {
    connected,
    lastEvent,
    subscribe,
    unsubscribe,
  };
}

/**
 * Hook for real-time vitality updates for a specific token
 */
export function useRealtimeVitality(tokenAddress: Address | undefined) {
  const [vitality, setVitality] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<VitalityUpdate | null>(null);

  const handleEvent = useCallback((event: RealtimeEvent) => {
    if (event.type === 'vitality' && event.token === tokenAddress) {
      setVitality(event.newVitality);
      setLastUpdate(event);
    }
  }, [tokenAddress]);

  const { connected } = useRealtime(handleEvent, {
    tokens: tokenAddress ? [tokenAddress] : [],
  });

  return {
    vitality,
    lastUpdate,
    connected,
  };
}

/**
 * Hook for real-time trade feed for a token
 */
export function useRealtimeTrades(tokenAddress: Address | undefined) {
  const [trades, setTrades] = useState<TradeEvent[]>([]);

  const handleEvent = useCallback((event: RealtimeEvent) => {
    if (event.type === 'trade' && event.token === tokenAddress) {
      setTrades((prev) => [event, ...prev.slice(0, 49)]); // Keep last 50 trades
    }
  }, [tokenAddress]);

  const { connected } = useRealtime(handleEvent, {
    tokens: tokenAddress ? [tokenAddress] : [],
  });

  return {
    trades,
    connected,
  };
}

/**
 * Hook for real-time battle updates
 */
export function useRealtimeBattle(battleId: number | undefined) {
  const [updates, setUpdates] = useState<BattleUpdate[]>([]);
  const [latestUpdate, setLatestUpdate] = useState<BattleUpdate | null>(null);

  const handleEvent = useCallback((event: RealtimeEvent) => {
    if (event.type === 'battle' && event.battleId === battleId) {
      setLatestUpdate(event);
      setUpdates((prev) => [event, ...prev]);
    }
  }, [battleId]);

  const { connected } = useRealtime(handleEvent, {
    battleIds: battleId !== undefined ? [battleId] : [],
  });

  return {
    updates,
    latestUpdate,
    connected,
  };
}

/**
 * Hook for real-time tweet notifications
 */
export function useRealtimeTweets(tokenAddress?: Address) {
  const [tweets, setTweets] = useState<NewTweet[]>([]);

  const handleEvent = useCallback((event: RealtimeEvent) => {
    if (event.type === 'tweet') {
      if (!tokenAddress || event.token === tokenAddress) {
        setTweets((prev) => [event, ...prev.slice(0, 19)]); // Keep last 20 tweets
      }
    }
  }, [tokenAddress]);

  const { connected } = useRealtime(handleEvent, {
    tokens: tokenAddress ? [tokenAddress] : [],
  });

  return {
    tweets,
    connected,
  };
}
