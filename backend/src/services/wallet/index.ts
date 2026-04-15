/**
 * Wallet Service
 * Manages agentic wallets for characters (OKX Onchain OS integration)
 *
 * Economy loop:
 * EARN: Trading fees (0.2%), battle winnings, ally tips
 * PAY: Tweet costs, battle stakes, token purchases
 */

import { db, eq } from "../../db";
import { characters, characterTransactions } from "../../db/schema";
import { okxApi, type WalletInfo, type TokenBalance, type TxResult } from "./okx-api";

// Economy parameters
const TRADING_FEE_PERCENT = 0.002; // 0.2% to character treasury
const MIN_TIP_AMOUNT = "0.01";     // Minimum tip in OKB
const MAX_TIP_AMOUNT = "1.0";      // Maximum tip in OKB
const TWEET_COST_OKB = "0.001";    // Cost per tweet (x402)

export interface WalletStatus {
  walletId: string | null;
  address: string | null;
  enabled: boolean;
  balance: {
    okb: string;
    tokens: TokenBalance[];
  };
  lastSync: Date | null;
}

export interface TransactionRecord {
  id: string;
  type: string;
  amount: string;
  tokenAddress: string | null;
  txHash: string | null;
  counterparty: string | null;
  status: string;
  createdAt: Date;
}

