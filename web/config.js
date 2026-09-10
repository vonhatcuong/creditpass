// ---------------------------------------------------------------------------
// CreditPass dashboard config.
//
// Fill `addresses` after running:
//   npm run deploy:source && npm run deploy:creditcoin
// (addresses are also written to deployments.json at the repo root)
//
// `borrower` is the address whose Credit Passport you want to show. If left
// empty, the dashboard falls back to the pool's underwriter address.
// ---------------------------------------------------------------------------
export const CONFIG = {
  creditcoin: {
    name: 'Creditcoin CC3 Testnet',
    rpc: 'https://rpc.cc3-testnet.creditcoin.network',
    explorer: 'https://creditcoin-testnet.blockscout.com',
    lookback: 40000, // blocks of history to scan for the activity feed
    chunk: 4000,
  },
  sepolia: {
    name: 'Ethereum Sepolia',
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.etherscan.io',
    lookback: 4000,
    chunk: 2000,
  },

  addresses: {
    passport: '', // CREDIT_PASSPORT_ASC_ADDRESS  (Creditcoin)
    policy: '', // CREDIT_POLICY_ADDRESS        (Creditcoin)
    pool: '', // CREDIT_POOL_ADDRESS          (Creditcoin)
    source: '', // CREDIT_HISTORY_SOURCE_ADDRESS (Sepolia)
  },

  borrower: '', // borrower address (same key on both chains)

  refreshMs: 15000,
};
