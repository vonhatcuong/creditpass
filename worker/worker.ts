import path from 'node:path';
import { Contract, EventLog, JsonRpcProvider, Wallet } from 'ethers';
import { loadEnv, requireEnv, ROOT_DIR } from '../shared/env';
import { attach } from '../shared/artifacts';
import { generateProofFor, submitProofToASC } from '../shared/proof';
import { Telemetry, log } from '../shared/telemetry';

/**
 * CreditPass off-chain readability worker.
 *
 * For every CreditHistorySource event on the source chain (Sepolia) it:
 *   1. waits for the block to be attested on Creditcoin,
 *   2. generates the Merkle + continuity proof via the Proof Builder,
 *   3. submits the proof to CreditPassportASC.execute(action, ...), where the
 *      Block Prover precompile verifies it synchronously and updates the passport.
 *
 * Progress is emitted as structured logs and to web/telemetry.json (for the dashboard).
 */

const ACTION: Record<string, number> = {
  CollateralDeposited: 0,
  RepaymentRecorded: 1,
  IncomeReceived: 2,
};

const POLL_INTERVAL_MS = 5_000;
const MAX_LOG_RANGE = 45;

let shuttingDown = false;
process.on('SIGINT', () => (shuttingDown = true));
process.on('SIGTERM', () => (shuttingDown = true));

function describeEvent(eventName: string, args: any): { base: any; action: number } {
  if (eventName === 'CollateralDeposited') {
    return { action: 0, base: { type: eventName, user: args[0], amount: args[1].toString() } };
  }
  if (eventName === 'RepaymentRecorded') {
    return { action: 1, base: { type: eventName, user: args[0], amount: args[2].toString(), onTime: args[3] } };
  }
  return { action: 2, base: { type: eventName, user: args[0], amount: args[1].toString() } };
}

async function main() {
  loadEnv();

  const sourceRpcUrl = requireEnv('SOURCE_CHAIN_RPC_URL');
  const ccRpcUrl = requireEnv('CREDITCOIN_RPC_URL');
  const proofBuilderUrl = requireEnv('PROOF_BUILDER_URL');
  const chainKey = Number(requireEnv('SOURCE_CHAIN_KEY'));

  const sourceProvider = new JsonRpcProvider(sourceRpcUrl);
  const ccProvider = new JsonRpcProvider(ccRpcUrl);
  const operator = new Wallet(requireEnv('DEPLOYER_PRIVATE_KEY'), ccProvider);

  const sourceAddress = requireEnv('CREDIT_HISTORY_SOURCE_ADDRESS');
  const passportAddress = requireEnv('CREDIT_PASSPORT_ASC_ADDRESS');
  const source = attach('CreditHistorySource', sourceAddress, sourceProvider);
  const asc = attach('CreditPassportASC', passportAddress, operator);

  const telemetry = new Telemetry(path.join(ROOT_DIR, 'web', 'telemetry.json'), {
    chainKey,
    source: sourceAddress,
    passport: passportAddress,
  });

  let fromBlock: number;
  if (process.env.SOURCE_START_BLOCK) {
    fromBlock = Number(process.env.SOURCE_START_BLOCK);
  } else {
    const head = await sourceProvider.getBlockNumber();
    fromBlock = Math.max(0, head - 2000);
  }
  const processed = new Set<string>();

  log('WORKER', 'started', { chainKey, source: sourceAddress, passport: passportAddress, fromBlock });

  while (!shuttingDown) {
    try {
      const current = await sourceProvider.getBlockNumber();
      for (const eventName of Object.keys(ACTION)) {
        await processEvent(eventName, source, asc, sourceProvider, ccProvider, proofBuilderUrl, chainKey, fromBlock, current, processed, telemetry);
      }
      fromBlock = current + 1;
    } catch (error: any) {
      log('WORKER', 'polling error', { error: error?.shortMessage ?? error?.message });
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  log('WORKER', 'stopped');
  process.exit(0);
}

async function processEvent(
  eventName: string,
  source: Contract,
  asc: Contract,
  sourceProvider: JsonRpcProvider,
  ccProvider: JsonRpcProvider,
  proofBuilderUrl: string,
  chainKey: number,
  fromBlock: number,
  toBlock: number,
  processed: Set<string>,
  telemetry: Telemetry,
): Promise<void> {
  if (fromBlock > toBlock) return;
  let start = fromBlock;
  while (start <= toBlock) {
    const end = Math.min(start + MAX_LOG_RANGE - 1, toBlock);
    let events: EventLog[] = [];
    try {
      events = (await source.queryFilter(eventName, start, end)) as EventLog[];
    } catch (error: any) {
      log('WORKER', 'queryFilter failed', { event: eventName, from: start, to: end, error: error?.shortMessage ?? error });
      start = end + 1;
      continue;
    }

    for (const event of events) {
      const id = `${event.transactionHash}:${event.index}:${eventName}`;
      if (processed.has(id)) continue;
      processed.add(id);

      const { base, action } = describeEvent(eventName, event.args);
      telemetry.emitted({ id, ...base, sourceTx: event.transactionHash, sourceBlock: event.blockNumber });
      log('DETECT', eventName, { user: String(base.user).slice(0, 10), amount: base.amount, block: event.blockNumber, tx: event.transactionHash.slice(0, 12) });

      await prove(id, event.transactionHash, action, asc, sourceProvider, ccProvider, proofBuilderUrl, chainKey, telemetry);
    }
    start = end + 1;
  }
}

async function prove(
  id: string,
  txHash: string,
  action: number,
  asc: Contract,
  sourceProvider: JsonRpcProvider,
  ccProvider: JsonRpcProvider,
  proofBuilderUrl: string,
  chainKey: number,
  telemetry: Telemetry,
) {
  try {
    const proof = await generateProofFor(txHash, chainKey, proofBuilderUrl, ccProvider, sourceProvider, (s) => {
      if (s.phase === 'attesting') telemetry.attesting(id, s.latestAttested ?? 0, s.blockNumber ?? 0);
      if (s.phase === 'attested') telemetry.attested(id, s.blockNumber ?? 0);
    });

    if (!proof.success || !proof.data) throw new Error(proof.error || 'proof generation failed');

    const response = await submitProofToASC(asc, action, proof.data);
    const receipt = await response.wait();
    telemetry.proved(id, receipt.hash);
    log('RESULT', 'passport updated on Creditcoin', { tx: receipt.hash, action });
  } catch (error: any) {
    const message = error?.shortMessage ?? error?.message ?? String(error);
    telemetry.failed(id, message);
    log('ERROR', 'prove failed', { tx: txHash.slice(0, 12), error: message });
  }
}

main().catch((error) => {
  log('FATAL', error?.message ?? String(error));
  process.exit(1);
});