class WalletService {
  /**
   * Initialize wallet for a character
   */
  async initializeWallet(characterId: string): Promise<WalletInfo> {
    // Get character
    const char = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });

    if (!char) {
      throw new Error("Character not found");
    }

    if (char.agenticWalletId) {
      throw new Error("Character already has a wallet");
    }

    // Create wallet via OKX API
    const wallet = await okxApi.createWallet(char.ticker);

    // Get initial balance
    const balance = await okxApi.getBalance(wallet.address);

    // Update character with wallet info and initial balance
    await db.update(characters)
      .set({
        agenticWalletId: wallet.walletId,
        agenticWalletAddress: wallet.address,
        walletEnabled: true,
        treasuryBalanceOkb: balance.okb,
        lastWalletSync: new Date(),
      })
      .where(eq(characters.id, characterId));

    console.log(`[Wallet] Initialized wallet for ${char.ticker}: ${wallet.address}`);

    return wallet;
  }

  /**
   * Get wallet status for a character
   */
  async getStatus(characterId: string): Promise<WalletStatus> {
    const char = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });

    if (!char) {
      throw new Error("Character not found");
    }

    // If no wallet, return empty status
    if (!char.agenticWalletAddress) {
      return {
        walletId: null,
        address: null,
        enabled: false,
        balance: { okb: "0", tokens: [] },
        lastSync: null,
      };
    }

    // Get live balance
    const balance = await okxApi.getBalance(char.agenticWalletAddress);

    // Update cached balance
    await db.update(characters)
      .set({
        treasuryBalanceOkb: balance.okb,
        lastWalletSync: new Date(),
      })
      .where(eq(characters.id, characterId));

    return {
      walletId: char.agenticWalletId,
      address: char.agenticWalletAddress,
      enabled: char.walletEnabled,
      balance,
      lastSync: new Date(),
    };
  }

  /**
   * Enable/disable wallet for a character
   */
  async setEnabled(characterId: string, enabled: boolean): Promise<void> {
    await db.update(characters)
      .set({ walletEnabled: enabled })
      .where(eq(characters.id, characterId));
  }

  /**
   * Record trading fee earned by character
   * Called when someone buys/sells the character's token
   */
  async recordTradingFee(
    characterId: string,
    tradeAmount: string,
    txHash: string
  ): Promise<void> {
    const feeAmount = (parseFloat(tradeAmount) * TRADING_FEE_PERCENT).toString();

    await db.insert(characterTransactions).values({
      characterId,
      type: "earn_fee",
      amount: feeAmount,
      txHash,
      status: "confirmed",
    });

    // Update cached balance
    const char = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });

    if (char) {
      const newBalance = (parseFloat(char.treasuryBalanceOkb || "0") + parseFloat(feeAmount)).toString();
      await db.update(characters)
        .set({ treasuryBalanceOkb: newBalance })
        .where(eq(characters.id, characterId));
    }

    console.log(`[Wallet] ${characterId} earned ${feeAmount} OKB fee from trade ${txHash}`);
  }

  /**
   * Tip another character (for WHOLESOME personalities)
   */
  async tipCharacter(
    fromCharacterId: string,
    toCharacterId: string,
    amount: string
  ): Promise<TxResult> {
    // Validate amount
    if (parseFloat(amount) < parseFloat(MIN_TIP_AMOUNT)) {
      return { success: false, error: `Minimum tip is ${MIN_TIP_AMOUNT} OKB` };
    }
    if (parseFloat(amount) > parseFloat(MAX_TIP_AMOUNT)) {
      return { success: false, error: `Maximum tip is ${MAX_TIP_AMOUNT} OKB` };
    }

    // Get both characters
    const fromChar = await db.query.characters.findFirst({
      where: eq(characters.id, fromCharacterId),
    });
    const toChar = await db.query.characters.findFirst({
      where: eq(characters.id, toCharacterId),
    });

    if (!fromChar?.agenticWalletId || !toChar?.agenticWalletAddress) {
      return { success: false, error: "Both characters must have wallets" };
    }

    // Check balance
    if (parseFloat(fromChar.treasuryBalanceOkb || "0") < parseFloat(amount)) {
      return { success: false, error: "Insufficient balance" };
    }

    // Send OKB
    const result = await okxApi.sendOkb(
      fromChar.agenticWalletId,
      toChar.agenticWalletAddress,
      amount
    );

    if (result.success) {
      // Record outgoing transaction
      await db.insert(characterTransactions).values({
        characterId: fromCharacterId,
        type: "tip_ally",
        amount: `-${amount}`,
        counterparty: toChar.agenticWalletAddress,
        counterpartyCharacterId: toCharacterId,
        txHash: result.txHash,
        status: "confirmed",
      });

      // Record incoming transaction
      await db.insert(characterTransactions).values({
        characterId: toCharacterId,
        type: "receive_tip",
        amount,
        counterparty: fromChar.agenticWalletAddress,
        counterpartyCharacterId: fromCharacterId,
        txHash: result.txHash,
        status: "confirmed",
      });

      // Update balances
      const newFromBalance = (parseFloat(fromChar.treasuryBalanceOkb || "0") - parseFloat(amount)).toString();
      const newToBalance = (parseFloat(toChar.treasuryBalanceOkb || "0") + parseFloat(amount)).toString();

      await db.update(characters)
        .set({ treasuryBalanceOkb: newFromBalance })
        .where(eq(characters.id, fromCharacterId));
      await db.update(characters)
        .set({ treasuryBalanceOkb: newToBalance })
        .where(eq(characters.id, toCharacterId));

      console.log(`[Wallet] ${fromChar.ticker} tipped ${toChar.ticker} ${amount} OKB`);
    }

    return result;
  }

  /**
   * Buy a token via DEX swap (okx-dex-swap skill)
   */
  async buyToken(
    characterId: string,
    tokenAddress: string,
    amountOkb: string
  ): Promise<TxResult> {
    const char = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });

    if (!char?.agenticWalletId) {
      return { success: false, error: "Character has no wallet" };
    }

    // Check balance
    if (parseFloat(char.treasuryBalanceOkb || "0") < parseFloat(amountOkb)) {
      return { success: false, error: "Insufficient balance" };
    }

    // Security check
    const security = await okxApi.checkTokenSecurity(tokenAddress);
    if (!security.isSecure) {
      return {
        success: false,
        error: `Token failed security check: ${security.warnings.join(", ")}`
      };
    }

    // Execute swap
    const result = await okxApi.swap(
      char.agenticWalletId,
      "0x0000000000000000000000000000000000000000", // OKB (native)
      tokenAddress,
      amountOkb
    );

    if (result.success) {
      await db.insert(characterTransactions).values({
        characterId,
        type: "buy_token",
        amount: `-${amountOkb}`,
        tokenAddress,
        txHash: result.txHash,
        status: "confirmed",
      });

      // Update OKB balance
      const newBalance = (parseFloat(char.treasuryBalanceOkb || "0") - parseFloat(amountOkb)).toString();
      await db.update(characters)
        .set({ treasuryBalanceOkb: newBalance })
        .where(eq(characters.id, characterId));

      console.log(`[Wallet] ${char.ticker} bought token ${tokenAddress} for ${amountOkb} OKB`);
    }

    return result;
  }

  /**
   * Pay for an action (e.g., tweet cost via x402)
   */
  async payForAction(
    characterId: string,
    actionType: string,
    amount: string = TWEET_COST_OKB
  ): Promise<TxResult> {
    const char = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });

    if (!char) {
      return { success: false, error: "Character not found" };
    }

    // In mock mode, just record the transaction
    if (okxApi.isMockMode()) {
      await db.insert(characterTransactions).values({
        characterId,
        type: "pay_action",
        amount: `-${amount}`,
        metadata: { actionType },
        status: "confirmed",
      });

      const newBalance = Math.max(0, parseFloat(char.treasuryBalanceOkb || "0") - parseFloat(amount)).toString();
      await db.update(characters)
        .set({ treasuryBalanceOkb: newBalance })
        .where(eq(characters.id, characterId));

      return { success: true, txHash: `mock_${Date.now()}` };
    }

    // Real mode would integrate with x402 payment protocol
    // For now, deduct from treasury
    const newBalance = (parseFloat(char.treasuryBalanceOkb || "0") - parseFloat(amount)).toString();
    if (parseFloat(newBalance) < 0) {
      return { success: false, error: "Insufficient balance for action" };
    }

    await db.insert(characterTransactions).values({
      characterId,
      type: "pay_action",
      amount: `-${amount}`,
      metadata: { actionType },
      status: "confirmed",
    });

    await db.update(characters)
      .set({ treasuryBalanceOkb: newBalance })
      .where(eq(characters.id, characterId));

    return { success: true };
  }

  /**
   * Record battle stake
   */
  async stakeBattle(
    characterId: string,
    battleId: string,
    backedCharacterId: string,
    amount: string
  ): Promise<TxResult> {
    const char = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });

    if (!char) {
      return { success: false, error: "Character not found" };
    }

    if (parseFloat(char.treasuryBalanceOkb || "0") < parseFloat(amount)) {
      return { success: false, error: "Insufficient balance for stake" };
    }

    // Record the stake transaction
    await db.insert(characterTransactions).values({
      characterId,
      type: "battle_stake",
      amount: `-${amount}`,
      counterpartyCharacterId: backedCharacterId,
      metadata: { battleId, backedCharacterId },
      status: "pending", // Will be confirmed/refunded when battle resolves
    });

    const newBalance = (parseFloat(char.treasuryBalanceOkb || "0") - parseFloat(amount)).toString();
    await db.update(characters)
      .set({ treasuryBalanceOkb: newBalance })
      .where(eq(characters.id, characterId));

    console.log(`[Wallet] ${char.ticker} staked ${amount} OKB on battle ${battleId}`);
    return { success: true };
  }

  /**
   * Record battle winnings
   */
  async recordBattleWin(
    characterId: string,
    battleId: string,
    amount: string
  ): Promise<void> {
    await db.insert(characterTransactions).values({
      characterId,
      type: "battle_win",
      amount,
      metadata: { battleId },
      status: "confirmed",
    });

    const char = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });

    if (char) {
      const newBalance = (parseFloat(char.treasuryBalanceOkb || "0") + parseFloat(amount)).toString();
      await db.update(characters)
        .set({ treasuryBalanceOkb: newBalance })
        .where(eq(characters.id, characterId));
    }

    console.log(`[Wallet] ${characterId} won ${amount} OKB from battle ${battleId}`);
  }

  /**
   * Get transaction history for a character
   */
  async getTransactions(
    characterId: string,
    limit: number = 50
  ): Promise<TransactionRecord[]> {
    const txs = await db.query.characterTransactions.findMany({
      where: eq(characterTransactions.characterId, characterId),
      orderBy: (tx, { desc }) => [desc(tx.createdAt)],
      limit,
    });

    return txs.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      tokenAddress: tx.tokenAddress,
      txHash: tx.txHash,
      counterparty: tx.counterparty,
      status: tx.status,
      createdAt: tx.createdAt,
    }));
  }

  /**
   * Get swap quote (for UI display)
   */
  async getSwapQuote(fromToken: string, toToken: string, amount: string) {
    return okxApi.getSwapQuote(fromToken, toToken, amount);
  }

  /**
   * Check if wallet service is in mock mode
   */
  isMockMode(): boolean {
    return okxApi.isMockMode();
  }
}

// Export singleton instance
export const walletService = new WalletService();

// Re-export types
export type { TokenBalance, TxResult } from "./okx-api";
