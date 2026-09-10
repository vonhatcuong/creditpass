import { Wallet } from 'ethers';
import { loadEnv, requireEnv, saveDeployment } from '../shared/env';
import { deploy, provider, wallet } from '../shared/artifacts';

/**
 * Deploys the source-chain stack on Ethereum Sepolia:
 *   1. TestToken          - borrower collateral (18 decimals)
 *   2. CreditHistorySource - emits the events CreditPassportASC proves on Creditcoin
 *   3. MockLendingVenue    - produces credible repayment history
 *
 * Then authorizes the venue as a recorder and funds the demo accounts.
 */
async function main() {
  loadEnv();

  const rpc = requireEnv('SOURCE_CHAIN_RPC_URL');
  const deployerKey = requireEnv('DEPLOYER_PRIVATE_KEY');
  const borrowerKey = process.env.BORROWER_PRIVATE_KEY || deployerKey;

  const signer = wallet(deployerKey, rpc);
  const borrower = new Wallet(borrowerKey).address;
  console.log(`Network RPC: ${rpc}`);
  console.log(`Deployer:    ${signer.address}`);
  console.log(`Borrower:    ${borrower}`);

  const token = await deploy('TestToken', signer, ['Credit USD', 'cUSD', 6]);
  const tokenAddress = await token.getAddress();
  console.log(`TestToken (collateral): ${tokenAddress}`);

  const source = await deploy('CreditHistorySource', signer, [tokenAddress]);
  const sourceAddress = await source.getAddress();
  console.log(`CreditHistorySource:    ${sourceAddress}`);

  const venue = await deploy('MockLendingVenue', signer, [tokenAddress, sourceAddress]);
  const venueAddress = await venue.getAddress();
  console.log(`MockLendingVenue:       ${venueAddress}`);

  console.log('Authorizing venue as recorder...');
  await (await source.setRecorder(venueAddress, true)).wait();
  console.log('Authorizing deployer as recorder (for income history)...');
  await (await source.setRecorder(signer.address, true)).wait();

  // Fund the demo: venue lends, borrower posts collateral.
  console.log('Minting demo collateral...');
  await (await token.mint(venueAddress, 10_000n * 10n ** 6n)).wait();
  await (await token.mint(borrower, 10_000n * 10n ** 6n)).wait();

  saveDeployment('SOURCE_CHAIN_COLLATERAL_TOKEN_ADDRESS', tokenAddress);
  saveDeployment('CREDIT_HISTORY_SOURCE_ADDRESS', sourceAddress);
  saveDeployment('MOCK_LENDING_VENUE_ADDRESS', venueAddress);

  console.log('\nSaved addresses to deployments.json');
  console.log('Next: run "npm run deploy:creditcoin"');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
