"use client";

import { useState } from "react";
import { type Address, formatEther } from "viem";
import { useAccount } from "wagmi";
import { useStakeBattle, useBattle, useClaimWinnings } from "../_lib/contracts";
import { useRealtimeBattle } from "../_lib/contracts/realtime";
import { useWallet } from "./WalletProvider";
import { BATTLE_ARENA } from "../_lib/contracts/config";

type Props = {
  battleId: bigint;
  characterA: { name: string; ticker: string; tokenAddress: Address };
  characterB: { name: string; ticker: string; tokenAddress: Address };
};

export default function BattleStakePanel({ battleId, characterA, characterB }: Props) {
  const { isConnected, address } = useAccount();
  const { openModal } = useWallet();
  const [selectedCharacter, setSelectedCharacter] = useState<Address | null>(null);
  const [amount, setAmount] = useState("");

  // Battle data
  const { battle, isLoading: battleLoading, refetch } = useBattle(battleId);
  const { latestUpdate, connected } = useRealtimeBattle(Number(battleId));

  // Stake transaction
  const {
    stake,
    isPending: stakePending,
    isConfirming: stakeConfirming,
    isSuccess: stakeSuccess,
    error: stakeError,
    reset: resetStake,
  } = useStakeBattle();

  // Claim transaction
  const {
    claim,
    isPending: claimPending,
    isConfirming: claimConfirming,
    isSuccess: claimSuccess,
    error: claimError,
    reset: resetClaim,
  } = useClaimWinnings();

  const isLoading = stakePending || stakeConfirming || claimPending || claimConfirming;

  // Handle stake success
  if (stakeSuccess) {
    setTimeout(() => {
      setAmount("");
      setSelectedCharacter(null);
      resetStake();
      refetch();
    }, 2000);
  }

  const handleStake = async () => {
    if (!isConnected) {
      openModal();
      return;
    }

    if (!selectedCharacter || !amount || parseFloat(amount) < BATTLE_ARENA.MIN_STAKE) {
      return;
    }

    await stake(battleId, selectedCharacter, amount);
  };

  const handleClaim = async () => {
    if (!isConnected) {
      openModal();
      return;
    }

    await claim(battleId);
  };

  const poolA = battle ? formatEther(battle.poolA) : "0";
  const poolB = battle ? formatEther(battle.poolB) : "0";
  const totalPool = parseFloat(poolA) + parseFloat(poolB);
  const oddsA = totalPool > 0 ? (parseFloat(poolA) / totalPool * 100).toFixed(1) : "50.0";
  const oddsB = totalPool > 0 ? (parseFloat(poolB) / totalPool * 100).toFixed(1) : "50.0";

  const isBattleEnded = battle?.ended || false;
  const winner = battle?.winner;

  return (
    <div className="border-[3px] border-ink shadow-[6px_6px_0_0_#0a0a0a] bg-bone">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-[3px] border-ink bg-ink text-bone">
        <div className="font-display text-[18px] uppercase tracking-tight">
          Battle #{battleId.toString()}
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <span className="w-2 h-2 bg-acid rounded-full animate-pulse" title="Live updates" />
          )}
          <span className="font-mono text-[10px] font-extrabold uppercase">
            Round {battle?.currentRound?.toString() || "0"}/5
          </span>
        </div>
      </div>

      {/* Score */}
      <div className="grid grid-cols-3 border-b-[3px] border-ink">
        <div className={`p-4 text-center ${winner === characterA.tokenAddress ? "bg-acid" : ""}`}>
          <div className="font-display text-[32px]">{battle?.roundsWonA?.toString() || "0"}</div>
          <div className="font-mono text-[10px] font-extrabold uppercase opacity-60">${characterA.ticker}</div>
        </div>
        <div className="p-4 text-center border-x-[3px] border-ink bg-sun">
          <div className="font-display text-[18px]">VS</div>
        </div>
        <div className={`p-4 text-center ${winner === characterB.tokenAddress ? "bg-acid" : ""}`}>
          <div className="font-display text-[32px]">{battle?.roundsWonB?.toString() || "0"}</div>
          <div className="font-mono text-[10px] font-extrabold uppercase opacity-60">${characterB.ticker}</div>
        </div>
      </div>

      {/* Pools */}
      <div className="p-4 border-b-[3px] border-ink">
        <div className="flex justify-between font-mono text-[10px] font-extrabold uppercase opacity-60 mb-2">
          <span>Total Pool</span>
          <span>{totalPool.toFixed(2)} OKB</span>
        </div>
        <div className="h-4 border-[3px] border-ink bg-bone overflow-hidden flex">
          <div
            className="bg-acid h-full transition-all duration-500"
            style={{ width: `${oddsA}%` }}
          />
          <div
            className="bg-hot h-full transition-all duration-500"
            style={{ width: `${oddsB}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <div className="font-mono text-[11px] font-extrabold">
            ${characterA.ticker}: {poolA} OKB ({oddsA}%)
          </div>
          <div className="font-mono text-[11px] font-extrabold">
            ${characterB.ticker}: {poolB} OKB ({oddsB}%)
          </div>
        </div>
      </div>

      {/* Stake or Claim Section */}
      {isBattleEnded ? (
        // Claim winnings
        <div className="p-4">
          <div className="text-center mb-4">
            <div className="font-display text-[24px] uppercase">
              Winner: ${winner === characterA.tokenAddress ? characterA.ticker : characterB.ticker}
            </div>
          </div>

          {claimSuccess ? (
            <div className="p-3 border-[3px] border-ink bg-acid font-mono text-[11px] font-extrabold uppercase text-center">
              ✓ Winnings claimed!
            </div>
          ) : (
            <button
              onClick={handleClaim}
              disabled={isLoading}
              className="w-full py-4 font-display text-[20px] uppercase tracking-tight border-[3px] border-ink shadow-[4px_4px_0_0_#0a0a0a] bg-acid hover:bg-sun transition disabled:opacity-50"
            >
              {isLoading ? "⟳ Processing..." : "Claim Winnings"}
            </button>
          )}
          <div className="mt-3 font-mono text-[9px] font-extrabold uppercase opacity-50 text-center">
            {BATTLE_ARENA.PLATFORM_FEE_BPS / 100}% platform fee · winner takes 95%
          </div>
        </div>
      ) : (
        // Stake on character
        <div className="p-4">
          <div className="font-mono text-[10px] font-extrabold uppercase opacity-60 mb-3">
            Pick your fighter
          </div>

          {/* Character Selection */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[characterA, characterB].map((char, i) => (
              <button
                key={char.tokenAddress}
                onClick={() => setSelectedCharacter(char.tokenAddress)}
                className={`p-4 border-[3px] border-ink transition ${
                  selectedCharacter === char.tokenAddress
                    ? i === 0 ? "bg-acid shadow-[4px_4px_0_0_#0a0a0a]" : "bg-hot shadow-[4px_4px_0_0_#0a0a0a]"
                    : "bg-bone hover:bg-sun"
                }`}
              >
                <div className="font-display text-[22px] uppercase">{char.name}</div>
                <div className="font-mono text-[11px] font-extrabold opacity-60">${char.ticker}</div>
              </button>
            ))}
          </div>

          {/* Amount Input */}
          <div className="font-mono text-[10px] font-extrabold uppercase opacity-60 mb-2">
            Stake Amount (OKB)
          </div>
          <div className="flex border-[3px] border-ink mb-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Min ${BATTLE_ARENA.MIN_STAKE} OKB`}
              className="flex-1 px-4 py-3 font-display text-[20px] bg-bone outline-none focus:bg-sun"
              disabled={isLoading}
            />
            <div className="px-4 py-3 bg-sun border-l-[3px] border-ink font-mono font-extrabold text-[12px] uppercase flex items-center">
              OKB
            </div>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {[0.5, 1, 5, 10].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className="font-mono font-extrabold text-[10px] uppercase px-2.5 py-1.5 border-[3px] border-ink bg-bone hover:bg-sun shadow-[2px_2px_0_0_#0a0a0a] transition"
              >
                {v} OKB
              </button>
            ))}
          </div>

          {/* Error */}
          {(stakeError || claimError) && (
            <div className="mb-4 p-3 border-[3px] border-ink bg-blood text-bone font-mono text-[11px] font-extrabold uppercase">
              ⚠ {(stakeError || claimError)?.message}
            </div>
          )}

          {/* Success */}
          {stakeSuccess && (
            <div className="mb-4 p-3 border-[3px] border-ink bg-acid font-mono text-[11px] font-extrabold uppercase">
              ✓ Stake placed successfully!
            </div>
          )}

          {/* Stake Button */}
          <button
            onClick={handleStake}
            disabled={isLoading || !selectedCharacter || !amount}
            className={`w-full py-4 font-display text-[20px] uppercase tracking-tight border-[3px] border-ink shadow-[4px_4px_0_0_#0a0a0a] transition disabled:opacity-50 disabled:cursor-not-allowed ${
              selectedCharacter === characterA.tokenAddress
                ? "bg-acid hover:bg-sun"
                : selectedCharacter === characterB.tokenAddress
                ? "bg-hot hover:bg-sun"
                : "bg-bone hover:bg-sun"
            }`}
          >
            {!isConnected
              ? "Connect Wallet"
              : isLoading
              ? "⟳ Processing..."
              : selectedCharacter
              ? `Stake on $${selectedCharacter === characterA.tokenAddress ? characterA.ticker : characterB.ticker}`
              : "Select a Fighter"}
          </button>

          <div className="mt-3 font-mono text-[9px] font-extrabold uppercase opacity-50 text-center">
            Min stake {BATTLE_ARENA.MIN_STAKE} OKB · Loser loses {BATTLE_ARENA.VITALITY_PENALTY_PCT}% vitality cap
          </div>
        </div>
      )}

      {/* Live Update Indicator */}
      {latestUpdate && (
        <div className="px-4 py-2 border-t-[3px] border-ink bg-sun">
          <div className="font-mono text-[10px] font-extrabold uppercase">
            {latestUpdate.event === "round_resolved"
              ? `Round ${latestUpdate.data.roundNumber} won by ${latestUpdate.data.winner?.slice(0, 10)}...`
              : latestUpdate.event === "stake_placed"
              ? `New stake: ${latestUpdate.data.amount} OKB`
              : "Battle ended!"}
          </div>
        </div>
      )}
    </div>
  );
}
