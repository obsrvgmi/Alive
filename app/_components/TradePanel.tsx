"use client";

import { useState, useMemo } from "react";
import { type Address, parseEther } from "viem";
import { useAccount } from "wagmi";
import {
  useBuy,
  useSell,
  useTokenPrice,
  useTokenBalance,
  useGetTokensOut,
  useGetOkbOut,
  useApproveToken,
  useAllowance,
} from "../_lib/contracts";
import { useWallet } from "./WalletProvider";

type Props = {
  tokenAddress: Address;
  ticker: string;
};

export default function TradePanel({ tokenAddress, ticker }: Props) {
  const { isConnected } = useAccount();
  const { openModal } = useWallet();
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");

  // Price data
  const { priceFormatted, isLoading: priceLoading, refetch: refetchPrice } = useTokenPrice(tokenAddress);
  const { balanceFormatted, refetch: refetchBalance } = useTokenBalance(tokenAddress);
  const { allowance, refetch: refetchAllowance } = useAllowance(tokenAddress);

  // Quote calculations
  const { tokensOutFormatted, isLoading: quoteLoading } = useGetTokensOut(
    tokenAddress,
    mode === "buy" ? amount : "0"
  );
  const { okbOutFormatted } = useGetOkbOut(
    tokenAddress,
    mode === "sell" ? amount : "0"
  );

  // Transactions
  const { buy, isPending: buyPending, isConfirming: buyConfirming, isSuccess: buySuccess, error: buyError, reset: resetBuy } = useBuy(tokenAddress);
  const { sell, isPending: sellPending, isConfirming: sellConfirming, isSuccess: sellSuccess, error: sellError, reset: resetSell } = useSell(tokenAddress);
  const { approve, isPending: approvePending, isConfirming: approveConfirming, isSuccess: approveSuccess } = useApproveToken(tokenAddress);

  const isPending = buyPending || sellPending || approvePending;
  const isConfirming = buyConfirming || sellConfirming || approveConfirming;
  const isLoading = isPending || isConfirming;

  // Check if approval needed for sell
  const needsApproval = useMemo(() => {
    if (mode !== "sell" || !amount) return false;
    try {
      const amountWei = parseEther(amount);
      return allowance !== undefined && allowance < amountWei;
    } catch {
      return false;
    }
  }, [mode, amount, allowance]);

  // Handle trade success
  if (buySuccess || sellSuccess) {
    setTimeout(() => {
      setAmount("");
      resetBuy();
      resetSell();
      refetchPrice();
      refetchBalance();
      refetchAllowance();
    }, 2000);
  }

  const handleTrade = async () => {
    if (!isConnected) {
      openModal();
      return;
    }

    if (!amount || parseFloat(amount) <= 0) return;

    try {
      if (mode === "buy") {
        await buy(amount);
      } else {
        if (needsApproval) {
          await approve();
        } else {
          await sell(amount);
        }
      }
    } catch (e) {
      console.error("Trade error:", e);
    }
  };

  const error = buyError || sellError;

  return (
    <div className="border-[3px] border-ink shadow-[6px_6px_0_0_#0a0a0a] bg-bone">
      {/* Mode Toggle */}
      <div className="grid grid-cols-2 border-b-[3px] border-ink">
        <button
          onClick={() => setMode("buy")}
          className={`py-3 font-display text-[18px] uppercase tracking-tight transition ${
            mode === "buy" ? "bg-acid" : "bg-bone hover:bg-sun"
          }`}
        >
          ↑ Buy
        </button>
        <button
          onClick={() => setMode("sell")}
          className={`py-3 font-display text-[18px] uppercase tracking-tight border-l-[3px] border-ink transition ${
            mode === "sell" ? "bg-hot" : "bg-bone hover:bg-sun"
          }`}
        >
          ↓ Sell
        </button>
      </div>

      {/* Price Display */}
      <div className="p-4 border-b-[3px] border-ink">
        <div className="font-mono text-[10px] font-extrabold uppercase opacity-60">
          Current Price
        </div>
        <div className="font-display text-[28px] tracking-tight">
          {priceLoading ? "..." : priceFormatted} <span className="text-[14px] opacity-60">OKB</span>
        </div>
        {mode === "sell" && (
          <div className="font-mono text-[10px] font-extrabold opacity-60 mt-1">
            Your balance: {balanceFormatted} ${ticker}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4">
        <div className="font-mono text-[10px] font-extrabold uppercase opacity-60 mb-2">
          {mode === "buy" ? "Amount (OKB)" : `Amount ($${ticker})`}
        </div>
        <div className="flex border-[3px] border-ink">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="flex-1 px-4 py-3 font-display text-[24px] bg-bone outline-none focus:bg-sun"
            disabled={isLoading}
          />
          <div className="px-4 py-3 bg-sun border-l-[3px] border-ink font-mono font-extrabold text-[12px] uppercase flex items-center">
            {mode === "buy" ? "OKB" : ticker}
          </div>
        </div>

        {/* Quick amounts */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {mode === "buy" ? (
            <>
              {[0.1, 0.5, 1, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(String(v))}
                  className="font-mono font-extrabold text-[10px] uppercase px-2.5 py-1.5 border-[3px] border-ink bg-bone hover:bg-sun shadow-[2px_2px_0_0_#0a0a0a] transition"
                >
                  {v} OKB
                </button>
              ))}
            </>
          ) : (
            <>
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    const balance = parseFloat(balanceFormatted) || 0;
                    setAmount(String((balance * pct / 100).toFixed(6)));
                  }}
                  className="font-mono font-extrabold text-[10px] uppercase px-2.5 py-1.5 border-[3px] border-ink bg-bone hover:bg-sun shadow-[2px_2px_0_0_#0a0a0a] transition"
                >
                  {pct}%
                </button>
              ))}
            </>
          )}
        </div>

        {/* Quote */}
        {amount && parseFloat(amount) > 0 && (
          <div className="mt-4 p-3 border-[3px] border-ink bg-sun">
            <div className="font-mono text-[10px] font-extrabold uppercase opacity-60">
              You {mode === "buy" ? "receive" : "get"} (est)
            </div>
            <div className="font-display text-[22px] mt-1">
              {quoteLoading ? "..." : mode === "buy" ? tokensOutFormatted : okbOutFormatted}{" "}
              <span className="text-[12px] opacity-60">{mode === "buy" ? `$${ticker}` : "OKB"}</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 border-[3px] border-ink bg-blood text-bone font-mono text-[11px] font-extrabold uppercase">
            ⚠ {error.message}
          </div>
        )}

        {/* Success */}
        {(buySuccess || sellSuccess || approveSuccess) && (
          <div className="mt-4 p-3 border-[3px] border-ink bg-acid font-mono text-[11px] font-extrabold uppercase">
            ✓ {approveSuccess ? "Approved! Now sell." : `${mode === "buy" ? "Bought" : "Sold"} successfully!`}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleTrade}
          disabled={isLoading || (!amount && isConnected)}
          className={`w-full mt-4 py-4 font-display text-[20px] uppercase tracking-tight border-[3px] border-ink shadow-[4px_4px_0_0_#0a0a0a] transition disabled:opacity-50 disabled:cursor-not-allowed ${
            mode === "buy" ? "bg-acid hover:bg-sun" : "bg-hot hover:bg-sun"
          }`}
        >
          {!isConnected
            ? "Connect Wallet"
            : isLoading
            ? "⟳ Processing..."
            : needsApproval
            ? `Approve ${ticker}`
            : mode === "buy"
            ? `Buy $${ticker}`
            : `Sell $${ticker}`}
        </button>

        {/* Slippage note */}
        <div className="mt-3 font-mono text-[9px] font-extrabold uppercase opacity-50 text-center">
          1% trading fee · price impact varies by size
        </div>
      </div>
    </div>
  );
}
