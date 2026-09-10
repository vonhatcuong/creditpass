import fs from 'node:fs';
import path from 'node:path';
import { Contract, ContractFactory, JsonRpcProvider, Wallet } from 'ethers';
import { ROOT_DIR } from './env';

interface Artifact {
  abi: any[];
  bytecode: { object: string };
}

/** Loads a compiled Foundry artifact (abi + bytecode) from the `out/` directory. */
export function loadArtifact(contractName: string): Artifact {
  const file = path.join(ROOT_DIR, 'out', `${contractName}.sol`, `${contractName}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Artifact not found: ${file}. Run "forge build" first.`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Artifact;
}

export function provider(rpcUrl: string): JsonRpcProvider {
  return new JsonRpcProvider(rpcUrl);
}

export function wallet(privateKey: string, rpcUrl: string): Wallet {
  return new Wallet(privateKey, provider(rpcUrl));
}

export async function deploy(
  contractName: string,
  signer: Wallet,
  args: unknown[] = [],
): Promise<Contract> {
  const artifact = loadArtifact(contractName);
  const factory = new ContractFactory(artifact.abi, artifact.bytecode.object, signer);
  const contract = await factory.deploy(...(args as any[]));
  await contract.waitForDeployment();
  return contract as unknown as Contract;
}

export function attach(contractName: string, address: string, signerOrProvider: any): Contract {
  const artifact = loadArtifact(contractName);
  return new Contract(address, artifact.abi, signerOrProvider);
}
