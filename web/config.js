// ---------------------------------------------------------------------------
// CreditPass dApp config.
//
// Fill `addresses` after running:
//   npm run deploy:source && npm run deploy:creditcoin
// (addresses are also written to deployments.json at the repo root)
//
// `borrower` is the default address whose passport is shown when no wallet is
// connected. Networks below are used by the wallet layer for switch/add.
// ---------------------------------------------------------------------------
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
    passport: '', // CREDIT_PASSPORT_ASC_ADDRESS   (Creditcoin)
    policy: '', // CREDIT_POLICY_ADDRESS         (Creditcoin)
    pool: '', // CREDIT_POOL_ADDRESS           (Creditcoin)
    usd: '', // MOCK_USD1_ADDRESS             (Creditcoin)
    source: '', // CREDIT_HISTORY_SOURCE_ADDRESS (Sepolia)
    venue: '', // MOCK_LENDING_VENUE_ADDRESS    (Sepolia)
    collateral: '', // SOURCE_CHAIN_COLLATERAL_TOKEN_ADDRESS (Sepolia)
  },

  borrower: '', // default passport address when no wallet is connected
  refreshMs: 15000,
};
