/**
 * Wallet Actions - Personality-driven economy behavior
 *
 * Each personality type has different spending/earning patterns:
 * - WHOLESOME: Tips allies frequently (30% chance)
 * - ALPHA: Buys tokens on dips
 * - MENACE: Stakes against enemies in battles
 * - FERAL: Random chaotic spending
 * - COPIUM: Hoards (low spending)
 * - SCHIZO: Unpredictable patterns
 */

import { db, eq, and, ne } from "../../db";
import { characters, relationships, battles } from "../../db/schema";
import { walletService, type TokenBalance } from "../wallet";
import type { Mood } from "./mood";

// Action probabilities by personality (0-1)
const PERSONALITY_ACTION_RATES = {
  WHOLESOME: { tipAlly: 0.3, buyToken: 0.1, battleStake: 0.05 },
  ALPHA: { tipAlly: 0.1, buyToken: 0.25, battleStake: 0.2 },
  MENACE: { tipAlly: 0.0, buyToken: 0.1, battleStake: 0.35 },
  FERAL: { tipAlly: 0.15, buyToken: 0.2, battleStake: 0.15 },
  COPIUM: { tipAlly: 0.05, buyToken: 0.05, battleStake: 0.05 },
  SCHIZO: { tipAlly: 0.2, buyToken: 0.2, battleStake: 0.2 },
};

// Mood modifiers (multiply base rates)
const MOOD_MODIFIERS = {
  FERAL: { tipAlly: 0.5, buyToken: 1.5, battleStake: 1.5 },
  DOOMED: { tipAlly: 0.2, buyToken: 0.0, battleStake: 0.0 },
  LOCKED_IN: { tipAlly: 1.2, buyToken: 1.5, battleStake: 1.2 },
  UNHINGED: { tipAlly: 0.8, buyToken: 1.8, battleStake: 1.5 },
  DELUSIONAL: { tipAlly: 1.5, buyToken: 2.0, battleStake: 1.0 },
  MENACING: { tipAlly: 0.0, buyToken: 0.5, battleStake: 2.0 },
  NEUTRAL: { tipAlly: 1.0, buyToken: 1.0, battleStake: 1.0 },
};

// Tip amounts by treasury balance tier
const TIP_AMOUNTS = {
  low: "0.01",    // < 1 OKB treasury
  medium: "0.05", // 1-10 OKB treasury
  high: "0.1",    // > 10 OKB treasury
};

// Battle stake amounts
const BATTLE_STAKE_PERCENT = 0.1; // 10% of treasury

interface WalletAction {
  type: "tip_ally" | "buy_token" | "battle_stake";
  targetId?: string;
  amount: string;
  reason: string;
}

interface Balance {
  okb: string;
  tokens: TokenBalance[];
}

/**
 * Decide which wallet actions to take based on personality and mood
 */
export function decideWalletActions(
  character: {
    id: string;
    ticker: string;
    personality: string;
    treasuryBalanceOkb: string | null;
  },
  mood: Mood,
  balance: Balance,
  allies: { id: string; ticker: string; tokenAddress: string }[],
  enemies: { id: string; ticker: string }[],
  activeBattles: { id: string; characterAId: string; characterBId: string }[]
): WalletAction[] {
  const actions: WalletAction[] = [];
  const treasury = parseFloat(balance.okb);

  // No actions if treasury is too low
  if (treasury < 0.01) {
    return actions;
  }

  const personality = character.personality as keyof typeof PERSONALITY_ACTION_RATES;
  const baseRates = PERSONALITY_ACTION_RATES[personality] || PERSONALITY_ACTION_RATES.FERAL;
  const moodMod = MOOD_MODIFIERS[mood] || MOOD_MODIFIERS.NEUTRAL;

  // Calculate adjusted probabilities
  const tipProb = baseRates.tipAlly * moodMod.tipAlly;
  const buyProb = baseRates.buyToken * moodMod.buyToken;
  const stakeProb = baseRates.battleStake * moodMod.battleStake;

  // 1. Tip an ally?
  if (allies.length > 0 && Math.random() < tipProb) {
    const ally = allies[Math.floor(Math.random() * allies.length)];
    const tipAmount = getTipAmount(treasury);

    if (parseFloat(tipAmount) <= treasury) {
      actions.push({
        type: "tip_ally",
        targetId: ally.id,
        amount: tipAmount,
        reason: `${character.ticker} feeling ${mood.toLowerCase()}, tipping ally ${ally.ticker}`,
      });
    }
  }

  // 2. Buy ally token?
  if (allies.length > 0 && Math.random() < buyProb) {
    const ally = allies[Math.floor(Math.random() * allies.length)];
    const buyAmount = Math.min(treasury * 0.1, 0.5).toFixed(4); // Max 10% or 0.5 OKB

    if (parseFloat(buyAmount) >= 0.01) {
      actions.push({
        type: "buy_token",
        targetId: ally.tokenAddress,
        amount: buyAmount,
        reason: `${character.ticker} buying $${ally.ticker} to support ally`,
      });
    }
  }

  // 3. Stake on battle?
  if (activeBattles.length > 0 && Math.random() < stakeProb) {
    const battle = activeBattles[Math.floor(Math.random() * activeBattles.length)];

    // Decide who to back (allies > self > enemies)
    let backTarget: string | null = null;
    let backReason = "";

    // Check if ally is in battle
    const allyInBattle = allies.find(
      (a) => a.id === battle.characterAId || a.id === battle.characterBId
    );

    // Check if enemy is in battle
    const enemyInBattle = enemies.find(
      (e) => e.id === battle.characterAId || e.id === battle.characterBId
    );

    if (personality === "MENACE" && enemyInBattle) {
      // MENACE backs AGAINST enemy (backs their opponent)
      backTarget = battle.characterAId === enemyInBattle.id
        ? battle.characterBId
        : battle.characterAId;
      backReason = `Staking against enemy ${enemyInBattle.ticker}`;
    } else if (allyInBattle) {
      backTarget = allyInBattle.id;
      backReason = `Supporting ally ${allyInBattle.ticker} in battle`;
    } else if (character.id === battle.characterAId || character.id === battle.characterBId) {
      // Self-stake
      backTarget = character.id;
      backReason = "Self-staking in battle";
    }

    if (backTarget) {
      const stakeAmount = Math.min(
        treasury * BATTLE_STAKE_PERCENT,
        1.0 // Max 1 OKB stake
      ).toFixed(4);

      if (parseFloat(stakeAmount) >= 0.01) {
        actions.push({
          type: "battle_stake",
          targetId: backTarget,
          amount: stakeAmount,
          reason: backReason,
        });
      }
    }
  }

  return actions;
}

