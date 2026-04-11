/**
 * On-chain event handlers
 * Triggers agent responses to blockchain events
 */

import { db, characters, battles } from "../../db";
import { triggerEventTweet, forceTweet } from "./core";
import { generateReply } from "./personality";
import { postTweet } from "./twitter";

export interface TradeEvent {
  tokenAddress: string;
  trader: string;
  type: "buy" | "sell";
  tokenAmount: string;
  okbAmount: string;
  newVitality: number;
  txHash: string;
}

export interface BattleEvent {
  battleId: string;
  type: "created" | "round_resolved" | "ended";
  characterA: string;
  characterB: string;
  winner?: string;
  round?: number;
}

/**
 * Handle a trade event from the indexer
 */
export async function handleTradeEvent(event: TradeEvent): Promise<void> {
  const char = db.query.characters.findFirst({
    where: (c: any) => c.tokenAddress === event.tokenAddress.toLowerCase(),
  });

  if (!char) {
    console.log(`[Events] Unknown token: ${event.tokenAddress}`);
    return;
  }

  // Only tweet for significant trades (> 0.5 OKB)
  const okbAmount = parseFloat(event.okbAmount);
  if (okbAmount < 0.5) {
    return;
  }

  console.log(`[Events] ${char.ticker} ${event.type}: ${okbAmount.toFixed(2)} OKB`);

  // Check if vitality crossed critical threshold
  const wasCritical = char.vitality < 1500;
  const nowCritical = event.newVitality < 1500;

  if (!wasCritical && nowCritical) {
    // Just entered critical state
    await triggerEventTweet(char.ticker, {
      type: "sell",
      data: { amount: `${okbAmount.toFixed(2)} OKB`, critical: true },
    });
    return;
  }

  if (wasCritical && !nowCritical && event.type === "buy") {
    // Recovered from critical
    await forceTweet(char.ticker, "recovery");
    return;
  }

  // Regular trade tweet (small chance for normal trades)
  const shouldTweet = okbAmount > 2 || Math.random() < 0.2;

  if (shouldTweet) {
    await triggerEventTweet(char.ticker, {
      type: event.type,
      data: {
        amount: `${okbAmount.toFixed(2)} OKB`,
        trader: event.trader.slice(0, 6) + "..." + event.trader.slice(-4),
      },
    });
  }
}

/**
 * Handle a battle event
 */
export async function handleBattleEvent(event: BattleEvent): Promise<void> {
  // Get character info
  const charA = db.query.characters.findFirst({
    where: (c: any) => c.id === event.characterA,
  });
  const charB = db.query.characters.findFirst({
    where: (c: any) => c.id === event.characterB,
  });

  if (!charA || !charB) {
    console.log("[Events] Battle characters not found");
    return;
  }

  switch (event.type) {
    case "created":
      // Both characters trash talk
      console.log(`[Events] Battle created: ${charA.ticker} vs ${charB.ticker}`);

      await triggerEventTweet(charA.ticker, {
        type: "battle_start",
        data: { opponent: charB.name, opponentTicker: charB.ticker },
      });

      // Stagger the second tweet
      setTimeout(async () => {
        await triggerEventTweet(charB.ticker, {
          type: "battle_start",
          data: { opponent: charA.name, opponentTicker: charA.ticker },
        });
      }, 5000);
      break;

    case "round_resolved":
      // Winner celebrates, loser copes
      const roundWinner = event.winner === event.characterA ? charA : charB;
      const roundLoser = event.winner === event.characterA ? charB : charA;

      console.log(`[Events] Round ${event.round}: ${roundWinner.ticker} wins`);

      // Only tweet on decisive rounds (1, 3, 5)
      if (event.round === 1 || event.round === 3 || event.round === 5) {
        await triggerEventTweet(roundWinner.ticker, {
          type: "battle_win",
          data: {
            opponent: roundLoser.name,
            opponentTicker: roundLoser.ticker,
            round: event.round,
            partial: event.round !== 5,
          },
        });
      }
      break;

    case "ended":
      // Final result tweets
      const winner = event.winner === event.characterA ? charA : charB;
      const loser = event.winner === event.characterA ? charB : charA;

      console.log(`[Events] Battle ended: ${winner.ticker} defeats ${loser.ticker}`);

      // Winner celebration
      await triggerEventTweet(winner.ticker, {
        type: "battle_win",
        data: {
          opponent: loser.name,
          opponentTicker: loser.ticker,
          final: true,
        },
      });

      // Loser reaction (delayed)
      setTimeout(async () => {
        await triggerEventTweet(loser.ticker, {
          type: "battle_loss",
          data: {
            opponent: winner.name,
            opponentTicker: winner.ticker,
            final: true,
          },
        });
      }, 10000);
      break;
  }
}

/**
 * Handle character launch event
 */
export async function handleLaunchEvent(tokenAddress: string): Promise<void> {
  const char = db.query.characters.findFirst({
    where: (c: any) => c.tokenAddress === tokenAddress.toLowerCase(),
  });

  if (!char) {
    console.log(`[Events] Launch event for unknown token: ${tokenAddress}`);
    return;
  }

  console.log(`[Events] Character launched: ${char.ticker}`);

  // Force launch tweet
  await forceTweet(char.ticker, "launch");
}

/**
 * Simulate an event for testing
 */
export async function simulateEvent(
  type: "buy" | "sell" | "battle_start" | "battle_win" | "battle_loss" | "launch",
  ticker: string,
  data?: any
): Promise<{ success: boolean; result?: any }> {
  const char = db.query.characters.findFirst({
    where: (c: any) => c.ticker === ticker.toUpperCase(),
  });

  if (!char) {
    return { success: false };
  }

  switch (type) {
    case "launch":
      await handleLaunchEvent(char.tokenAddress);
      return { success: true };

    case "buy":
    case "sell":
      await handleTradeEvent({
        tokenAddress: char.tokenAddress,
        trader: data?.trader || "0xtest...addr",
        type,
        tokenAmount: data?.tokenAmount || "1000",
        okbAmount: data?.okbAmount || "5",
        newVitality: data?.newVitality || char.vitality,
        txHash: "0xsimulated",
      });
      return { success: true };

    case "battle_start":
    case "battle_win":
    case "battle_loss":
      // Find opponent
      const opponent = db.query.characters.findFirst({
        where: (c: any) => c.ticker !== char.ticker,
      });

      if (!opponent) {
        return { success: false };
      }

      if (type === "battle_start") {
        await handleBattleEvent({
          battleId: "sim",
          type: "created",
          characterA: char.id,
          characterB: opponent.id,
        });
      } else {
        await handleBattleEvent({
          battleId: "sim",
          type: "ended",
          characterA: char.id,
          characterB: opponent.id,
          winner: type === "battle_win" ? char.id : opponent.id,
        });
      }
      return { success: true };

    default:
      return { success: false };
  }
}
