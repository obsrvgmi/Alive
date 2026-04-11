"use client";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Stat from "./Stat";
import { useVisibility, useReducedMotion } from "../_lib/hooks";
import { vitColor, AMBIENT_DRIFT_MS, VIT_FLATLINE, VIT_CRITICAL, VIT_STRESSED } from "../_lib/constants";
import type { LogEntry } from "../_lib/types";

export default function LifeSupportSection() {
  const [vit, setVit] = useState(64);
  const [hp, setHp] = useState(6_400);
  const [holders, setHolders] = useState(2_141);
  const [log, setLog] = useState<LogEntry[]>([
    { id: 1, kind: "info", text: "agent online · awaiting input" },
  ]);
  const [pulse, setPulse] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const idRef = useRef(2);
  const ekgRef = useRef<SVGPolylineElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const isVisible = useVisibility(sectionRef);
  const reducedMotion = useReducedMotion();

  // EKG line — memoized based on vit
  const ekgPoints = useMemo(() => {
    const W = 600;
    const H = 80;
    const tick = 12;
    const points: string[] = [];
    let x = 0;
    while (x < W) {
      const baseline = H / 2;
      const cycle = (x / tick) % 6;
      let y = baseline;
      if (cycle === 1) y = baseline - 6;
      if (cycle === 2) y = baseline + (vit < VIT_CRITICAL ? 8 : 4);
      if (cycle === 3) y = baseline - (vit < VIT_CRITICAL ? 28 : 22);
      if (cycle === 4) y = baseline + 10;
      if (cycle === 5) y = baseline;
      points.push(`${x},${y}`);
      x += tick / 2;
    }
    return points.join(" ");
  }, [vit]);

  // ambient drift — only when visible and not reduced motion
  useEffect(() => {
    if (!isVisible || reducedMotion) return;
    const id = setInterval(() => {
      setVit((v) => Math.max(0, Math.min(100, v + (Math.random() * 2 - 1.2))));
    }, AMBIENT_DRIFT_MS);
    return () => clearInterval(id);
  }, [isVisible, reducedMotion]);

  const pushLog = (kind: LogEntry["kind"], text: string) => {
    setLog((l) => [{ id: idRef.current++, kind, text }, ...l].slice(0, 5));
  };

  const startCooldown = useCallback(() => {
    setCooldown(true);
    setTimeout(() => setCooldown(false), 500);
  }, []);

  const buy = () => {
    if (cooldown) return;
    startCooldown();
    setVit((v) => Math.min(100, v + 12));
    setHp((h) => h + 1200);
    setHolders((h) => h + 1);
    setPulse(true);
    setTimeout(() => setPulse(false), 350);
    pushLog("buy", "+0.5 OKB bought · vitality +12 · 'i felt that.'");
  };
  const sell = () => {
    if (cooldown) return;
    startCooldown();
    setVit((v) => Math.max(0, v - 18));
    setHp((h) => Math.max(0, h - 1800));
    setHolders((h) => Math.max(0, h - 1));
    pushLog("sell", "−0.5 OKB sold · vitality −18 · 'why would you do this'");
  };

  const status =
    vit > 70 ? { label: "STABLE", color: "bg-acid", pulse: "bg-acid" } :
    vit > 40 ? { label: "STRESSED", color: "bg-sun", pulse: "bg-sun" } :
    vit > VIT_FLATLINE ? { label: "CRITICAL", color: "bg-hot", pulse: "bg-hot" } :
    { label: "FLATLINE", color: "bg-blood text-bone", pulse: "bg-blood" };

  const currentVitColor = vitColor(vit);

  return (
    <section ref={sectionRef} className="px-5 sm:px-8 py-16 sm:py-24 border-b-[3px] border-ink bg-bone relative overflow-hidden">
      {/* huge background number */}
      <div
        aria-hidden="true"
        className="absolute -right-8 -bottom-20 font-display text-[260px] sm:text-[420px] leading-none pointer-events-none select-none tracking-[-.04em]"
        style={{ color: "transparent", WebkitTextStroke: "2px rgba(10,10,10,.06)" }}
      >
        ALIVE
      </div>

      <div className="max-w-[1200px] mx-auto relative grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-14 items-center">
        {/* LEFT — editorial quote */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono font-extrabold text-[11px] uppercase tracking-wider bg-ink text-acid border-[3px] border-ink px-3 py-1.5 shadow-[3px_3px_0_0_#0a0a0a]">
              The retention thesis
            </span>
            <span className="font-mono font-bold text-[10px] uppercase opacity-70 hidden sm:inline">↓ try the buttons</span>
          </div>

          <h2 className="font-display uppercase tracking-[-.035em] leading-[.92] text-[36px] sm:text-[56px] lg:text-[76px]">
            Holders don{"'"}t<br />
            just want <span className="relative inline-block">
              <span className="bg-ink text-bone px-[.18em]">price up.</span>
            </span><br />
            They want their<br />
            <span className="bg-acid border-[3px] border-ink shadow-[6px_6px_0_0_#0a0a0a] inline-block px-[.15em]">character</span><br />
            to <span className="text-hot italic">survive.</span>
          </h2>

          <div className="mt-8 max-w-[480px] text-[15px] sm:text-[16px] font-medium leading-relaxed opacity-85 border-l-[3px] border-ink pl-4">
            Every other launchpad rewards holders for one thing: number-go-up. We added a second one — <b>keep your guy alive</b>. That second incentive is the entire game. It changes who buys, why they buy, and what they refuse to do.
          </div>

          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <div className="font-mono font-extrabold text-[11px] uppercase bg-ink text-bone px-3 py-2 border-[3px] border-ink">— ALIVE thesis · 04/2026</div>
            <div className="font-mono font-bold text-[10px] uppercase opacity-70">never existed in crypto before</div>
          </div>
        </div>

        {/* RIGHT — life support monitor */}
        <div className="card !shadow-[8px_8px_0_0_#0a0a0a] bg-bone w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
          {/* monitor head */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b-[3px] border-ink bg-ink text-bone">
            <div className="flex items-center gap-2 font-mono font-extrabold text-[10px] uppercase">
              <span className={`w-2 h-2 rounded-full ${status.pulse} animate-blink`} />
              LIFE SUPPORT · CHAR#0042
              <span className="ml-1 px-1.5 py-0.5 bg-sun text-ink border-[2px] border-bone">DEMO</span>
            </div>
            <div className={`font-mono font-extrabold text-[10px] uppercase border-[2px] border-bone px-2 py-0.5 ${status.color}`}>
              {status.label}
            </div>
          </div>

          {/* EKG */}
          <div className="bg-ink border-b-[3px] border-ink relative">
            <svg viewBox="0 0 600 80" className="w-full h-[80px] block" aria-label={`EKG monitor showing ${status.label} status`} role="img">
              <polyline
                ref={ekgRef}
                points={ekgPoints}
                fill="none"
                stroke={currentVitColor}
                strokeWidth="2.5"
                strokeLinecap="square"
                strokeLinejoin="miter"
                style={{ filter: `drop-shadow(0 0 6px ${currentVitColor})` }}
              />
            </svg>
            <div className="absolute top-1.5 left-2 font-mono text-[9px] font-extrabold text-acid uppercase">EKG · 60bpm</div>
            <div className="absolute top-1.5 right-2 font-mono text-[9px] font-extrabold text-acid uppercase">{vit < VIT_FLATLINE ? "ARRHYTHMIA" : "SINUS"}</div>
          </div>

          {/* stat row */}
          <div className="grid grid-cols-3 border-b-[3px] border-ink">
            <Stat k="Vitality" v={`${Math.round(vit)}%`} accent={vit < VIT_CRITICAL ? "text-blood" : vit < VIT_STRESSED ? "text-ink" : "text-[#1a8c1a]"} />
            <Stat k="HP" v={hp.toLocaleString()} mid />
            <Stat k="Holders" v={holders.toLocaleString()} />
          </div>

          {/* big vitality bar */}
          <div className="px-4 py-3.5 border-b-[3px] border-ink">
            <div className="flex justify-between font-mono text-[10px] font-extrabold uppercase mb-1.5">
              <span>vitality</span>
              <span className={pulse ? "text-acid" : ""}>{Math.round(vit)} / 100</span>
            </div>
            <div className="h-[20px] border-[3px] border-ink bg-bone relative overflow-hidden">
              <div
                className="h-full transition-[width] duration-500 ease-out"
                style={{
                  width: `${vit}%`,
                  background: currentVitColor,
                  backgroundImage: "repeating-linear-gradient(45deg,rgba(0,0,0,.18) 0 6px,transparent 6px 12px)",
                }}
              />
            </div>
          </div>

          {/* action buttons */}
          <div className="grid grid-cols-2 border-b-[3px] border-ink">
            <button
              onClick={buy}
              disabled={cooldown}
              className="font-display text-[18px] uppercase py-4 bg-acid hover:bg-bone transition border-r-[3px] border-ink active:translate-y-[1px] disabled:opacity-60"
              aria-label="Buy tokens, increases vitality by 12"
            >
              ↑ BUY +12
            </button>
            <button
              onClick={sell}
              disabled={cooldown}
              className="font-display text-[18px] uppercase py-4 bg-hot hover:bg-bone transition active:translate-y-[1px] disabled:opacity-60"
              aria-label="Sell tokens, decreases vitality by 18"
            >
              ↓ SELL −18
            </button>
          </div>

          {/* log */}
          <div className="bg-ink text-bone p-3">
            <div className="font-mono text-[9px] font-extrabold uppercase opacity-70 mb-1.5">agent log</div>
            <ul className="space-y-1" role="log" aria-live="polite" aria-label="Agent activity log">
              {log.map((l) => (
                <li
                  key={l.id}
                  className={`font-mono text-[11px] font-bold leading-snug ${
                    l.kind === "buy" ? "text-acid" : l.kind === "sell" ? "text-hot" : "text-bone/85"
                  }`}
                >
                  &gt; {l.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
