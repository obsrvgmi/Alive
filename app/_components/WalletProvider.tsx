"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount, useBalance, useDisconnect } from "wagmi";
import {
  RainbowKitProvider,
  ConnectButton,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { config, xLayer } from "../_lib/wagmi";
import { createContext, useContext, useState, useCallback } from "react";

const queryClient = new QueryClient();

// Context for modal control and wallet state
type WalletCtx = {
  address: `0x${string}` | undefined;
  balance: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  openModal: () => void;
  closeModal: () => void;
  modalOpen: boolean;
  disconnect: () => void;
};

const WalletContext = createContext<WalletCtx | null>(null);

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");

  // Return a compatible interface with the old mock wallet
  return {
    wallet: ctx.isConnected
      ? {
          address: ctx.address as string,
          balance: ctx.balance ? parseFloat(ctx.balance) : 0,
        }
      : null,
    connecting: ctx.isConnecting,
    connect: ctx.openModal,
    disconnect: ctx.disconnect,
    openModal: ctx.openModal,
    closeModal: ctx.closeModal,
    modalOpen: ctx.modalOpen,
  };
}

function WalletContextWrapper({ children }: { children: React.ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false);
  const { address, isConnected, isConnecting, chainId } = useAccount();
  // Force X Layer Sepolia chainId (1952) for balance - contracts are deployed there
  const { data: balanceData } = useBalance({
    address,
    chainId: 1952,
  });
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  const disconnect = useCallback(() => {
    wagmiDisconnect();
    setModalOpen(false);
  }, [wagmiDisconnect]);

  return (
    <WalletContext.Provider
      value={{
        address,
        balance: balanceData?.formatted,
        isConnected,
        isConnecting,
        openModal,
        closeModal,
        modalOpen,
        disconnect,
      }}
    >
      {children}
      {modalOpen && (
        <ConnectModal onClose={closeModal} />
      )}
    </WalletContext.Provider>
  );
}

function ConnectModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-ink/70 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-bone border-[3px] border-ink shadow-[8px_8px_0_0_#0a0a0a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b-[3px] border-ink bg-ink text-bone">
          <div className="font-display text-[18px] uppercase tracking-tight">Connect wallet</div>
          <button
            onClick={onClose}
            className="w-7 h-7 border-[2px] border-bone hover:bg-hot transition font-display"
          >
            x
          </button>
        </div>
        <div className="p-4">
          <p className="font-mono text-[11px] font-bold uppercase opacity-70 mb-4">
            Connect to X Layer (OKB) to launch and trade characters
          </p>
          <div className="flex justify-center">
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openConnectModal,
                mounted,
              }) => {
                const connected = mounted && account && chain;

                if (!mounted) {
                  return (
                    <div className="w-full py-4 text-center font-mono text-[12px] font-extrabold uppercase opacity-50">
                      Loading...
                    </div>
                  );
                }

                if (!connected) {
                  return (
                    <button
                      onClick={openConnectModal}
                      className="w-full btn-brut !bg-acid"
                    >
                      Select Wallet
                    </button>
                  );
                }

                // Connected - close modal
                setTimeout(onClose, 100);

                return (
                  <div className="w-full py-4 text-center font-mono text-[12px] font-extrabold uppercase text-[#1a8c1a]">
                    Connected
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </div>
          <div className="mt-4 text-center">
            <span className="font-mono text-[10px] font-bold uppercase opacity-50">
              Supports: OKX Wallet, MetaMask, WalletConnect, Ledger
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Custom theme matching ALIVE design
const aliveTheme = lightTheme({
  accentColor: "#c6ff3d",
  accentColorForeground: "#0a0a0a",
  borderRadius: "none",
  fontStack: "system",
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={aliveTheme}
          modalSize="compact"
        >
          <WalletContextWrapper>{children}</WalletContextWrapper>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// Export a simple connect button that can be used anywhere
export function WalletConnectButton() {
  const { wallet, openModal, disconnect } = useWallet();

  const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

  if (wallet) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="font-mono font-bold text-[11px] uppercase px-3 py-2 border-[3px] border-ink bg-acid shadow-[3px_3px_0_0_#0a0a0a]">
          {wallet.balance.toFixed(2)} OKB {short(wallet.address)}
        </span>
        <button
          onClick={disconnect}
          className="font-mono font-bold text-[11px] uppercase px-2.5 py-2 border-[3px] border-ink bg-bone hover:bg-hot transition"
          title="disconnect"
        >
          X
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={openModal}
      className="font-mono font-bold text-[12px] uppercase px-3 py-2 border-[3px] border-ink bg-ink text-bone shadow-[3px_3px_0_0_#c6ff3d] hover:bg-hot hover:!shadow-[3px_3px_0_0_#0a0a0a] transition"
    >
      Connect
    </button>
  );
}
