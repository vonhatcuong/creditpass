import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  Contract,
  ContractFactory,
  JsonRpcProvider,
  NonceManager,
  Wallet,
  keccak256,
  toUtf8Bytes,
} from 'ethers';
import { loadArtifact } from '../shared/artifacts';
import { ROOT_DIR } from '../shared/env';
import { Telemetry, log } from '../shared/telemetry';

/**
 * Local end-to-end run of CreditPass on two Anvil devnets.
 *
 *   chain A (port 8571, Sepolia-like)     -> source contracts + borrower history
 *   chain B (port 8572, Creditcoin-like)  -> passport ASC + policy + pool
 *
 * The real proof path needs the block-prover precompile (0xFD2) which only exists on
 * Creditcoin, so on localhost we simulate the worker+precompile by calling
 * CreditPassportASC.applyLocalEvent (owner-gated local mode). The state transitions,
 * underwriting and lending are the exact same code paths used on testnet.
 */

const SOURCE_PORT = Number(process.env.LOCAL_SOURCE_PORT || 8571);
const CC_PORT = Number(process.env.LOCAL_CC_PORT || 8572);
const SOURCE_RPC = `http://127.0.0.1:${SOURCE_PORT}`;
const CC_RPC = `http://127.0.0.1:${CC_PORT}`;
const SOURCE_CHAIN_ID = 11155112; // "Local Sepolia" (unique so wallets don't confuse it with real Sepolia)
const CC_CHAIN_ID = 102032; // "Local Creditcoin" (unique vs CC3 testnet's 102031)

const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const BORROWER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const USD = 10n ** 6n;
const usd = (n: number | bigint) => BigInt(n) * USD;
const fmt = (n: bigint) => '$' + (Number(n) / 1e6).toLocaleString('en-US');

function resolveAnvil(): string {
  if (process.env.ANVIL_PATH) return process.env.ANVIL_PATH;
  const home = path.join(os.homedir(), '.foundry', 'bin', 'anvil');
  if (fs.existsSync(home)) return home;
  return 'anvil';
}

function startAnvil(port: number, chainId: number): ChildProcess {
  const child = spawn(resolveAnvil(), ['--port', String(port), '--chain-id', String(chainId), '--silent'], {
    stdio: 'ignore',
  });
  child.on('error', (err) => {
    console.error(`Failed to start anvil on :${port}. Is Foundry installed?\n`, err.message);
    process.exit(1);
  });
  return child;
}

async function waitForRpc(rpc: string, chainId: number, timeoutMs = 15_000): Promise<JsonRpcProvider> {
  const provider = new JsonRpcProvider(rpc, chainId, { staticNetwork: true });
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await provider.getBlockNumber();
      return provider;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error(`RPC not ready: ${rpc}`);
}

async function deployOn(name: string, signer: NonceManager, args: unknown[]): Promise<Contract> {
  const { abi, bytecode } = loadArtifact(name);
  const factory = new ContractFactory(abi, bytecode.object, signer);
  const contract = await factory.deploy(...(args as any[]));
  await contract.waitForDeployment();
  return contract as unknown as Contract;
}

