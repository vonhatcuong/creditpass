import { loadEnv, requireEnv, saveDeployment } from '../shared/env';
import { attach, deploy, wallet } from '../shared/artifacts';

/**
 * Optional standalone script: (re)authorize a source-chain emitter and/or seed pool
 * liquidity. Useful when re-running a demo without redeploying everything.
 */
async function main() {
  loadEnv();

  const rpc = requireEnv('CREDITCOIN_RPC_URL');
  const signer = wallet(requireEnv('DEPLOYER_PRIVATE_KEY'), rpc);

  const ascAddress = process.env.CREDIT_PASSPORT_ASC_ADDRESS;
  const poolAddress = process.env.CREDIT_POOL_ADDRESS;
  const usdAddress = process.env.MOCK_USD1_ADDRESS;
  const sourceAddress = process.env.CREDIT_HISTORY_SOURCE_ADDRESS;

  const asc = attach('CreditPassportASC', requireEnv('CREDIT_PASSPORT_ASC_ADDRESS'), signer);

  if (sourceAddress) {
    console.log(`Authorizing source ${sourceAddress}...`);
    await (await asc.setAuthorizedSource(sourceAddress, true)).wait();
    console.log('Authorized.');
  }

  if (poolAddress && usdAddress && process.env.SEED_LIQUIDITY === '1') {
    const usd = attach('TestToken', usdAddress, signer);
    const pool = attach('CreditPool', poolAddress, signer);
    const amount = 1_000_000n * 10n ** 6n;
    await (await usd.mint(signer.address, amount)).wait();
    await (await usd.approve(poolAddress, amount)).wait();
    await (await pool.depositLiquidity(amount)).wait();
    console.log('Seeded 1,000,000 mUSD1 into the pool.');
  }

  saveDeployment('LAST_CONFIRMATION_BLOCK', String(await (signer.provider as any).getBlockNumber()));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
