// Port of web/config.js:11-45 + local override helper from web/app.js:55-68.

export const CONFIG = {
  creditcoin: {
    key: 'creditcoin',
    name: 'Creditcoin CC3 Testnet',
    rpc: 'https://rpc.cc3-testnet.creditcoin.network',
    explorer: 'https://creditcoin-testnet.blockscout.com',
    chainId: 102031,
    nativeCurrency: { name: 'Creditcoin', symbol: 'CTC', decimals: 18 },
    lookback: 40000,
    chunk: 4000,
  },
  sepolia: {
    key: 'sepolia',
    name: 'Ethereum Sepolia',
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.etherscan.io',
    chainId: 11155111,
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    lookback: 4000,
    chunk: 2000,
  },
  addresses: {
    passport: '',
    policy: '',
    pool: '',
    usd: '',
    source: '',
    venue: '',
    collateral: '',
  },
  borrower: '',
  refreshMs: 15000,
};

export async function applyLocalOverrides(cfg: typeof CONFIG = CONFIG as any) {
  try {
    const res = await fetch('/config.local.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const o = await res.json();
    if (o.addresses) Object.assign(cfg.addresses, o.addresses);
    if (o.creditcoin) Object.assign(cfg.creditcoin, o.creditcoin);
    if (o.sepolia) Object.assign(cfg.sepolia, o.sepolia);
    return true;
  } catch {
    return false;
  }
}