/**
 * Get tip amount based on treasury size
 */
function getTipAmount(treasury: number): string {
  if (treasury < 1) return TIP_AMOUNTS.low;
  if (treasury < 10) return TIP_AMOUNTS.medium;
  return TIP_AMOUNTS.high;
}

/**
 * Execute a single wallet action
 */
export async function executeWalletAction(
  characterId: string,
  action: WalletAction
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  console.log(`[WalletAction] ${action.reason}`);

  try {
    switch (action.type) {
      case "tip_ally":
        if (!action.targetId) {
          return { success: false, error: "No target for tip" };
        }
        const tipResult = await walletService.tipCharacter(
          characterId,
          action.targetId,
          action.amount
        );
        return tipResult;

      case "buy_token":
        if (!action.targetId) {
          return { success: false, error: "No token address" };
        }
        const buyResult = await walletService.buyToken(
          characterId,
          action.targetId,
          action.amount
        );
        return buyResult;

      case "battle_stake":
        // Need battle ID for this - would need to be passed in action
        // For now, log and skip
        console.log(`[WalletAction] Battle stake not yet implemented`);
        return { success: false, error: "Battle stake not implemented" };

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (error: any) {
    console.error(`[WalletAction] Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get allies for a character
 */
export async function getCharacterAllies(characterId: string): Promise<
  { id: string; ticker: string; tokenAddress: string }[]
> {
  const allyRelations = await db.query.relationships.findMany({
    where: and(
      eq(relationships.characterA, characterId),
      eq(relationships.type, "ALLIANCE")
    ),
  });

  const allyIds = allyRelations.map((r) => r.characterB);
  if (allyIds.length === 0) return [];

  const allies = await db.query.characters.findMany({
    where: (char, { inArray }) => inArray(char.id, allyIds),
  });

  return allies
    .filter((a) => a.agenticWalletAddress) // Only allies with wallets
    .map((a) => ({
      id: a.id,
      ticker: a.ticker,
      tokenAddress: a.tokenAddress,
    }));
}

/**
 * Get enemies for a character
 */
export async function getCharacterEnemies(characterId: string): Promise<
  { id: string; ticker: string }[]
> {
  const beefRelations = await db.query.relationships.findMany({
    where: and(
      eq(relationships.characterA, characterId),
      eq(relationships.type, "BEEF")
    ),
  });

  const enemyIds = beefRelations.map((r) => r.characterB);
  if (enemyIds.length === 0) return [];

  const enemies = await db.query.characters.findMany({
    where: (char, { inArray }) => inArray(char.id, enemyIds),
  });

  return enemies.map((e) => ({
    id: e.id,
    ticker: e.ticker,
  }));
}

/**
 * Get active battles
 */
export async function getActiveBattles(): Promise<
  { id: string; characterAId: string; characterBId: string }[]
> {
  const activeBattles = await db.query.battles.findMany({
    where: (battle, { or, eq }) =>
      or(eq(battle.status, "OPEN"), eq(battle.status, "LIVE")),
  });

  return activeBattles.map((b) => ({
    id: b.id,
    characterAId: b.characterA,
    characterBId: b.characterB,
  }));
}
