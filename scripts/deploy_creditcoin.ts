import { loadEnv, requireEnv, saveDeployment } from '../shared/env';
import { deploy, wallet } from '../shared/artifacts';

/**
 * Deploys the Creditcoin stack:
 *   1. Mock USD1 (lending liquidity, 6 decimals)
 *   2. CreditPassportASC  - verifies Attestcoin proofs, stores the verified Credit Passport
 *   3. CreditPolicy       - deterministic underwriting
 *   4. CreditPool         - lending pool gated by the passport
 *
 * Then authorizes the source contract as a trusted emitter and seeds pool liquidity.
 */
async function main() {
  loadEnv();

  const rpc = requireEnv('CREDITCOIN_RPC_URL');
  const deployerKey = requireEnv('DEPLOYER_PRIVATE_KEY');
  const sourceAddress = requireEnv('CREDIT_HISTORY_SOURCE_ADDRESS');

  const signer = wallet(deployerKey, rpc);
  console.log(`Creditcoin RPC: ${rpc}`);
  console.log(`Deployer:       ${signer.address}`);
  console.log(`Trusted source: ${sourceAddress}`);

  const usd = await deploy('TestToken', signer, ['Mock USD1', 'mUSD1', 6]);
  const usdAddress = await usd.getAddress();
  console.log(`Mock USD1:            ${usdAddress}`);

  const asc = await deploy('CreditPassportASC', signer, []);
  const ascAddress = await asc.getAddress();
  console.log(`CreditPassportASC:    ${ascAddress}`);

  const policy = await deploy('CreditPolicy', signer, []);
  const policyAddress = await policy.getAddress();
  console.log(`CreditPolicy:         ${policyAddress}`);

  const pool = await deploy('CreditPool', signer, [usdAddress, ascAddress, policyAddress]);
  const poolAddress = await pool.getAddress();
  console.log(`CreditPool:           ${poolAddress}`);

  console.log('Authorizing CreditHistorySource as a trusted emitter...');
  await (await asc.setAuthorizedSource(sourceAddress, true)).wait();

  console.log('Setting the AI underwriting agent...');
  await (await pool.setUnderwriter(signer.address)).wait();

  console.log('Seeding pool liquidity (1,000,000 mUSD1)...');
  const liquidity = 1_000_000n * 10n ** 6n;
  await (await usd.mint(signer.address, liquidity)).wait();
  await (await usd.approve(poolAddress, liquidity)).wait();
  await (await pool.depositLiquidity(liquidity)).wait();

  saveDeployment('MOCK_USD1_ADDRESS', usdAddress);
  saveDeployment('CREDIT_PASSPORT_ASC_ADDRESS', ascAddress);
  saveDeployment('CREDIT_POLICY_ADDRESS', policyAddress);
  saveDeployment('CREDIT_POOL_ADDRESS', poolAddress);

  console.log('\nSaved addresses to deployments.json');
  console.log('Next: run "npm run history:simulate" then "npm run worker:start"');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
