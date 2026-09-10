import { Wallet } from 'ethers';
import { loadEnv, requireEnv } from '../shared/env';
import { attach, wallet } from '../shared/artifacts';

const DEC = 10n ** 6n; // 6-decimal USD units
const usd = (n: number | bigint) => BigInt(n) * DEC;

/**
 * Generates a realistic borrower history on Ethereum Sepolia:
 *   - deposits collateral
 *   - takes and repays 5 on-time installments through MockLendingVenue
 *   - the deployer (a recorder) attests verified income
 *
 * Every event emitted here is later proven on Creditcoin by the worker.
 */
async function main() {
  loadEnv();

  const rpc = requireEnv('SOURCE_CHAIN_RPC_URL');
  const deployerKey = requireEnv('DEPLOYER_PRIVATE_KEY');
  const borrowerKey = process.env.BORROWER_PRIVATE_KEY || deployerKey;

  const deployer = wallet(deployerKey, rpc);
  const borrower = wallet(borrowerKey, rpc);

  const tokenAddress = requireEnv('SOURCE_CHAIN_COLLATERAL_TOKEN_ADDRESS');
  const sourceAddress = requireEnv('CREDIT_HISTORY_SOURCE_ADDRESS');
  const venueAddress = requireEnv('MOCK_LENDING_VENUE_ADDRESS');

  const token = attach('TestToken', tokenAddress, borrower);
  const source = attach('CreditHistorySource', sourceAddress, borrower);
  const venue = attach('MockLendingVenue', venueAddress, borrower);

  console.log(`Borrower: ${borrower.address}`);
  const hashes: string[] = [];
  const track = async (label: string, txPromise: Promise<any>) => {
    const tx = await txPromise;
    const receipt = await tx.wait();
    hashes.push(receipt.hash);
    console.log(`${label}: ${receipt.hash}`);
  };

  await track('approve(source)', token.approve(sourceAddress, usd(50_000)));
  await track('approve(venue)', token.approve(venueAddress, usd(50_000)));

  // 1. Lock collateral.
  await track('CollateralDeposited', source.depositCollateral(usd(5_000)));

  // 2. Five on-time repayments through the venue.
  for (let i = 0; i < 5; i++) {
    await track(`borrow#${i}`, venue.borrow(usd(200)));
    await track(`RepaymentRecorded#${i}`, venue.repay(i, usd(200), true));
  }

  // 3. Verified income attested by the recruiter (deployer is a recorder).
  const sourceAsRecorder = attach('CreditHistorySource', sourceAddress, deployer);
  await track('IncomeReceived', sourceAsRecorder.recordIncome(borrower.address, usd(1_500), tokenAddress));

  console.log('\nSource-chain history created. Transaction hashes:');
  for (const h of hashes) console.log(`  ${h}`);
  console.log('\nStart the worker to prove these on Creditcoin: npm run worker:start');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
