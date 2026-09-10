import { Contract, EventLog, JsonRpcProvider, Wallet } from 'ethers';
import { loadEnv, requireEnv } from '../shared/env';
import { attach } from '../shared/artifacts';
import { generateProofFor, submitProofToASC } from '../shared/proof';

/**
 * CreditPass off-chain readability worker.
 *
 * For every CreditHistorySource event on the source chain (Sepolia) it:
 *   1. waits for the block to be attested on Creditcoin,
 *   2. generates the Merkle + continuity proof via the Proof Builder,
 *   3. submits the proof to CreditPassportASC.execute(action, ...), where the
 *      Block Prover precompile verifies it synchronously and updates the passport.
 *
 * This is what makes the borrower's history verifiable on Creditcoin without any
 * trusted oracle operator and without deploying anything else on the source chain.
 */

// Action discriminators must match `enum Action` in CreditPassportASC.sol
const ACTION: Record<string, number> = {
  CollateralDeposited: 0,
  RepaymentRecorded: 1,
  IncomeReceived: 2,
};

const POLL_INTERVAL_MS = 5_000;
const MAX_LOG_RANGE = 45; // hosted RPCs often cap eth_getLogs

let shuttingDown = false;
process.on('SIGINT', () => (shuttingDown = true));
process.on('SIGTERM', () => (shuttingDown = true));

async function main() {
  loadEnv();

  const sourceRpcUrl = requireEnv('SOURCE_CHAIN_RPC_URL');
  const ccRpcUrl = requireEnv('CREDITCOIN_RPC_URL');
  const proofBuilderUrl = requireEnv('PROOF_BUILDER_URL');
  const chainKey = Number(requireEnv('SOURCE_CHAIN_KEY'));

  const sourceProvider = new JsonRpcProvider(sourceRpcUrl);
  const ccProvider = new JsonRpcProvider(ccRpcUrl);

  const operator = new Wallet(requireEnv('DEPLOYER_PRIVATE_KEY'), ccProvider);

  const source = attach('CreditHistorySource', requireEnv('CREDIT_HISTORY_SOURCE_ADDRESS'), sourceProvider);
  const asc = attach('CreditPassportASC', requireEnv('CREDIT_PASSPORT_ASC_ADDRESS'), operator);

  // Start from a configurable block so previously-emitted history is also proved.
  // Defaults to a ~6.5h lookback on Sepolia so a demo run is picked up automatically.
  let fromBlock: number;
  if (process.env.SOURCE_START_BLOCK) {
    fromBlock = Number(process.env.SOURCE_START_BLOCK);
  } else {
    const head = await sourceProvider.getBlockNumber();
    fromBlock = Math.max(0, head - 2000);
  }
  const processed = new Set<string>();

  console.log('CreditPass worker started.');
  console.log(`  chainKey:   ${chainKey}`);
  console.log(`  source:     ${await source.getAddress()}`);
  console.log(`  passport:   ${await asc.getAddress()}`);
  console.log(`  from block: ${fromBlock}`);

  while (!shuttingDown) {
    try {
      const current = await sourceProvider.getBlockNumber();
      // Scan every event type over the SAME block range before advancing.
      for (const eventName of Object.keys(ACTION)) {
        await processEvent(
          eventName,
          source,
          asc,
          sourceProvider,
          ccProvider,
          proofBuilderUrl,
          chainKey,
          fromBlock,
          current,
          processed,
        );
      }
      fromBlock = current + 1;
    } catch (error: any) {
      console.error('Polling error:', error?.shortMessage ?? error?.message ?? error);
    }
    await sleep(POLL_INTERVAL_MS);
  }

  console.log('Worker stopped.');
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
): Promise<void> {
  if (fromBlock > toBlock) return;

  let start = fromBlock;
  while (start <= toBlock) {
    const end = Math.min(start + MAX_LOG_RANGE - 1, toBlock);
    let events: EventLog[] = [];
    try {
      events = (await source.queryFilter(eventName, start, end)) as EventLog[];
    } catch (error: any) {
      console.warn(`queryFilter ${eventName} [${start}-${end}] failed: ${error?.shortMessage ?? error}`);
      start = end + 1;
      continue;
    }

    for (const event of events) {
      const key = `${event.transactionHash}:${event.index}:${eventName}`;
      if (processed.has(key)) continue;
      processed.add(key);
      await prove(eventName, event.transactionHash, asc, sourceProvider, ccProvider, proofBuilderUrl, chainKey);
    }
    start = end + 1;
  }
}

async function prove(
  eventName: string,
  txHash: string,
  asc: Contract,
  sourceProvider: JsonRpcProvider,
  ccProvider: JsonRpcProvider,
  proofBuilderUrl: string,
  chainKey: number,
) {
  console.log(`\n[${eventName}] ${txHash}`);
  try {
    const proof = await generateProofFor(txHash, chainKey, proofBuilderUrl, ccProvider, sourceProvider);
    if (!proof.success || !proof.data) {
      console.error(`  proof failed: ${proof.error}`);
      return;
    }

    const response = await submitProofToASC(asc, ACTION[eventName], proof.data);
    const receipt = await response.wait();
    console.log(`  passport updated on Creditcoin: ${receipt.hash}`);
  } catch (error: any) {
    console.error(`  ${eventName} failed: ${error?.shortMessage ?? error?.message ?? error}`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
