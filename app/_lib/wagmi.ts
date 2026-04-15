import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { localhost } from "viem/chains";

// X Layer Mainnet
export const xLayer = defineChain({
  id: 196,
  name: "X Layer Mainnet",
  nativeCurrency: {
    name: "OKB",
    symbol: "OKB",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.xlayer.tech"],
    },
  },
  blockExplorers: {
    default: {
      name: "OKX Explorer",
      url: "https://www.okx.com/explorer/xlayer",
    },
  },
});

// X Layer Testnet (standard)
export const xLayerTestnet = defineChain({
  id: 195,
  name: "X Layer Testnet",
  nativeCurrency: {
    name: "OKB",
    symbol: "OKB",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://testrpc.xlayer.tech"],
    },
  },
  blockExplorers: {
    default: {
      name: "OKX Explorer",
      url: "https://www.okx.com/explorer/xlayer-test",
    },
  },
  testnet: true,
});

// X Layer Sepolia (contracts deployed here - chain 1952)
export const xLayerSepolia = defineChain({
  id: 1952,
  name: "X Layer Sepolia",
  nativeCurrency: {
    name: "OKB",
    symbol: "OKB",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://xlayertestrpc.okx.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "OKX Explorer",
      url: "https://www.okx.com/explorer/xlayer-test",
    },
  },
  testnet: true,
});

// Local Anvil for development
export const anvil = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
  },
  testnet: true,
});

// Note: Get a free project ID at https://cloud.walletconnect.com/
// For local dev without WalletConnect, the app still works with injected wallets (MetaMask, OKX)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Include localhost chain for development
const isDev = process.env.NODE_ENV === "development";

export const config = getDefaultConfig({
  appName: "ALIVE",
  projectId: projectId || "00000000000000000000000000000000", // Dummy ID for dev
  // X Layer Sepolia (1952) first - contracts are deployed there
  chains: isDev ? [xLayerSepolia, xLayerTestnet, anvil, xLayer] : [xLayerSepolia, xLayerTestnet, xLayer],
  ssr: true,
});

// Export flag for components to check
export const hasWalletConnect = !!projectId && projectId !== "your_project_id_here";
