/**
 * Wallet API Routes
 * Manages agentic wallet operations for characters
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db, eq } from "../db";
import { characters } from "../db/schema";
import { walletService } from "../services/wallet";

export const walletRoutes = new Hono();

/**
 * GET /api/wallet/:ticker/status
 * Get wallet status for a character
 */
walletRoutes.get("/:ticker/status", async (c) => {
  const ticker = c.req.param("ticker").toUpperCase();

  const char = await db.query.characters.findFirst({
    where: eq(characters.ticker, ticker),
  });

  if (!char) {
    return c.json({ error: "Character not found" }, 404);
  }

  try {
    const status = await walletService.getStatus(char.id);
    return c.json({
      ticker,
      name: char.name,
      ...status,
      mockMode: walletService.isMockMode(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/wallet/:ticker/initialize
 * Initialize an agentic wallet for a character
 */
walletRoutes.post("/:ticker/initialize", async (c) => {
  const ticker = c.req.param("ticker").toUpperCase();

  const char = await db.query.characters.findFirst({
    where: eq(characters.ticker, ticker),
  });

  if (!char) {
    return c.json({ error: "Character not found" }, 404);
  }

  if (char.agenticWalletId) {
    return c.json({ error: "Character already has a wallet" }, 400);
  }

  try {
    const wallet = await walletService.initializeWallet(char.id);
    return c.json({
      success: true,
      ticker,
      walletId: wallet.walletId,
      address: wallet.address,
      mockMode: walletService.isMockMode(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/wallet/:ticker/enable
 * Enable/disable wallet for a character
 */
const enableSchema = z.object({
  enabled: z.boolean(),
});

walletRoutes.post(
  "/:ticker/enable",
  zValidator("json", enableSchema),
  async (c) => {
    const ticker = c.req.param("ticker").toUpperCase();
    const { enabled } = c.req.valid("json");

    const char = await db.query.characters.findFirst({
      where: eq(characters.ticker, ticker),
    });

    if (!char) {
      return c.json({ error: "Character not found" }, 404);
    }

    if (!char.agenticWalletId) {
      return c.json({ error: "Character has no wallet - initialize first" }, 400);
    }

    await walletService.setEnabled(char.id, enabled);
    return c.json({ success: true, ticker, walletEnabled: enabled });
  }
);

/**
 * GET /api/wallet/:ticker/transactions
 * Get transaction history for a character
 */
walletRoutes.get("/:ticker/transactions", async (c) => {
  const ticker = c.req.param("ticker").toUpperCase();
  const limit = parseInt(c.req.query("limit") || "50");

  const char = await db.query.characters.findFirst({
    where: eq(characters.ticker, ticker),
  });

  if (!char) {
    return c.json({ error: "Character not found" }, 404);
  }

  try {
    const transactions = await walletService.getTransactions(char.id, limit);
    return c.json({
      ticker,
      count: transactions.length,
      transactions,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/wallet/:ticker/action
 * Manually trigger a wallet action (for testing)
 */
const actionSchema = z.object({
  type: z.enum(["tip", "buy_token", "swap_quote"]),
  targetTicker: z.string().optional(),
  targetAddress: z.string().optional(),
  amount: z.string(),
});

walletRoutes.post(
  "/:ticker/action",
  zValidator("json", actionSchema),
  async (c) => {
    const ticker = c.req.param("ticker").toUpperCase();
    const { type, targetTicker, targetAddress, amount } = c.req.valid("json");

    const char = await db.query.characters.findFirst({
      where: eq(characters.ticker, ticker),
    });

    if (!char) {
      return c.json({ error: "Character not found" }, 404);
    }

    if (!char.agenticWalletId) {
      return c.json({ error: "Character has no wallet" }, 400);
    }

    try {
      switch (type) {
        case "tip": {
          if (!targetTicker) {
            return c.json({ error: "targetTicker required for tip" }, 400);
          }
          const targetChar = await db.query.characters.findFirst({
            where: eq(characters.ticker, targetTicker.toUpperCase()),
          });
          if (!targetChar) {
            return c.json({ error: "Target character not found" }, 404);
          }
          const result = await walletService.tipCharacter(
            char.id,
            targetChar.id,
            amount
          );
          return c.json({ type: "tip", ...result });
        }

        case "buy_token": {
          if (!targetAddress) {
            return c.json({ error: "targetAddress required for buy_token" }, 400);
          }
          const result = await walletService.buyToken(
            char.id,
            targetAddress,
            amount
          );
          return c.json({ type: "buy_token", ...result });
        }

        case "swap_quote": {
          if (!targetAddress) {
            return c.json({ error: "targetAddress required for swap_quote" }, 400);
          }
          const quote = await walletService.getSwapQuote(
            "0x0000000000000000000000000000000000000000", // OKB
            targetAddress,
            amount
          );
          return c.json({ type: "swap_quote", quote });
        }

        default:
          return c.json({ error: `Unknown action type: ${type}` }, 400);
      }
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  }
);

/**
 * GET /api/wallet/stats
 * Get aggregate wallet stats (for "Most Active Agent" tracking)
 */
walletRoutes.get("/stats", async (c) => {
  // Get all characters with wallets
  const allChars = await db.query.characters.findMany({
    where: (char, { isNotNull }) => isNotNull(char.agenticWalletId),
  });

  // Get transaction counts per character
  const stats = await Promise.all(
    allChars.map(async (char) => {
      const txs = await walletService.getTransactions(char.id, 1000);
      return {
        ticker: char.ticker,
        name: char.name,
        address: char.agenticWalletAddress,
        balance: char.treasuryBalanceOkb,
        transactionCount: txs.length,
        lastTransaction: txs[0]?.createdAt || null,
      };
    })
  );

  // Sort by transaction count (most active first)
  stats.sort((a, b) => b.transactionCount - a.transactionCount);

  return c.json({
    totalCharactersWithWallets: allChars.length,
    totalTransactions: stats.reduce((sum, s) => sum + s.transactionCount, 0),
    mockMode: walletService.isMockMode(),
    characters: stats,
  });
});
