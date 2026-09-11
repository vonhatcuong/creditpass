import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { BrowserProvider } from 'ethers';
import { CONFIG } from './config';

type Net = typeof CONFIG.creditcoin | typeof CONFIG.sepolia;

interface WalletState {
  account: string | null;
  chainId: number | null;
  connect(): Promise<void>;
  disconnect(): void;
  ensureChain(n: Net): Promise<void>;
  getSigner(): Promise<any>;
}

const Ctx = createContext<WalletState>({
  account: null,
  chainId: null,
  connect: async () => {},
  disconnect: () => {},
  ensureChain: async () => {},
  getSigner: async () => {
    throw new Error('Wallet not connected');
  },
});

export const useWallet = () => useContext(Ctx);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);

  // Single subscription — fixes web/wallet.js:40-49 duplicate listeners on every connect().
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth?.on) return;
    const onAcct = (a: string[]) => setAccount(a[0] || null);
    const onChain = (hex: string) => setChainId(Number(hex));
    eth.on('accountsChanged', onAcct);
    eth.on('chainChanged', onChain);
    return () => {
      eth.removeListener?.('accountsChanged', onAcct);
      eth.removeListener?.('chainChanged', onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) throw new Error('No wallet detected. Please install MetaMask.');
    const p = new BrowserProvider(eth);
    const accts: string[] = await p.send('eth_requestAccounts', []);
    setProvider(p);
    setAccount(accts[0] || null);
    setChainId(Number((await p.getNetwork()).chainId));
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setProvider(null);
  }, []);

  const ensureChain = useCallback(async (n: Net) => {
    const eth = (window as any).ethereum;
    if (!eth) throw new Error('No wallet detected. Please install MetaMask.');
    const hex = '0x' + n.chainId.toString(16);
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    } catch (e: any) {
      if (e?.code === 4902) {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: hex,
              chainName: n.name,
              nativeCurrency: n.nativeCurrency,
              rpcUrls: [n.rpc],
              blockExplorerUrls: n.explorer ? [n.explorer] : [],
            },
          ],
        });
      } else {
        throw e;
      }
    }
    setChainId(n.chainId);
  }, []);

  const getSigner = useCallback(async () => {
    if (!provider) throw new Error('Wallet not connected');
    return provider.getSigner();
  }, [provider]);

  return (
    <Ctx.Provider value={{ account, chainId, connect, disconnect, ensureChain, getSigner }}>
      {children}
    </Ctx.Provider>
  );
}
