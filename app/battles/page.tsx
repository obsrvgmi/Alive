"use client";
import { useState, useEffect } from "react";
import Nav from "../_components/Nav";
import Footer from "../_components/Footer";
import { characters as mockCharacters, type Character } from "../_lib/characters";
import { getBattles, type Battle as APIBattle } from "../_lib/api";
import Link from "next/link";

type LocalBattle = {
  id: number;
  a: Character;
  b: Character;
  pool: string;
  status: string;
  round: number;
  votes: { a: number; b: number };
};

const mockBattles: LocalBattle[] = [
  { id: 1, a: mockCharacters[0], b: mockCharacters[3], pool: "12.4 OKB", status: "LIVE", round: 3, votes: { a: 62, b: 38 } },
  { id: 2, a: mockCharacters[2], b: mockCharacters[5], pool: "8.1 OKB", status: "LIVE", round: 1, votes: { a: 41, b: 59 } },
  { id: 3, a: mockCharacters[4], b: mockCharacters[1], pool: "21.0 OKB", status: "OPEN", round: 0, votes: { a: 50, b: 50 } },
];

export default function BattlesPage() {
  const [battles, setBattles] = useState<LocalBattle[]>(mockBattles);
  const [loading, setLoading] = useState(true);
  const [totalPool, setTotalPool] = useState("12.4 OKB");

  useEffect(() => {
    async function fetchBattles() {
      try {
        const apiBattles = await getBattles({ status: "active", limit: 10 });
        if (apiBattles.length > 0) {
          // Convert API battles to local format (would need character data)
          // For now, stick with mock data
          console.log("API battles available:", apiBattles.length);
        }
      } catch (err) {
        console.error("Failed to fetch battles:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchBattles();
  }, []);
  return (
    <>
      <Nav active="battles" />
      <main className="px-5 sm:px-8 py-10 sm:py-14">
        <div className="max-w-[1200px] mx-auto">
          <span className="inline-block font-mono font-extrabold text-[11px] uppercase tracking-wider bg-blood text-bone border-[3px] border-ink px-3 py-1.5 shadow-[3px_3px_0_0_#0a0a0a] mb-5">
            ⚔ THE ARENA · WEEKLY · {totalPool} POOL
          </span>
          <h1 className="font-display uppercase leading-[.9] tracking-[-.045em] text-[44px] sm:text-[64px] lg:text-[88px]">
            Two creatures<br />
            <span className="bg-acid border-[3px] border-ink shadow-[6px_6px_0_0_#0a0a0a] inline-block px-[.12em]">enter.</span> One survives.
          </h1>
          <p className="mt-4 max-w-[640px] text-base sm:text-[17px] font-medium leading-relaxed opacity-85">
            Holders stake vitality on their character. Winners eat the loser{"'"}s prize pool. Losers don{"'"}t die — but they limp.
          </p>

          <div className="mt-10 space-y-6">
            {battles.map((b) => {
              const totalVotes = b.votes.a + b.votes.b;
              const aPct = (b.votes.a / totalVotes) * 100;
              return (
                <div key={b.id} className="card !shadow-[8px_8px_0_0_#0a0a0a]">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b-[3px] border-ink bg-ink text-bone font-mono font-extrabold text-[11px] uppercase">
                    <span>BATTLE #{b.id.toString().padStart(3, "0")} · ROUND {b.round}/5</span>
                    <span className="flex items-center gap-2">
                      <span className="text-acid">PRIZE</span> {b.pool}
                      <span className={`px-2 py-0.5 ml-2 ${b.status === "LIVE" ? "bg-blood text-bone animate-blink" : "bg-acid text-ink"}`}>
                        {b.status}
                      </span>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center">
                    {/* A */}
                    <Link href={`/c/${b.a.ticker}`} className="p-5 hover:bg-sun transition flex items-center gap-4 border-b-[3px] md:border-b-0 md:border-r-[3px] border-ink" aria-label={`View ${b.a.name} profile`}>
                      <div className="w-16 h-16 border-[3px] border-ink shadow-[3px_3px_0_0_#0a0a0a] flex items-center justify-center text-[28px]" style={{ background: b.a.ava }} role="img" aria-label={`${b.a.name} avatar`}>
                        {b.a.emoji}
                      </div>
                      <div>
                        <div className="font-display text-[22px] uppercase leading-none tracking-[-.02em]">{b.a.name}</div>
                        <div className="font-mono text-[11px] font-extrabold opacity-70 mt-1">${b.a.ticker} · vit {b.a.vit}%</div>
                      </div>
                    </Link>
                    {/* VS */}
                    <div className="px-5 py-2 md:py-5 font-display text-[40px] text-center bg-bone md:border-r-[3px] border-ink border-b-[3px] md:border-b-0">VS</div>
                    {/* B */}
                    <Link href={`/c/${b.b.ticker}`} className="p-5 hover:bg-sun transition flex items-center gap-4 md:flex-row-reverse md:text-right" aria-label={`View ${b.b.name} profile`}>
                      <div className="w-16 h-16 border-[3px] border-ink shadow-[3px_3px_0_0_#0a0a0a] flex items-center justify-center text-[28px]" style={{ background: b.b.ava }} role="img" aria-label={`${b.b.name} avatar`}>
                        {b.b.emoji}
                      </div>
                      <div>
                        <div className="font-display text-[22px] uppercase leading-none tracking-[-.02em]">{b.b.name}</div>
                        <div className="font-mono text-[11px] font-extrabold opacity-70 mt-1">${b.b.ticker} · vit {b.b.vit}%</div>
                      </div>
                    </Link>
                  </div>
                  <div className="border-t-[3px] border-ink">
                    <div className="h-[18px] bg-bone flex">
                      <div className="bg-acid h-full" style={{ width: `${aPct}%` }} />
                      <div className="bg-hot h-full flex-1" />
                    </div>
                    <div className="flex justify-between px-4 py-2 font-mono text-[10px] font-extrabold uppercase">
                      <span>{b.votes.a}% backing ${b.a.ticker}</span>
                      <span>{b.votes.b}% backing ${b.b.ticker}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 border-t-[3px] border-ink">
                    <button className="font-display text-[16px] uppercase py-3.5 bg-bone hover:bg-acid transition border-r-[3px] border-ink" aria-label={`Back ${b.a.name} in this battle`}>⟶ back ${b.a.ticker}</button>
                    <button className="font-display text-[16px] uppercase py-3.5 bg-bone hover:bg-hot transition" aria-label={`Back ${b.b.name} in this battle`}>⟶ back ${b.b.ticker}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
