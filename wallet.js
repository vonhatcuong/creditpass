import { BrowserProvider } from 'https://esm.sh/ethers@6.17.0';

/**
 * Minimal EIP-1193 wallet layer (MetaMask or any injected provider).
 * Exposes connection state, network switching/adding and a signer.
 */

let browserProvider = null;
let account = null;
let chainId = null;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn({ account, chainId }));

export function hasWallet() {
  return typeof window !== 'undefined' && Boolean(window.ethereum);
}

export function getAccount() {
  return account;
}

export function getChainId() {
  return chainId;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function connect() {
  if (!hasWallet()) throw new Error('No wallet detected. Please install MetaMask.');
  browserProvider = new BrowserProvider(window.ethereum);

  const accounts = await browserProvider.send('eth_requestAccounts', []);
  account = accounts[0] || null;
  chainId = Number((await browserProvider.getNetwork()).chainId);

  if (window.ethereum.on) {
    window.ethereum.on('accountsChanged', (accounts) => {
      account = accounts[0] || null;
      emit();
    });
    window.ethereum.on('chainChanged', (hex) => {
      chainId = Number(hex);
      emit();
    });
  }

  emit();
  return account;
}

export function disconnect() {
  account = null;
  chainId = null;
  browserProvider = null;
  emit();
}

export async function getSigner() {
  if (!browserProvider) throw new Error('Wallet not connected');
  return browserProvider.getSigner();
}

function addChainParams(network) {
  return {
    chainId: '0x' + network.chainId.toString(16),
    chainName: network.name,
    nativeCurrency: network.nativeCurrency,
    rpcUrls: [network.rpc],
    blockExplorerUrls: network.explorer ? [network.explorer] : [],
  };
}

/** Switch the wallet to a network, adding it first if the wallet doesn't know it. */
export async function ensureChain(network) {
  if (!hasWallet()) throw new Error('No wallet detected. Please install MetaMask.');
  const hex = '0x' + network.chainId.toString(16);
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
  } catch (error) {
    if (error?.code === 4902 || error?.code === -32603 || error?.data?.originalError?.code === 4902) {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [addChainParams(network)] });
    } else {
      throw error;
    }
  }
  chainId = network.chainId;
  emit();
}
