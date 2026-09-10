import { Contract, JsonRpcApiProvider } from 'ethers';
import { proofProvider, chainInfo } from '@gluwa/usc-sdk';

/**
 * Waits for a source-chain transaction to be attested on Creditcoin, then asks the
 * Proof Builder service for the Merkle inclusion proof + continuity proof. This is the
 * "Generate proofs" step of the Attestcoin readability flow.
 */
export async function generateProofFor(
  txHash: string,
  chainKey: number,
  proofBuilderUrl: string,
  creditcoinRpc: JsonRpcApiProvider,
  sourceChainRpc: JsonRpcApiProvider,
): Promise<proofProvider.ProofResult> {
  console.log(`Waiting for ${txHash} to be mined on the source chain...`);
  const receipt = await sourceChainRpc.waitForTransaction(txHash, 1, 120_000);
  if (!receipt || receipt.blockNumber == null) {
    throw new Error(`Transaction ${txHash} is not yet mined on the source chain`);
  }
  const blockNumber = receipt.blockNumber;
  console.log(`Transaction ${txHash} found in source block ${blockNumber}`);

  const proofBuilder = new proofProvider.service.ProofBuilder(chainKey, proofBuilderUrl);
  const info = new chainInfo.PrecompileChainInfoProvider(creditcoinRpc);

  const latest = await info.getLatestAttestedHeightAndHash(chainKey);
  console.log(`Latest attested height for chainKey ${chainKey}: ${latest.height}`);
  console.log('Waiting for attestation (this takes a few minutes)...');

  await proofBuilder.waitUntilHeightAttested(chainKey, blockNumber, 15_000, 1_200_000);
  console.log(`Block ${blockNumber} attested! Generating proof...`);

  const proof = await proofBuilder.getProof(txHash);
  console.log('Proof generated.');
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

  if (!gasLimit) {
    gasLimit = await estimateExecuteGas(contract, params);
  }

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
    // Gas estimation over precompiles can fail; fall back to a proof-size estimate.
    const continuity = (params[7] as string[])?.length ?? 1;
    return BigInt(21000 + continuity * 5000 + 20000);
  }
}
