/**
 * OKX Onchain OS API Client
 * Handles wallet creation, balance queries, and DEX swaps on X Layer
 * Docs: https://www.okx.com/web3/build/docs/waas/waas-overview
 */

import crypto from "crypto";

// X Layer (OKB) chain ID
const X_LAYER_CHAIN_ID = "196";

// Native OKB token
const OKB_ADDRESS = "0x0000000000000000000000000000000000000000";

interface OkxConfig {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  projectId: string;
  baseUrl?: string;
}

interface ApiResponse<T> {
  code: string;
  msg: string;
  data: T;
}

interface WalletInfo {
  walletId: string;
  address: string;
}

interface TokenBalance {
  tokenAddress: string;
  symbol: string;
  balance: string;
  balanceUsd: string;
}

interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  priceImpact: string;
  route: string[];
}

interface TxResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export class OkxApiClient {
  private config: OkxConfig;
  private mockMode: boolean;

  constructor(config?: Partial<OkxConfig>) {
    // Check for required env vars, fall back to mock mode if missing
    const apiKey = config?.apiKey || process.env.OKX_API_KEY;
    const secretKey = config?.secretKey || process.env.OKX_SECRET_KEY;
    const passphrase = config?.passphrase || process.env.OKX_PASSPHRASE;
    const projectId = config?.projectId || process.env.OKX_PROJECT_ID;

    this.mockMode = !apiKey || !secretKey || !passphrase || !projectId;

    if (this.mockMode) {
      console.log("[OKX] Running in mock mode - no API credentials configured");
      this.config = {
        apiKey: "",
        secretKey: "",
        passphrase: "",
        projectId: "",
        baseUrl: "https://www.okx.com",
      };
    } else {
      this.config = {
        apiKey: apiKey!,
        secretKey: secretKey!,
        passphrase: passphrase!,
        projectId: projectId!,
        baseUrl: config?.baseUrl || "https://www.okx.com",
      };
    }
  }

  /**
   * Check if running in mock mode (no real API calls)
   */
  isMockMode(): boolean {
    return this.mockMode;
  }

  /**
   * Generate signature for OKX API request
   */
  private sign(
    timestamp: string,
    method: string,
    path: string,
    body: string = ""
  ): string {
    const message = timestamp + method + path + body;
    return crypto
      .createHmac("sha256", this.config.secretKey)
      .update(message)
      .digest("base64");
  }

