import { Wallet } from 'ethers';
import { loadEnv, requireEnv } from '../shared/env';
import { attach, provider } from '../shared/artifacts';

/** Prints the verified Credit Passport and the pool state for a borrower. */
async function main() {
  loadEnv();

  const rpc = requireEnv('CREDITCOIN_RPC_URL');
  const p = provider(rpc);
  const borrower = process.env.BORROWER_PRIVATE_KEY
    ? new Wallet(process.env.BORROWER_PRIVATE_KEY).address
    : new Wallet(requireEnv('DEPLOYER_PRIVATE_KEY')).address;

  const asc = attach('CreditPassportASC', requireEnv('CREDIT_PASSPORT_ASC_ADDRESS'), p);
  const policy = attach('CreditPolicy', requireEnv('CREDIT_POLICY_ADDRESS'), p);
  const pool = attach('CreditPool', requireEnv('CREDIT_POOL_ADDRESS'), p);

  const profile = await asc.profileOf(borrower);
  const [score, limit, tier] = await policy.assess(profile);

  const usd = (n: bigint) => `$${(Number(n) / 1e6).toLocaleString('en-US')}`;

  console.log(`\nBorrower: ${borrower}`);
  console.log('Verified Credit Passport');
  console.log(`  collateral:   ${usd(profile.collateralUsd)}`);
  console.log(`  total repaid: ${usd(profile.totalRepaidUsd)}`);
  console.log(`  repayments:   ${profile.repaymentCount} (on-time ${profile.onTimeCount})`);
  console.log(`  income:       ${usd(profile.incomeUsd)}`);
  console.log(`  score:        ${score}/1000  tier: ${tier}`);
  console.log(`  credit limit: ${usd(limit)}`);

  console.log('\nPool');
  console.log(`  total liquidity:   ${usd(await pool.totalLiquidity())}`);
  console.log(`  total outstanding: ${usd(await pool.totalOutstanding())}`);
  console.log(`  loans opened:      ${Number(await pool.nextLoanId()) - 1}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