async function main() {
  console.log('Starting local devnets...');
  const anvilSource = startAnvil(SOURCE_PORT, SOURCE_CHAIN_ID);
  const anvilCc = startAnvil(CC_PORT, CC_CHAIN_ID);

  try {
    const sourceProvider = await waitForRpc(SOURCE_RPC, SOURCE_CHAIN_ID);
    const ccProvider = await waitForRpc(CC_RPC, CC_CHAIN_ID);

    const deployer = new NonceManager(new Wallet(DEPLOYER_KEY, sourceProvider));
    const borrower = new NonceManager(new Wallet(BORROWER_KEY, sourceProvider));
    const ccDeployer = new NonceManager(new Wallet(DEPLOYER_KEY, ccProvider));
    const deployerAddr = await deployer.getAddress();
    const borrowerAddr = await borrower.getAddress();

    console.log(`Deployer: ${deployerAddr}`);
    console.log(`Borrower: ${borrowerAddr}\n`);

    // ---------- source chain ----------
    console.log('== Source chain (Sepolia-like) ==');
    const token = await deployOn('TestToken', deployer, ['Credit USD', 'cUSD', 6]);
    const source = await deployOn('CreditHistorySource', deployer, [await token.getAddress()]);
    const venue = await deployOn('MockLendingVenue', deployer, [await token.getAddress(), await source.getAddress()]);
    const tokenAddr = await token.getAddress();
    const sourceAddr = await source.getAddress();
    const venueAddr = await venue.getAddress();
    console.log(`  TestToken            ${tokenAddr}`);
    console.log(`  CreditHistorySource  ${sourceAddr}`);
    console.log(`  MockLendingVenue     ${venueAddr}`);

    await (await source.setRecorder(venueAddr, true)).wait();
    await (await source.setRecorder(deployerAddr, true)).wait();
    await (await token.mint(venueAddr, usd(50_000))).wait();
    await (await token.mint(borrowerAddr, usd(50_000))).wait();

    console.log('\n  Borrower history:');
    const tokenB = token.connect(borrower) as Contract;
    const sourceB = source.connect(borrower) as Contract;
    const venueB = venue.connect(borrower) as Contract;
    await (await tokenB.approve(sourceAddr, usd(50_000))).wait();
    await (await tokenB.approve(venueAddr, usd(50_000))).wait();
    await (await sourceB.depositCollateral(usd(5_000))).wait();
    console.log('    collateral locked: $5,000');
    for (let i = 0; i < 5; i++) {
      await (await venueB.borrow(usd(200))).wait();
      await (await venueB.repay(i, usd(200), true)).wait();
    }
    console.log('    5 on-time repayments: $1,000');
    const sourceRecorder = source.connect(deployer) as Contract;
    await (await sourceRecorder.recordIncome(borrowerAddr, usd(1_500), tokenAddr)).wait();
    console.log('    income attested: $1,500');

    // ---------- creditcoin chain ----------
    console.log('\n== Creditcoin chain (Creditcoin-like) ==');
    const usdToken = await deployOn('TestToken', ccDeployer, ['Mock USD1', 'mUSD1', 6]);
    const asc = await deployOn('CreditPassportASC', ccDeployer, []);
    const policy = await deployOn('CreditPolicy', ccDeployer, []);
    const usdTokenAddr = await usdToken.getAddress();
    const pool = await deployOn('CreditPool', ccDeployer, [
      usdTokenAddr,
      await asc.getAddress(),
      await policy.getAddress(),
    ]);
    const ascAddr = await asc.getAddress();
    const policyAddr = await policy.getAddress();
    const poolAddr = await pool.getAddress();
    console.log(`  CreditPassportASC  ${ascAddr}`);
    console.log(`  CreditPolicy       ${policyAddr}`);
    console.log(`  CreditPool         ${poolAddr}`);

    await (await asc.setAuthorizedSource(sourceAddr, true)).wait();
    await (await asc.setLocalMode(true)).wait(); // local devnet only: simulate the precompile path
    await (await pool.setUnderwriter(ccDeployer)).wait();

    const liquidity = usd(1_000_000);
    await (await usdToken.mint(deployerAddr, liquidity)).wait();
    await (await usdToken.approve(poolAddr, liquidity)).wait();
    await (await pool.depositLiquidity(liquidity)).wait();
    console.log(`  liquidity seeded   ${fmt(liquidity)}`);

    // ---------- local relayer: events -> passport ----------
    const telemetry = new Telemetry(path.join(ROOT_DIR, 'web', 'telemetry.json'), {
      chainKey: 1,
      source: sourceAddr,
      passport: ascAddr,
    });
    log('RELAYER', 'started (local mode: simulates worker + precompile)');
    const relayed = new Set<string>();
    const relay = async () => {
      const head = await sourceProvider.getBlockNumber();
      telemetry.setLatestAttestedHeight(head);
      const events = [
        ...(await source.queryFilter('CollateralDeposited', 0, 'latest')),
        ...(await source.queryFilter('RepaymentRecorded', 0, 'latest')),
        ...(await source.queryFilter('IncomeReceived', 0, 'latest')),
      ] as any[];
      let applied = 0;
      for (const e of events) {
        const id = `${e.transactionHash}:${e.index}:${e.fragment.name}`;
        if (relayed.has(id)) continue;
        relayed.add(id);
        const name = e.fragment.name;
        let base: any;
        let action: number;
        if (name === 'CollateralDeposited') {
          action = 0;
          base = { type: name, user: e.args[0], amount: e.args[1].toString() };
        } else if (name === 'RepaymentRecorded') {
          action = 1;
          base = { type: name, user: e.args[0], amount: e.args[2].toString(), onTime: e.args[3] };
        } else {
          action = 2;
          base = { type: name, user: e.args[0], amount: e.args[1].toString() };
        }
        telemetry.emitted({ id, ...base, sourceTx: e.transactionHash, sourceBlock: e.blockNumber });
        try {
          const tx =
            action === 0
              ? asc.applyLocalEvent(0, e.args[0], e.args[1], false)
              : action === 1
                ? asc.applyLocalEvent(1, e.args[0], e.args[2], e.args[3])
                : asc.applyLocalEvent(2, e.args[0], e.args[1], false);
          const receipt = await (await tx).wait();
          telemetry.attested(id, e.blockNumber);
          telemetry.proved(id, receipt.hash);
          log('PROVE', name, { user: String(base.user).slice(0, 10), amount: base.amount, tx: receipt.hash.slice(0, 12) });
          applied++;
        } catch (err: any) {
          relayed.delete(id);
          telemetry.failed(id, err?.shortMessage ?? err?.message ?? String(err));
        }
      }
      return applied;
    };
    const appliedNow = await relay();
    log('RELAYER', 'initial proof complete', { events: appliedNow });

    // ---------- AI underwriting ----------
    console.log('\n== AI underwriting ==');
    const profile = await asc.profileOf(borrowerAddr);
    const assessment = await policy.assess([
      profile[0], profile[1], profile[2], profile[3], profile[4], profile[5], profile[6],
    ]);
    const score = Number(assessment[0]);
    const limit = BigInt(assessment[1]);
    console.log(`  verified score: ${score}/1000`);
    console.log(`  verified limit: ${fmt(limit)}`);

    const rationale = `Approve ${fmt(limit)} within verified limit for ${borrowerAddr}. Score ${score}/1000. Inputs proven by Attestcoin.`;
    const decisionHash = keccak256(toUtf8Bytes(rationale));
    const tx = await (pool as Contract).underwrite(borrowerAddr, limit, decisionHash, 'local://rationale');
    const receipt = await tx.wait();
    console.log(`  loan disbursed: tx ${receipt.hash}`);

    const finalProfile = await asc.profileOf(borrowerAddr);
    const poolLiquidity = await pool.totalLiquidity();
    const outstanding = await pool.totalOutstanding();
    const borrowerUsd = await usdToken.balanceOf(borrowerAddr);

    console.log('\n== Result ==');
    console.log(`  passport:  collateral ${fmt(finalProfile[0])} | repaid ${fmt(finalProfile[1])} | income ${fmt(finalProfile[4])}`);
    console.log(`  score:     ${score}/1000 (limit ${fmt(limit)})`);
    console.log(`  pool:      liquidity ${fmt(poolLiquidity)} | outstanding ${fmt(outstanding)}`);
    console.log(`  borrower:  received ${fmt(borrowerUsd)} mUSD1`);
    console.log('\nLOCAL END-TO-END: OK');

    if (process.env.LOCAL_KEEP_ALIVE === '1') {
      const localConfig = {
        creditcoin: {
          name: 'Local Creditcoin', rpc: CC_RPC, explorer: '', chainId: CC_CHAIN_ID,
          nativeCurrency: { name: 'Creditcoin', symbol: 'CTC', decimals: 18 },
          lookback: 100000, chunk: 10000,
        },
        sepolia: {
          name: 'Local Sepolia', rpc: SOURCE_RPC, explorer: '', chainId: SOURCE_CHAIN_ID,
          nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
          lookback: 100000, chunk: 10000,
        },
        addresses: {
          passport: ascAddr, policy: policyAddr, pool: poolAddr,
          usd: usdTokenAddr, source: sourceAddr, venue: venueAddr, collateral: tokenAddr,
        },
        borrower: borrowerAddr,
        refreshMs: 5000,
      };
      fs.writeFileSync(path.join(ROOT_DIR, 'web', 'config.local.json'), JSON.stringify(localConfig, null, 2));

      // Background relayer: keeps proving new source-chain events while the dashboard is open.
      const relayTimer = setInterval(() => {
        relay()
          .then((n) => { if (n > 0) log('RELAYER', 'proved new events', { count: n }); })
          .catch(() => {});
      }, 5000);

      const shutdown = () => {
        clearInterval(relayTimer);
        anvilSource.kill('SIGKILL');
        anvilCc.kill('SIGKILL');
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      console.log('\nDevnets kept alive (LOCAL_KEEP_ALIVE=1).');
      console.log('  Dashboard: run "npm run serve" and open http://localhost:3000');
      console.log(`  Networks: Local Creditcoin chainId ${CC_CHAIN_ID}, Local Sepolia chainId ${SOURCE_CHAIN_ID}`);
      console.log('  web/config.local.json written; background relayer is running.');
      console.log('  Press Ctrl+C to stop the devnets.');
      await new Promise(() => {});
    }
  } finally {
    anvilSource.kill('SIGKILL');
    anvilCc.kill('SIGKILL');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