  /**
   * Make authenticated request to OKX API
   */
  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: object
  ): Promise<ApiResponse<T>> {
    if (this.mockMode) {
      throw new Error("OKX API not configured - running in mock mode");
    }

    const timestamp = new Date().toISOString();
    const bodyStr = body ? JSON.stringify(body) : "";
    const signature = this.sign(timestamp, method, path, bodyStr);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "OK-ACCESS-KEY": this.config.apiKey,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": this.config.passphrase,
      "OK-ACCESS-PROJECT": this.config.projectId,
    };

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers,
      body: body ? bodyStr : undefined,
    });

    if (!response.ok) {
      throw new Error(`OKX API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create an agentic wallet for a character
   * Uses OKX WaaS (Wallet as a Service)
   */
  async createWallet(characterTicker: string): Promise<WalletInfo> {
    if (this.mockMode) {
      // Generate mock wallet for testing
      const mockId = `mock_wallet_${characterTicker}_${Date.now()}`;
      const mockAddress = `0x${crypto.randomBytes(20).toString("hex")}`;
      console.log(`[OKX Mock] Created wallet for ${characterTicker}: ${mockAddress}`);
      return { walletId: mockId, address: mockAddress };
    }

    const response = await this.request<{ walletId: string; address: string }[]>(
      "POST",
      "/api/v5/waas/wallet/create-wallet",
      {
        walletName: `ALIVE_${characterTicker}`,
        chainId: X_LAYER_CHAIN_ID,
      }
    );

    if (response.code !== "0" || !response.data?.[0]) {
      throw new Error(`Failed to create wallet: ${response.msg}`);
    }

    return {
      walletId: response.data[0].walletId,
      address: response.data[0].address,
    };
  }

  /**
   * Get wallet balance (OKB + tokens)
   */
  async getBalance(walletAddress: string): Promise<{
    okb: string;
    tokens: TokenBalance[];
  }> {
    if (this.mockMode) {
      // Return mock balance for testing
      return {
        okb: "10.5", // Mock 10.5 OKB
        tokens: [],
      };
    }

    const response = await this.request<{
      tokenAssets: Array<{
        tokenAddress: string;
        symbol: string;
        balance: string;
        tokenPrice: string;
      }>;
    }[]>(
      "GET",
      `/api/v5/waas/asset/token-balances?address=${walletAddress}&chainId=${X_LAYER_CHAIN_ID}`
    );

    if (response.code !== "0") {
      throw new Error(`Failed to get balance: ${response.msg}`);
    }

    const assets = response.data?.[0]?.tokenAssets || [];
    const okbAsset = assets.find(
      (a) => a.tokenAddress.toLowerCase() === OKB_ADDRESS.toLowerCase() ||
             a.symbol.toUpperCase() === "OKB"
    );

    return {
      okb: okbAsset?.balance || "0",
      tokens: assets
        .filter((a) => a.tokenAddress.toLowerCase() !== OKB_ADDRESS.toLowerCase())
        .map((a) => ({
          tokenAddress: a.tokenAddress,
          symbol: a.symbol,
          balance: a.balance,
          balanceUsd: (parseFloat(a.balance) * parseFloat(a.tokenPrice || "0")).toString(),
        })),
    };
  }

  /**
   * Send OKB to another address (for tips, battle stakes)
   */
  async sendOkb(
    fromWalletId: string,
    toAddress: string,
    amount: string
  ): Promise<TxResult> {
    if (this.mockMode) {
      const mockTxHash = `0x${crypto.randomBytes(32).toString("hex")}`;
      console.log(`[OKX Mock] Sent ${amount} OKB to ${toAddress}: ${mockTxHash}`);
      return { success: true, txHash: mockTxHash };
    }

    try {
      const response = await this.request<{ txHash: string }[]>(
        "POST",
        "/api/v5/waas/transaction/send-transaction",
        {
          walletId: fromWalletId,
          chainId: X_LAYER_CHAIN_ID,
          toAddress,
          amount,
          tokenAddress: OKB_ADDRESS, // Native OKB
        }
      );

      if (response.code !== "0" || !response.data?.[0]?.txHash) {
        return { success: false, error: response.msg };
      }

      return { success: true, txHash: response.data[0].txHash };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get swap quote from DEX aggregator
   */
  async getSwapQuote(
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<SwapQuote> {
    if (this.mockMode) {
      // Mock quote with 1% slippage
      const mockToAmount = (parseFloat(amount) * 0.99).toString();
      return {
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: mockToAmount,
        priceImpact: "0.01",
        route: [fromToken, toToken],
      };
    }

    const response = await this.request<{
      routerResult: {
        fromTokenAmount: string;
        toTokenAmount: string;
        priceImpactPercentage: string;
        routes: Array<{ tokenAddress: string }>;
      };
    }[]>(
      "GET",
      `/api/v5/dex/aggregator/quote?chainId=${X_LAYER_CHAIN_ID}&fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&amount=${amount}`
    );

    if (response.code !== "0" || !response.data?.[0]?.routerResult) {
      throw new Error(`Failed to get quote: ${response.msg}`);
    }

    const result = response.data[0].routerResult;
    return {
      fromToken,
      toToken,
      fromAmount: result.fromTokenAmount,
      toAmount: result.toTokenAmount,
      priceImpact: result.priceImpactPercentage,
      route: result.routes.map((r) => r.tokenAddress),
    };
  }

  /**
   * Execute a DEX swap (okx-dex-swap skill)
   */
  async swap(
    walletId: string,
    fromToken: string,
    toToken: string,
    amount: string,
    slippageTolerance: string = "0.01" // 1% default
  ): Promise<TxResult> {
    if (this.mockMode) {
      const mockTxHash = `0x${crypto.randomBytes(32).toString("hex")}`;
      console.log(`[OKX Mock] Swap ${amount} ${fromToken} → ${toToken}: ${mockTxHash}`);
      return { success: true, txHash: mockTxHash };
    }

    try {
      // First get quote to get optimal route
      const quote = await this.getSwapQuote(fromToken, toToken, amount);

      // Execute swap via DEX aggregator
      const response = await this.request<{ txHash: string }[]>(
        "POST",
        "/api/v5/dex/aggregator/swap",
        {
          walletId,
          chainId: X_LAYER_CHAIN_ID,
          fromTokenAddress: fromToken,
          toTokenAddress: toToken,
          amount,
          slippage: slippageTolerance,
          // Use the optimal route from quote
        }
      );

      if (response.code !== "0" || !response.data?.[0]?.txHash) {
        return { success: false, error: response.msg };
      }

      return { success: true, txHash: response.data[0].txHash };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Check token security (okx-security skill)
   */
  async checkTokenSecurity(tokenAddress: string): Promise<{
    isSecure: boolean;
    riskLevel: "low" | "medium" | "high";
    warnings: string[];
  }> {
    if (this.mockMode) {
      return {
        isSecure: true,
        riskLevel: "low",
        warnings: [],
      };
    }

    try {
      const response = await this.request<{
        isHoneypot: boolean;
        riskLevel: string;
        riskItems: Array<{ name: string }>;
      }[]>(
        "GET",
        `/api/v5/dex/token-security?chainId=${X_LAYER_CHAIN_ID}&tokenAddress=${tokenAddress}`
      );

      if (response.code !== "0" || !response.data?.[0]) {
        return { isSecure: false, riskLevel: "high", warnings: ["Unable to verify token"] };
      }

      const data = response.data[0];
      return {
        isSecure: !data.isHoneypot && data.riskLevel !== "high",
        riskLevel: (data.riskLevel as "low" | "medium" | "high") || "medium",
        warnings: data.riskItems?.map((r) => r.name) || [],
      };
    } catch (error: any) {
      return { isSecure: false, riskLevel: "high", warnings: [error.message] };
    }
  }
}

// Export singleton instance
export const okxApi = new OkxApiClient();

// Export types
export type { WalletInfo, TokenBalance, SwapQuote, TxResult };
