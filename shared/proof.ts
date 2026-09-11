import { Contract, JsonRpcApiProvider } from 'ethers';
import { proofProvider, chainInfo } from '@gluwa/usc-sdk';
import { log, sleep } from './telemetry';

export type ProofPhase = 'mined' | 'attesting' | 'attested' | 'proof-generated';

export interface ProofStatus {
  phase: ProofPhase;
  blockNumber?: number;
  latestAttested?: number;
}

/**
 * Waits for a source-chain transaction to be attested on Creditcoin, then asks the
 * Proof Builder service for the Merkle inclusion proof + continuity proof. This is the
 * "Generate proofs" step of the Attestcoin readability flow.
 *
 * `onStatus` reports each stage so callers can emit structured telemetry.
 */
export async function generateProofFor(
  txHash: string,
  chainKey: number,
  proofBuilderUrl: string,
  creditcoinRpc: JsonRpcApiProvider,
  sourceChainRpc: JsonRpcApiProvider,
  onStatus?: (status: ProofStatus) => void,
): Promise<proofProvider.ProofResult> {
  log('PROOF', 'waiting for source tx to be mined', { tx: txHash.slice(0, 12) });
  const receipt = await sourceChainRpc.waitForTransaction(txHash, 1, 120_000);
  if (!receipt || receipt.blockNumber == null) {
    throw new Error(`Transaction ${txHash} is not yet mined on the source chain`);
  }
  const blockNumber = receipt.blockNumber;
  log('PROOF', 'source tx mined', { tx: txHash.slice(0, 12), block: blockNumber });
  onStatus?.({ phase: 'mined', blockNumber });

  const proofBuilder = new proofProvider.service.ProofBuilder(chainKey, proofBuilderUrl);
  const info = new chainInfo.PrecompileChainInfoProvider(creditcoinRpc);

  let latest = await info.getLatestAttestedHeightAndHash(chainKey);
  log('ATTEST', 'waiting for attestation', {
    chainKey,
    targetBlock: blockNumber,
    latestAttested: latest.height,
  });

  const started = Date.now();
  while (latest.height < blockNumber) {
    onStatus?.({ phase: 'attesting', blockNumber, latestAttested: latest.height });
    if (Date.now() - started > 20 * 60_000) throw new Error('Timed out waiting for attestation');
    await sleep(15_000);
    latest = await info.getLatestAttestedHeightAndHash(chainKey);
  }

  log('ATTEST', 'block attested', { block: blockNumber, latestAttested: latest.height });
  onStatus?.({ phase: 'attested', blockNumber, latestAttested: latest.height });

  const proof = await proofBuilder.getProof(txHash);
  log('PROOF', 'proof generated', { tx: txHash.slice(0, 12), block: blockNumber });
  onStatus?.({ phase: 'proof-generated', blockNumber, latestAttested: latest.height });
  return proof;
}

/**
 * Submits a generated proof to an ASC via its `execute(action, ...)` entrypoint.
 * The precompile verifies the proof synchronously; ASCBase dedupes by queryId.
 */
export async function submitProofToASC(
  contract: Contract,
  action: number,
  proofData: proofProvider.ContinuityResponse,
  gasLimit?: bigint,
): Promise<any> {
  const params = [
    action,
    proofData.chainKey,
    proofData.headerNumber,
    proofData.txBytes,
    proofData.merkleProof.root,
    proofData.merkleProof.siblings,
    proofData.continuityProof.lowerEndpointDigest,
    proofData.continuityProof.roots,
  ];

  if (!gasLimit) gasLimit = await estimateExecuteGas(contract, params);
  log('SUBMIT', 'calling ASC.execute', {
    action,
    chainKey: proofData.chainKey,
    height: proofData.headerNumber,
    continuityRoots: proofData.continuityProof.roots?.length ?? 0,
  });
  return contract.execute(...params, { gasLimit });
}

async function estimateExecuteGas(contract: Contract, params: unknown[]): Promise<bigint> {
  const provider = contract.runner?.provider as JsonRpcApiProvider | undefined;
  const from = await (contract.runner as any)?.getAddress?.();
  const data = contract.interface.encodeFunctionData('execute', params as any[]);
  try {
    const estimated = await provider!.estimateGas({ to: await contract.getAddress(), data, from });
    return (estimated * 135n) / 100n;
  } catch {
    const continuity = (params[7] as string[])?.length ?? 1;
    return BigInt(21000 + continuity * 5000 + 20000);
  }
}
