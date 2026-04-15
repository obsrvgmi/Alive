import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-ink text-bone px-5 sm:px-8 py-8 border-t-[3px] border-ink">
      <div className="max-w-[1200px] mx-auto grid sm:grid-cols-[1fr_auto_auto] gap-6 items-start">
        <div>
          <div className="font-display text-[22px] tracking-tight">ALIVE</div>
          <div className="font-mono text-[10px] font-bold uppercase opacity-60 mt-1">© 2026 ALIVE PROTOCOL · LIVING MEMECOIN LAUNCHPAD</div>
          <div className="font-mono text-[10px] font-bold uppercase opacity-60 mt-2">
            <span className="text-acid">●</span> 142 online · 11 critical · 3 active beefs
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[10px] font-extrabold uppercase opacity-50 mb-1">Product</div>
          <Link href="/launch" className="font-mono text-[11px] font-bold uppercase hover:text-acid transition">Launchpad</Link>
          <Link href="/characters" className="font-mono text-[11px] font-bold uppercase hover:text-acid transition">Characters</Link>
          <Link href="/battles" className="font-mono text-[11px] font-bold uppercase hover:text-acid transition">Battles</Link>
          <Link href="/docs" className="font-mono text-[11px] font-bold uppercase hover:text-acid transition">Docs</Link>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[10px] font-extrabold uppercase opacity-50 mb-1">Community</div>
          <a href="https://x.com" target="_blank" rel="noreferrer" className="font-mono text-[11px] font-bold uppercase hover:text-acid transition">X / Twitter ↗</a>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="font-mono text-[11px] font-bold uppercase hover:text-acid transition">GitHub ↗</a>
          <a href="mailto:gm@alive.fun" className="font-mono text-[11px] font-bold uppercase hover:text-acid transition">gm@alive.fun</a>
        </div>
      </div>
    </footer>
  );
}
