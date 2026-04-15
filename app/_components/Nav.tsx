"use client";
import Link from "next/link";
import { useState } from "react";
import { useWallet } from "./WalletProvider";

const links: [string, string, string][] = [
  ["Launchpad", "/launch", "launch"],
  ["Characters", "/characters", "characters"],
  ["Battles", "/battles", "battles"],
  ["Docs", "/docs", "docs"],
];

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export default function Nav({ active }: { active?: string }) {
  const [open, setOpen] = useState(false);
  const { wallet, openModal, disconnect } = useWallet();

  return (
    <nav className="sticky top-0 z-50 bg-bone border-b-[3px] border-ink" aria-label="Main navigation">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between px-5 sm:px-8 py-3">
        <Link href="/" className="flex items-center gap-2.5 font-display text-[22px] sm:text-[26px] tracking-tighter">
          <span className="w-[16px] h-[16px] border-[3px] border-ink shadow-[2px_2px_0_0_#0a0a0a] animate-pulse2" />
          ALIVE
          <span className="font-mono text-[10px] bg-ink text-acid px-1.5 py-0.5 ml-1 -translate-y-1 inline-block">v0.1</span>
        </Link>
        <div className="hidden md:flex gap-1.5 items-center">
          {links.map(([l, href, key]) => (
            <Link
              key={l}
              href={href}
              aria-current={active === key ? "page" : undefined}
              className={`font-mono font-bold text-[12px] uppercase px-3 py-2 border-[3px] border-ink transition ${
                active === key
                  ? "bg-acid shadow-[3px_3px_0_0_#0a0a0a]"
                  : "bg-bone hover:bg-sun hover:shadow-[3px_3px_0_0_#0a0a0a]"
              }`}
            >
              {l}
            </Link>
          ))}
          {wallet ? (
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-[11px] uppercase px-3 py-2 border-[3px] border-ink bg-acid shadow-[3px_3px_0_0_#0a0a0a]">
                <span className="font-mono text-[9px] bg-ink text-acid px-1 py-0.5 mr-1.5">TESTNET</span>
                {wallet.balance.toFixed(2)} OKB · {short(wallet.address)}
              </span>
              <button
                onClick={disconnect}
                className="font-mono font-bold text-[11px] uppercase px-2.5 py-2 border-[3px] border-ink bg-bone hover:bg-hot transition"
                aria-label="Disconnect wallet"
                title="Disconnect wallet"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={openModal}
              className="font-mono font-bold text-[12px] uppercase px-3 py-2 border-[3px] border-ink bg-ink text-bone shadow-[3px_3px_0_0_#c6ff3d] hover:bg-hot hover:!shadow-[3px_3px_0_0_#0a0a0a] transition"
            >
              Connect →
            </button>
          )}
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="md:hidden w-10 h-10 border-[3px] border-ink bg-bone shadow-[3px_3px_0_0_#0a0a0a] flex flex-col items-center justify-center gap-[3px]"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <span className={`w-5 h-[3px] bg-ink transition ${open ? "rotate-45 translate-y-[5px]" : ""}`} />
          <span className={`w-5 h-[3px] bg-ink transition ${open ? "opacity-0" : ""}`} />
          <span className={`w-5 h-[3px] bg-ink transition ${open ? "-rotate-45 -translate-y-[5px]" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t-[3px] border-ink bg-bone px-5 py-4 flex flex-col gap-2">
          {links.map(([l, href, key]) => (
            <Link
              key={l}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={active === key ? "page" : undefined}
              className={`font-mono font-bold text-[13px] uppercase px-3 py-3 border-[3px] border-ink ${
                active === key ? "bg-acid" : "bg-bone"
              }`}
            >
              {l}
            </Link>
          ))}
          {wallet ? (
            <button
              onClick={() => { disconnect(); setOpen(false); }}
              className="font-mono font-bold text-[13px] uppercase px-3 py-3 border-[3px] border-ink bg-acid text-center"
            >
              {short(wallet.address)} · disconnect
            </button>
          ) : (
            <button
              onClick={() => { openModal(); setOpen(false); }}
              className="font-mono font-bold text-[13px] uppercase px-3 py-3 border-[3px] border-ink bg-ink text-bone text-center"
            >
              Connect wallet →
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
